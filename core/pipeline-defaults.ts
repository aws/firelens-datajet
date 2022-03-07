
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IExecutePipelineConfig } from "./pipeline-types.js";

/* Default pipeline configuration values */
const pipelineConfigDefaults: Required<IExecutePipelineConfig> = {


    validationFailureAction: "terminate",
    executionFailureAction: "terminate",
    onValidationFailure: async () => {},
    onExecutionFailure: async () => {},


}
export default pipelineConfigDefaults;