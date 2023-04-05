import { getStringFromFile, getSubFolders, getJsonFromFile, makeId, getSubFiles, s3ArnToBucketAndPath } from "../utils/utils";
import * as Constants from "../constants.js";
import * as Path from "path";

/* Execution specific details including the execution id */
export async function generateExecutionContext(execution: IExecution): Promise<IExecutionContext> {
    /* Pull in the execution-configuration file */
    const d = new Date();
    const iso = d.toISOString().replaceAll(":", "").replaceAll(".", "").replaceAll("Z", "");
    const id = makeId(8);
    const executionId = `E${iso}-${id}`;
    const startTime = Date.now();

    const executionConfig = await getJsonFromFile(Constants.paths.executionConfig); 
    
    return {
        execution,
        executionConfig,
        executionId,
        startTime,
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
            const suiteConfigSeed = await getStringFromFile(Path.join(c, Constants.paths.suiteConfigFileName));

            /* Expand each test suite */
            const testCaseSeeds =
            await Promise.all(suites.map(async (s) => {
                const cases = await getSubFiles(Path.join(s, Constants.paths.casesSubDir));
                const caseConfigSeed = await getStringFromFile(Path.join(c, Constants.paths.caseConfigFileName));
                
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
                        executionContext.executionConfig.s3ArchivesArn,
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
    return null;
}

export async function archiveTestCase(testCase: ITestCase) {

}

export async function runTestCase(testCase: ITestCase):
                                  Promise<IExecutionRecord> {
    return null;
}

export async function recordTestCase(testCase: ITestCase,
                                     executionRecord: IExecutionRecord) {
    
}
