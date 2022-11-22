
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IExecutePipelineConfig, ISynchronizerConfig } from "./pipeline-types.js";

/* Default pipeline configuration values */
const pipelineConfigDefaults: Required<IExecutePipelineConfig> = {


    validationFailureAction: "terminate",
    executionFailureAction: "terminate",
    onValidationFailure: async () => {},
    onExecutionFailure: async () => {},


}

export const synchronizerConfigDefaults: ISynchronizerConfig = {
    repeat: 1, /* repeats the full stage, including the before and after wait */
    waitBefore: 0, /* seconds */
    waitAfter: 0,
    waitBetween: 0, /* not used if async */
    awaitAsyncValidators: false, /* await all children validators that are async, default false */
    isAsync: true,
}

export default pipelineConfigDefaults;