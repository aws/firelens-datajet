
interface IGenericConfig {
    config: ICaseConfig,
    definitions: {[key: string]: any},
    managed: ICaseManagedVariables,
}

interface ICaseManagedVariables {
    executionId: string,
    executionName: string,
    collectionName: string,
    suiteName: string,
    caseName: string,
    caseNameFull: string,
    s3ResourcesArn: string, /* directs to appropriate folder for test case */
    s3ResourcesBucket: string,
    s3ResourcesPath: string,
    s3OutputExecutionArn: string, /* directs to execution specific folder of bucket */
    s3OutputBucket: string,
    s3OutputExecutionPath: string,
}

/*
 * Used for functionality as opposed to templating.
 * Accessable in templates as config.x
 */
interface ICaseConfig {
    template: string,
    cluster: string,
    region: string,
    taskCount: number,
    taskVpcSubnets: Array<string>,
    taskVpcSecurityGroups: Array<string>,
}

interface ITestCaseSeed {
    collectionConfigSeed: string,
    suiteConfigSeed: string,
    caseConfigSeed: string,
    caseSeed: string,
    managedVariables: ICaseManagedVariables,
}

interface IExecution extends IGenericConfig {
    executionName:  string,
    executeCollections: string[],
}

interface IExecutionConfig extends IGenericConfig {
    s3ArchivesArn: string,
    s3RecordArn: string,
    s3SummaryArn: string,
    s3OutputArn: string,
}

interface IExecutionContext {
    execution: IExecution,
    executionConfig: IExecutionConfig,
    executionId: string, /* <ISO Time><8 Rand Alpha> */
    startTime: number,
}

interface ICaseLocalVariables {
    archiveLocalPath: string,
    archiveArn: string
}

interface ITestCase extends IGenericConfig {
    local: ICaseLocalVariables,
}

interface IExecutionRecord {
    startTime: number,
    taskArns: string[]
}

interface IExecutionRecordArchive {
    executionRecord: IExecutionRecord,
    testCase: ITestCase,
}

interface IExecutionSummary {
    tasksStarted: number,
    tasksAlive: number,
    tasksDied: number,
    timeStart: number,
    currentTime: number,
}

interface IExecutionSummaryArchive {
    executionSummary: IExecutionSummary,
    executionRecord: IExecutionRecord,
    testCase: ITestCase,
}

interface IProcessedExecutionSummary {
    testName: string,
    runtimeToFailureDays: number,
    percentTaskDeath: number,
    testDuration: number,
    timeStart: number,
    timeEnd: number,
}

interface IExecutionExecutiveSummary {
    processedExecutionSummaries: IProcessedExecutionSummary[],
    lowestRuntimeToFailure: number
}
