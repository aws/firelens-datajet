
import { IWrapper } from "../../core/ext-types"
import { IBuiltStage, IBuiltStageWrapper } from "../../core/pipeline-types";
import winston from 'winston';
import { ChildProcess, exec } from "child_process";
import crypto from 'crypto';
import { resolve } from 'path';
import fs from "fs";

const WORKSPACE_PATH = "workspace/";
const WORKSPACE_NAME = "fluent-bit";
const FLUENT_REPO = "https://github.com/fluent/fluent-bit.git";

import mustache from 'mustache';
import simpleGit from 'simple-git';

/*
 * Fluent Bit Wrapper
 * Sets up and tears down a fluent bit process
 */

const fullWorkspacePath = resolve(`./${WORKSPACE_PATH}`);

interface IFluentBitWrapperConfig {
    fluentConfigFile: string,
    fluentLogTransports: Array<winston.transports.FileTransportOptions>,
    fluentLogCountOccurrences: Array<string>,
    awaitValidators: boolean,
    grace: number, /* in seconds */
    gitRemote: string,
    gitBranch: string,
    gitCommit: string,
}

const defaultConfig: IFluentBitWrapperConfig = {
    fluentConfigFile: "data-public/fluent-config/fluent.conf",
    awaitValidators: true,
    grace: 0,
    gitRemote: "https://github.com/fluent/fluent-bit.git", /* https://github.com/matthewfala/fluent-bit.git */
    gitBranch: "1.8",
    gitCommit: null,
    fluentLogTransports: [
        {filename: `fluent-bit-${timestamp()}.log`, level: 'info'} /* supports file only right now */
    ],
    fluentLogCountOccurrences: [
        "warn",
        "error",
    ]
}

