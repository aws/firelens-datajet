
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IBatchGenerator, ILogData } from "../core/ext-types.js"

/*
 * Explicit
 * This generator outputs a bunch of custom log messages in batches 
 */

interface IGeneratorConfig {
    batch: Array<ILogData>,      /* content */
    batchLimit: number,          /* number of batches */
}

const defaultConfig: IGeneratorConfig = {
    batch: [],
    batchLimit: null,
};

const explicitGenerator: IBatchGenerator = {
    name: "explicit",
    defaultConfig: defaultConfig,
    createConfiguredGenerator: function (config: IGeneratorConfig) {

        return {
            generatorTemplate: this,
            makeInstance: (() => (async function*() {
                let b = 0;
                while (config.batchLimit === null || b < config.batchLimit) {
                    ++b;
                    yield config.batch;
                }
            })()),
        }
    }

};

export default explicitGenerator;
