
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
    tcpBufferLimit: number,
    addNewline: boolean,
    logKey: string,
}

const defaultConfig: IDatajetConfig = {
    host: "127.0.0.1",
    port: 5170,
    maxRetries: 2,
    tcpBufferLimit: 100_000_000,  /* 100 Megabytes */
    addNewline: false,
    logKey: null,
}

const tcpDatajet: IDatajet = {
    name: "tcp",
    defaultConfig: defaultConfig,
    createConfiguredDatajet: function (config: IDatajetConfig, {
        logger
    }) {

        /* lazy client creation */
        let client: net.Socket = null;
        let isPaused: boolean = false;
        let isClosed: boolean = false;
        const makeClient = () => {
            if (client) {
                client.destroy();
            }
            client = new net.Socket();
            client.connect(config.port, config.host, function() {
                logger.info(`Connected tcp ${config.host}:${config.port}`);
            });

            client.on('close', function() {
                logger.info(`Connection closed  ${config.host}:${config.port}`);
                isClosed = true;
            });
        }
        return {
            datajetTemplate: this,
            transmitBatch: async (batch: Array<ILogData>) => {
                for (const log of batch) {
                    if (!client) {
                        makeClient();
                    }

                    /* client paused */
                    if (isPaused) {
                        /* still paused */
                        if (client.writableLength > config.tcpBufferLimit * 3/4) {
                            continue;
                        }

                        /* sent enough data to resume */
                        logger.info(`Resuming tcp datajet ${config.host}:${config.port}`);
                        isPaused = false;
                    }

                    /* check if client is closed */
                    if (isClosed) {
                        return false;
                    }

                    for (let r = 0; r < config.maxRetries + 1; ++r) {
                        try {
                            const content = (config.logKey) ? log[config.logKey] : JSON.stringify(log) + ((config.addNewline) ? "\n" : "");
                            client.write(content + '\n', (error) => {
                                if (error) {
                                    console.log("Failed to write to tcp connection.");
                                }
                            });

                            /* check if client needs to be paused */
                            if (client.writableLength > config.tcpBufferLimit) {
                                logger.info(`Pausing tcp datajet ${config.host}:${config.port}`);
                                isPaused = true;
                            }

                            break;
                        }
                        catch (e) {
                            if (r < config.maxRetries) {
                                logger.info(`Failed to write to tcp connection. Re-establishing connection. Attempt ${r+1}.`);
                                makeClient();
                            }
                            else {
                                logger.info(`TCP connection failure to ${config.host}:${config.port}.`);
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
