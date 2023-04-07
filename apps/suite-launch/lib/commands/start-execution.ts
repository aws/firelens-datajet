import * as Stage from "../helpers/start-execution-stages.js";
import * as Syncher from "../cloud/s3.js";
import * as Utils from "../utils/utils.js";

export async function executeTests(execution: IExecution) {

    /* Generate the execution context */
    const executionContext = await Stage.generateExecutionContext(execution);

    const testCaseSeeds = await Stage.recoverTestCaseSeeds(executionContext);

    /* Transform seeds into test cases */
    const testCases = await Promise.all(testCaseSeeds.map(Stage.hydrateTestCaseSeed));

    /* Pull archive */
    await Syncher.pullArchive(executionContext);

    /* Archive test cases */
    await Promise.all(testCases.map(Stage.archiveTestCase));
    
    /* Push archive */
    await Syncher.pushArchive(executionContext);

    /* Run test cases, synchronously */
    const executionRecords = [];
    for (const testCase of testCases) {
        executionRecords.push({
            testCase: testCase,
            executionRecord: await Stage.runTestCase(testCase)
        });
        /* Sleep between runs. We can taylor this to an appropriate number */
        await Utils.sleep(50);
    }

    /* Pull records */
    await Syncher.pullRecords(executionContext);

    /* Record test cases */
    Stage.recordTestCases(executionContext, executionRecords);

    await Promise.all(executionRecords.map(r => Stage.recordTestCases(r.testCase, r.executionRecord)));

    /* Push records */
    await Syncher.pushRecords(executionContext);

    console.log("done");
}
