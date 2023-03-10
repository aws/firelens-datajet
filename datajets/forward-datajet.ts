
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// import logger from "fluent-logger";
import { IDatajet, ILogData } from "../core/ext-types.js";
import logger from 'fluent-logger';

interface IDatajetConfig {
    tagPrefix: string,
    host: string,
    port: number,
    timeout: 3.0,
    reconnectInterval: number,
    requireAckResponse: boolean,  // Set to true to wait response from Fluentd certainly
    inputStructure: "object" | "log-key-json" | "log-key-string",
    timeOffset: number,
    batchSend: boolean,
    logKey: string,
    addKeys: object,
}

const defaultConfig: IDatajetConfig = {
    tagPrefix: 'tag_prefix',
    host: '0.0.0.0',
    port: 24224,
    timeout: 3.0,
    reconnectInterval: 600000,
    requireAckResponse: false,
    inputStructure: "log-key-string",
    timeOffset: 0,
    batchSend: false,
    logKey: "log",
    addKeys: {},
}

/*
Here are some keys we might want to add with addKeys
{
    source:"stdout",
    container_id:"c61d13c68659b622a01d8c3825b0bc1186391119d47dbf864d9c3a65c3f2aa79",
    container_name:"/distracted_bell"
}
*/

const forwardDatajet: IDatajet = {
    name: "forward",
    defaultConfig: defaultConfig,
    createConfiguredDatajet: function (config: IDatajetConfig) {
        let loggerInit = false;
        
        return {
            datajetTemplate: this,
            transmitBatch: async (batch: Array<ILogData>) => {
                if (!loggerInit) {
                    loggerInit = true;
                    logger.configure(config.tagPrefix, {
                        host: config.host,
                        port: config.port,
                        timeout: config.timeout,
                        reconnectInterval: config.reconnectInterval, // 10 minutes
                        requireAckResponse: config.requireAckResponse,
                    });
                }
                try {
                    let processedBatch: Array<ILogData>;

                    // Optimization for batch sends
                    if (config.inputStructure === "object" && Object.entries(config.addKeys).length === 0) {
                        processedBatch = batch;
                    }
                    
                    else {
                        // Process logs
                        processedBatch = batch.map(log => {
                            let pl: object;
                            if (config.inputStructure === "object") {
                                pl = log;
                            }
                            else if (config.inputStructure === "log-key-json") {
                                pl = JSON.parse(log[config.logKey]);
                            }
                            else { /* default value, "log-key-string" */
                                pl = {
                                    "log": log[config.logKey]
                                }
                            }

                            if (config.addKeys) {
                                pl = {
                                    ...config.addKeys,
                                    ...pl,
                                }
                            }
                            return pl;
                        });
                    }

                    const t = new Date();
                    t.setSeconds(t.getSeconds() + config.timeOffset);

                    // Send entire batch
                    if (config.batchSend) {
                        if (config.timeOffset !== 0) {
                            logger.emit(processedBatch, t);
                            return true;
                        }
                        logger.emit(processedBatch);
                        return true;
                    }

                    // Emit log with time offset
                    processedBatch.forEach((b) => {
                        if (config.timeOffset !== 0) {
                            logger.emit(b, t);
                            return;
                        }
    
                        // Emit log
                        logger.emit(b);
                    })
                   
                    return true;
                }
                catch (e) {
                    console.log("Firelens datajet execution failure: ", e.message)
                    return false;
                }
            }
        }
    }
} 

export default forwardDatajet;

function ecsObjectify(text: string) {
    return {
        source:"stdout",
        log: text,
        container_id:"c61d13c68659b622a01d8c3825b0bc1186391119d47dbf864d9c3a65c3f2aa79",
        container_name:"/distracted_bell"
    }
}