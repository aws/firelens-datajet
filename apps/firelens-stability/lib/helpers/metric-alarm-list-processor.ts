import { putMetricAlarm } from "lib/cloud/cloudwatch";
import { cascadeConfigurationLists, cascadeLists } from "lib/utils/config-utils";

export function processMetricAlarmsList(testCases: ITestCase[]) {

    /* Combine the lists */
    const metricAlarmSeeds = generateMetricAlarmSeeds(testCases);

    /* Convert to actual  */
    metricAlarmSeeds.forEach(seed => {
        putMetricAlarm(seed);
    });
}

export function generateMetricAlarmSeeds(testCases: ITestCase[]) : IMetricAlarmSeed[] {
    
    /* Combine the lists */
    const metricAlarmsLists = testCases.map(tc => tc.config["lists.metricAlarms"]);
    const metricAlarmsCascade = cascadeLists(metricAlarmsLists);

    /* Get dashboards */
    const metricAlarmSeeds: IMetricAlarmSeed[] = metricAlarmsCascade.map(mac => ({
        name: mac.name,
        config: mac.config,
        region: testCases[0].config.region,
    }));

    return metricAlarmSeeds;
}
