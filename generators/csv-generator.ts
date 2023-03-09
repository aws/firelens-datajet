
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IBatchGenerator, ILogData } from "../core/ext-types.js"
import fs from "fs"

import readline from 'readline';
const DATA_PATH = ""

/* 
 * CSV Line by Line Generator
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
    skipHeader: boolean,
    isJson: boolean,
    loop: boolean,
    logKey: string, /* Ignored if the isJson option is set */
}

const defaultConfig: IGeneratorConfig = {
    data: "examples/csv-logs-as-json.csv",
    batchSize: 10,
    skipHeader: true,
    isJson: false,
    logKey: "log",
    loop: false,
};

const csvGenerator: IBatchGenerator = {
    name: "csv",
    defaultConfig: defaultConfig,
    createConfiguredGenerator: function (config: any) {
        return {
            generatorTemplate: this,
            makeInstance: (() => (async function*() {
                
                let ranOnce = false;
                let batch: Array<ILogData> = [];
                
                while (config.loop || !ranOnce) {
                    const fileStream = fs.createReadStream(DATA_PATH + config.data);
                    const rl = readline.createInterface({
                        input: fileStream,
                        crlfDelay: Infinity
                    });
                    // Note: we use the crlfDelay option to recognize all instances of CR LF
                    // ('\r\n') in input.txt as a single line break.
                    
                    let skippedHeader = false;
                    let timestamped = true;
                    let parsed: any;
                    for await (const line of rl) {
                        if (!skippedHeader) {
                            skippedHeader = true;
                            if (line === "message") {
                                timestamped = false;
                            }
                            continue;
                        }

                        let cell1: string;
                        let cell2: string;
                        try {

                            if (timestamped) {
                                [cell1, cell2] = line.split(/,(.+)/);
                            }
                            
                            // overwrite cell 2 with cell if there is no timestamp
                            else {
                                cell2 = line;
                            }

                            // overwrite cell 2 with cell if there is no timestamp
                            if (cell2 === undefined) {
                                cell2 = cell1;
                            }

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
                            
                            if (config.isJson) {
                                parsed = JSON.parse(cell2); // will throw error
                                if (typeof parsed !== "object") {
                                    continue;
                                }
                            }
                        } catch (e) {
                            continue;
                        }

                        if (config.isJson) {
                            batch.push(parsed);
                        }
                        else {
                            batch.push({
                                [config.logKey]: cell2,
                            });
                        }
                        if (batch.length === config.batchSize) {
                            yield batch;
                            batch = [];
                        }
                        
                        // Each line in input.txt will be successively available here as `line`.
                        // console.log(`Line from file: ${line}`);
                    }

                    rl.close();
                    fileStream.close();
                    ranOnce = true;

                    if (!config.loop) {
                        if (batch.length !== 0) {
                            yield batch;
                        }
                    }
                }
            })()),
        }
    }

};

export default csvGenerator;
