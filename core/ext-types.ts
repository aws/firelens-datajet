import winston from "winston";
import { IBuiltStageWrapper, IExecutionResult } from "./pipeline-types.js";

/* Command definition */
export interface ICommand {
    pipelineConfiguration: any,
    handleExecutionResult: (executionResult: IExecutionResult) => Promise<void>,
}

export interface IComponentDependencies {
    logger: winston.Logger,
    dataRoot: string,
    workspaceRoot: string,
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
    makeInstance: () => AsyncGenerator<any[]>, /* Instantiates a new configured generator */
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
