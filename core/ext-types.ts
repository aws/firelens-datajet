import { IBuiltStageWrapper } from "./pipeline-types.js";

/* Datajet definition */
export interface IDatajet {
    name: string,
    defaultConfig: any,
    createConfiguredDatajet: (config: any) => IConfiguredDatajet,
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
    createConfiguredGenerator: (config: any) => IConfiguredGenerator /* returns a generator */
}

/* Immutably configured generator */
export interface IConfiguredGenerator {
    generatorTemplate: IBatchGenerator,
    makeInstance: () => AsyncGenerator<any[]>, /* Instantiates a new configured generator */
}

export interface IConfiguredValidator extends IBuiltStageWrapper {
    name: string,
}

export interface ILogData {
    text: string,
    timestamp?: Date,
    metadata?: any,
    stream?: "stdout" | "stderr",
}
