
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import winston from "winston";
import { IBuiltStageWrapper, IExecutionResult, IValidationResult } from "./pipeline-types.js";

/* re-exports */
import { IComponentDependencies } from '../core/component-dependencies';
export { IComponentDependencies };

/* Command definition */
export interface ICommand {
    pipelineConfiguration: any,
    handleExecutionResult: (executionResult: IExecutionResult) => Promise<void>,
}

export interface IAsyncCommandChain {
    command: ICommand | null,
    next: Promise<IAsyncCommandChain>,
    resolveNext: (IAsyncCommandChain) => void;
}

export type ICommandGenerator = AsyncGenerator<ICommand | null>;

/* Client definition */
export interface IClient {
    name: string,
    makeCommandGenerator: () => ICommandGenerator
}

export interface IDatajetConfig {
    name: string,
    config: any,
}

export interface IGeneratorConfig {
    name: string,
    config: any,
}

/* Datajet definition */
export interface IDatajet {
    name: string,
    defaultConfig: any,
    createConfiguredDatajet: (config: any, dependencies?: IComponentDependencies) => IConfiguredDatajet,
}

/* Immutably configured datajet */
export interface IConfiguredDatajet {
    datajetTemplate: IDatajet,
    transmitBatch: ((batch: Array<any>) => Promise<boolean>),
}

/* Batch generator definition */
export interface IBatchGenerator {
    name: string,
    defaultConfig: any,
    createConfiguredGenerator: (config: any, dependencies?: IComponentDependencies) => IConfiguredGenerator /* returns a generator */
}

/* Immutably configured generator */
export interface IConfiguredGenerator {
    generatorTemplate: IBatchGenerator,
    makeInstance: () => AsyncGenerator<ILogData[]>, /* Instantiates a new configured generator */
    validateInstances?: () => Promise<IValidationResult>, /* Returns true if valid */
}

export interface IWrapper {
    name: string,
    defaultConfig: any,
    createConfiguredWrapper: (config: any, dependencies?: IComponentDependencies) => IConfiguredWrapper,
}

export interface IConfiguredWrapper extends IBuiltStageWrapper {
    wrapperTemplate: IWrapper,
}

export interface ILogData {
    text: string,
    timestamp?: Date,
    metadata?: any,
    stream?: "stdout" | "stderr",
}
