
import { IClient } from "../core/ext-types.js"
import fs from 'fs';

/*
 * Corresponding environment variables
 * CLIENT_FILE_NAME=<filename path>
 */
const fileClient: IClient = {
    name: "file",
    makeCommandGenerator: (async function*() {
        let driverConfigFile = fs.readFileSync('firelens-datajet.json');

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
            handleExecutionResult: () => {},
        };
        return;
    })
};

export default fileClient;
