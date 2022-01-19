import { IBuiltStage, IBuiltStageWrapper, IPipelineConfig, IStage } from "./pipeline-types.js";
import generatorTemplates from "../generators/generator-index.js"
import wrapperTemplates from "../wrappers/wrapper-index.js"
import datajetTemplates from "../datajets/datajet-index.js"
import { buildStage, synchronizer, wrapWith } from "./pipeline.js";
import { error } from "console";
import { IComponentDependencies, IConfiguredWrapper, IWrapper } from "./ext-types.js";
import winston from "winston";
import { initDependencies } from "./component-dependencies.js";

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
    Wrap = "wrap",
}

export function buildPipeline(buildSchema: IPipelineSchema, componentDependencies?: IComponentDependencies) : IBuiltStage {
    if (arguments.length === 1) {
        return buildPipeline(buildSchema, initDependencies());
    }
    if (!buildSchema.component || buildSchema.component === IComponentName.Stage) {
        return buildPipelineStage(buildSchema, componentDependencies);
    }
    else if (buildSchema.component === IComponentName.Synchronizer) {
        return buildPipelineSynchronizer(buildSchema, componentDependencies);
    }
    else if (buildSchema.component === IComponentName.Wrap) {
        return buildPipelineWrap(buildSchema, componentDependencies);
    }
    throw error("Unsupported pipeline component in schema: ", buildSchema.component);
}

function buildPipelineStage(buildSchema: IPipelineSchema, componentDependencies: IComponentDependencies) : IBuiltStage {
    const findGeneratorByName = (name: string) => generatorTemplates
        .find((generatorTemplate => generatorTemplate.name === buildSchema.generator.name));

    const findDatajetByName = (name: string) => datajetTemplates
        .find((datajetTemplate => datajetTemplate.name === buildSchema.datajet.name));

    const stage = {
        generator: findGeneratorByName(buildSchema.generator.name)
            .createConfiguredGenerator({
                ...findGeneratorByName(buildSchema.generator.name).defaultConfig,
                ...buildSchema.generator.config ?? {},
            }, componentDependencies),
        datajet: findDatajetByName(buildSchema.datajet.name)
            .createConfiguredDatajet({
                ...findDatajetByName(buildSchema.datajet.name).defaultConfig,
                ...buildSchema.datajet.config ?? {},
            }, componentDependencies),
        config: buildSchema.stage,
    }

    return buildStage(stage);
}

function buildPipelineSynchronizer(buildSchema: IPipelineSchema, componentDependencies: IComponentDependencies) : IBuiltStage {
    const builtStages: Array<IBuiltStage> = (buildSchema.children ?? [])
    .map(childSchema => {
        return buildPipeline(childSchema, componentDependencies);
    });
    return synchronizer({
        stages: builtStages,
        config: buildSchema.config
    });
}

function buildPipelineWrap(buildSchema: IPipelineSchema, componentDependencies: IComponentDependencies) : IBuiltStage {
    const builtWrapper = buildWrapper(buildSchema.config.wrapper, componentDependencies);
    const builtChild = buildPipeline(buildSchema.child, componentDependencies);
    return wrapWith(builtWrapper, builtChild);
}

export function buildWrapper(wrapperSchema: any, componentDependencies: IComponentDependencies) : IConfiguredWrapper {
    const findWrapperByName = (name: string) => wrapperTemplates
        .find((wrapperTemplate => wrapperTemplate.name === name));

    return findWrapperByName(wrapperSchema.name)
    .createConfiguredWrapper({
        ...findWrapperByName(wrapperSchema.name).defaultConfig,
        ...wrapperSchema.config ?? {},
    }, componentDependencies);
}
