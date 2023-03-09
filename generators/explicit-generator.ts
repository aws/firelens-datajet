
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
    batches: Array<Array<ILogData>>, /* array of array of log objects */
    loop: boolean,
}

const defaultConfig: IGeneratorConfig = {
    batches: [],
    loop: true,
};

const explicitGenerator: IBatchGenerator = {
    name: "explicit",
    defaultConfig: defaultConfig,
    createConfiguredGenerator: function (config: IGeneratorConfig) {
        return {
            generatorTemplate: this,
            makeInstance: (() => (async function* () {
                let hasLooped = false;
                while (config.loop === true || !hasLooped) {
                    for (let b of config.batches) {
                        yield b;
                    }
                    hasLooped = true;
                }
            })()),
        }
    }
};

export default explicitGenerator;
