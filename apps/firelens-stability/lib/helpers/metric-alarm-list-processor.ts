import { putMetricAlarm } from "../cloud/cloudwatch.js";
import { cascadeConfigurationLists, cascadeLists } from "../utils/config-utils.js";

export async function processMetricAlarmsList(testCases: ITestCase[]) {

    /* Combine the lists */
    const metricAlarmSeeds = generateMetricAlarmSeeds(testCases);

    /* Convert to alarms  */
    await Promise.all(metricAlarmSeeds.map(seed => {
        console.log(`🔔 Create alarm: ${seed.name}`);
        return putMetricAlarm(seed);
    }));
}

export function generateMetricAlarmSeeds(testCases: ITestCase[]) : IMetricAlarmSeed[] {
    
    /* Combine the lists */
    const metricAlarmsLists = testCases.map(tc => tc.config["lists.metricAlarms"] ?? []);
    const metricAlarmsCascade = cascadeLists(metricAlarmsLists);

    /* Get dashboards */
    const metricAlarmSeeds: IMetricAlarmSeed[] = metricAlarmsCascade.map(mac => ({
        name: mac.name,
        config: mac.config,
        region: testCases[0].config.region,
    }));

    return metricAlarmSeeds;
}
