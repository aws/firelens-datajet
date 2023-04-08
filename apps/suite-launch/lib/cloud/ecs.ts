import { getJsonFromFile, sleep } from "../utils/utils.js";
import * as ECS from "@aws-sdk/client-ecs";
import AWS from 'aws-sdk'; /* We really should be migrating to v3, but for now use v2 */
import { getTestCaseTaskDefinition } from "../utils/config-utils.js";
import { PromiseResult } from "aws-sdk/lib/request";
process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = '1';

let ecsTestCaseTaskQueue: Array<IEcsTestTask> = [];

interface IEcsTestTask {
    testCase: ITestCase,
    successPromiseResolver: (value: IExecutionRecordArchive | PromiseLike<IExecutionRecordArchive>) => void
}

export async function runECSTestCase(testCase: ITestCase) {
    /* Create an ecs test task and register */
    let successPromiseResolver: (value: IExecutionRecordArchive | PromiseLike<IExecutionRecordArchive>) => void;
    const executionRecord = new Promise<IExecutionRecordArchive>((resolve) => {
        successPromiseResolver = resolve;
    });

    const testTask = {
        testCase,
        successPromiseResolver
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
        const testCase = task.testCase;
        
        // Set the region name
        AWS.config.update({ region: testCase.config.region });

        // Create an ECS client
        const ecs = new AWS.ECS();

        // Create fargate cluster if it doesn't already exist
        const clusters = await ecs.listClusters().promise();
        if (!clusters.clusterArns.some(c => c.endsWith(`/${testCase.config.cluster}`))) {
            await ecs.createCluster({
                clusterName: testCase.config.cluster
            }).promise();
            console.log(`🍇 Created cluster: ${testCase.config.cluster}\n`)
            await sleep(2000); /* Wait for the container to be ready to accept new tasks */
        }
    
        // Get the task definition file
        const taskDefinition = await getTestCaseTaskDefinition(testCase);


        // Register task definition
        let taskDefinitionArn: string;
        try {
            taskDefinitionArn = (await ecs.registerTaskDefinition(taskDefinition).promise()).taskDefinition!.taskDefinitionArn;
        }
        catch (err) {
            console.error(`Error registering task definition: ${err}`);
            return;
        }

        // Launch tasks in groups of 10 or less
        console.log(`  🧪 ${testCase.managed.collectionName}/${testCase.managed.suiteName}/${testCase.managed.caseName}: launched tasks`);
        let launchedTasks = [];
        const taskCount = testCase.config.taskCount;
        for (let i = 0; i < taskCount; i += Math.min(10, taskCount - i)) {
            const count = Math.min(10, taskCount - i);
            let result: PromiseResult<AWS.ECS.RunTaskResponse, AWS.AWSError>;
            try {
                result = await ecs.runTask({
                cluster: testCase.config.cluster,
                taskDefinition: taskDefinitionArn!,
                count: count,
                launchType: "FARGATE",
                networkConfiguration: {
                    awsvpcConfiguration: {
                        subnets: testCase.config.taskVpcSubnets,
                        assignPublicIp: "ENABLED",
                        securityGroups: testCase.config.taskVpcSecurityGroups,
                    }
                }
                }).promise();
            }
            catch (err) {
                console.error(`Error launching task: ${err}`);
                return;
            }

            const launchedTaskArns = result.tasks!.map((task) => task.taskArn!);
            console.log(launchedTaskArns.reduce((a,b)=>`${a}    ${b}\n`, ""));
            launchedTasks.push(...launchedTaskArns);
            
            /* Retry failed tasks... */
            const failedTasks = count - result.tasks.length;
            i -= failedTasks;
            if (failedTasks) {
                console.log(`    ⚠️ ${testCase.managed.caseNameUnique}, failed task launches: ${failedTasks}. Will retry`);
            }

            await new Promise(resolve => setTimeout(resolve, 500)); /* slow down the async loop (20 per second) */
        }

        task.successPromiseResolver({
            executionRecord: {
                startTime: Date.now(),
                taskArns: launchedTasks,
            },
            testCase: testCase
        });
    }
}

ecsTestRunnerWorker();
