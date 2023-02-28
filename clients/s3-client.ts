import AWS from 'aws-sdk';
import { IClient } from "../core/ext-types.js"
import { IExecutionResult } from "../core/pipeline-types.js";

const environmentClient: IClient = {
    name: "s3",
    makeCommandGenerator: (async function*() {

        const s3 = new AWS.S3();

        const bucket = process.env.CLIENT_S3_BUCKET || 'firelens-datajet';
        const file = process.env.CLIENT_S3_FILE || 'firelens-datajet.json';

        try {
            const s3Response = await s3.getObject({
                Bucket: bucket,
                Key: file
            }).promise();

            const config = JSON.parse(s3Response.Body.toString());

            console.log("Retrieved datajet configuration file from s3: ");
            console.log(JSON.stringify(config, null, 2));

            yield {
                pipelineConfiguration: config,
                handleExecutionResult: async (_: IExecutionResult) => {},
            };
        } catch (e) {
            console.log(`Unable to fetch configuration file from S3 bucket: ${e}`);
            return;
        }
    })
};

export default environmentClient;
