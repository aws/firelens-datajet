
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IDatajet, ILogData } from "../core/ext-types.js"
import net from 'net'

/* 
 * Sends logs to Fluent Bit through tcp
 */

interface IDatajetConfig {
    host: string,
    port: number,
    maxRetries: number,
}

const defaultConfig: IDatajetConfig = {
    host: "127.0.0.1",
    port: 5170,
    maxRetries: 2,
}

const tcpDatajet: IDatajet = {
    name: "tcp",
    defaultConfig: defaultConfig,
    createConfiguredDatajet: function (config: IDatajetConfig) {

        /* lazy client creation */
        let client: net.Socket = null;
        const makeClient = () => {
            if (client) {
                client.destroy();
            }
            client = new net.Socket();
            client.connect(config.port, config.host, function() {
                console.log(`Connected tcp ${config.host}:${config.port}`);
            });
        }
        return {
            datajetTemplate: this,
            transmitBatch: async (batch: Array<ILogData>) => {
                for (const log of batch) {
                    if (!client) {
                        makeClient();
                    }
                    for (let r = 0; r < config.maxRetries + 1; ++r) {
                        try {
                            client.write(JSON.stringify(log));
                            break;
                        }
                        catch (e) {
                            if (r < config.maxRetries) {
                                console.log(`Failed to write to tcp connection. Re-establishing connection. Attempt ${r+1}.`);
                                makeClient();
                            }
                            else {
                                console.log(`TCP connection failure to ${config.host}:${config.port}.`);
                                return false;
                            }
                        }
                    }
                }
                return true;
            }
        }
    }
}

export default tcpDatajet;
