
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IWrapper } from "../../core/ext-types"
import { IBuiltStage, IBuiltStageWrapper } from "../../core/pipeline-types";
import winston from 'winston';
import { ChildProcess, exec, execSync, spawn } from "child_process";
import { resolve } from 'path';
import fs from "fs";

const WORKSPACE_PATH = "workspace/";
const WORKSPACE_NAME = "fluent-bit";
const FLUENT_REPO = "https://github.com/fluent/fluent-bit.git";

import mustache, { templateCache } from 'mustache';
import simpleGit from 'simple-git';
import { hash, timestamp } from "../../core/utils.js";

/*
 * Fluent Bit Wrapper
 * Sets up and tears down a fluent bit process
 */

const fullWorkspacePath = resolve(`./${WORKSPACE_PATH}`);

interface ICodeCommitReference {
    repository?: string,
    branch?: string,
    commit?: string,
}

interface ICodeSource {
    base: ICodeCommitReference,
    cherryPicks: Array<ICodeCommitReference>,
    mergeStrategy: string,
}

interface ICodeSourceLock {
    baseCommit: string,
    cherryPickedCommits: Array<string>
    mergeStrategy: string,
}

interface IFluentBitWrapperConfig {
    outputFolder: string,
    codeSource: ICodeSource,
    fluentConfigFile: string,
    fluentLogTransports: Array<winston.transports.FileTransportOptions>,
    fluentLogCountOccurrences: Array<string>,
    awaitValidators: boolean,
    grace: number, /* in seconds */
}

interface IFluentLock {
    sourceLock: ICodeSourceLock,
    configLock: string,
}

const defaultCodeCommitReference: ICodeCommitReference = {
    repository: "https://github.com/fluent/fluent-bit.git",
    branch: "master",
}

const defaultCherryPickMergeStrategy = "ort";

const defaultCodeSource: ICodeSource = {
    base: defaultCodeCommitReference,
    cherryPicks: [],
    mergeStrategy: "",
}

