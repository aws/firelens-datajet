import { putDashboard } from "lib/cloud/dashboard";
import { cascadeLists } from "lib/utils/config-utils";

export function processDashboardWidgetLists(testCases: ITestCase[]) {
    /* Create the dashboard structure */
    const dashboardSeeds = generateDashboardSeeds(testCases);

    /* Convert to actual dashboards */
    dashboardSeeds.forEach(seed => {
        putDashboard(seed);
    });
}

export function generateDashboardSeeds(testCases: ITestCase[]) {
    const defaultDashboardName = `${testCases[0].managed.executionName}-${testCases[0].managed.executionId}`

    /* Separate testCases by dashboard */
    const dashboards: {[key: string]: ITestCase[]} = {};
    testCases.forEach(tc => {
        const dashboardName = tc.config.dashboard ?? defaultDashboardName;

        if (!(dashboardName in dashboards)) {
            dashboards[dashboardName] = []
        }
        dashboards[dashboardName].push(tc);
    })

    /* Get dashboards */
    const dashboardSeeds = Object.entries(dashboards).map(([name, testCasesSubset]) => ({
        name: name,
        widgets: generateOrderdedWidgetsFromTestCases(testCasesSubset),
        region: testCasesSubset[0].config.region,
    }))

    return dashboardSeeds;
}

export function generateOrderdedWidgetsFromTestCases(testCases: ITestCase[]) {
    /* Group test cases by path */
    const dashboardSections: {[key: string]: any[]} = {};
    testCases.forEach((testCase) => {
        const defaultSection = testCase.config.dashboardSection ?? "/";
        testCase.config["lists.dashboardWidgets"].forEach(widget => {
            const path = `${widget.section ?? defaultSection}/${widget.name}`; 
            if (!dashboardSections[path]) { dashboardSections[path] = []; }
            dashboardSections[path].push(widget);
        });
    });

    /* Squash test cases by path */
    const dashboardWidgetGroups = Object.entries(dashboardSections).map(([path, widgets]) => {
        const sortedLists = widgets.sort((a, b) => a?.order ?? 1 - b?.order ?? 1);
        const mergedLists = cascadeLists(sortedLists);
        return {
            path: path,
            widgets: mergedLists,
        };
    })

    /* Sort paths */
    const sortedLists = dashboardWidgetGroups.sort((a, b) => a.path.localeCompare(b.path));

    /* Combine the widget lists */
    const flatWidgets = sortedLists.map(sl => sl.widgets).flat();
    const strippedFlatWidgets = flatWidgets.map(fw => fw.config);
    return strippedFlatWidgets;
}
