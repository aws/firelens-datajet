
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IClient } from "../core/ext-types.js"
import fs from 'fs';
import { IExecutionResult } from "../core/pipeline-types.js";

/*
 * Corresponding environment variables
 * CLIENT_ENVIRONMENT_CONFIG=<escaped JSON config string in environment variable>
 *  | default_value: null - will throw error
 */
const environmentClient: IClient = {
    name: "environment",
    makeCommandGenerator: (async function*() {

        let config;
        try {
            config = JSON.parse(process.env.CLIENT_ENVIRONMENT_CONFIG);
        }

        /* invalid JSON config */
        catch (e) {
            console.log("Invalid client environment format. Required format: json");
            return;
        }
        yield {
            pipelineConfiguration: config,
            handleExecutionResult: async (_: IExecutionResult) => {},
        };
        return;
    })
};

export default environmentClient;
