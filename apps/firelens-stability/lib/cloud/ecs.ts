import { getJsonFromFile, sleep } from "../utils/utils.js";
import { ECS, RunTaskCommandOutput } from "@aws-sdk/client-ecs";
import { getTestCaseTaskDefinition } from "../utils/config-utils.js";
import * as Constants from "../constants.js"

let ecsTestCaseTaskQueue: Array<IEcsTestTask> = [];

interface IEcsTestTask {
    testCase: ITestCase,
    successPromiseResolver: (value: IExecutionRecordArchive | PromiseLike<IExecutionRecordArchive>) => void,
    executionRecord?: IExecutionRecord,
    executionRound: number,
    taskDefinitionArn?: string,
}

export async function runECSTestCase(testCase: ITestCase) {
    /* Create an ecs test task and register */
    let successPromiseResolver: (value: IExecutionRecordArchive | PromiseLike<IExecutionRecordArchive>) => void;
    const executionRecord = new Promise<IExecutionRecordArchive>((resolve) => {
        successPromiseResolver = resolve;
    });

    const testTask = {
        testCase,
        successPromiseResolver,
        executionRound: 1,
    }

    /* Put ECS Task in the pipe. The worker will process this later */
    ecsTestCaseTaskQueue.push(testTask);
    return await executionRecord;
}

async function ecsTestRunnerWorker() {
    while (true) {
        await processEcsTestTaskQueue();
        await sleep(1000);
    }
}

async function processEcsTestTaskQueue() {
    const processTasks = ecsTestCaseTaskQueue;
    ecsTestCaseTaskQueue = [];

    for (const task of processTasks) {
        if (task.executionRound === 1) {
            await startECSTask(task);
        }
        else if (task.executionRound <= Constants.ecsConfig.maxRetryRounds) {
            await validateAndRetryECSTask(task);
        }
        else {
            await outOfRetriesECSTask(task);
        }
    }
}

async function startECSTask(task: IEcsTestTask) {
    const testCase = task.testCase;
        
    // Create an ECS client
    const ecs = new ECS({
        region: testCase.config.region,
    });

    // Create fargate cluster if it doesn't already exist
    const clusters = await ecs.listClusters();
    if (!clusters.clusterArns.some(c => c.endsWith(`/${testCase.config.cluster}`))) {
        await ecs.createCluster({
            settings: [{
                name: "containerInsights",
                value: "enabled"
            }],
            clusterName: testCase.config.cluster
        });
        console.log(`🍇 Created cluster: ${testCase.config.cluster}\n`)
        await sleep(2000); /* Wait for the container to be ready to accept new tasks */
    }
    
    // Get the task definition file
    const taskDefinition = await getTestCaseTaskDefinition(testCase);

    // Register task definition
    let taskDefinitionArn: string;
    try {
        taskDefinitionArn = (await ecs.registerTaskDefinition(taskDefinition)).taskDefinition!.taskDefinitionArn;
    }
    catch (err) {
        console.error(`Error registering task definition: ${err}`);
        return;
    }

    // Launch tasks in groups of 10 or less
    console.log(`  🧪 ${testCase.managed.collectionName}/${testCase.managed.suiteName}/${testCase.managed.caseName}: launched tasks`);
    const taskCount = testCase.config.taskCount;
    let launchedTasks = await launchECSTasks(testCase, taskCount, ecs, taskDefinitionArn);

    // Add to the back of the task queue after a delay of 5-10 seconds for validation. Check on the status.
    addECSTaskToQueue(
        Constants.ecsConfig.retryDelaySecondsBase,
        Constants.ecsConfig.retryDelaySecondsCap, {
            successPromiseResolver: task.successPromiseResolver,
            executionRecord: {
                startTime: Date.now(),
                taskArns: launchedTasks,
            },
            testCase: testCase,
            executionRound: task.executionRound + 1,
            taskDefinitionArn: taskDefinitionArn,
        });
}

function addECSTaskToQueue(delayBase: number, delayCap: number, ecsTask: IEcsTestTask) {
    setTimeout(() => {
        ecsTestCaseTaskQueue.push(ecsTask);
    }, (delayBase + Math.random() * (delayCap - delayBase)) * 1000);
}

function ecsTaskReturn(ecsTestTask: IEcsTestTask) {
    ecsTestTask.successPromiseResolver(
        /* Prune away the ecsTestTask specific information */
        {
            executionRecord: ecsTestTask.executionRecord,
            testCase: ecsTestTask.testCase,
        }
    );
}

