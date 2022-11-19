
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IConfiguredGenerator, ILogData, IWrapper } from "../../core/ext-types"
import { IBuiltStage } from "../../core/pipeline-types";

import { difer, hash } from "../../core/utils.js";

/*
 * Compares the contents of two generators
 * 1.) Datajet Generator Source
 * 2.) Validation Generator Source
 */

interface IComparatorWrapperConfig {
    validationGraceTimeout: number,  /* validation period ends after this many seconds no matter what */
    validationIdleTimeout: number, /* validation ends if no new validation logs are recieved in this time */
    stageGeneratorRef: string,
    validationGeneratorRef: string,
    stageGeneratorLogCount: number, /* null means implied to be equal to validation log count */
    isValidatingWhileExecuting: boolean,
}

const defaultConfig: IComparatorWrapperConfig = {
    validationGraceTimeout: 20, /* seconds */
    validationIdleTimeout: 5, /* seconds */
    stageGeneratorRef: null,
    validationGeneratorRef: null,
    stageGeneratorLogCount: null,
    isValidatingWhileExecuting: false,
}

interface IComparatorWrapperMetrics {
    testDuration: number, /* seconds */
    validationLogTotalCount: number,
    duplicate: number,
    loss: number,
    
    validationGraceDuration: number, /* seconds after validation starts for all logs to be recieved */
    validationGraceAndMetricsDuration: number,
    isValidationCompleted: boolean,
}

