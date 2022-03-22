
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import validatorIndex from "../validators/validator-index.js"
import lineByLineGenerator from "./line-by-line-generator.js"
import reverseCSVGenerator from "./reverse-csv-generator.js"
import csvGenerator from "./csv-generator.js"
import incrementGenerator from "./increment-generator.js"
import colorLoggerGenerator from "./color-logger-generator.js"
import referenceGenerator from "./reference-generator.js"
import basicGenerator from "./basic-generator.js"

export default [
    lineByLineGenerator,
    reverseCSVGenerator,
    csvGenerator,
    incrementGenerator,
    colorLoggerGenerator,
    referenceGenerator,
    basicGenerator,
    ...validatorIndex,
]
