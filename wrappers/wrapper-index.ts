
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import executors from "./executors/executor-index.js"
import validators from "./validators/validator-index.js"

export default [
    ...executors,
    ...validators,
]
