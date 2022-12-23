
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IBatchGenerator, ILogData } from "../core/ext-types.js"
import crypto from "crypto"

/* 
 * Increment Generator
 * This generator creates logs with a standard message
 * And a number appended to the end of the log
 */

interface IGeneratorConfig {
    logKey: string,
    contentLength: number,
    batchSize: number,
    contentType: "uniform" | "random",
    contentUniformValue: string,
}

const defaultConfig: IGeneratorConfig = {
    logKey: "log",
    contentLength: 1000,
    batchSize: 1,
    contentType: "uniform",
    contentUniformValue: "x",
};

const incrementGenerator: IBatchGenerator = {
    name: "basic",
    defaultConfig: defaultConfig,
    createConfiguredGenerator: function (config: IGeneratorConfig) {

        let log: any = {
            [config.logKey]: config.contentUniformValue.repeat(config.contentLength)
        };

        let batch: ILogData[] = [];
        for (let i = 0; i < config.batchSize; ++i) {
            batch.push(log);
        }

        return {
            generatorTemplate: this,
            makeInstance: (() => (async function*() {
                while (1) {
                    if (config.contentType === "random") {
                        batch = []
                        for (let i = 0; i < config.batchSize; ++i) {
                            log = {
                                [config.logKey]: crypto.randomBytes(Math.floor(config.contentLength/2)).toString("hex"),
                            }
                            batch.push(log);
                        }
                    }
                    yield batch;
                }
            })()),
        }
    }

};

export default incrementGenerator;