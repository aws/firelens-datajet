import { evaluateTemplateString } from "../templating/handlebars-templater.js";
import * as Path from "path"
import * as Constants from "../constants.js"
import { getJsonFromFile } from "./utils.js";


export function cascadeConfigurationObjects(extensionConfig: IGenericConfig, baseConfig: IGenericConfig) {
    return {
        config: {
            ...baseConfig.config,
            ...extensionConfig.config,
        },
        definitions: {
            ...baseConfig.definitions,
            ...extensionConfig.definitions,
        },
        managed: {
            ...baseConfig.managed,
            ...extensionConfig.managed
        }
    }
}

export function cascadeConfigurationStringAsExtension(cascadedConfigString: string, baseConfig: IGenericConfig) {
    const nextConfigLayerString = evaluateTemplateString(cascadedConfigString, baseConfig);
    const nextConfigLayer = JSON.parse(nextConfigLayerString);
    
    /* Apply new configuraion layer */
    return cascadeConfigurationObjects(nextConfigLayer, baseConfig);
}

export function cascadeConfigurationStringAsDefault(baseString: string, extensionConfig: IGenericConfig) {
    const baseConfigLayerString = evaluateTemplateString(baseString, extensionConfig);
    const baseConfigLayer = JSON.parse(baseConfigLayerString);

    /* Apply extension config to defaults */
    return cascadeConfigurationObjects(extensionConfig, baseConfigLayer);
}

export async function getTestCaseTaskDefinition(testCase: ITestCase): Promise<AWS.ECS.Types.RegisterTaskDefinitionRequest> {
    const taskPath = Path.join(testCase.local.archiveLocalPath, Constants.fileNames.taskDefinition);
    return await getJsonFromFile(taskPath);
}

export async function validateTestConfig(config: IGenericConfig) {
    const checkNotNull = [
        "template",
        "cluster",
        "region",
        "taskCount",
        "taskVpcSubnets",
        "taskVpcSecurityGroups"
    ];

    let err = false;
    checkNotNull.forEach(c => {
        if (config.config[c] === undefined) {
            console.log(`Configuration error on test: ` +
            `${config.managed.caseNameFull}. Please ensure ${c} is set in "config"`);
        }
    });

    if (err) {
        throw "error";
    }
}