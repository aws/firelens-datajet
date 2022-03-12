
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IBuiltStage, IBuiltStageWrapper, IExecutionResult, IPipelineConfig, IPipelineContext, IStage } from "./pipeline-types.js";
import generatorTemplates from "../generators/generator-index.js"
import wrapperTemplates from "../wrappers/wrapper-index.js"
import datajetTemplates from "../datajets/datajet-index.js"
import { buildStage, synchronizer, wrapWith } from "./pipeline.js";
import { error } from "console";
import { IComponentDependencies, IConfiguredGenerator, IConfiguredWrapper, IWrapper } from "./ext-types.js";
import winston from "winston";
import { initDependencies } from "./component-dependencies.js";

export interface IPipelineSchema {
    component?: string,
    referenceId?: string,
    library?: IPipelineSchema[],
    definitions?: {[key: string]: any},
    config?: any,
    children?: IPipelineSchema[],
    child?: IPipelineSchema,

    generator: any,
    datajet: any,
    stage: any, /* remove and replace with config */
};

enum IComponentName {
    Stage = "stage", /* default */
    Synchronizer = "synchronizer",
    Validator = "validator",
    Wrap = "wrap",
    Generator = "generator",
}

const genericBuiltStageStub = {
    children: [],
    executeStage: (a: IPipelineConfig, b: IPipelineContext) => (Promise.resolve({builtStage: this,
        isValidationSuccess: true,
        isExecutionSuccess: true,
        pendingValidators: [],
        children: [],})),
};

export function buildPipeline(buildSchema: IPipelineSchema, componentDependencies?: IComponentDependencies) : IBuiltStage {
    if (arguments.length === 1) {
        return buildPipeline(buildSchema, initDependencies(buildSchema));
    }
    const derivedDependencies = deriveDependencies(buildSchema, componentDependencies);
    if (!buildSchema.component || buildSchema.component === IComponentName.Stage) {
        return buildPipelineStage(buildSchema, derivedDependencies);
    }
    else if (buildSchema.component === IComponentName.Synchronizer) {
        return buildPipelineSynchronizer(buildSchema, derivedDependencies);
    }
    else if (buildSchema.component === IComponentName.Wrap) {
        return buildPipelineWrap(buildSchema, derivedDependencies);
    }
    else if (buildSchema.component === IComponentName.Generator) {
        return buildPipelineGenerator(buildSchema, derivedDependencies);
    }
    throw error("Unsupported pipeline component in schema: ", buildSchema.component);
}

function deriveDependencies(buildSchema: IPipelineSchema, componentDependencies: IComponentDependencies) : IComponentDependencies {
    const libraryComponents: {[key: string]: IBuiltStage} = {};
    (buildSchema.library ?? []).forEach(libBuildSchema => {
        libraryComponents[libBuildSchema.referenceId] = buildPipeline(libBuildSchema);
    });
    const definitions: {[key: string]: any} = {
        ...componentDependencies.variables.defined,
        ...(buildSchema.definitions ?? {}),
    };
    return {
        ...componentDependencies,
        library: {
            ...componentDependencies.library,
            ...libraryComponents,
        },
        variables: {
            ...componentDependencies.variables,
            defined: {
                ...componentDependencies.variables.defined,
                ...(buildSchema.definitions ?? {}),
            }
        },
        localPipelineSchema: buildSchema,
    }
}

function buildPipelineStage(buildSchema: IPipelineSchema, componentDependencies: IComponentDependencies) : IBuiltStage {
    const findGeneratorByName = (name: string) => generatorTemplates
        .find((generatorTemplate => generatorTemplate.name === name));

    const findDatajetByName = (name: string) => datajetTemplates
        .find((datajetTemplate => datajetTemplate.name === name));

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

function buildPipelineGenerator(buildSchema: IPipelineSchema, componentDependencies: IComponentDependencies): IBuiltStage {
    return {
        ...genericBuiltStageStub,
        type: "generator",
        data: buildGenerator(buildSchema, componentDependencies),
    }
}

function buildGenerator(buildSchema: IPipelineSchema, componentDependencies: IComponentDependencies): IConfiguredGenerator {
    const findGeneratorByName = (name: string) => generatorTemplates
        .find((generatorTemplate => generatorTemplate.name === name));

    return findGeneratorByName(buildSchema.generator.name)
            .createConfiguredGenerator({
                ...findGeneratorByName(buildSchema.generator.name).defaultConfig,
                ...buildSchema.generator.config ?? {},
            }, componentDependencies);
}

function buildPipelineWrap(buildSchema: IPipelineSchema, componentDependencies: IComponentDependencies) : IBuiltStage {
    const wrapperDependencies = {
        ...componentDependencies,
        variables: {
            defined: {...componentDependencies.variables.defined},
            managed: {...componentDependencies.variables.managed}, /* deep copy, changes affect children only */
        },
        setManagedVariable: (key: string, value: any) => {
            wrapperDependencies.variables.managed[key] = value;
        }
    }
    const builtWrapper = buildWrapper(buildSchema.config.wrapper, wrapperDependencies);
    wrapperDependencies.setManagedVariable = (key: string, value: any) => { throw "unable to set variable outside of wrapper config"; }
    let updatedComponentDependencies = {
        ...componentDependencies,
        variables: wrapperDependencies.variables, /* only allow variable updates */
    };
    const builtChild = buildPipeline(buildSchema.child, updatedComponentDependencies);
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
