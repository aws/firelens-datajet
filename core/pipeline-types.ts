
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {IConfiguredDatajet, IConfiguredGenerator, IDatajet} from "./ext-types.js";

export interface IBuiltStageWrapper {
    setup: (root: IBuiltStage, subtree: IBuiltStage) => Promise<boolean>,
    validation: (root: IBuiltStage, subtree: IBuiltStage) => Promise<IValidationResult>,
    breakdown: (root: IBuiltStage, subtree: IBuiltStage) => Promise<boolean>,
    isValidationAsync?: boolean, /* defaults to false, ie synchronous validation */
}

/* These configurations must all have default values */
export interface IExecutePipelineConfig {
    validationFailureAction?: "terminate" | "ignore",
    executionFailureAction?: "terminate" | "ignore",
    onValidationFailure?: () => Promise<void>,
    onExecutionFailure?: () => Promise<void>,
}

/* Should be immutable at the point of execution */
export interface IPipelineConfig {
    readonly rootBuiltStage: IBuiltStage,
    readonly validationFailureAction: "terminate" | "ignore",
    readonly executionFailureAction: "terminate" | "ignore",
    readonly onValidationFailure: () => Promise<void>,
    readonly onExecutionFailure: () => Promise<void>,
}

/* Context of pipeline */
export interface IPipelineContext {
    isValidationSuccess: boolean,
    isExecutionSuccess: boolean, /* Error on execution */
}

/*
 * Context of execution
 * Note: Immutable from the perspective of the child durring setup and execution.
 *       May change between child configuration and child setup/execution.
 *       Modified by wrapper before child execution is called.
 * Note 2: May change between various invocations of the same pipeline builtStage.
 */
export interface IExecutionContext {
    managedVariables: {[key: string]: any}
    setManagedVariable: (key: string, value: any) => void,
}

export interface IValidationResult {
    isValidationSuccess: boolean,

    // Other data can be added here for validation metric collection.
    validationData?: any,
}

export interface IExecutionResult {
    builtStage: IBuiltStage,
    isValidationSuccess: boolean,
    isExecutionSuccess: boolean,
    validationResult?: IValidationResult,
    pendingValidators: Array<Promise<IValidationResult>>, /* Contains all children validators which have yet to complete evaluation */

    children: Array<IExecutionResult>,
}

export interface IStageConfig {
    batchRate: number,      /* batches per second */
    maxBatches?: number,    /* optional, if specify only fwd up to maxBatch batches to the datajet */
    maxSeconds?: number,       /* optional, this actually sets max time in seconds, batches may not be batchRate * maxBatches */
}

export interface IStage {
    generator: IConfiguredGenerator,
    datajet: IConfiguredDatajet,
    config: IStageConfig,
}

export interface ISynchronizerConfig {
    repeat?: number, /* repeats the full stage, including the before and after wait */
    waitBefore: number, /* seconds */
    waitAfter: number,
    waitBetween: number, /* not used if async */

    awaitAsyncValidators?: boolean, /* await all children validators that are async, default false */

    // only sync supported now.
    isAsync: boolean,
}

export interface IBuiltStage {
    executeStage: (pipelineConfig: IPipelineConfig,
                   pipelineContext: IPipelineContext,
                   executionContext: IExecutionContext) => Promise<IExecutionResult>,
    children: Array<IBuiltStage>,
    type: "stage" | "synchronizer" | "wrapper" | "generator",
    data?: any,

    /* 
     * Stage data:
     * leaf nodes have the whole stage stored
     * synchronizer has just the synchronizer config
     */
    stageLeaf?: IStage,
    synchronizerConfig?: ISynchronizerConfig,
    wrapperConfig?: any,
    stageWrapper?: IBuiltStageWrapper,
    component?: string,
}
