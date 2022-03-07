
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
    messageType: "parsed" | "packaged" | "auto",
    objectify: (text: string) => object,
}

const defaultConfig: IDatajetConfig = {
    tagPrefix: 'tag_prefix',
    host: '0.0.0.0',
    port: 24224,
    timeout: 3.0,
    reconnectInterval: 600000,
    requireAckResponse: false,
    messageType: "auto",
    objectify: (text) => ({
        source:"stdout",
        log: text,
        container_id:"c61d13c68659b622a01d8c3825b0bc1186391119d47dbf864d9c3a65c3f2aa79",
        container_name:"/distracted_bell"
    }),
}

const firelensDatajet: IDatajet = {
    name: "firelens",
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
                    batch.forEach(log => {
    
                        // process raw log
                        let logData: object;
                        try {
                            if (config.messageType === "packaged") {
                                throw null;
                            }
                            logData = JSON.parse(log.text);
                        } catch (e) {
                            if (config.messageType === "parsed") {
                                console.log("Firelens datajet failed to parse: ", log.text);
                                return false;
                            }
                            /* create a sample version of what fluentd log driver would output */
                            logData = config.objectify(JSON.stringify(log));
                        }
    
                        // emit log
                        if (log.timestamp !== undefined) {
                            logger.emit(logData, log.timestamp);
                        }
                        else {
                            logger.emit(logData);
                        }
                    });
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

export default firelensDatajet;
