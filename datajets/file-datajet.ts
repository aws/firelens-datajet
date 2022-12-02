
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import { IDatajet, ILogData } from "../core/ext-types.js";

interface IDatajetConfig {
    folder: string,
    filename: string,
    logKey: string,
}

const defaultConfig: IDatajetConfig = {
    folder: "./workspace/tmp",
    filename: "output-logs.log",
    logKey: null
}

const fileDatajet: IDatajet = {
    name: "file",
    defaultConfig: defaultConfig,
    createConfiguredDatajet: function (config: IDatajetConfig) {

        const file = path.resolve(`${config.folder}/${config.filename}`);
        let logStream;

        return {
            datajetTemplate: this,
            transmitBatch: async (batch: Array<ILogData>) => {
                if (!logStream) {
                    logStream = fs.createWriteStream(file, { flags: 'a' }); /* 27.48 seconds - 27.862 */
                }
                /* does stringify take too long? */
                const len = batch.length;
                for (let i = 0; i < len; ++i) {
                    const log = batch[i];
                    /* const str = `${log[config.key] ?? "null"}\n`; */
                    /* log[config.key] ?? "null" */

                    logStream.write((config.logKey) ?
                        `${log[config.logKey] ?? "null"}\n` : /* Elapsed time: 27.48 seconds - 27.41 seconds single string */
                        ((typeof log === "object") ?
                            `${JSON.stringify(log)}\n` :
                            log ?? "null"));
                    // fs.writeFileSync(file, , { flag: 'a+' });
                }
                return true;
            }
        }
    }
}

export default fileDatajet;
