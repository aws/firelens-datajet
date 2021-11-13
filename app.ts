
import generatorTemplates from "./generators/generator-index.js"
import datajetTemplates from "./datajets/datajet-index.js"
import { buildStage, deepFreezePipeline, executePipeline } from "./core/pipeline.js";
import { IExecutePipelineConfig } from "./core/pipeline-types.js";
import dotenv from 'dotenv';
import { IClient } from "./core/ext-types.js";
import clientsIndex from "./clients/client-index.js";

/*
 * App environment variables
 * CLIENTS=["<client1>", "<client2>", ...]
 *  | default_value: ["request"]
 *  | options: "request", "file", "environment"
 */

/* Load environment variables */
dotenv.config();

let clients: Array<string>; 
try {
   clients = JSON.parse(process.env.CLIENTS ?? "[\"request\"]");
}
catch (e) {
    console.log("Unable to parse clients JSON environment variable");
}

const processClient = async (client: IClient) => {
    const commandGenerator = client.makeCommandGenerator();
    for await (const command of commandGenerator) {
        if (command == null) {
            continue;
        }

        const executionResult = await processPipeline(command.pipelineConfiguration);
        command.handleExecutionResult(executionResult);
    }
}

/* Spin up all clients */
clients.forEach(clientName => {
    const client = clientsIndex
        .find((clientTemplate => clientTemplate.name === clientName));
    processClient(client);
})

async function processPipeline(config: any) {
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
    return await executePipeline(pipeline, pipelineConfig);
}
