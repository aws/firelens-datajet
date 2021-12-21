import { IBuiltStage, IBuiltStageWrapper, IPipelineConfig, IStage } from "./pipeline-types.js";
import generatorTemplates from "../generators/generator-index.js"
import datajetTemplates from "../datajets/datajet-index.js"
import { buildStage, synchronizer } from "./pipeline.js";
import { error } from "console";

export interface IPipelineSchema {
    component?: string,
    config?: any,
    children?: any[],
    child?: any,

    generator: any,
    datajet: any,
    stage: any, /* remove and replace with config */
};

enum IComponentName {
    Stage = "stage", /* default */
    Synchronizer = "synchronizer",
    Validator = "validator",
}

export const buildPipeline = (buildSchema: IPipelineSchema) : IBuiltStage => {
    if (!buildSchema.component || buildSchema.component === IComponentName.Stage) {
        return buildPipelineStage(buildSchema);
    }
    else if (buildSchema.component === IComponentName.Synchronizer) {
        return buildPipelineSynchronizer(buildSchema);
    }
    else if (buildSchema.component === IComponentName.Validator) {
        return buildPipelineValidator(buildSchema);
    }
    throw error("Unsupported pipeline component in schema: ", buildSchema.component);
}

function buildPipelineStage(buildSchema: IPipelineSchema) : IBuiltStage {
    const findGeneratorByName = (name: string) => generatorTemplates
        .find((generatorTemplate => generatorTemplate.name === buildSchema.generator.name));

    const findDatajetByName = (name: string) => datajetTemplates
        .find((datajetTemplate => datajetTemplate.name === buildSchema.datajet.name));

    const stage = {
        generator: findGeneratorByName(buildSchema.generator.name)
            .createConfiguredGenerator({
                ...findGeneratorByName(buildSchema.generator.name).defaultConfig,
                ...buildSchema.generator.config ?? {},
            }),
        datajet: findDatajetByName(buildSchema.datajet.name)
            .createConfiguredDatajet({
                ...findDatajetByName(buildSchema.datajet.name).defaultConfig,
                ...buildSchema.datajet.config ?? {},
            }),
        config: buildSchema.stage,
    }

    return buildStage(stage);
}

function buildPipelineSynchronizer(buildSchema: IPipelineSchema) : IBuiltStage {
    const builtStages: Array<IBuiltStage> = (buildSchema.children ?? [])
    .map(childSchema => {
        return buildPipeline(childSchema);
    });
    return synchronizer({
        stages: builtStages,
        config: buildSchema.config
    });
}

function buildPipelineValidator(buildSchema: IPipelineSchema) : IBuiltStage {
    throw error("Validator pipeline builder not implemented.");
}
