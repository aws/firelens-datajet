
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
    contentRandomValueSet: "hex" | "alpha-numeric" | "unicode"
}

const defaultConfig: IGeneratorConfig = {
    logKey: "log",
    contentLength: 1000,
    batchSize: 1,
    contentType: "uniform",
    contentUniformValue: "x",
    contentRandomValueSet: "unicode",
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
                            
                            if (config.contentRandomValueSet === "hex") {
                                log = {
                                    [config.logKey]: crypto.randomBytes(Math.floor(config.contentLength/2)).toString(config.contentRandomValueSet),
                                };
                            }

                            else if (config.contentRandomValueSet === "alpha-numeric") {
                                log = {
                                    [config.logKey]: randomAlphaNumericGenerator(config.contentLength),
                                };
                            }

                            // unicode, and default
                            else {
                                log = {
                                    [config.logKey]: randomUnicodeGenerator(config.contentLength),
                                };
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

function randomUnicodeGenerator(length: number): string {
    return Array.from(
        { length }, () => String.fromCharCode(Math.floor(Math.random() * (65536)))
      ).join('');
}

function randomAlphaNumericGenerator(length: number): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    return Array.from(
        { length }, () => characters.charAt(Math.floor(Math.random() * charactersLength))
    ).join('');
}

export default incrementGenerator;
