import { getStringFromFile, getSubFolders, getJsonFromFile, makeId, getSubFiles, s3ArnToBucketAndPath, nestedPathCreate, sendStringToFile, sendJSONToFile } from "../utils/utils.js";
import * as Constants from "../constants.js";
import path, * as Path from "path";
import { cascadeConfigurationStringAsDefault, cascadeConfigurationStringAsExtension, validateTestConfig } from "../utils/config-utils.js";
import { promises as fs } from "fs";
import { copyAndTemplateFile } from "../templating/handlebars-templater.js";
import { runECSTestCase } from "../cloud/ecs.js";
import * as PathProvider from "../providers/path-provider.js"
import { processMetricAlarmsList } from "./metric-alarm-list-processor.js";
import { processDashboardWidgetLists } from "./dashboard-widget-list-processor.js";

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
    const executionConfigSeed = await getStringFromFile(PathProvider.executionJson());
    const collectionConfigSeed = await getStringFromFile(Constants.paths.collectionConfig);
    const collectionsAll = await getSubFolders(Constants.paths.collections);
    const collections = collectionsAll.filter(c => executionContext.execution.executeCollections.includes(path.basename(c)));

    /* Basic managed variables */
    const managedVariablesDefaults = {
        executionId: executionContext.executionId,
        executionName: executionContext.execution.executionName,
    }

    /* Managed context variables - execution */
    const executionCollectionNames = [];
    const executionSuiteNames = [];
    const executionCaseNames = [];
    const executionCaseNamesUnique = [];

    /* Expand each test collection */
    const testCaseSeeds =
    await Promise.all(collections.map(
        
        async (c) => {
            const suites = await getSubFolders(c);
            const suiteConfigSeed = await getStringFromFile(Path.join(c, Constants.fileNames.suiteConfig));

            /* Managed context variables - collection */
            const collectionSuiteNames = [];
            const collectionCaseNames = [];
            const collectionCaseNamesUnique = [];

            /* Set collection context */
            const collectionName = Path.basename(c);
            executionCollectionNames.push(collectionName)

            /* Expand each test suite */
            const testCaseSeeds =
            await Promise.all(suites.map(async (s) => {
                const cases = await getSubFiles(Path.join(s, Constants.folderNames.cases));
                const caseConfigSeed = await getStringFromFile(Path.join(s, Constants.fileNames.caseConfig));

                /* Managed context variables - suite */
                const suiteCaseNames = [];
                const suiteCaseNamesUnique = [];

                /* Set suite context */
                const suiteName = Path.basename(s);
                executionSuiteNames.push(suiteName)
                collectionSuiteNames.push(suiteName)
                
                const testCaseSeeds =
                await Promise.all(cases.map(async (tc) => {
                    const caseSeed = await getStringFromFile(tc);

                    /* Get managed variable names for templating */
                    const caseName = Path.basename(tc).split(".")[0];
                    const caseNameUnique = `${collectionName}-${suiteName}-${caseName}`;

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

                    /* Set case context variables */
                    executionCaseNames.push(caseName)
                    collectionCaseNames.push(caseName)
                    suiteCaseNames.push(caseName)

                    executionCaseNamesUnique.push(caseNameUnique)
                    collectionCaseNamesUnique.push(caseNameUnique)
                    suiteCaseNamesUnique.push(caseNameUnique)
     
                    /* Create managed variable set */
                    const managedVariables = {
                        ...managedVariablesDefaults,
                        collectionName,
                        suiteName,
                        caseName,
                        caseNameUnique: caseNameUnique,
                        s3ResourcesArn,
                        s3ResourcesBucket,
                        s3ResourcesPath,
                        s3OutputExecutionArn,
                        s3OutputBucket,
                        s3OutputExecutionPath,

                        /* Context variables */
                        executionCollectionNames,
                        executionSuiteNames,
                        executionCaseNames,
                        executionCaseNamesUnique,
                        collectionSuiteNames,
                        collectionCaseNames,
                        collectionCaseNamesUnique,
                        suiteCaseNames,
                        suiteCaseNamesUnique,
                    }

                    /* Define the test case seed */
                    return {
                        executionConfigSeed,
                        collectionConfigSeed,
                        suiteConfigSeed,
                        caseConfigSeed,
                        caseSeed,
                        managedVariables,
                        seedDefinitions: executionContext.execution.definitions ?? {},
                        seedConfig: executionContext.execution.config ?? {} as ICaseConfig,
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
    const layer2ExecutionOverride = cascadeConfigurationStringAsExtension(testCaseSeed.executionConfigSeed, layer2Config);
    const layer3Config = cascadeConfigurationStringAsExtension(testCaseSeed.suiteConfigSeed, layer2ExecutionOverride);
    const layer3ExecutionOverride = cascadeConfigurationStringAsExtension(testCaseSeed.executionConfigSeed, layer3Config);
    const layer4Config = cascadeConfigurationStringAsExtension(testCaseSeed.caseConfigSeed, layer3ExecutionOverride);
    const layer4ExecutionOverride = cascadeConfigurationStringAsExtension(testCaseSeed.executionConfigSeed, layer4Config);
    const layer5Config = cascadeConfigurationStringAsExtension(testCaseSeed.caseSeed, layer4ExecutionOverride);

    /* Apply execution config before and after template to ensure overrides are set - allow set template */
    const layer5ExecutionOverride = cascadeConfigurationStringAsExtension(testCaseSeed.executionConfigSeed, layer5Config);

    /* Get template */
    const templateName = layer5ExecutionOverride.config.template;
    if (!templateName) {
        validateTestConfig(layer5ExecutionOverride);
    }
    const templateConfigPath = Path.join(Constants.paths.templates, templateName, Constants.fileNames.templateDefaultConfig);
    const templateConfig = await getStringFromFile(templateConfigPath);
    const layer7Config = cascadeConfigurationStringAsDefault(templateConfig, layer5ExecutionOverride);

    /* Final layer of configuration from execution seed. These function as overrides. */
    const config = cascadeConfigurationStringAsExtension(testCaseSeed.executionConfigSeed, layer7Config);

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
    const recordsComplete = {
        executionContext,
        executionRecordArchives
    }
    const recordsFile = Path.join(recordsLocalPath, `${executionContext.executionId}-record.json`);
    console.log(`Records written to file: ${recordsFile}`)
    console.log(`Started tasks: ${recordsComplete.executionRecordArchives.map(r=>r.testCase.config.taskCount).reduce((a,b)=>a+b,0)}`);
    console.log(`Unique test cases: ${recordsComplete.executionRecordArchives.length}`);
    console.log(`Tasks per test case:`);
    recordsComplete.executionRecordArchives.forEach(r=>
        console.log(`    ${r.testCase.managed.caseNameUnique}: ${r.testCase.config.taskCount}`));

    return await sendJSONToFile(recordsComplete, recordsFile);
}

export async function processListComponents(testCases: ITestCase[]) {
    await processMetricAlarmsList(testCases);
    await processDashboardWidgetLists(testCases);
    console.log("✨✨✨ Enabled monitoring ✨✨✨");
}
