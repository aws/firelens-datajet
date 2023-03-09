
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IWrapper } from "../core/ext-types"
import { IBuiltStage, IBuiltStageWrapper } from "../core/pipeline-types";
import winston from 'winston';
import { ChildProcess, exec, spawn } from "child_process";
import { resolve } from 'path';
import fs from "fs";

interface IContainerConfig {
}

const defaultConfig: IContainerConfig = {
}

/*
 * Container Wrapper
 * This essentially does nothing, but allows for Library and Definitions to be added
 * to children elements
 */


const containerWrapper: IWrapper = {
    name: "container",
    defaultConfig: {},
    modifySubschema: (subschema)=>subschema,
    createConfiguredWrapper: function (config: IContainerConfig, _) {

        return {
            wrapperTemplate: this,
    
            setup: async (root: IBuiltStage, subtree: IBuiltStage) => {

                return true;
            },
        
            validation: async (root: IBuiltStage, subtree: IBuiltStage) => {
              
                return {
                    isValidationSuccess: true,
                    /*  Other data can be added here for validation metric collection. */
                    validationData: {
                    },
                    
                    /* May want to add hidden validation data */
                };
            },
        
            breakdown: async (root: IBuiltStage, subtree: IBuiltStage) => {
                return true;
            },
        
            isValidationAsync: true,
        };
    }
}

export default containerWrapper;