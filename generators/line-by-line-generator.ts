
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IBatchGenerator, ILogData } from "../core/ext-types.js"
import fs from 'fs';
import readline from 'readline';
const DATA_PATH = "data/"

/* 
 * File Line by Line Generator
 * This generator reads a file as input and
 * sequentially outputs file, line by line
 */

interface IGeneratorConfig {
    data: string,
    batchSize: number,
}

const defaultConfig: IGeneratorConfig = {
    data: "sample/sample.log",
    batchSize: 10,
};

const lineByLineGenerator: IBatchGenerator = {
    name: "file",
    defaultConfig: defaultConfig,
    createConfiguredGenerator: function (config: IGeneratorConfig) {
        return {
            generatorTemplate: this,
            makeInstance: (() => (async function*() {
                const fileStream = fs.createReadStream(DATA_PATH + config.data);
                const rl = readline.createInterface({
                    input: fileStream,
                    crlfDelay: Infinity
                });
                // Note: we use the crlfDelay option to recognize all instances of CR LF
                // ('\r\n') in input.txt as a single line break.

                let batch: Array<ILogData> = [];
                for await (const line of rl) {
                    batch.push({
                        text: line,
                    });
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
            })()),
        }
    }

};

export default lineByLineGenerator;
