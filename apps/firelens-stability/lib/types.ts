
interface IGenericConfig {
    config: ICaseConfig,
    definitions: {[key: string]: any},
    managed: ICaseManagedVariables,
}

/*
 * Used in templating as managed.x
 */
interface ICaseManagedVariables {
    executionId: string,
    executionName: string,
    collectionName: string,
    suiteName: string,
    caseName: string,
    caseNameUnique: string, /* this is testCollection-testSuite-testCase */
    s3ResourcesArn: string, /* directs to appropriate folder for test case */
    s3ResourcesBucket: string,
    s3ResourcesPath: string,
    s3OutputExecutionArn: string, /* directs to execution specific folder of bucket */
    s3OutputBucket: string,
    s3OutputExecutionPath: string,

    /* metric/graph helpers */
    executionCollectionNames: string[],
    executionSuiteNames: string[],
    executionCaseNames: string[],
    executionCaseNamesUnique: string[],
    collectionSuiteNames: string[],
    collectionCaseNames: string[],
    collectionCaseNamesUnique: string[],
    suiteCaseNames: string[],
    suiteCaseNamesUnique: string[],
}

/*
 * Used for functionality as opposed to templating.
 * Accessable in templates as config.x
 */
interface ICaseConfig {
    template: string,
    cluster: string,
    dashboard: string,
    dashboardSection: string,
    region: string,
    taskCount: number,
    taskVpcSubnets: Array<string>,
    taskVpcSecurityGroups: Array<string>,
    "lists.dashboardWidgets": Array<IDashboardWidget>,
    "lists.metricAlarms": Array<IMetricAlarm>,
    "lists.compositeAlarms": Array<ICompositeAlarm>,
}

interface ITestCaseSeed {
    executionConfigSeed: string, /* Highest order of precidence, from execution.json */
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

interface IExecutionRecordComplete {
    executionContext: IExecutionContext,
    executionRecordArchives: IExecutionRecordArchive[],
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
    lowestRuntimeToFailure: number,
}

interface IDashboardWidget {
    name: string,
    config: any,
    section: string,
    order: number,
}

interface IMetricAlarm {
    name: string,
    config: any,
}

interface ICompositeAlarm {
    name: string,
    config: any,
}

interface IDashboardSeed {
    name: string,
    widgets: any[],
    region: string,
}

interface IMetricAlarmSeed {
    name: string,
    config: any,
    region: string,
}
