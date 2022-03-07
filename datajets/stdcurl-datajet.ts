
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IDatajet, ILogData } from "../core/ext-types.js"
import fetch from 'node-fetch'

/* 
 * Sends logs to a docker image that echos the logs
 * in it's stdout. Please see std-curl image.
 * Fluentd log driver then forwards these logs to port 24224
 * into Fluent Bit
 */

interface IDatajetConfig {
    logStream: "stdout" | "stderr" | "auto",
    defaultStream: "stdout" | "stderr",
    appendNewline: boolean,
}

const defaultConfig: IDatajetConfig = {
    logStream: "auto",
    defaultStream: "stdout",
    appendNewline: true,
}

const stdoutDatajet: IDatajet = {
    name: "stdcurl",
    defaultConfig: defaultConfig,
    createConfiguredDatajet: function (config: IDatajetConfig) {
        return {
            datajetTemplate: this,
            transmitBatch: async (batch: Array<ILogData>) => {
                
                for (const log of batch) {
                    const logMethod = (config.logStream !== "auto")
                        ? config.logStream
                        : (log.stream ?? config.defaultStream);

                    await fetch("http://localhost:3132/" + logMethod, {
                        method: "post",
                        body: log.text + (config.appendNewline ? "\n" : ""),
                        headers: {'Content-Type': 'text/plain'}
                    });
                }
                return true;
            }
        }
    }
}

export default stdoutDatajet;
