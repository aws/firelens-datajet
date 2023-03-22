import * as AWS from 'aws-sdk';
import { S3Client } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PromiseResult } from 'aws-sdk/lib/request';
import * as handlebars from "handlebars";
const S3SyncClient = require('s3-sync-client');

interface GlobalTemplateJson {
  global_test_case_template: { [key: string]: any },
  global_test_suite_template: { [key: string]: any },
}

interface TestExecutionJson {
  test_execution_name: string,
  execution_template: { [key: string]: any };
}

interface TestSuiteJson {
  s3_bucket_name: string;
  suite_template: { [key: string]: any };
}

interface TestCaseConfig {
  test_name: string;
  template: any;
  s3_bucket_name: string;
  cluster: string;
  n_tasks: number;
  task_definition: string;
  test_preset: string;
  network_vpc_config: any;
}

/* register handlebars custom templating helpers */
/*
 * {{#times 10}}
 *   <span>{{this}}</span>
 * {{/times}}
 */
handlebars.registerHelper('times', function(n, block) {
  var accum = '';
  for(var i = 0; i < n; ++i)
      accum += block.fn({
        ...this,
        _idx: i
      });
  return accum;
});

/*
 * {{#for 0 10 2}}
 *   <span>{{this}}</span>
 * {{/for}}
 */
handlebars.registerHelper('for', function(from, to, incr, block) {
  var accum = '';
  for(var i = from; i < to; i += incr)
      accum += block.fn({
        ...this,
        _idx: i
      });
  return accum;
});

/*
 * {{#ifEquals sampleString "This is a string"}}
 *  Your HTML here
 * {{/ifEquals}}
 */
handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

handlebars.registerHelper('ifEqualsOneOf', function() {
  const arg1 = arguments[1];
  const otherArgs = [];
  for (let i = 1; i < arguments.length - 1; ++i) {
    otherArgs.push(arguments[i]);
  }
  const options = arguments[arguments.length - 1];
  return otherArgs.some(a => a === arg1) ? options.fn(this) : options.inverse(this);
});


