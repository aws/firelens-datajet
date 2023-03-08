
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IBatchGenerator, ILogData } from "../core/ext-types.js"
import fsR from "fs-reverse"
import fs from "fs"

import readline from 'readline'
const DATA_PATH = "";

/* 
 * Reverse CSV Line by Line Generator
 * (This currently doesn't work correctly)
 * (\n gets interpreted as a new line...)
 * 
 * This generator reads a csv file as input and
 * sequentially outputs file, line by line
 * 
 * File should be formatted:
 * @timestamp, @message
 * anything  , anything | object
 * 
 * Only objects will be output by this generator,
 * other text will be filtered out.
 */

interface IGeneratorConfig {
    data: string,
    batchSize: number,
    logKey: string, /* if included, data is wrapped in {"logKeyObjectWrapper": cell2} */
}

const defaultConfig: IGeneratorConfig = {
    data: "sample/sample.log",
    batchSize: 10,
    logKey: null,
};

const reverseCsvGenerator: IBatchGenerator = {
    name: "reverse-csv",
    defaultConfig: defaultConfig,
    createConfiguredGenerator: function (config: any) {
        return {
            generatorTemplate: this,
            makeInstance: (() => (async function*() {
                const fileStream = fs.createReadStream(DATA_PATH + config.data); // Replaced with standard fs, (use fsreverse for reverse...)
                const rl = readline.createInterface({
                    input: fileStream,
                    crlfDelay: Infinity
                });
                // Note: we use the crlfDelay option to recognize all instances of CR LF
                // ('\r\n') in input.txt as a single line break.

                let batch: Array<ILogData> = [];
                for await (const line of rl) {

                    let cell2: string;
                    let parsed: any;
                    try {
                        cell2 = line.split(/,(.+)/)[1];

                        // remove quotes if needed
                        if (cell2.charAt(0) === "\"") {
                            cell2 = cell2.slice(1);
                        }
                        if (cell2.charAt(cell2.length - 1) === "\"") {
                            cell2 = cell2.slice(0, -1);
                        }

                        // substitute "" with "
                        try {
                            cell2 = cell2.replace(/\"\"/g, "\"");
                        }
                        catch (e) {
                            console.log(e)
                        }

                        parsed = JSON.parse(cell2);
                        if (typeof parsed !== "object") {
                            continue;
                        }
                    } catch (e) {
                        continue;
                    }

                    batch.push((config.logKey) ?
                    {
                        [config.logKey]: cell2,
                    } :
                    parsed);
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

export default reverseCsvGenerator;