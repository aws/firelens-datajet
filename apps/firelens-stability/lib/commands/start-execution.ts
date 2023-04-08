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
    const executionRecords = await Promise.all(testCases.map(Stage.runTestCase));

    /* Pull records */
    await Syncher.pullRecords(executionContext);

    /* Record test cases */
    Stage.recordTestCases(executionContext, executionRecords);

    /* Push records */
    await Syncher.pushRecords(executionContext);

    console.log(`Started tests. Execution ID: ${executionContext.executionId}`);
}
