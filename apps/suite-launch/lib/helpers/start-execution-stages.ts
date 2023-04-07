import { getStringFromFile, getSubFolders, getJsonFromFile, makeId, getSubFiles, s3ArnToBucketAndPath, nestedPathCreate, sendStringToFile, sendJSONToFile } from "../utils/utils.js";
import * as Constants from "../constants.js";
import path, * as Path from "path";
import { cascadeConfigurationStringAsDefault, cascadeConfigurationStringAsExtension, validateTestConfig } from "../utils/config-utils.js";
import { promises as fs } from "fs";
import { copyAndTemplateFile } from "../templating/handlebars-templater.js";
import { runECSTestCase } from "../cloud/ecs.js";

/* Execution specific details including the execution id */
export async function generateExecutionContext(execution: IExecution): Promise<IExecutionContext> {
    /* Pull in the execution-configuration file */
    const d = new Date();
    const iso = d.toISOString().replaceAll(":", "").replaceAll(".", "").replaceAll("Z", "");
    const id = makeId(8);
    const executionId = `E-${iso}-${id}`;
    const startTime = Date.now();

    const executionConfig = await getJsonFromFile(Constants.paths.executionConfig); 
    
    return {
        execution,
        executionConfig,
        executionId,
        startTime
    };
}

export async function recoverTestCaseSeeds(executionContext: IExecutionContext):
                                           Promise<ITestCaseSeed[]> {

    const collectionConfigSeed = await getStringFromFile(Constants.paths.collectionConfig);
    const collections = await getSubFolders(Constants.paths.collections);

    /* Basic managed variables */
    const managedVariablesDefaults = {
        executionId: executionContext.executionId,
        executionName: executionContext.execution.executionName,
    }

    /* Expand each test collection */
    const testCaseSeeds =
    await Promise.all(collections.map(
        async (c) => {
            const suites = await getSubFolders(c);
            const suiteConfigSeed = await getStringFromFile(Path.join(c, Constants.fileNames.suiteConfig));

            /* Expand each test suite */
            const testCaseSeeds =
            await Promise.all(suites.map(async (s) => {
                const cases = await getSubFiles(Path.join(s, Constants.folderNames.cases));
                const caseConfigSeed = await getStringFromFile(Path.join(s, Constants.fileNames.caseConfig));
                
                const testCaseSeeds =
                await Promise.all(cases.map(async (tc) => {
                    const caseSeed = await getStringFromFile(tc);

                    /* Get managed variable names for templating */
                    const collectionName = Path.basename(c);
                    const suiteName = Path.basename(s);
                    const caseName = Path.basename(tc).split(".")[0];

                    /* Determine the upload destinations for templates */
                    const s3ResourcesArn = Path.join(
                        executionContext.executionConfig.s3ArchivesArn,
                        managedVariablesDefaults.executionId,
                        collectionName,
                        suiteName,
                        caseName);

                    const {
                        s3Bucket: s3ResourcesBucket,
                        s3Path: s3ResourcesPath,
                    } = s3ArnToBucketAndPath(s3ResourcesArn);

                    /* Output execution folders */
                    const s3OutputExecutionArn = Path.join(
                        executionContext.executionConfig.s3OutputArn,
                        managedVariablesDefaults.executionId);
                    
                    const {
                        s3Bucket: s3OutputBucket,
                        s3Path: s3OutputExecutionPath,
                    } = s3ArnToBucketAndPath(s3OutputExecutionArn);
     
                    /* Create managed variable set */
                    const managedVariables = {
                        ...managedVariablesDefaults,
                        collectionName,
                        suiteName,
                        caseName,
                        caseNameFull: `${collectionName}-${suiteName}-${caseName}`,
                        s3ResourcesArn,
                        s3ResourcesBucket,
                        s3ResourcesPath,
                        s3OutputExecutionArn,
                        s3OutputBucket,
                        s3OutputExecutionPath,
                    }

                    /* Define the test case seed */
                    return {
                        collectionConfigSeed,
                        suiteConfigSeed,
                        caseConfigSeed,
                        caseSeed,
                        managedVariables
                    }
                }));
                return testCaseSeeds;
            }));
            return testCaseSeeds;
        }
    ));
    return testCaseSeeds.flat(10);
}

export async function hydrateTestCaseSeed(testCaseSeed: ITestCaseSeed):
                                       Promise<ITestCase> {

    /* Cascade config by order of precidence, highest last */
    const baseConfig = {
        managed: testCaseSeed.managedVariables,
        config: Constants.defaults.config as ICaseConfig, /* Config could also come from a file */
        definitions: {},
    };

    const layer2Config = cascadeConfigurationStringAsExtension(testCaseSeed.collectionConfigSeed, baseConfig);
    const layer3Config = cascadeConfigurationStringAsExtension(testCaseSeed.suiteConfigSeed, layer2Config);
    const layer4Config = cascadeConfigurationStringAsExtension(testCaseSeed.caseSeed, layer3Config);

    /* Get template */
    const templateName = layer4Config.config.template;
    if (!templateName) {
        validateTestConfig(layer4Config);
    }
    const templateConfigPath = Path.join(Constants.paths.templates, templateName, Constants.fileNames.templateDefaultConfig);
    const templateConfig = await getStringFromFile(templateConfigPath);
    const config = cascadeConfigurationStringAsDefault(templateConfig, layer4Config);

    validateTestConfig(config);
    
    const archiveLocalPath = Path.join(Constants.paths.auto, Constants.folderNames.archives, config.managed.s3ResourcesPath);
    const archiveArn = config.managed.s3ResourcesArn;

    return {
        ...config,
        local: {
            archiveLocalPath,
            archiveArn
        }
    };
}

export async function archiveTestCase(testCase: ITestCase) {
    /* Create archive folder */
    await nestedPathCreate(testCase.local.archiveLocalPath);

    /* Template each file in the templates folder */
    const templateFiles = await getSubFiles(Path.join(Constants.paths.templates, testCase.config.template));

    /* Template each file */
    await Promise.all(templateFiles.map(async tf => {
        const dest = Path.join(testCase.local.archiveLocalPath, Path.basename(tf));
        await copyAndTemplateFile(tf, dest, testCase);
    }))
}

export async function runTestCase(testCase: ITestCase):
                                  Promise<IExecutionRecordArchive> {
    return await runECSTestCase(testCase);
}

export async function recordTestCases(
    executionContext: IExecutionContext,
    executionRecordArchives: Array<IExecutionRecordArchive>) {
    
    const recordsLocalPath = Path.join(Constants.paths.auto, Constants.folderNames.records, executionContext.executionId);
    await nestedPathCreate(recordsLocalPath);
    return await sendJSONToFile(executionRecordArchives, recordsLocalPath);
}
