
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IDatajet } from "../core/ext-types.js"
import forwardDatajet from "./forward-datajet.js"
import stdoutDatajet from "./stdout-datajet.js"
import stdcurlDatajet from "./stdcurl-datajet.js"
import tcpDatajet from "./tcp-datajet.js";
import fileDatajet from './file-datajet.js';

const index : Array<IDatajet> = [
    forwardDatajet,
    stdoutDatajet,
    stdcurlDatajet,
    tcpDatajet,
    fileDatajet,
];

export default index;
