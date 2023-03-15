import * as AWS from 'aws-sdk';
import { S3Client } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PromiseResult } from 'aws-sdk/lib/request';
import * as handlebars from "handlebars";
const S3SyncClient = require('s3-sync-client');

interface MaterialGroupJson {
  s3_bucket_name: string;
  global_template: { [key: string]: any };
}

interface TestcaseJson {
  test_name: string;
  template: any;
  s3_bucket_name: string;
  cluster: string;
  n_tasks: number;
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

  // Load the environment variables from material-sets.env
  const materialSetsEnvPath = path.join(scriptDir, 'material-sets', 'material-sets.env');
  dotenv.config({ path: materialSetsEnvPath });

  // Get the path to the material groups directory
  const materialGroupsDir = path.join(__dirname, "material-sets");

  // Read the material groups JSON file
  const materialGroupsJsonPath = path.join(materialGroupsDir, "material-sets.json");
  const materialGroupsJsonString = await fs.promises.readFile(materialGroupsJsonPath, "utf-8");
  const materialGroupsJson: MaterialGroupJson = JSON.parse(materialGroupsJsonString);

  // Process each material group
  console.log(`Processing material group directory: ${materialGroupsDir}`);

  // Determine the S3 bucket to use for the material group
  const s3BucketName = materialGroupsJson.s3_bucket_name;

  // Read the global template
  const globalTemplate = materialGroupsJson.global_template;

  // Process each test case in each material group
  let testCaseDirs = fs.readdirSync(materialGroupsDir, { withFileTypes: true })
    .filter((dir) => dir.isDirectory())
    .map((dir) => path.join(materialGroupsDir, dir.name));

  // Override with user provided testCaseDirs
  if (process.argv.length > 2) {
    testCaseDirs = process.argv.slice(2).map((item) => path.join(materialGroupsDir, item));
  }

  for (const testCaseDir of testCaseDirs) {
    console.log(`Processing test case directory: ${testCaseDir}`);

    // Read the test case JSON file
    const testCaseJsonPath = path.join(testCaseDir, "testcase.json");
    const testCaseJsonString = await fs.promises.readFile(testCaseJsonPath, "utf-8");
    const testCaseJson: TestcaseJson = JSON.parse(handlebars.compile(testCaseJsonString)(globalTemplate));

    // Determine the ID for the current test case
    const hash = await getMaterialGroupHash(testCaseDir, materialGroupsJsonString);
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

    const materialSetFiles = fs.readdirSync(testCaseDir, { withFileTypes: true })
    .filter((dirent) => dirent.isFile())
    .map((dirent) => dirent.name);

    // Copy all non-directory files from the material sets directory to the yield directory
    /*for (const materialSetFile of materialSetFiles) {
      const sourcePath = path.join(testCaseDir, materialSetFile);
      const destinationPath = path.join(yieldDirPath, materialSetFile);
      await fs.promises.copyFile(sourcePath, destinationPath);
    } */

    // Template all files in the material sets directory
    console.log(`Templating files in material set directory: ${testCaseDir}/yield/${yieldSubDir}`);

    const templateData = {
      s3_materials_arn: `arn:aws:s3:::${s3BucketName}/${path.basename(testCaseDir)}/yield/${yieldSubDir}`,
      s3_materials_key_base: `${path.basename(testCaseDir)}/yield/${yieldSubDir}`,
      s3_materials_bucket: s3BucketName,
      test_revision: `${testId}-${hash.slice(0, 6)}`,
      test_name: path.basename(testCaseDir),
      test_name_unique: `${path.basename(testCaseDir)}-r${testId}-${hash.slice(0, 6)}`,
      ...globalTemplate,
      ...testCaseJson.template,
    };
    testCaseJson.template = templateData

    for (const materialSetFile of materialSetFiles) {
      const sourcePath = path.join(testCaseDir, materialSetFile);
      const destinationPath = path.join(yieldDirPath, materialSetFile);
      const fileString = await fs.promises.readFile(sourcePath, "utf-8");
      const templatedString = handlebars.compile(fileString)(templateData);
      if (sourcePath == testCaseJsonPath) {
        await fs.promises.writeFile(destinationPath, JSON.stringify(testCaseJson, null, 2));
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

  // Sync the materialsets folder
  const materialSetsDir = materialGroupsDir;
  await sync(materialSetsDir, 's3://' + s3Bucket);

  // Get the list of folders in the material-sets folder
  let folders = testCaseDirs;
  console.log(folders);

  // Create an ECS client
  const ecs = new AWS.ECS();

  // Loop through each folder
  for (const folder of folders) {
    // Load the environment variables from testcase.env
    const testcaseEnvPath = path.join(folder, 'testcase.env');
    dotenv.config({ path: testcaseEnvPath });

    const yieldSubDir = path.join(folder, "yield", "0-current");

    const testCaseJsonPath = path.join(yieldSubDir, "testcase.json");
    const testCaseJson: TestcaseJson = JSON.parse(fs.readFileSync(testCaseJsonPath, 'utf8'));

    // Register the task definition
    const taskJsonPath = path.join(yieldSubDir, 'task.json');
    const rawJsonFile = fs.readFileSync(taskJsonPath, 'utf8');
    const taskDefinitionParams: AWS.ECS.Types.RegisterTaskDefinitionRequest = JSON.parse(fs.readFileSync(taskJsonPath, 'utf8'));

    // Avoid processing tasks with count of 0
    const nTasks = testCaseJson.n_tasks;
    if (nTasks === 0) {
      continue;
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
            cluster: testCaseJson.cluster,
            taskDefinition: taskDefinitionArn!,
            count: count,
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
  }
}

run();


async function getMaterialGroupHash(materialGroupDir: string, extra: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  
  // Update the hash with the contents of each file in the material group directory
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

  hash.update(extra);
  
  return hash.digest("hex");
}
