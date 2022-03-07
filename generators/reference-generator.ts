
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IBatchGenerator, IComponentDependencies, IConfiguredGenerator } from "../core/ext-types.js"

/* 
 * Reference Generator
 * This generator references a generator specified in a
 * parent library
 */

interface IGeneratorConfig {
    ref: string, 
}

const defaultConfig: IGeneratorConfig = {
    ref: "",
};

const referenceGenerator: IBatchGenerator = {
    name: "reference",
    defaultConfig: defaultConfig,
    createConfiguredGenerator: function (config: IGeneratorConfig, dependencies: IComponentDependencies) {
        return dependencies.library[config["ref"]].data as IConfiguredGenerator;
    }
};

export default referenceGenerator;