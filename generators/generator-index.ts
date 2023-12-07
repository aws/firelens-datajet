
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import validatorIndex from "./validators/validator-index.js"
import fileGenerator from "./file-generator.js"
import csvGenerator from "./csv-generator.js"
import incrementGenerator from "./increment-generator.js"
import colorLoggerGenerator from "./color-logger-generator.js"
import referenceGenerator from "./reference-generator.js"
import basicGenerator from "./basic-generator.js"
import explicitGenerator from "./explicit-generator.js"
import s3Generator from "./s3-generator.js"

export default [
    fileGenerator,
    csvGenerator,
    incrementGenerator,
    colorLoggerGenerator,
    referenceGenerator,
    basicGenerator,
    explicitGenerator,
    s3Generator,
    ...validatorIndex,
]