const defaultConfig: IFluentBitWrapperConfig = {
    outputFolder: "Unfiled",
    codeSource: defaultCodeSource,
    fluentConfigFile: "data-public/fluent-config/fluent.conf",
    awaitValidators: true,
    grace: 0,
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
        logger,
        localPipelineSchema,
        workspaceRoot,
        setManagedVariable,
        variables,
    }) {

        let fluentBitChildProcess: ChildProcess;
        let fluentBitProcessLogger: winston.Logger;
        let fluentLogCounts: {[key: string]: number} = {};

        let loggerLogStd = (data: string, logger: winston.Logger) => {
            const logs = data.toString().split("\n");
            logs.filter(log => log.length > 0).forEach(log => {
                config.fluentLogCountOccurrences.forEach((find) => {
                    let re = new RegExp(find);
                    if (re.test(log)) {
                        /* matched regex */
                        fluentLogCounts[find] = (fluentLogCounts[find] ?? 0) + 1;
                    }
                });
                logger.info(log);
            });
        }

        let fluentLog = (data: string) => {
            loggerLogStd(data, fluentBitProcessLogger);
        }

        return {
            wrapperTemplate: this,

            subtreeModifier: (subtree: IBuiltStage) => true, /* modify subtree, potentially inserting other BuiltStageWrappers in subtree */
    
            setup: async (root: IBuiltStage, subtree: IBuiltStage) => {

                /* Config path */
                const fluentConfigPath = resolve(config.fluentConfigFile);

                /* Init fluent bit repo if needed */
                const repoPath = `${workspaceRoot}/${WORKSPACE_NAME}`;
                const fullRepoPath = resolve(repoPath);
                const fluentConfigWorkspacePath = `${workspaceRoot}/fluent-config`

                /* Make folders if needed */
                if (!await directoryExists(workspaceRoot)) {
                    await directoryMake(workspaceRoot);
                }
                if (!await directoryExists(repoPath)) {
                    await directoryMake(fullRepoPath);
                }

                /* Clear workspace temp folder */
                const tmpFolder = `${workspaceRoot}/tmp`;
                if (await directoryExists(tmpFolder)) {
                    await directoryDelete(tmpFolder);
                    await directoryMake(tmpFolder);
                }
                else {
                    await directoryMake(tmpFolder);
                }
                setManagedVariable("workspaceTmp", resolve(tmpFolder));

                /* Copy config to workspace */
                let configTemplate;
                try {
                    configTemplate = await fileRead(fluentConfigPath);
                } catch (e) {
                    logger.error(`Unable to read file: ${fluentConfigPath}`);
                    return false;
                }

                /* Init repo if needed */
                const git = simpleGit(fullRepoPath);
                const isRepo = await (directoryExists(`${repoPath}/.git`));
                if (!isRepo) {
                    await initializeRepo(git, FLUENT_REPO);
                    await git.raw(['config', `user.email`, `"firelens@amazon.com"`]);
                    await git.raw(['config', `user.name`, `"FireLens Datajet"`]);
                }
                await git.fetch();

                /* Amend code source repository and branch references */
                const amendCodeRepositoryAndBranchReference = async (ref: ICodeCommitReference) => ({
                    ...defaultCodeCommitReference,
                    ...ref,
                });
                const amendedCodeSourcePart: ICodeSource = {
                    base: await amendCodeRepositoryAndBranchReference(config.codeSource.base),
                    cherryPicks: (config.codeSource.cherryPicks) ? await Promise.all(config.codeSource.cherryPicks.map(amendCodeRepositoryAndBranchReference)) : [],
                    mergeStrategy: ((config.codeSource.cherryPicks?.length ?? 0) !== 0) ?
                        config.codeSource.mergeStrategy ?? defaultCherryPickMergeStrategy :
                        "", // no merge strategy for [] cherry picks list
                }

                /* Accumulate fetch list (for updated commits) */
                interface ICodeFetch {
                    repository: string,
                    branch: string,
                };
                const removeDuplicates = (a: Array<ICodeFetch>) => {
                    return Array.from(new Set(a.map(ftch => JSON.stringify(ftch))))
                        .map(strParse => JSON.parse(strParse)) as Array<ICodeFetch>;
                }
                const fetches: Array<ICodeFetch> = removeDuplicates(
                    [
                        amendedCodeSourcePart.base,
                        ...amendedCodeSourcePart.cherryPicks,
                    ].map(ref => ({
                        repository: ref.repository,
                        branch: ref.branch,
                    }))
                );

                const fetchResults = fetches.map(async fetch => git.fetch(fetch.repository, fetch.branch));
                await Promise.all(fetchResults);

                /* Amend code source commit reference */
                const amendCodeCommitReference = async (ref: ICodeCommitReference) => {
                    const amended = {
                        ...defaultCodeCommitReference,
                        ...ref,
                    };
                    if (!amended?.commit) {
                        const commitHash = await git.raw(['ls-remote', `${amended.repository}`, `${amended.branch}`]);
                        amended.commit = commitHash.split("\t")[0];
                    }
                    return amended;
                };
                const amendedCodeSource: ICodeSource = {
                    base: await amendCodeCommitReference(amendedCodeSourcePart.base),
                    cherryPicks: await Promise.all(amendedCodeSourcePart.cherryPicks.map(amendCodeCommitReference)),
                    mergeStrategy: (amendedCodeSourcePart.cherryPicks.length !== 0) ?
                        amendedCodeSourcePart.mergeStrategy ?? defaultCherryPickMergeStrategy :
                        "", // no merge strategy for [] cherry picks list
                }

                /* Source lock */
                const sourceLock: ICodeSourceLock = {
                    baseCommit: amendedCodeSource.base.commit,
                    cherryPickedCommits: amendedCodeSource.cherryPicks.map(ref => ref.commit),
                    mergeStrategy: amendedCodeSource.mergeStrategy,
                }
                const sourceLockHash = hash(sourceLock);

                /* Checkout branch */
                const sourceLockedBranchName = `source-lock-${sourceLockHash}`;
                let makeSourceBranch = false;
                try {
                    /* git reset --hard to avoid gitignore induced problems */
                    await git.reset(["--hard"]); 
                    await git.checkout(sourceLockedBranchName);
                }
                catch {
                    logger.info(`Creating new source locked branch: ${sourceLockedBranchName}`);
                    makeSourceBranch = true;
                }

                if (makeSourceBranch) {

                    /* Make branch */
                    await git.checkout(["-b", sourceLockedBranchName, sourceLock.baseCommit]);
                    
                    try {
                        /* Cherry picks */
                        for (const cherry of sourceLock.cherryPickedCommits) {
                            await git.raw(['cherry-pick', `--strategy=${sourceLock.mergeStrategy}`, cherry]);
                        }
                    }
                    catch (e) {
                        /* Cherry picks fail - delete branch */
                        await git.reset(["--hard"]);
                        await git.checkout("-");
                        await git.deleteLocalBranch(sourceLockedBranchName, true);
                        logger.error(`Cherry picks failed. Deleted failed sourceLockedBranch ${sourceLockedBranchName}`);
                        throw e;
                    }
                }

                /* Create fluent-lock.json */
                const fluentLock: IFluentLock = {
                    sourceLock: sourceLock,
                    configLock: configTemplate,
                }
                const fluentLockHash = hash(fluentLock);

                /* Write source records */
                const outputParentPath = resolve("./output");
                if (!await directoryExists(outputParentPath)) {
                    await directoryMake(outputParentPath);
                }
                const outputPath = resolve(`${outputParentPath}/${config.outputFolder}`);
                if (!await directoryExists(outputPath)) {
                    await directoryMake(outputPath);
                }
                const outputFluentLockedPath = `${outputPath}/fluent-lock-${fluentLockHash}`;
                if (!await directoryExists(outputFluentLockedPath)) {
                    await directoryMake(outputFluentLockedPath);
                }
                setManagedVariable("outputPath", outputFluentLockedPath);
                const fluentLockFilePath = `${outputFluentLockedPath}/fluent-lock.json`;
                if (!await fileExists(fluentLockFilePath)) {
                    await fileMake(fluentLockFilePath, JSON.stringify(fluentLock, null, 2));
                }
                const sourceLockInfoFilePath = `${outputFluentLockedPath}/source-lock-info.json`;
                const sourceLockInfo = {
                    sourceLockBranch: sourceLockedBranchName,
                    sourceLockHash: sourceLockHash,
                    sourceLock: sourceLock,
                }
                if (!await fileExists(sourceLockInfoFilePath)) {
                    await fileMake(sourceLockInfoFilePath, JSON.stringify(sourceLockInfo, null, 2));
                }
                const fluentConfigFilePath = `${outputFluentLockedPath}/fluent-bit-template.conf`
                if (!await fileExists(fluentConfigFilePath)) {
                    await fileMake(fluentConfigFilePath, configTemplate);
                }

                /* Write test records */
                const outputTestPath = `${outputFluentLockedPath}/test-${timestamp()}`;
                if (!await directoryExists(outputTestPath)) {
                    await directoryMake(outputTestPath);
                }
                setManagedVariable("testPath", outputTestPath);
                const testByproductPath = `${outputTestPath}/byproduct`;
                if (!await directoryExists(testByproductPath)) {
                    await directoryMake(testByproductPath);
                }
                setManagedVariable("testByproductPath", testByproductPath);
                const fluentPipelineSchemaFilePath = `${outputTestPath}/test-pipeline-schema.json`
                if (!await fileExists(fluentPipelineSchemaFilePath)) {
                    await fileMake(fluentPipelineSchemaFilePath, JSON.stringify(localPipelineSchema, null, 2));
                }
                const fluentFullSourcePath = `${outputTestPath}/source.json`
                if (!await fileExists(fluentFullSourcePath)) {
                    await fileMake(fluentFullSourcePath, JSON.stringify(amendedCodeSource, null, 2));
                }
                const outputInstrumentationPath = `${outputTestPath}/instrumentation`;
                if (!await directoryExists(outputInstrumentationPath)) {
                    await directoryMake(outputInstrumentationPath);
                }

                /* Render baked config file (now that all managed variables are set) */
                const configBaked = mustache.render(configTemplate, variables);
                const configId = hash(configBaked);
                if (!await directoryExists(fluentConfigWorkspacePath)) {
                    await directoryMake(fluentConfigWorkspacePath)
                }
                const configBakedPath = `${fluentConfigWorkspacePath}/${configId}.conf`;
                if (!await fileExists(configBakedPath)) {
                    await fileMake(configBakedPath, configBaked);
                }
                const fluentBakedConfigFilePath = `${outputTestPath}/fluent-bit.conf`
                if (!await fileExists(fluentBakedConfigFilePath)) {
                    await fileMake(fluentBakedConfigFilePath, configBaked);
                }

                /* Configure Fluent Bit, make, and cmake loggers */
                const outputLogPath = `${outputTestPath}/logs`;
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
                const cmakeProcessLogger = winston.createLogger({
                    level: 'info',
                    transports: config.fluentLogTransports.map(transport => new winston.transports.File({
                        filename: `${outputLogPath}/cmake.log`,
                    })),
                });
                const makeProcessLogger = winston.createLogger({
                    level: 'info',
                    transports: config.fluentLogTransports.map(transport => new winston.transports.File({
                        filename: `${outputLogPath}/make.log`,
                    })),
                });

                /* CMake & make build */
                logger.info("👷 Building Fluent Bit. Stand by...");
                let buildFailed = false;
                try {
                    /* CMake */
                    await execChildAsyncWrapper((() => {
                        const childProcess = exec("cmake ..", {cwd: `${fullRepoPath}/build`}, (error, stdout, stderr) => {
                        if (error) {
                            logger.error("CMake failed");
                            loggerLogStd(error.message, cmakeProcessLogger);
                            // cmakeProcessLogger.info(`error: ${error.message}\n`);
                            buildFailed = true;
                            return;
                        }
                        if (stderr) {
                            loggerLogStd(stderr, cmakeProcessLogger);
                            // cmakeProcessLogger.info(`stderr: ${stderr}\n`);
                            return;
                        }
                        loggerLogStd(stdout, cmakeProcessLogger);
                        });
                        return childProcess;
                    })());
                    /* Make */
                    await execChildAsyncWrapper((() => {
                        const childProcess = exec("make", {cwd: `${fullRepoPath}/build`}, (error, stdout, stderr) => {
                            if (error) {
                                logger.error("Make failed");
                                loggerLogStd(error.message, makeProcessLogger);
                                buildFailed = true;
                                childProcess.kill();
                                return;
                            }
                            if (stderr) {
                                loggerLogStd(stderr, makeProcessLogger);
                                return;
                            }
                            loggerLogStd(stdout, makeProcessLogger);
                        });
                        return childProcess
                    })());
                } catch (e) {
                    buildFailed = true;
                }
                if (buildFailed) {
                    logger.error("Build failed.");
                    return false;
                }
                logger.info("Build succeeded.");

                /* Archive Fluent Bit executable */
                await fileCopy(`${fullRepoPath}/build/bin/fluent-bit`, `${testByproductPath}/fluent-bit`);

                /* Run Fluent Bit */
                logger.info("Running Fluent Bit.");
                fluentBitChildProcess = spawn(`ulimit -c unlimited; ./fluent-bit -c '${fluentBakedConfigFilePath}'`, {
                    cwd: `${fullRepoPath}/build/bin`,
                    env: {
                        ...process.env,
                        "FLB_INSTRUMENTATION_OUT_PATH": outputInstrumentationPath,
                    },
                    shell: true
                });
                fluentBitChildProcess.stdout.on('data', (data) => {
                    fluentLog(data);
                });
                fluentBitChildProcess.stderr.on('data', (data) => {
                    fluentLog(data);
                });
                fluentBitChildProcess.on('error', (error) => logger.error(`Fluent Bit Process error: ${error.message}`))

                return true;
            },
        
            validation: async (root: IBuiltStage, subtree: IBuiltStage) => {
                await new Promise((resolve, reject) => {

                    /* request shutdown: SigTerm */
                    logger.info("Fluent Bit signalled");
                    fluentBitChildProcess.kill('SIGTERM');
                    
                    /* terminate after grace: SigInt */
                    let graceTimer = setTimeout(() => {
                        fluentBitChildProcess.kill('SIGKILL');
                        logger.info("Fluent Bit killed");
                        graceTimer = null;
                        logger.info("Fluent Bit exited (killed)");
                        resolve(null);
                    }, config.grace * 1000);

                    /* handle exit */
                    fluentBitChildProcess.on("exit", () => {
                        if (graceTimer) {
                            clearTimeout(graceTimer);
                        }
                        logger.info("Fluent Bit exited (stopped)");
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

async function directoryDelete(path: string) {
    return new Promise((resolve, reject) => {
        fs.rm(path, { recursive: true }, (err) => {
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
                return reject(err);
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

async function fileCopy(source: string, destination: string) {
    return new Promise((resolve, reject) => {
        fs.copyFile(source, destination, function(err) {
            if (err) {
                reject(err);
            } else resolve(null);
        });
    })
}

export default fluentBitWrapper;