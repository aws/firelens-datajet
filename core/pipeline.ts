
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IConfiguredWrapper, IWrapper } from "./ext-types.js";
import pipelineConfigDefaults from "./pipeline-defaults.js";
import {
    IBuiltStage,
    IExecutePipelineConfig,
    IExecutionContext,
    IExecutionResult,
    IPipelineConfig,
    IPipelineContext,
    IStage,
    ISynchronizerConfig,
    IValidationResult
} from "./pipeline-types.js"

export const buildStage = (stage: IStage) : IBuiltStage => {
    const executeStage = async function (pipelineConfig: IPipelineConfig, pipelineContext: IPipelineContext, executionContext: IExecutionContext) {

        const executionResult: IExecutionResult = {
            builtStage: this,
            isValidationSuccess: true,
            isExecutionSuccess: true,
            pendingValidators: [],
            children: [],
        }

        const generator = stage.generator.makeInstance();

        const millisecondsPerBatch = 1000 / stage.config.batchRate;
        let startTime = Date.now();
        let batchIndex = 0;
        for await (const batch of generator) {
            if (batchIndex === stage.config.maxBatches) {
                break;
            }
            
            const execSuccess = await stage.datajet.transmitBatch(batch)
            executionResult.isExecutionSuccess &&= execSuccess;
            pipelineContext.isExecutionSuccess &&= execSuccess;

            const deltaTime = Date.now() - startTime;
            const remainingTime = millisecondsPerBatch - deltaTime;
            await delay(remainingTime);
            ++batchIndex;
            startTime = Date.now();
        }

        return executionResult;
    };
    
    const builtStage: IBuiltStage = {
        executeStage: executeStage,
        children: [],
        stageLeaf: stage,
        type: "stage",
    };

    // Bind execute stage
    builtStage.executeStage = builtStage.executeStage.bind(builtStage);

    return builtStage;
}

export const synchronizer = ({stages, config} : {stages: Array<IBuiltStage>, config: ISynchronizerConfig}) : IBuiltStage => {

    const executeStage = async function (pipelineConfig: IPipelineConfig, pipelineContext: IPipelineContext, executionContext: IExecutionContext) {

        const executionResult: IExecutionResult = {
            builtStage: this,
            isValidationSuccess: true,
            isExecutionSuccess: true,
            pendingValidators: [],
            children: [],
        }

        const pendingValidators: Array<Promise<IValidationResult>> = [];

        // process the pending validators according to synchronizer's configuration
        const processPendingValidators = async () => {

            // wait for async validators to complete (along with breakdown)
            if (config.awaitAsyncValidators) {
                // await all pending validators
                await Promise.all(pendingValidators);
            }

            // punt async validators to parent
            else {
                executionResult.pendingValidators = pendingValidators;
            }
        }

        for (let r = 0; r < config.repeat; ++r) {
            await delay(config.waitBefore * 1000);
            let executionResults: Array<IExecutionResult> = [];

            // execute children asynchronously
            if (config.isAsync) {
                executionResults = await Promise.all(
                    stages.map(stage => stage.executeStage(pipelineConfig, pipelineContext, executionContext))
                );

                // summarize execution
                executionResult.isValidationSuccess &&=
                    executionResults.every(result => result.isValidationSuccess);
                executionResult.isExecutionSuccess &&=
                    executionResults.every(result => result.isExecutionSuccess);
            }

            // execute children synchronously
            else {
                for (let i = 0; i < stages.length; ++i) {
                    executionResults.push(await stages[i].executeStage(pipelineConfig, pipelineContext, executionContext));
                    const execSuccess = executionResults[executionResults.length-1].isExecutionSuccess !== false;
                    const valiSuccess = executionResults[executionResults.length-1].isValidationSuccess !== false;
                    pipelineContext.isExecutionSuccess &&= execSuccess;   /* toggle global success flags */
                    pipelineContext.isValidationSuccess &&= valiSuccess;
                    executionResult.isExecutionSuccess &&= execSuccess;   /* toggle local success flags */
                    executionResult.isValidationSuccess &&= valiSuccess;

                    let earlyReturn = !execSuccess && pipelineConfig.executionFailureAction === "terminate";
                    earlyReturn &&= !valiSuccess && pipelineConfig.validationFailureAction === "terminate";
                    if (earlyReturn) {
                        break;
                    }

                    if (i !== stages.length - 1) {
                        await delay(config.waitBetween);
                    }
                }
            }

            // collect pending validators & execution results
            executionResult.pendingValidators.push(...executionResults.flatMap(results => results.pendingValidators));
            executionResult.children.push(...executionResults); /* repeats will have a node fan out. [a, b, a, b, ...] */
                                                                /* we may run out of memory for canary tests. add new option to not save results */

            let earlyReturn = !executionResult.isExecutionSuccess && pipelineConfig.executionFailureAction === "terminate";
            earlyReturn &&= !executionResult.isValidationSuccess && pipelineConfig.validationFailureAction === "terminate";
            if (earlyReturn) {
                break;
            }

            await delay(config.waitAfter * 1000);
        }

        // process validators and return result
        await processPendingValidators();
        return executionResult;
    };

    const builtStage: IBuiltStage = {
        executeStage: executeStage,
        children: stages,
        synchronizerConfig: config,
        type: "synchronizer",
    };

    // Bind execute stage
    builtStage.executeStage = builtStage.executeStage.bind(builtStage);

    return builtStage;
}

