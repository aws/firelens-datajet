
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IBatchGenerator, ILogData } from "../core/ext-types.js"

/* 
 * Increment Generator
 * This generator creates logs with a standard message
 * And a number appended to the end of the log
 */

interface IGeneratorConfig {
    key: string,
    contentLength: number,
    batchSize: number,
}

const defaultConfig: IGeneratorConfig = {
    key: "payload",
    contentLength: 1000,
    batchSize: 10,
};

const incrementGenerator: IBatchGenerator = {
    name: "basic",
    defaultConfig: defaultConfig,
    createConfiguredGenerator: function (config: IGeneratorConfig) {

        const log: any = {
            [config.key]: "x".repeat(config.contentLength)
        };
        
        const batch: ILogData[] = [];
        for (let i = 0; i < config.batchSize; ++i) {
            batch.push(log);
        }

        return {
            generatorTemplate: this,
            makeInstance: (() => (async function*() {
                while (1) {
                    yield batch;
                }
            })()),
        }
    }

};

export default incrementGenerator;