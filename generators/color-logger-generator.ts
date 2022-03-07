
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
    payloadSize: 32,
    payloadCount: 100,
    signalPayloadSize: 128000,
    signalPayloadCount: 100,
    disableSignal: false,
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

                const getTime = () => {
                    const d = new Date();
                    return d.getFullYear() + "-" + ('0' + (d.getMonth() + 1)).slice(-2) + "-" + ('0' + d.getDate()).slice(-2) + " " + ('0' + d.getHours()).slice(-2) + ":" + ('0' + d.getMinutes()).slice(-2) + ":" + ('0' + d.getSeconds()).slice(-2) + ('0' + d.getMilliseconds()).slice(-2);
                }

                const generateRandomString = (myLength) => {
                    const chars =
                        "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz1234567890";
                    const randomArray = Array.from(
                        { length: myLength },
                        (v, k) => chars[Math.floor(Math.random() * chars.length)]
                    );
                    
                    const randomString = randomArray.join("");
                    return randomString;
                };

                while (1) {
                    
                    /* Signal log: one out of 71 */
                    if (logIndex % 71 === 0 && !config.disableSignal) {
                        const logData: ILogData = ({
                            payload: signalPayload,
                            event_id: generateRandomString(1000),
                            counter: signalIndex,
                            global_counter: logIndex,
                            time: getTime(),
                        } as any);
                        
                        yield [logData];
                    }

                    /* Blue log: one out of 100 */
                    if (logIndex % 100 === 0) {
                        const logData: ILogData = ({
                            blue: true,
                            id: logIndex,
                            time: getTime(),
                        } as any);

                        yield [logData];
                    }

                    /* Normal log: always sent */
                    const batch: ILogData[] = [];
                    const logData: ILogData = ({
                        payload: payload,
                        time: getTime(),
                        gauge: logIndex,
                        uuid: `abc${logIndex}`,
                    } as any);

                    yield [logData];
                }
            })()),
        }
    }

};

export default colorLoggerGenerator;
