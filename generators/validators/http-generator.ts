
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IBatchGenerator, ILogData } from "../../core/ext-types.js"
import express from "express";

/* 
 * HTTP Generator
 * This generator is meant to act as a loop back
 * server to recieve all http metrics from fluent bit
 */

interface IGeneratorConfig {
    port: number,
}

const defaultConfig: IGeneratorConfig = {
    port: 2685,
};

const httpGenerator: IBatchGenerator = {
    name: "http",
    defaultConfig: defaultConfig,
    createConfiguredGenerator: function (config: IGeneratorConfig) {

        const app = express();
        const requests: Array<express.Request> = [];

        app.use((req, res, next) => {
            /* log request and send success message */
            requests.push(req);
            res.sendStatus(200);
        })

        const server = app.listen(config.port, () => {
            console.log(`HTTP generator listening on port: ${config.port}`);
        })

        return {
            generatorTemplate: this,
            makeInstance: (() => (async function*() {
                let logIndex = 0;
                for (let i = 0; i < requests.length; ++i) {
                    /* this would be a good place to run filters */
                    yield requests.pop().body as Array<ILogData>;
                }
            })()),
            validateInstances: async () => {
                return {
                    isValidationSuccess: true,
                }
            }
        }
    }

};

export default httpGenerator;