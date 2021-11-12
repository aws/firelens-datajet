
import { IClient } from "../core/ext-types.js"
import fs from 'fs';
import { IExecutionResult } from "../core/pipeline-types.js";

/*
 * Corresponding environment variables
 * CLIENT_FILE_NAME=<filename path>
 *  | default_value: firelens-datajet.json
 */
const fileClient: IClient = {
    name: "file",
    makeCommandGenerator: (async function*() {
        const configFilePath = process.env.CLIENT_FILE_NAME ?? 'firelens-datajet.json';
        let driverConfigFile = fs.readFileSync(configFilePath);

        let config;
        try {
            config = JSON.parse(driverConfigFile.toString());
        }

        /* invalid JSON config */
        catch (e) {
            console.log("Invalid client file format. Required format: json");
            return;
        }
        yield {
            pipelineConfiguration: config,
            handleExecutionResult: async (_: IExecutionResult) => {},
        };
        return;
    })
};

export default fileClient;