async function validateAndRetryECSTask(ecsTestTask: IEcsTestTask) {
    const testCase = ecsTestTask.testCase;
      
    // Create an ECS client
    const ecs = new ECS({
        region: testCase.config.region,
    });

    const {
        currentTasks,
        startingTasks,
        runningTasks,
        startingTasksCount,
        runningTasksCount,
        endedTasksCount,
    } = await validateECSTestTask(ecs, ecsTestTask);

    /* Done! All tasks are in running */
    if (runningTasksCount === ecsTestTask.testCase.config.taskCount) {
        console.log(`  ✅ ${testCase.managed.collectionName}/${testCase.managed.suiteName}/${testCase.managed.caseName}: All ${ecsTestTask.testCase.config.taskCount} tasks in running state`);

        /* Mark the ECS task as resolved. */
        ecsTaskReturn(ecsTestTask);
        return;
    }
    
    /* Tasks need to be retried. Retry the ended tasks */
    let taskArns = ecsTestTask.executionRecord.taskArns;
    if (endedTasksCount !== 0) {
        console.log(`  🔁 ${testCase.managed.collectionName}/${testCase.managed.suiteName}/${testCase.managed.caseName}: Retrying failed tasks`);
        const taskCount = endedTasksCount;
        let newTasksLaunched = await launchECSTasks(testCase, taskCount, ecs, ecsTestTask.taskDefinitionArn);
        taskArns = [...startingTasks, ...runningTasks, ...newTasksLaunched];
    }

    /* Add back to queue for validation */
    addECSTaskToQueue(
        Constants.ecsConfig.retryDelaySecondsBase,
        Constants.ecsConfig.retryDelaySecondsCap, {
        ...ecsTestTask,
        executionRecord: {
            ...ecsTestTask.executionRecord,
            taskArns: taskArns, /* Replace the task arns with updated list */
        },
        executionRound: ecsTestTask.executionRound + 1,
    });
}

async function outOfRetriesECSTask(ecsTestTask: IEcsTestTask) {
    const testCase = ecsTestTask.testCase;

    // Create an ECS client
    const ecs = new ECS({
        region: testCase.config.region,
    });

    const {
        runningTasksCount,
    } = await validateECSTestTask(ecs, ecsTestTask);

    /* Done! All tasks are in running */
    if (runningTasksCount === ecsTestTask.testCase.config.taskCount) {
        console.log(`  ✅ ${testCase.managed.collectionName}/${testCase.managed.suiteName}/${testCase.managed.caseName}: All tasks in running state`);

        /* Mark the ECS task as resolved. */
        ecsTaskReturn(ecsTestTask);
        return;
    }

    /* Failed tasks */
    else {
        console.log(`  ❌ ${testCase.managed.collectionName}/${testCase.managed.suiteName}/${testCase.managed.caseName}: Some tasks failed to enter running state after ${Constants.ecsConfig.maxRetryRounds} rounds of retries failed.`);

        /* Mark the ECS task as resolved. */
        ecsTaskReturn(ecsTestTask);
        return;
    }
}


async function launchECSTasks(testCase: ITestCase, taskCount: number, ecs: ECS, taskDefinitionArn: string): Promise<string[]> {
    let launchedTasks = [];
    while (launchedTasks.length < taskCount) {
        const launchCount = Math.min(10, taskCount - launchedTasks.length);
        let result: RunTaskCommandOutput;
        try {
            result = await ecs.runTask({
                enableExecuteCommand: true,
                cluster: testCase.config.cluster,
                taskDefinition: taskDefinitionArn!,
                count: launchCount,
                launchType: "FARGATE",
                networkConfiguration: {
                    awsvpcConfiguration: {
                        subnets: testCase.config.taskVpcSubnets,
                        assignPublicIp: "DISABLED",
                        securityGroups: testCase.config.taskVpcSecurityGroups,
                    }
                }
            });
        }
        catch (err) {
            console.error(`Error launching task: ${err}`);
            return;
        }

        const launchedTaskArns = result.tasks!.map((task) => task.taskArn!);
        console.log(launchedTaskArns.reduce((a,b)=>`${a}    ${b}\n`, ""));
        launchedTasks.push(...launchedTaskArns);
        
        /* Retry failed tasks... */
        const failedTasks = launchCount - launchedTaskArns.length;
        if (failedTasks) {
            console.log(`    ⚠️ ${testCase.managed.caseNameUnique}, failed ${failedTasks} task launches. Will retry`);
            await new Promise(resolve => setTimeout(resolve, 500)); /* slow down the async loop (20 per second) */
        }

        await new Promise(resolve => setTimeout(resolve, 500)); /* slow down the async loop (20 per second) */
    }
    return launchedTasks;
}

async function validateECSTestTask(ecs: ECS, ecsTestTask: IEcsTestTask) {     
    const currentTasks = await ecs.describeTasks(
        {cluster: ecsTestTask.testCase.config.cluster, tasks: ecsTestTask.executionRecord.taskArns},
    );
    const startingTasks = currentTasks.tasks
        .filter(t => (t.taskDefinitionArn === ecsTestTask.taskDefinitionArn) &&
            (t.lastStatus === "PROVISIONING" || t.lastStatus === "PENDING" || t.lastStatus === "ACTIVATING"))
        .map(t => t.taskArn);
    const runningTasks = currentTasks.tasks
        .filter(t => (t.taskDefinitionArn === ecsTestTask.taskDefinitionArn) &&
           (t.lastStatus === "RUNNING"))
        .map(t => t.taskArn);
        
    const startingTasksCount = startingTasks.length;
    const runningTasksCount = runningTasks.length;
    const endedTasksCount = ecsTestTask.executionRecord.taskArns.length - startingTasks.length - runningTasks.length;

    return {
        currentTasks,
        startingTasks,
        runningTasks,
        startingTasksCount,
        runningTasksCount,
        endedTasksCount,
    }
}

ecsTestRunnerWorker();
