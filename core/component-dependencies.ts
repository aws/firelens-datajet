
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolve } from "path";
import winston from "winston";
import { IBuiltStage } from "./pipeline-types";
import { IPipelineSchema } from "./rockefeller";

export interface IComponentDependencies {
    logger: winston.Logger,
    dataRoot: string,
    workspaceRoot: string,
    library: { [key: string]: IBuiltStage },
    localPipelineSchema: IPipelineSchema,
    pipelineSchema: IPipelineSchema, /* pipeline schema at root */
    variables: {
        managed: {[key: string]: any},
        defined: {[key: string]: any},
    }
    setManagedVariable: (key: string, value: any) => void,
}

export function initDependencies(buildSchema: IPipelineSchema): IComponentDependencies {
    const logger = winston.createLogger({
        level: 'debug',
        /* stylize the logs to a familiar format... */
        format: winston.format.printf((info) => `[${info.level}] ${info.message}`),
        transports: [
            //
            // - Write all logs with importance level of `error` or less to `error.log`
            // - Write all logs with importance level of `info` or less to `combined.log`
            //
            new winston.transports.Console(),
            /*new winston.transports.File({ filename: 'error.log', level: 'error' }),
            new winston.transports.File({ filename: 'combined.log' }),*/
        ],
    });
    return {
        logger,
        dataRoot: resolve("./data"),
        workspaceRoot: resolve("./workspace"),
        library: {},
        localPipelineSchema: buildSchema,
        pipelineSchema: buildSchema,
        variables: {
            managed: {
                workspaceRoot: resolve("./workspace"),
                dataRoot: resolve("./data"),
            },
            defined: {},
        },
        setManagedVariable: (key: string, value: any) => {},
    };
}