const fluentBitWrapper: IWrapper = {
    name: "fluent-bit-executor",
    defaultConfig: defaultConfig,
    createConfiguredWrapper: function (config: IFluentBitWrapperConfig, {
        logger
    }) {

        let fluentBitChildProcess: ChildProcess;
        let fluentBitProcessLogger: winston.Logger;
        let fluentLogCounts: {[key: string]: number} = {};

        let fluentLog = (data: string) => {
            const logs = data.toString().split("\n");
            logs.filter(log => log.length > 0).forEach(log => {
                config.fluentLogCountOccurrences.forEach((find) => {
                    let re = new RegExp(find);
                    if (re.test(log)) {
                        /* matched regex */
                        fluentLogCounts[find] = (fluentLogCounts[find] ?? 0) + 1;
                    }
                });
                fluentBitProcessLogger.info(log);
            });
        }

        return {
            wrapperTemplate: this,

            subtreeModifier: (subtree: IBuiltStage) => true, /* modify subtree, potentially inserting other BuiltStageWrappers in subtree */
    
            setup: async (root: IBuiltStage, subtree: IBuiltStage) => {

                /* Configure logger */
                const outputPath = resolve("./output");
                if (!await directoryExists(outputPath)) {
                    await directoryMake(outputPath);
                }
                const outputLogPath = `${outputPath}/fluent-bit-logs`;
                if (!await directoryExists(outputLogPath)) {
                    await directoryMake(outputLogPath);
                }
                fluentBitProcessLogger = winston.createLogger({
                    level: 'info',
                    defaultMeta: { service: 'fluent-bit' },
                    transports: config.fluentLogTransports.map(transport => new winston.transports.File({
                        ...transport,
                        filename: `${outputLogPath}/${transport?.filename ?? "fluent-bit.log"}`,
                    })),
                });

                /* Config path */
                const fluentConfigPath = resolve(config.fluentConfigFile);

                /* Init fluent bit repo if needed */
                const repoPath = `./${WORKSPACE_PATH}/${WORKSPACE_NAME}`;
                const fullRepoPath = resolve(repoPath);
                const fluentConfigWorkspacePath = `${fullWorkspacePath}/fluent-config`

                /* Make folders if needed */
                if (!await directoryExists(fullWorkspacePath)) {
                    await directoryMake(fullWorkspacePath);
                }
                if (!await directoryExists(repoPath)) {
                    await directoryMake(fullRepoPath);
                }

                /* Copy config to workspace */
                const configTemplate = await fileRead(fluentConfigPath);
                const configBaked = mustache.render(configTemplate, {});
                const configId = hash(configBaked);
                if (!await directoryExists(fluentConfigWorkspacePath)) {
                    await directoryMake(fluentConfigWorkspacePath)
                }
                const configBakedPath = `${fluentConfigWorkspacePath}/${configId}.conf`;
                if (!await fileExists(configBakedPath)) {
                    await fileMake(configBakedPath, configBaked);
                }

                /* Init repo if needed */
                const git = simpleGit(fullRepoPath);
                const isRepo = await (directoryExists(`${repoPath}/.git`));
                if (!isRepo) {
                    await initializeRepo(git, FLUENT_REPO);
                }
                await git.fetch();

                /* Checkout remote branch */
                const remoteName = hash(config.gitRemote);
                /*
                const remotes = [];
                await git.listRemote([], (err, data) => {
                    remotes.push(data);
                });
                const remoteExists = remotes.some(remote => remote === remoteName);
                if (!remoteExists) { }
                */
                try {
                    logger.info("Adding remote");
                    await git.addRemote(remoteName, config.gitRemote)
                    .fetch(remoteName, config.gitBranch);
                } catch (e) {
                    logger.info("Remote already exists");
                }

                /* Checkout specific commit */
                if (config.gitCommit) {
                    await git.checkout(config.gitCommit);
                }
                
                /* Checkout remote/branch */
                else {
                    await git.checkout(`${remoteName}/${config.gitBranch}`);
                }

                /* CMake install */
                logger.info("👷 Building Fluent Bit. Stand by...");
                await execChildAsyncWrapper(exec("cmake ..; make", {cwd: `${fullRepoPath}/build`}, (error, stdout, stderr) => {
                    if (error) {
                        logger.debug(`error: ${error.message}`);
                        return;
                    }
                    if (stderr) {
                        logger.debug(`stderr: ${stderr}`);
                        return;
                    }
                    logger.debug(`stdout: ${stdout}`);
                }));
                logger.info("Build succeeded.");

                /* Run Fluent Bit */
                fluentBitChildProcess = exec(`./fluent-bit -c ${fluentConfigPath}`, {cwd: `${fullRepoPath}/build/bin`});
                fluentBitChildProcess.stdout.on('data', (data) => {
                    fluentLog(data);
                });
                fluentBitChildProcess.stderr.on('data', (data) => {
                    fluentLog(data);
                });

                return true;
            },
        
            validation: async (root: IBuiltStage, subtree: IBuiltStage) => {
                await new Promise((resolve, reject) => {

                    /* request shutdown: SigTerm */
                    logger.info("Fluent Bit signalled");
                    fluentBitChildProcess.kill('SIGTERM');
                    
                    /* terminate after grace: SigInt */
                    let graceTimer = setTimeout(() => {
                        fluentBitChildProcess.kill('SIGINT');
                        logger.info("Fluent Bit interrupted");
                        graceTimer = null;
                    }, config.grace * 1000);

                    /* handle exit */
                    fluentBitChildProcess.on("exit", () => {
                        if (graceTimer) {
                            clearTimeout(graceTimer);
                        }
                         logger.info("Fluent Bit exited");
                        resolve(null);
                    });
                });
                return {
                    isValidationSuccess: true,
                    // Other data can be added here for validation metric collection.
                    validationData: {
                        fluentLogCounts: fluentLogCounts,
                        /*fluentBitProcessLogger: fluentBitProcessLogger, */
                    },
                    /* May want to add hidden validation data */
                };
            },
        
            breakdown: async (root: IBuiltStage, subtree: IBuiltStage) => {
                return true;
            },
        
            isValidationAsync: false,
        };
    }
}

function initializeRepo(git, url: string) {
    return git.init()
    .then(() => git.addRemote('origin', url))
}

async function execChildAsyncWrapper(childProcess: ChildProcess) {
    return new Promise((resolve, reject) => {
        childProcess.addListener("error", reject);
        childProcess.addListener("exit", resolve);
    });
}

async function directoryExists(path: string) {
    return new Promise((resolve, reject) => {
        fs.access(path, function(error) {
            if (error) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

async function directoryMake(path: string) {
    return new Promise((resolve, reject) => {
        fs.mkdir(path, function(err) {
            if (err) {
                reject(err);
            } else resolve(null);
        });
    })
}

async function fileRead(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (err, buff) => {
            if (err) {
                reject(err);
            }
            resolve(buff.toString());
        });
    })
}

async function fileExists(path: string) {
    return directoryExists(path);
}

async function fileMake(path: string, contents: string) {
    return new Promise((resolve, reject) => {
        fs.writeFile(path, contents, function (err) {
            if (err) {
                reject(err);
            }
            resolve(null);
        })
    })
}

function hash(item: any): string {
    const str = (typeof item === "string") ? item : JSON.stringify(item);
    return crypto.createHash('md5').update(item).digest('hex');
}

function timestamp(): string {
    return (new Date()).toISOString();
}

export default fluentBitWrapper;