const comparatorWrapper: IWrapper = {
    name: "comparator-validator",
    defaultConfig: defaultConfig,
    modifySubschema: (subschema)=>subschema,
    createConfiguredWrapper: function (config: IComparatorWrapperConfig, {
        logger,
        library,
    }) {
        let testStartTime: number;
        let validationLogTotalCount: number = 0;
        let validationLogHashCounts: {[key: string]: number} = {};
        let stageLogHashCounts: {[key: string]: number} = {};

        let ingestionValidationLoop: Promise<boolean>;
        let ingestionLatestTime: number;

        const stageGenerator = library[config.stageGeneratorRef].data as IConfiguredGenerator;
        const validationGenerator = library[config.validationGeneratorRef].data as IConfiguredGenerator;
        const stageGeneratorInstance = stageGenerator.makeInstance();
        const validationGeneratorInstance = validationGenerator.makeInstance();

        let abortHandlers: Array<{ abort: () => void }> = [];

        const removeAbortHandler = (handlerToRemove) => {
            abortHandlers = abortHandlers.filter(handler => handler !== handlerToRemove);
        }

        const addAbortHandler = (resolve: (any) => void) => {
            const abortHandler = {
                abort: function(){
                    removeAbortHandler(this);
                    resolve(null);
                }
            };
            abortHandlers.push(abortHandler);
            return abortHandler;
        }

        const waitForAbortGeneratorNextSignal = () => {
            return new Promise(async (resolve, reject) => {
                addAbortHandler(resolve);
            });
        }

        const signalAbortGeneratorNext = () => {
            abortHandlers.forEach((handler) => {
                handler.abort();
            });
        }

        const signalMoveToTimeoutIngestion = () => {
            logger.debug("ingestion signalled. move to grace phase of ingestion")
            signalAbortGeneratorNext();
        }

        /* potentially overly complex. Only need one handler */
        const getSignallableGeneratorNext = (): Promise<IteratorResult<ILogData[], any> | null> => {
            return new Promise(async (resolve, reject) => {
                const abortHandler = addAbortHandler(resolve);
                const result = await difer(() => validationGeneratorInstance.next());
                removeAbortHandler(abortHandler);
                resolve(result);
            })
        }

        const getTimeoutGeneratorNext = (): Promise<IteratorResult<ILogData[], any> | null> => {
            return new Promise(async (resolve, reject) => {
                const myTimeout = setTimeout(() => {
                    resolve(null)
                }, config.validationIdleTimeout * 1000);
                const result = await difer(() => validationGeneratorInstance.next()); /* don't hog cpu */
                clearTimeout(myTimeout);
                resolve(result);
            });
        }

        const ingestValidationLogBatch = (logs: ILogData[]) => {
            logs.forEach((log) => {
                /* ingest validation log */
                validationLogTotalCount++;
                validationLogHashCounts[hash(log)] = (validationLogHashCounts[hash(log)] ?? 0) + 1;
                ingestionLatestTime = Date.now();
            });
        }

        const ingestStageLogBatch = (logs: ILogData[]) => {
            logs.forEach((log) => {
                /* ingest stage log */
                stageLogHashCounts[hash(log)] = (stageLogHashCounts[hash(log)] ?? 0) + 1;
            });
        }

        const ingestValidationLogBatches = async () => {
            logger.debug("ingesting validation logs");

            let isSignalled = false;
            let result: IteratorResult<ILogData[], any>;

            /* validate while executing child */
            if (config.isValidatingWhileExecuting) {
                result = await getSignallableGeneratorNext();
                isSignalled = result === null;
                while (!isSignalled && !result.done) { /* null counts as complete */
                    /* ingest validation log */
                    ingestValidationLogBatch(result.value);
                    result = await getSignallableGeneratorNext();
                    isSignalled = result === null;
                }

                /* nothing left to validate */
                if (result.done) {
                    return true;
                }
            }

            /* otherwise wait for signal to start validating */
            else {
                await waitForAbortGeneratorNextSignal();
            }

            /* move to ingestion with grace phase */
            logger.debug("ingesting validation logs: grace phase");

            /* grace timeout for rapid yielding */
            let isGraceTimedOut = false;
            const graceTimer = setTimeout(() => isGraceTimedOut = true, config.validationGraceTimeout * 1000);

            result = await getTimeoutGeneratorNext();
            let isIdleTimedout = result === null;
            while (!isGraceTimedOut && !isIdleTimedout && result.done === false) { /* null counts as complete */
                /* ingest validation log */
                ingestValidationLogBatch(result.value);
                result = await getTimeoutGeneratorNext();
                isIdleTimedout = result === null;
            }
            clearTimeout(graceTimer);

            /* 
             * return true:  Idle timeout means that validation completed.
             * return false: Grace timeout means our validation time is up.
             */
            if (isGraceTimedOut) {
                return false;
            }
            return true;
        
        }

        const ingestionCompleteOrTimeout = async () => { /* return true if completed, false if timeout */
            return new Promise(async (resolve, reject) => {
                /*
                 * grace timeout for slow yielding, ingestionValidation loop has its
                 * own timeout to help with cleaning up the closure
                 */
                setTimeout(() => resolve(false), config.validationGraceTimeout * 1000);
                const isComplete = await ingestionValidationLoop;
                resolve(isComplete);
            });
        }

        return {
            wrapperTemplate: this,
    
            setup: async (root: IBuiltStage, subtree: IBuiltStage) => {

                /* validation ingestion loop */
                ingestionValidationLoop = ingestValidationLogBatches(); /* signallable */
                testStartTime = Date.now();

                return true;
            },
        
            validation: async (root: IBuiltStage, subtree: IBuiltStage) => {

                /* signal ingestion to move to timeout phase */
                signalMoveToTimeoutIngestion();
                
                /* wait for grace timeout phase */
                const graceStartTime = Date.now();
                const validationCompleted = await ingestionCompleteOrTimeout();
                const validationGraceDuration = ingestionLatestTime - graceStartTime;

                /* ingest source generator logs */
                const stageGeneratorLogCount = config.stageGeneratorLogCount ?? validationLogTotalCount;
                for (let i = 0; i < stageGeneratorLogCount; ++i) {
                    const stageLog = await stageGeneratorInstance.next();
                    if (stageLog.value ===  null) {
                        break;
                    }
                    ingestStageLogBatch(stageLog.value);
                    if (stageLog.done) {
                        break;
                    }
                }

                /* verify logs in both + only_stage_log */
                let duplicate = 0;
                let loss = 0;
                for (const myHash in stageLogHashCounts) {
                    const stageCount = stageLogHashCounts[myHash] ?? 0;
                    const validationCount = validationLogHashCounts[myHash] ?? 0;

                    if (stageCount > validationCount) {
                        loss += stageCount - validationCount;
                    }
                    if (validationCount > stageCount) {
                        duplicate += validationCount - stageCount;
                    }
                }

                /* verify logs in only_validation_count */
                for (const myHash in validationLogHashCounts) {
                    if (stageLogHashCounts.hasOwnProperty(myHash)) {
                        /* In stageHashCounts */
                        continue;
                    }
                    const validationCount = validationLogHashCounts[myHash] ?? 0;
                    duplicate += validationCount;
                }

                /* additional metrics */
                const testDuration = Date.now() - testStartTime;
                const validationGraceAndMetricsDuration = Date.now() - graceStartTime;

                return {
                    isValidationSuccess: true,
                    // Other data can be added here for validation metric collection.
                    validationData: {
                        testDuration: testDuration,
                        validationLogTotalCount: validationLogTotalCount,
                        duplicate: duplicate,
                        loss: loss,
                        
                        validationGraceDuration: validationGraceDuration,
                        validationGraceAndMetricsDuration: validationGraceAndMetricsDuration,
                        isValidationCompleted: validationCompleted,
                    } as IComparatorWrapperMetrics,
                    /* May want to add hidden validation data */
                };
            },
        
            breakdown: async (root: IBuiltStage, subtree: IBuiltStage) => {
                /* clear memory */
                stageLogHashCounts = {};
                validationLogHashCounts = {};
                return true;
            },
        
            isValidationAsync: false,
        };
    }
}

export default comparatorWrapper;
