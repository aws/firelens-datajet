
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IBatchGenerator, ILogData } from "../core/ext-types.js"

/* 
 * Increment Generator
 * This generator creates logs with a standard message
 * And a number appended to the end of the log
 */

interface IGeneratorConfig {
    name: string,
    payloadSize: number,
    payloadCount: number,
    signalPayloadSize: number,
    signalPayloadCount: number,
    disableSignal: boolean,
}

const defaultConfig: IGeneratorConfig = {
    name: "logger",
    payloadSize: 10,
    payloadCount: 3,
    signalPayloadSize: 100,
    signalPayloadCount: 5,
    disableSignal: false
};

const colorLoggerGenerator: IBatchGenerator = {
    name: "color-logger",
    defaultConfig: defaultConfig,
    createConfiguredGenerator: function (config: IGeneratorConfig) {
        return {
            generatorTemplate: this,
            makeInstance: (() => (async function*() {
                const payload = "x".repeat(config.payloadSize);
                const signalPayload = "x".repeat(config.signalPayloadSize);
                let logIndex = 0;
                let signalIndex = 0;
                let blueIndex = 0;

                const getTime = () => {
                    const d = new Date();
                    return d.getFullYear() + "-" + ('0' + (d.getMonth() + 1)).slice(-2) + "-" + ('0' + d.getDate()).slice(-2) + " " + ('0' + d.getHours()).slice(-2) + ":" + ('0' + d.getMinutes()).slice(-2) + ":" + ('0' + d.getSeconds()).slice(-2) + ('0' + d.getMilliseconds()).slice(-2);
                }

                while (1) {
                    
                    const batch = [];

                    /* Signal log: one out of 71 */
                    if (logIndex % 71 === 0 && !config.disableSignal && signalIndex < config.signalPayloadCount) {
                        const logData: ILogData = ({
                            payload: signalPayload,
                            event_id: Math.floor(Math.random() * 1000), // generateRandomString(1000),
                            counter: signalIndex,
                            global_counter: logIndex,
                            time: getTime(),
                        } as any);

                        batch.push(logData);
                        ++signalIndex;
                    }

                    /* Blue log: one out of 100 */
                    if (logIndex % 100 === 0 && blueIndex < config.payloadCount) {
                        const logData: ILogData = ({
                            blue: true,
                            id: logIndex,
                            time: getTime(),
                        } as any);

                        batch.push(logData);
                        ++blueIndex;
                    }

                    /* Normal log: always sent */
                    const logData: ILogData = ({
                        payload: payload,
                        time: getTime(),
                        gauge: logIndex,
                        uuid: `abc${logIndex}`,
                    } as any);

                    batch.push(logData);
                    ++logIndex;
                    
                    yield batch;
                }
            })()),
        }
    }

};

export default colorLoggerGenerator;
