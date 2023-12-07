
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import AWS from 'aws-sdk';
import { IBatchGenerator, ILogData } from "../core/ext-types.js"
import fs from 'fs';
import readline from 'readline';
const DATA_PATH = ""

/* 
 * S3 Line by Line Generator
 * This generator reads a file as input and
 * sequentially outputs file, line by line
 */

interface IGeneratorConfig {
    bucket: string,
    file: string,
    batchSize: number,
    loop: boolean,
    isJSON: boolean,
    logKey: string,
}

const defaultConfig: IGeneratorConfig = {
    bucket: "myS3Bucket",
    file: "/my/file.log",
    batchSize: 1,
    loop: true,
    isJSON: false,
    logKey: "log",
};

const s3Generator: IBatchGenerator = {
    name: "s3",
    defaultConfig: defaultConfig,
    createConfiguredGenerator: function (config: IGeneratorConfig) {

        const s3 = new AWS.S3();

        const bucket = config.bucket
        const file = config.file;

        let s3Loaded = false;
        let s3Logs: Array<string> = [];

        return {
            generatorTemplate: this,
            makeInstance: (() => (async function*() {

                if (s3Loaded == false) {
                    try {
                        const s3Response = await s3.getObject({
                            Bucket: bucket,
                            Key: file
                        }).promise();
            
                        s3Logs = (s3Response?.Body?.toString() ?? "").split("\n");
                    }
                    catch (e) {
                        console.log("S3 Generator failed to load configuration files.");
                        throw(e);
                    }

                    s3Loaded = true;
                }
                

                let hasLooped = false;

                while (config.loop || !hasLooped) {
                   
                    let batch: Array<ILogData> = [];
                    for await (const line of s3Logs) {

                        if (config.isJSON) {
                            batch.push(JSON.parse(line))
                        }

                        // we need to convert text to json
                        else {
                            batch.push({
                                [config.logKey]: line
                            } as ILogData);
                        }

                        if (batch.length === config.batchSize) {
                            yield batch;
                            batch = [];
                        }

                        // Each line in input.txt will be successively available here as `line`.
                        // console.log(`Line from file: ${line}`);
                    }
                    if (batch.length !== 0) {
                        yield batch;
                    }
                    hasLooped = true;
                }
            })()),
        }
    }

};

export default s3Generator;
