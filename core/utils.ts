
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { serialize } from "v8";
import crypto from 'crypto';

import highwayhash from "highwayhash";
const key = Buffer.from('50069d41f480683272f38acee70a054611190cfe09c2ecd82aa4aaadb91a879c', 'hex');

export function hash(item: any): string {
    /*return highwayhash.asHexString(key, serialize(item));*/
    /* this is too slow */
    const str = (typeof item === "string") ? item : JSON.stringify(item);
    return crypto.createHash('md5').update(str).digest('hex');
}

export function timestamp(): string {
    return (new Date()).toISOString();
}

export function difer(cb: () => any): any {
    return new Promise(async (resolve: (any) => void) => setTimeout(async () => { resolve(await cb()) }, 0));
}