
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import fileClient from "./file-client.js"
import requestClient from "./request-client.js"
import environmentClient from "./environment-client.js"

export default [
    fileClient,
    requestClient,
    environmentClient,
]
