import { resolve } from "path";
import winston from "winston";
import { IComponentDependencies } from "./ext-types";

export function initDependencies(): IComponentDependencies {
    const logger = winston.createLogger({
        level: 'info',
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
    };
}