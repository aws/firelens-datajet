
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import { IDatajet, ILogData } from "../core/ext-types.js";

interface IDatajetConfig {
    folder: string,
    filename: string,
    logKey: string,
    maxFileSizeBytes?: number,
    maxRotatedFiles?: number,
}

const defaultConfig: IDatajetConfig = {
    folder: "./workspace/tmp",
    filename: "output-logs.log",
    logKey: "log",
    // Rotation is controlled by maxFileSizeBytes — if unset, a single file is written indefinitely (original behaviour).
    // maxRotatedFiles controls how many rotated files to retain (default 5) and only applies when rotation is active.
    // For stability tests, these are set via datajet_file_max_size_bytes in
    // apps/firelens-stability/templates/golden-path-mountebank-fargate-v01-11-2023/default-config.json
}

const fileDatajet: IDatajet = {
    name: "file",
    defaultConfig: defaultConfig,
    createConfiguredDatajet: function (config: IDatajetConfig) {

        let fileIndex = 0;
        let logStream: fs.WriteStream | null = null;

        const openNextStream = () => {
            // If rotation is enabled, use numbered files; otherwise use the configured filename as-is
            const filename = config.maxFileSizeBytes
                ? `${config.filename}_${++fileIndex}.txt`
                : config.filename;
            const file = path.resolve(`${config.folder}/${filename}`);
            return fs.createWriteStream(file, { flags: 'a' });
        };

        return {
            datajetTemplate: this,
            transmitBatch: async (batch: Array<ILogData>) => {
                if (!logStream) {
                    logStream = openNextStream();
                }
                const len = batch.length;
                for (let i = 0; i < len; ++i) {
                    const log = batch[i];
                    logStream.write((config.logKey) ?
                        `${log[config.logKey] ?? "null"}\n` :
                        ((typeof log === "object") ?
                            `${JSON.stringify(log)}\n` :
                            log ?? "null"));

                    // Roll to next file mid-batch if size limit reached
                    if (config.maxFileSizeBytes > 0 && logStream.bytesWritten >= config.maxFileSizeBytes) {
                        await new Promise<void>((resolve) => logStream.end(resolve));
                        logStream = openNextStream();

                        // Delete oldest file if we've exceeded maxRotatedFiles
                        const maxFiles = config.maxRotatedFiles;
                        if (maxFiles > 0) {
                            const oldestIndex = fileIndex - maxFiles;
                            if (oldestIndex >= 1) {
                                const oldest = path.resolve(`${config.folder}/${config.filename}_${oldestIndex}.txt`);
                                try {
                                    if (fs.existsSync(oldest)) fs.unlinkSync(oldest);
                                } catch (e) {
                                    console.warn(`Failed to delete rotated file ${oldest}: ${e}`);
                                }
                            }
                        }
                    }
                }
                return true;
            }
        }
    }
}

export default fileDatajet;
