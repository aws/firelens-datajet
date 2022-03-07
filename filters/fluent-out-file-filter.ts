
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ILogData } from "../core/ext-types";

const filterBatch = (batch: Array<ILogData>) => {
    batch.map(log => {
        log.text = log.text
    })
}