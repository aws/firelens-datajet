
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import generatorTemplates from "./generators/generator-index.js"
import datajetTemplates from "./datajets/datajet-index.js"
import { buildStage, deepFreezePipeline, executePipeline } from "./core/pipeline.js";
import { IExecutePipelineConfig } from "./core/pipeline-types.js";
import dotenv from 'dotenv';
import { IClient } from "./core/ext-types.js";
import clientsIndex from "./clients/client-index.js";
import { buildPipeline, IPipelineSchema } from "./core/rockefeller.js";

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
    const pipeline = buildPipeline(config as IPipelineSchema);
    const pipelineConfig: IExecutePipelineConfig = {
        onExecutionFailure: async () => {console.log("Execution failed");}
    };

    deepFreezePipeline(pipeline);
    return await executePipeline(pipeline, pipelineConfig);
}
