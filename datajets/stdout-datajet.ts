
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IDatajet, ILogData } from "../core/ext-types.js";

interface IDatajetConfig {
    logStream: "stdout" | "stderr" | "auto",
    defaultStream: "stdout" | "stderr",
    logKey: string,
}

const defaultConfig: IDatajetConfig = {
    logStream: "auto",
    defaultStream: "stdout",
    logKey: null,
}

const stdoutDatajet: IDatajet = {
    name: "stdout",
    defaultConfig: defaultConfig,
    createConfiguredDatajet: function (config: IDatajetConfig) {

        return {
            datajetTemplate: this,
            transmitBatch: async (batch: Array<ILogData>) => {
                batch.forEach(log => {
                    const logMethod = (config.logStream !== "auto")
                        ? config.logStream
                        : (log.stream ?? config.defaultStream);
                    
                    if (logMethod === "stdout") {
                        console.log((config.logKey) ? log[config.logKey] : JSON.stringify(log));
                    }

                    else if (logMethod === "stderr") {
                        console.error((config.logKey) ? log[config.logKey] : JSON.stringify(log));
                    }
                });
                return true;
            }
        }

    }
}

export default stdoutDatajet;
