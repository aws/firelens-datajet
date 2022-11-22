
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IBuiltStage, IExecutionContext, IPipelineConfig, IPipelineContext } from "./pipeline-types.js";
import generatorTemplates from "../generators/generator-index.js"
import wrapperTemplates from "../wrappers/wrapper-index.js"
import datajetTemplates from "../datajets/datajet-index.js"
import { buildStage, synchronizer, wrapWith } from "./pipeline.js";
import { error } from "console";
import { IComponentDependencies, IConfiguredGenerator, IWrapper } from "./ext-types.js";
import { initDependencies } from "./component-dependencies.js";
import { synchronizerConfigDefaults } from "./pipeline-defaults.js";

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
    Generator = "generator",
    /* all wrappers are also components */
}

const genericBuiltStageStub = {
    children: [],
    executeStage: (a: IPipelineConfig, b: IPipelineContext, c: IExecutionContext) => (Promise.resolve({builtStage: this,
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
    else if (buildSchema.component === IComponentName.Generator) {
        return buildPipelineGenerator(buildSchema, derivedDependencies);
    }
    else if (wrapperTemplates.some((w)=>(buildSchema.component === w.name))) {
        return buildPipelineWrapper(buildSchema, derivedDependencies);
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
        config: {
            ...synchronizerConfigDefaults,
            ...(buildSchema.config ?? {}),
        }
    });
}

function buildPipelineGenerator(buildSchema: IPipelineSchema, componentDependencies: IComponentDependencies) : IBuiltStage {
    return {
        ...genericBuiltStageStub,
        type: "generator",
        data: buildGenerator(buildSchema, componentDependencies),
    }
}

function buildGenerator(buildSchema: IPipelineSchema, componentDependencies: IComponentDependencies) : IConfiguredGenerator {
    const findGeneratorByName = (name: string) => generatorTemplates
        .find((generatorTemplate => generatorTemplate.name === name));

    return findGeneratorByName(buildSchema.generator.name)
            .createConfiguredGenerator({
                ...findGeneratorByName(buildSchema.generator.name).defaultConfig,
                ...buildSchema.generator.config ?? {},
            }, componentDependencies);
}

function buildPipelineWrapper(buildSchema: IPipelineSchema, componentDependencies: IComponentDependencies) : IBuiltStage {
    const wrapperConfig = buildSchema.config;
    const wrapperTemplate = wrapperTemplates.find((wrapperTemplate => wrapperTemplate.name === buildSchema.component));

    /* Modify subschema */
    const subschema = buildSchema.child;
    const modifiedSubschema = wrapperTemplate.modifySubschema({...subschema}); /* future: add deep copy utility */

    const wrapperConstructor = (executionContext: IExecutionContext, wrapperTemplate: IWrapper, wrapperConfig: any) => {
        /* Include the managed variables from this point in the execution. */
        return wrapperTemplate.createConfiguredWrapper({
                ...wrapperTemplate.defaultConfig,
                ...wrapperConfig ?? {},
            }, {
                ...componentDependencies,
                variables: {
                    ...componentDependencies.variables,
                    managed: executionContext.managedVariables,
                },
                setManagedVariable: executionContext.setManagedVariable
            });
    }

    const builtChild = buildPipeline(modifiedSubschema, componentDependencies);
    return wrapWith(wrapperConstructor, wrapperTemplate, wrapperConfig, builtChild);
}