async function run() {

  dotenv.config();

  AWS.config.update({region: 'us-west-2'});

  // Get the directory of the script
  const scriptDir = path.dirname(require.main!.filename);

  // Read the test suites JSON file
  const testExecutionJsonPath = path.join(__dirname, "test-execution.json");
  const testExecutionJsonString = await fs.promises.readFile(testExecutionJsonPath, "utf-8");
  const testExecutionJson: TestExecutionJson = JSON.parse(testExecutionJsonString);
  const testExecutionId = testExecutionJson.test_execution_name + "-" + randomAlphaNumericGenerator(8);

  // Load the environment variables from test-suite.env
  const testSuitesEnvPath = path.join(scriptDir, 'test-suite', 'test-suite.env');
  dotenv.config({ path: testSuitesEnvPath });

  // Get the path to the test suites directory
  const testSuiteDir = path.join(__dirname, "test-suite");

  // Read the test suites JSON file
  const testSuiteJsonPath = path.join(testSuiteDir, "test-suite.json");
  const testSuiteJsonString = await fs.promises.readFile(testSuiteJsonPath, "utf-8");
  const testSuiteJson: TestSuiteJson = JSON.parse(testSuiteJsonString);

  // Process each test suite
  console.log(`Processing test suite directory: ${testSuiteDir}`);

  // Read the global template
  const suiteTemplate = {
    ...testExecutionJson.execution_template,
    ...testSuiteJson.suite_template
  }

  // Determine the S3 bucket to use for the test suite
  const s3BucketName = testSuiteJson.s3_bucket_name;

  // Determine the S3 folder to use for the test suite
  const testSuiteUploadFolder: string =
    testExecutionJson.test_execution_name + "/" +
    suiteTemplate.test_collection_name + "/" +
    suiteTemplate.test_suite_name;

  // Process each test case in each test suite
  let testCaseDirs = fs.readdirSync(testSuiteDir, { withFileTypes: true })
    .filter((dir) => dir.isDirectory())
    .map((dir) => path.join(testSuiteDir, dir.name));

  // Override with user provided testCaseDirs
  if (process.argv.length > 2) {
    testCaseDirs = process.argv.slice(2).map((item) => path.join(testSuiteDir, item));
  }

  /* --------------------- */
  /*  Process Test Cases   */
  /* --------------------- */
  
  for (const testCaseDir of testCaseDirs) {
    console.log(`Processing test case directory: ${testCaseDir}`);

    // Read the test case JSON file
    const testCaseConfigPath = path.join(testCaseDir, "test-case.json");
    const testCaseConfigString = await fs.promises.readFile(testCaseConfigPath, "utf-8");
    const testCaseConfig: TestCaseConfig = JSON.parse(handlebars.compile(testCaseConfigString)(suiteTemplate));

    // Read the global JSON file
    const testGlobalJsonPath = path.join(__dirname, "test-global-template.json");
    const testGlobalJsonString = await fs.promises.readFile(testGlobalJsonPath, "utf-8");
    const globalTestCaseTemplate: GlobalTemplateJson = JSON.parse(
      handlebars.compile(testGlobalJsonString)(suiteTemplate)).global_test_case_template;

    /* --------------------- */
    /*  Staged Folder Setup  */
    /* --------------------- */

    // Add all files to the staged folder
    const  stagedDirPath = path.join(testCaseDir, "staged");
    try {
      const _ = await fs.promises.access(stagedDirPath);
      // The folder exists. Delete.
      await fs.promises.rm(stagedDirPath, {recursive: true});
    }
    catch {
      // The folder does not exist. Do nothing.
    }
    await fs.promises.mkdir(stagedDirPath);

    // Copy over the task
    await fs.promises.cp(
      path.join(
        __dirname,
        "task-definitions",
        testCaseConfig.task_definition
      ),
      path.join(stagedDirPath, "task.json"));

    // Add resource files to stage directory
    if (testCaseConfig?.test_preset != undefined) {
      const sourceTestResourcesFrom = path.join(__dirname, "test-presets", testCaseConfig.test_preset);
      const testCaseFiles = fs.readdirSync(sourceTestResourcesFrom, { withFileTypes: true })
        .filter((dirent) => dirent.isFile())
        .map((dirent) => dirent.name);
      
      for (const testCaseFile of testCaseFiles) {
        const sourcePath = path.join(sourceTestResourcesFrom, testCaseFile);
        const destinationPath = path.join(stagedDirPath, testCaseFile);
        await fs.promises.copyFile(sourcePath, destinationPath);
      }

      // Copy over the test-case.json over from the test suite
      const testCaseSourcePath = path.join(testCaseDir, "test-case.json");
      const testCaseDestinationPath = path.join(stagedDirPath, "test-case.json");
      await fs.promises.copyFile(testCaseSourcePath, testCaseDestinationPath);
    }
    
    /* Let's just copy our test preset from the folder. Implicit test config. */
    else {
      const testCaseFiles = fs.readdirSync(testCaseDir, { withFileTypes: true })
        .filter((dirent) => dirent.isFile())
        .map((dirent) => dirent.name);
      
      for (const testCaseFile of testCaseFiles) {
        const sourcePath = path.join(testCaseDir, testCaseFile);
        const destinationPath = path.join(stagedDirPath, testCaseFile);
        await fs.promises.copyFile(sourcePath, destinationPath);
      }
    }

    /* --------------------- */
    /*  Yield Folder Setup   */
    /* --------------------- */

    // Determine the ID for the current test case
    const hash = await getMaterialGroupHash(stagedDirPath,
      testSuiteJsonString,
      testGlobalJsonString,
      testExecutionJsonString);
    const yieldDir = path.join(testCaseDir, "yield");
    let testId = 1;
    if (fs.existsSync(yieldDir)) {
      const previousYields = fs.readdirSync(yieldDir);
      for (const previousYield of previousYields) {
        const prevId = parseInt(previousYield.split("-")[0]);
        if (prevId >= testId) {
          /* Keep last ID if test content has not changed */
          if (previousYield.endsWith("-" + hash)) {
            testId = prevId;
            continue;
          }
          testId = prevId+1;
        }
      }
    }

    // Create the yield directory for this test case
    const yieldSubDir = `${testId}-${hash}`;
    const yieldDirPath = path.join(yieldDir, yieldSubDir);
    await fs.promises.mkdir(yieldDirPath, { recursive: true });   

    // Create a link to the directory
    const yieldSubDirSymLinkPath = path.join(yieldDir, "0-current");
    if (fs.existsSync(yieldSubDirSymLinkPath)) {
      await fs.promises.unlink(yieldSubDirSymLinkPath);
    }
    await fs.promises.symlink(yieldDirPath, yieldSubDirSymLinkPath);

    // Template all files in the staged directory
    console.log(`Templating files in staged directory: ${testCaseDir}/yield/${yieldSubDir}`);

    const templateData = {
      s3_materials_arn: `arn:aws:s3:::${s3BucketName}/${testSuiteUploadFolder}/${path.basename(testCaseDir)}/yield/${yieldSubDir}`,
      s3_materials_key_base: `${testSuiteUploadFolder}/${path.basename(testCaseDir)}/yield/${yieldSubDir}`,
      s3_materials_bucket: s3BucketName,
      test_revision: `${testId}-${hash.slice(0, 6)}`,
      test_name: path.basename(testCaseDir),
      test_name_unique: `${path.basename(testCaseDir)}-r${testId}-${hash.slice(0, 6)}`,
      test_suite_timestamp: Date.now(),
      ...globalTestCaseTemplate,
      ...suiteTemplate,
      ...testCaseConfig.template,
    };
    testCaseConfig.template = templateData;


    // Copy all non-directory files from the material sets directory to the yield directory
    const stagedFiles = fs.readdirSync(stagedDirPath, { withFileTypes: true })
      .filter((dirent) => dirent.isFile())
      .map((dirent) => dirent.name);

    for (const stagedFile of stagedFiles) {
      const sourcePath = path.join(stagedDirPath, stagedFile);
      const destinationPath = path.join(yieldDirPath, stagedFile);
      const fileString = await fs.promises.readFile(sourcePath, "utf-8");
      const templatedString = handlebars.compile(fileString)(templateData);
      if (sourcePath == testCaseConfigPath) {
        await fs.promises.writeFile(destinationPath, JSON.stringify(testCaseConfig, null, 2));
        continue;
      }
      await fs.promises.writeFile(destinationPath, templatedString);
    }
  }

  // Create an S3 client
  const s3 = new AWS.S3();
  const s3Bucket = s3BucketName;

  // Create a S3 sync client
  const s3Client = new S3Client({});
  const { sync } = new S3SyncClient({ client: s3Client });

  // Sync the testsuites folder
  const testSuitesDir = testSuiteDir;
  await sync(testSuitesDir, 's3://' +
    s3Bucket + "/" + testSuiteUploadFolder);

  // Get the list of folders in the test-suite folder
  let folders = testCaseDirs;
  console.log(folders);

  // Create an ECS client
  const ecs = new AWS.ECS();

  // Loop through each folder
  for (const folder of folders) {

    // Test case name
    const testcaseName = path.basename(folder);

    // Load the environment variables from testcase.env
    const testcaseEnvPath = path.join(folder, 'testcase.env');
    dotenv.config({ path: testcaseEnvPath });

    const yieldSubDir = path.join(folder, "yield", "0-current");

    const testCaseConfigPath = path.join(yieldSubDir, "test-case.json");
    const testCaseConfig: TestCaseConfig = JSON.parse(fs.readFileSync(testCaseConfigPath, 'utf8'));

    // Register the task definition
    const taskJsonPath = path.join(yieldSubDir, 'task.json');
    const rawJsonFile = fs.readFileSync(taskJsonPath, 'utf8');
    const taskDefinitionParams: AWS.ECS.Types.RegisterTaskDefinitionRequest = JSON.parse(rawJsonFile);

    // Avoid processing tasks with count of 0
    const nTasks = testCaseConfig.n_tasks;
    if (nTasks === 0) {
      continue;
    }

    // If no container is specified, create one.
    const testCaseContainerName =
      testExecutionId + "-" +
      suiteTemplate.test_collection_name + "-" +
      suiteTemplate.test_suite_name + "-" +
      testcaseName

    // Create fargate cluster
    if (testCaseConfig.cluster === undefined) {
      await createCluster(ecs, testCaseContainerName);
      testCaseConfig.cluster = testCaseContainerName;
      await sleep(2000); /* Wait for the container to be ready to accept new tasks */
    }

    ecs.registerTaskDefinition(taskDefinitionParams, async (err, data) => {
      if (err) {
        console.error(`Error registering task definition for ${folder}: ${err}`);
        return;
      }
      const taskDefinitionArn = data.taskDefinition!.taskDefinitionArn;

      // Create the resulting_tasks folder if it does not exist
      const resultingTasksDir = path.join(yieldSubDir, 'resulting_tasks');
      if (!fs.existsSync(resultingTasksDir)) {
        fs.mkdirSync(resultingTasksDir);
      }

      // Launch the tasks in groups of 10 or less
      let taskIds = '';
      for (let i = 0; i < nTasks; i += 10) {
        const count = Math.min(10, nTasks - i);
        let result: PromiseResult<AWS.ECS.RunTaskResponse, AWS.AWSError>;
        try {
          result = await ecs.runTask({
            cluster: testCaseConfig.cluster,
            taskDefinition: taskDefinitionArn!,
            count: count,
            launchType: "FARGATE",
            networkConfiguration: {
              awsvpcConfiguration: testCaseConfig.network_vpc_config
            }
          }).promise();

          // await new Promise(resolve => setTimeout(resolve, 250)); /* slow down the async loop */
        }
        catch (err) {
          console.error(`Error launching task for ${folder}: ${err}`);
          return;
        }

        taskIds += result.tasks!.map((task) => task.taskArn!).join('\n') + '\n';
      }

      // Write the task IDs to a file
      const timestamp = Date.now();
      const taskIdsFilePath = path.join(resultingTasksDir, `tasks_${timestamp}`);
      fs.writeFile(taskIdsFilePath, taskIds, (err) => {
        if (err) {
          console.error(`Error writing task IDs to file for ${folder}: ${err}`);
          return;
        }
        console.log(`Task IDs written to ${taskIdsFilePath}`);
      });
    });
    await new Promise(resolve => setTimeout(resolve, 550)); /* if the async loop runs too quickly we get throttled */

    await sync(testSuitesDir, 's3://' +
    s3Bucket + "/" + testSuiteUploadFolder);
  }
}

run();

async function createCluster(ecs: AWS.ECS, clusterName: string) {
  return new Promise((resolve, reject) => {
    ecs.createCluster({
      clusterName: clusterName,
    }, (err) => {
      if (err) {
        reject(err);
      }
      else {
        resolve(clusterName);
      }
    });
  });
}


async function getMaterialGroupHash(materialGroupDir: string, ...extra: Array<string>): Promise<string> {
  const hash = crypto.createHash("sha256");
  
  // Update the hash with the contents of each file in the test suite directory
  const fileNames = await fs.promises.readdir(materialGroupDir);
  for (const fileName of fileNames) {
    const filePath = path.join(materialGroupDir, fileName);
    const stats = await fs.promises.stat(filePath);
  
    if (stats.isFile()) {
      hash.update(fileName);
      const fileContents = await fs.promises.readFile(filePath,  'utf8');
      hash.update(fileContents);
    }
  }

  for (const e of extra) {
    hash.update(e);
  }
  
  return hash.digest("hex");
}

function randomAlphaNumericGenerator(length: number): string {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  return Array.from(
      { length }, () => characters.charAt(Math.floor(Math.random() * charactersLength))
  ).join('');
}

// Helper methods
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}