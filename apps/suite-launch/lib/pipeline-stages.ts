
/* Execution specific details including the execution id */
export async function generateExecutionContext(execution: IExecution): Promise<IExecutionContext> {
    /* Pull in the execution-configuration file */
    
    return null;
}


export async function recoverTestCaseSeeds(executionContext: IExecutionContext):
                                           Promise<ITestCaseSeed[]> {
    return [];
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
