
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ILogData, IValidator } from "../core/ext-types"
import { IBuiltStage, IBuiltStageWrapper } from "../core/pipeline-types";
const fs = require('fs');
const readline = require('readline');
const DATA_PATH = "data/"

/*
 * Cloudwatch validator
 * Sets up and tears down cloudwatch
 */

interface ICloudwatchValidatorConfig {
    "dataFilename": string;
    "batchSize": number;
}

const cloudwatchValidator: (ICloudwatchValidatorConfig) => IConfiguredValidator = {
    name: "cloudwatch",
    
    subtreeModifier: (subtree: IBuiltStage) => true, /* modify subtree, potentially inserting other BuiltStageWrappers in subtree */
    
    setup: async (root: IBuiltStage, subtree: IBuiltStage) => {
        return true;
    },

    validation: async (root: IBuiltStage, subtree: IBuiltStage) => {
        return {
            isValidationSuccess: true,
            // Other data can be added here for validation metric collection.
            validationData: {},
        };
    },

    breakdown: async (root: IBuiltStage, subtree: IBuiltStage) => {
        return true;
    },

    isValidationAsync: false,
};

export default cloudwatchValidator;