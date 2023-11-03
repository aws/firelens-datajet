
import { getStringFromFile, getSubFolders, getJsonFromFile, makeId, getSubFiles, s3ArnToBucketAndPath, nestedPathCreate, sendStringToFile, sendJSONToFile } from "../utils/utils.js";
import * as Constants from "../constants.js";
import path, * as Path from "path";
import { cascadeConfigurationStringAsDefault, cascadeConfigurationStringAsExtension, cascadeLists, validateTestConfig } from "../utils/config-utils.js";
import { promises as fs } from "fs";
import { copyAndTemplateFile } from "../templating/handlebars-templater.js";
import { runECSTestCase } from "./ecs.js";
import * as PathProvider from "../providers/path-provider.js"
import { CloudWatchClient, PutDashboardCommand, PutMetricAlarmCommandInput } from "@aws-sdk/client-cloudwatch"; // ES Modules import
import { PutMetricAlarmCommand } from "@aws-sdk/client-cloudwatch";

export async function putDashboard(seed: IDashboardSeed) {

    /* API call to create cloudwatch dashboards */
    const client = new CloudWatchClient({region: seed.region});

    const input = {
        DashboardName: seed.name,
        DashboardBody: JSON.stringify({
            "widgets": seed.widgets
        }),
    }

    const command = new PutDashboardCommand(input);
    const response = await client.send(command);
};

export async function putMetricAlarm(seed: IMetricAlarmSeed) {

    /* API call to create cloudwatch dashboards */
    const client = new CloudWatchClient({region: seed.region});

    // This alarm triggers when CPUUtilization exceeds 70% for one minute.
    const command = new PutMetricAlarmCommand(seed.config);
    const response = await client.send(command);
    
    /*
    try {
        return await client.send(command);
    } catch (err) {
        console.error(err);
    }
    */
}