export const wrapWith = (wrapperConstructor: (executionContext: IExecutionContext, wrapperTemplate: IWrapper, wrapperConfig: any) => IConfiguredWrapper,
                         wrapperTemplate: IWrapper,
                         wrapperConfig: any,
                         builtChild: IBuiltStage) => {

    const executeStage = async function (pipelineConfig: IPipelineConfig, pipelineContext: IPipelineContext, executionContext: IExecutionContext) {

        const executionResult: IExecutionResult = {
            builtStage: this,
            isValidationSuccess: true,
            isExecutionSuccess: true,
            pendingValidators: [],
            children: [],
        }

        // configure managed variables isolated from parent variables
        let isManagedVariablesMutable = true;
        const deepCopiedManagedVariables = JSON.parse(JSON.stringify(executionContext.managedVariables));
        const setManagedVariable = (key: string, value: any) => {
            if (isManagedVariablesMutable) {
                deepCopiedManagedVariables[key] = value;
            }
            else {
                throw "Attempting to set managed variables after setup. Managed variables are immutable at this point."
            }
        }
        const isolatedExecutionContext: IExecutionContext = {
            ...executionContext,
            managedVariables: deepCopiedManagedVariables,
            setManagedVariable: setManagedVariable
        }

        // construct wrapper
        const wrapper = wrapperConstructor(isolatedExecutionContext, wrapperTemplate, wrapperConfig);

        // setup
        executionResult.isExecutionSuccess &&=
            await wrapper.setup(pipelineConfig.rootBuiltStage, builtChild);

        // freeze managedVariables
        isManagedVariablesMutable = false;
        
        // execute
        const childExecutionResult =
            await builtChild.executeStage(pipelineConfig, pipelineContext, isolatedExecutionContext);
        executionResult.children = [childExecutionResult];
        executionResult.pendingValidators = childExecutionResult?.pendingValidators; /* punt all child validators to parent */
        executionResult.isExecutionSuccess &&= childExecutionResult.isExecutionSuccess;
        executionResult.isValidationSuccess &&= childExecutionResult.isValidationSuccess;

        // validate + teardown
        const validate = wrapper.validation(pipelineConfig.rootBuiltStage, builtChild)
            .then(async result => {
                executionResult.validationResult = result;
                executionResult.isValidationSuccess &&= result.isValidationSuccess;
                pipelineContext.isValidationSuccess &&= result.isValidationSuccess;

                // teardown
                executionResult.isExecutionSuccess &&=
                    await wrapper.breakdown(pipelineConfig.rootBuiltStage, builtChild);
                pipelineContext.isExecutionSuccess &&= executionResult.isExecutionSuccess;

                return result;
            });
        
        if (wrapper?.isValidationAsync ?? false) {
            executionResult.pendingValidators.push(validate);
        }
        else {
            await validate;
        }
        
        // propagate false flags
        pipelineContext.isExecutionSuccess &&= executionResult.isExecutionSuccess;
        pipelineContext.isValidationSuccess &&= executionResult.isValidationSuccess;

        return executionResult;
    };

    const outBuiltStage: IBuiltStage = {
        executeStage: executeStage,
        children: [builtChild],
        wrapperConfig: wrapperConfig,
        type: "wrapper",
        component: wrapperTemplate.name,
    }

    // Bind execute stage
    outBuiltStage.executeStage = outBuiltStage.executeStage.bind(outBuiltStage);
    return outBuiltStage;
}

/* 
 * Pipeline may be deep-freezed to ensure that executePipeline
 * maintains it's immutability property
 */
export const deepFreezePipeline = (pipelineRoot: Object) => {
  // Retrieve the property names defined on object
  const propNames = Object.getOwnPropertyNames(pipelineRoot);

  // Freeze properties before freezing self
  for (const name of propNames) {
    const value = pipelineRoot[name];

    if (value && typeof value === "object") {
        deepFreezePipeline(value);
    }
  }

  return Object.freeze(pipelineRoot);
}

export const executePipeline = async (pipelineRoot: IBuiltStage, executePipelineConfig: IExecutePipelineConfig) => {

    const pipelineConfig: IPipelineConfig = {
        rootBuiltStage: pipelineRoot,
        ...pipelineConfigDefaults,
        ...executePipelineConfig,
    }

    const startTime = Date.now();
    console.log (`Executing pipeline`);
    const pipelineContext: IPipelineContext = {
        isValidationSuccess: true,
        isExecutionSuccess: true,
    }
    const executionContext: IExecutionContext = {
        managedVariables: {},
        setManagedVariable: (key: string, value: any) => {}
    }
    const executionResult: IExecutionResult = await pipelineRoot.executeStage(pipelineConfig, pipelineContext, executionContext);
    await Promise.all(executionResult.pendingValidators); /* evaluate pending validators */

    // console.log(`Execution results: ${JSON.stringify(executionResult, null, 2)}`);
    console.log(`Elapsed time: ${(Date.now() - startTime) / 1000} seconds`);
    console.log(`Execution results:`);
    console.log("Execution success: ", pipelineContext.isExecutionSuccess);
    console.log("Validation success: ", pipelineContext.isValidationSuccess);
    console.log("Executed pipeline.");

    return executionResult;
}

function delay(milliseconds: number) : Promise<null> {
    return new Promise(resolve => {
        setTimeout(() => { resolve(null) }, milliseconds);
    })
}
