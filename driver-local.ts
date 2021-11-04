 
import generatorTemplates from "./generators/generator-index.js"
import datajetTemplates from "./datajets/datajet-index.js"
import { buildStage, deepFreezePipeline, executePipeline } from "./core/pipeline.js";
import { IExecutePipelineConfig } from "./core/pipeline-types.js";

import fs from 'fs';

let driverConfigFile = fs.readFileSync('firelens-datajet.json');
const config = JSON.parse(driverConfigFile.toString());

const findGeneratorByName = (name: string) => generatorTemplates
    .find((generatorTemplate => generatorTemplate.name === config.generator.name));

const findDatajetByName = (name: string) => datajetTemplates
    .find((datajetTemplate => datajetTemplate.name === config.datajet.name));

const stage = {
    generator: findGeneratorByName(config.generator.name)
        .createConfiguredGenerator({
            ...findGeneratorByName(config.generator.name).defaultConfig,
            ...config.generator.config ?? {},
        }),
    datajet: findDatajetByName(config.datajet.name)
        .createConfiguredDatajet({
            ...findDatajetByName(config.datajet.name).defaultConfig,
            ...config.datajet.config ?? {},
        }),
    config: config.stage,
}

const pipeline = buildStage(stage);
const pipelineConfig: IExecutePipelineConfig = {
    onExecutionFailure: async () => {console.log("Execution failed");}
};

deepFreezePipeline(pipeline);
executePipeline(pipeline, pipelineConfig);
