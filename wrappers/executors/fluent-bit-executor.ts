
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
import pidusage from 'pidusage';

const WORKSPACE_PATH = "workspace/";
const WORKSPACE_NAME = "fluent-bit";
const FLUENT_REPO = "https://github.com/fluent/fluent-bit.git";

import mustache, { templateCache } from 'mustache';
import simpleGit from 'simple-git';
import { hash, timestamp } from "../../core/utils.js";
import fetch from "node-fetch";

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
        const stacktraceStartDelay = 7000;
        const stacktraceBetweenDelay = 120000;
        const pidLoggerBetweenDelay = 120000; //120000;
        const restLoggerWaitBefore = 5000;
        const restLoggerWaitBetween = 120000;
        let datajetCrashSequenceInterval: NodeJS.Timer;
        let stackTraceLoggerInterval: NodeJS.Timer;
        let pidLoggerInterval: NodeJS.Timer;
        let apiScraperInterval: NodeJS.Timer;
        let apiScraperEndpoint = "http://127.0.0.1:2020"
        let apiScraperQueries = [
            {
                "uri": "/api/v1/uptime",
                "name": "uptime"
            },
            {
                "uri": "/api/v1/metrics",
                "name": "metrics"
            },
            /*{ // NOT JSON FORMAT
                "uri": "/api/v1/metrics/prometheus",
                "name": "prometheus"
            },*/
            {
                "uri": "/api/v1/storage",
                "name": "storage"
            },
            /*{ // JSON Evaluation fails
                "uri": "/api/v1/health",
                "name": "health"
            }*/
        ]

        // const stacktraceCommandWrapper = `(sleep ${stacktraceStartDelay}; while true; do sleep ${stacktraceBetweenDelay}; echo 'thread apply all bt full' | gdb -p \`pgrep fluent-bit\` > "${stacktracePath}/\`date +%s%N\`"; done)`;

        const initStacktraceLogger = async (childProcess: ChildProcess, outputTestPath: string) => {
            /* Temp - Recurring Stacktrace */
            const stacktracePath = `${outputTestPath}/instrumentation/stacktrace`;
            if (!await directoryExists(stacktracePath)) {
                await directoryMake(stacktracePath);
            }

            setTimeout(async () => {
                stackTraceLoggerInterval = setInterval(() => {
                    exec(`echo 'thread apply all bt full' | gdb -p ${childProcess.pid} > "${stacktracePath}/\`date +%s%N\`"`, _=>{});
                }, stacktraceBetweenDelay);
            }, stacktraceStartDelay);
//                    `(sleep ${stacktraceStartDelay}; while true; do sleep ${stacktraceBetweenDelay}; echo 'thread apply all bt full' | gdb -p \`pgrep fluent-bit\` > "${stacktracePath}/\`date +%s%N\`"; done)`
        }

        const cleanUpStacktraceLogger = () => {
            clearInterval(stackTraceLoggerInterval);
        }

        const initPidLogger = async (childProcess: ChildProcess, outputTestPath: string) => {
            /* Temp - Recurring Memory and CPU */
            if (pidLoggerInterval === undefined) {
                //exec("pgrep fluent-bit", async (err, stdout, stderr) => {
                //const pidFluentBitProcess = stdout.replace("\n","");
                const pidStatsPath = `${outputTestPath}/instrumentation/pid-stats`;
                if (!await directoryExists(pidStatsPath)) {
                    await directoryMake(pidStatsPath);
                }
                /* Attach to process */
                // const pidLoggerStartDelay = 3000;
                pidLoggerInterval = setInterval(() => {
                    pidusage(childProcess.pid, function (err, stats) {
                        // => {
                        //   cpu: 10.0,            // percentage (from 0 to 100*vcore)
                        //   memory: 357306368,    // bytes
                        //   ppid: 312,            // PPID
                        //   pid: 727,             // PID
                        //   ctime: 867000,        // ms user + system time
                        //   elapsed: 6650000,     // ms since the start of the process
                        //   timestamp: 864000000  // ms since epoch
                        // }

                        // Add filedescriptor count
                        exec(`lsof -p ${childProcess.pid} | wc -l`, (_,stdout,__)=> {
                            stats = {...stats, fds: stdout.replace("\n", "")}
                            fs.appendFile(pidStatsPath + "/fluent-bit-pid-stats.log", JSON.stringify(stats, null, 2) + ",\n", _=>{});
                        });

                    });
                    const stats = {
                        timestamp: Date.now(),
                        cpu: process.cpuUsage(),
                        memory: process.memoryUsage()
                    };
                    fs.appendFile(pidStatsPath + "/firelens-datajet-pid-stats.log", JSON.stringify(stats, null, 2) + ",\n", _=>{});
                }, pidLoggerBetweenDelay);
                //});                      
            }
        }

        const cleanUpPidLogger = () => {
            clearInterval(pidLoggerInterval);
        }

        const initRestLogger = async (childProcess: ChildProcess, outputTestPath: string) => {
            setTimeout(async () => {
                const restLoggerPath = `${outputTestPath}/instrumentation/rest`;
                if (!await directoryExists(restLoggerPath)) {
                    await directoryMake(restLoggerPath);
                }
                apiScraperInterval = setInterval(async () => {
                    const resps = await Promise.all(apiScraperQueries.map(async a => ({
                        uri: a.uri,
                        name: a.name,
                        data: await fetch(apiScraperEndpoint + a.uri).catch(reason => ({json: () =>({"error": "API request failed"})}))
                    })));
                    
                    resps.forEach(async resp => {
                        // const textResponse = await resp.data.text();
                        let jsonResponse = {};
                        try {
                            jsonResponse = await resp.data.json();
                        }
                        catch {
                            jsonResponse = {"error": "API is not active"};
                        }
                        fs.appendFile(restLoggerPath + "/" + resp.name + ".log", JSON.stringify({"timestamp": Date.now(), ...(jsonResponse as Object)}, null, 2) + ",\n", _=>{});
                    })
                }, restLoggerWaitBetween);
            }, restLoggerWaitBefore);
        }


        const cleanUpRestLogger = async () => {
            clearInterval(apiScraperInterval);
        }
        
        const crashSequenceDatajetMemoryThreshold = 1 * 1_000_000_000;
        const initDatajetCrashSequence = async (childProcess: ChildProcess, outputTestPath: string) => {
            /* Monitor Datajet Memory Utilization */
            setTimeout(() => {
                datajetCrashSequenceInterval = setInterval(async () => {
                    /* Check if datajet is running out of memory quickly (mem usage > 1 gig). */
                    if (process.memoryUsage().rss > crashSequenceDatajetMemoryThreshold) {
                        clearInterval(datajetCrashSequenceInterval);
                        logger.info("Firelens Datajet memory consumption has passed 1GB. Initiallizing crash sequence.");

                        const crashDumpPath = `${outputTestPath}/crashdump`;
                        if (!await directoryExists(crashDumpPath)) {
                            await directoryMake(crashDumpPath);
                        }

                        logger.info("Generating coredump");
                        try {
                            execSync(`cd ${crashDumpPath}; ulimit -c unlimited; gcore ${childProcess.pid}`);
                        } catch {
                            logger.info("failed to generate core dump");
                        }

                        const crashDump = `${crashDumpPath}/crashdump.log`;
                        if (!await fileExists(crashDump)) {
                            await fileMake(crashDump,
`Crash Dump:
Fluent Bit PIDs "pgrep fluent-bit": ${execSync("pgrep fluent-bit")}

Fluent Bit Child Process:
PID: ${childProcess.pid},
EXIT CODE: ${childProcess.exitCode},
Killed?: ${childProcess.killed},

TCP File Descriptors
${execSync(`sudo lsof -p ${childProcess.pid} | grep TCP`)}

All File Descriptors
${execSync(`sudo lsof -p ${childProcess.pid}`)}
`
                            );
                        };

                        logger.info("Sending a SIGSEV to fluent bit (artifical segfault) for a core dump");
                        childProcess.kill("SIGSEGV");
                    }
                }, 1000);
            }, 3000);
        }

        const cleanUpDatajetCrashSequence = () => {
            clearInterval(datajetCrashSequenceInterval);
        }

        const instrumentsInitializers = [
            initStacktraceLogger,
            initPidLogger,
            initRestLogger,
            initDatajetCrashSequence
        ]

        const instrumentsCleanup = [
            cleanUpStacktraceLogger,
            cleanUpPidLogger,
            cleanUpRestLogger,
            cleanUpDatajetCrashSequence
        ]

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

                logger.add(new winston.transports.File({
                    filename: `${outputLogPath}/datajet.log`,
                }));

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
                /*
                // RUN WITH COREDUMP
                logger.info("Running Fluent Bit.");
                fluentBitChildProcess = spawn(`${stacktraceCommandWrapper} & ulimit -c unlimited; ./fluent-bit -c '${fluentBakedConfigFilePath}'`, {
                    cwd: `${fullRepoPath}/build/bin`,
                    env: {
                        ...process.env,
                        "FLB_INSTRUMENTATION_OUT_PATH": outputInstrumentationPath,
                    },
                    shell: true
                });*/

                /* Run Fluent Bit */
                // NO STACK TRACE
                logger.info("Running Fluent Bit.");
                fluentBitChildProcess = spawn(`./fluent-bit`, [ `-c`, `${fluentBakedConfigFilePath}`], {
                    cwd: `${fullRepoPath}/build/bin`,
                    env: {
                        "FLB_INSTRUMENTATION_OUT_PATH": outputInstrumentationPath
                    }
                });

                /* Make sure to kill on exit */
                process.on("exit", () => {
                    if (!fluentBitChildProcess.killed) {
                        fluentBitChildProcess.kill();
                    }
                })

                fluentBitChildProcess.stdout.on('data', async (data) => {
                    fluentLog(data);
                });
                fluentBitChildProcess.stderr.on('data', (data) => {
                    fluentLog(data);
                });
                fluentBitChildProcess.on('error', (error) => logger.error(`Fluent Bit Process error: ${error.message}`));
                instrumentsInitializers.forEach(ins => {
                    ins(fluentBitChildProcess, outputTestPath);
                });

                /* handle exit */
                fluentBitChildProcess.on("exit", () => {
                    
                    clearInterval(pidLoggerInterval);
                    cleanUpRestLogger();
                    cleanUpStacktraceLogger();
                    
                    logger.info("Fluent Bit exited (stopped)");
                    logger.info("Timestamp: " + Date.now());
                    logger.info(`Fluent Bit exit code: ${fluentBitChildProcess.exitCode}`);
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
                        fluentBitChildProcess.kill('SIGKILL');
                        logger.info("Fluent Bit killed");
                        graceTimer = null;
                        logger.info("Fluent Bit exited (killed)");
                        instrumentsCleanup.forEach(insCleanup => {
                            insCleanup();
                        })
                        resolve(null);
                    }, config.grace * 1000);

                    /* handle exit */
                    fluentBitChildProcess.on("exit", () => {
                        if (graceTimer) {
                            clearTimeout(graceTimer);
                            instrumentsCleanup.forEach(insCleanup => {
                                insCleanup();
                            })
                        }
                        logger.info("Fluent Bit exited (stopped)");
                        logger.info(`Fluent Bit exit code: ${fluentBitChildProcess.exitCode}`);
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