
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IWrapper } from "../../core/ext-types"
import { IBuiltStage, IBuiltStageWrapper } from "../../core/pipeline-types";
import winston from 'winston';
import { ChildProcess, exec, spawn } from "child_process";
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
    modifySubschema: (subschema)=>subschema,
    createConfiguredWrapper: function (config: IFluentBitWrapperConfig, {
        logger,
        localPipelineSchema,
        workspaceRoot,
        setManagedVariable,
        variables,
    }) {

        return {
            wrapperTemplate: this,
    
            setup: async (root: IBuiltStage, subtree: IBuiltStage) => {

                return true;
            },
        
            validation: async (root: IBuiltStage, subtree: IBuiltStage) => {
              
                return {
                    isValidationSuccess: true,
                    /*  Other data can be added here for validation metric collection. */
                    validationData: {

                    },
                    
                    /* May want to add hidden validation data */
                };
            },
        
            breakdown: async (root: IBuiltStage, subtree: IBuiltStage) => {
                return true;
            },
        
            isValidationAsync: true,
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

export default fluentBitWrapper;