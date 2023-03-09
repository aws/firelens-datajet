
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
    batchSize: number,
    logKey: string,
}

const defaultConfig: IGeneratorConfig = {
    batchSize: 10,
    logKey: "log",
};

const incrementGenerator: IBatchGenerator = {
    name: "increment",
    defaultConfig: defaultConfig,
    createConfiguredGenerator: function (config: IGeneratorConfig) {
        return {
            generatorTemplate: this,
            makeInstance: (() => (async function*() {
                let logIndex = 0;
                while (1) {
                    const batch: ILogData[] = [];
                    for (let i = 0; i < config.batchSize; ++i) {
                        batch.push({
                            [config.logKey]: `log-number-${logIndex}`
                        });
                        ++logIndex;
                    }
                    yield batch;
                }
            })()),
        }
    }

};

export default incrementGenerator;
