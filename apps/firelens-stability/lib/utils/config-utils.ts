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

export function cascadeConfigurationObjectsConfig(extensionConfig: IGenericConfig, baseConfig: IGenericConfig) {
    return {
        config: {
            ...baseConfig.config,
            ...extensionConfig.config,
        },
        definitions: {
            ...baseConfig.definitions,
        },
        managed: {
            ...baseConfig.managed,
        }
    }
}

export function cascadeConfigurationObjectsDefinitions(extensionConfig: IGenericConfig, baseConfig: IGenericConfig) {
    return {
        config: {
            ...baseConfig.config,
        },
        definitions: {
            ...baseConfig.definitions,
            ...extensionConfig.definitions,
        },
        managed: {
            ...baseConfig.managed,
        }
    }
}

export function cascadeConfigurationStringAsExtensionBasic(cascadedConfigString: string, baseConfig: IGenericConfig) {
    const nextConfigLayerString = evaluateTemplateString(cascadedConfigString, baseConfig);
    const nextConfigLayer = JSON.parse(nextConfigLayerString);
    
    /* Apply new configuraion layer */
    return cascadeConfigurationObjects(nextConfigLayer, baseConfig);
}

/* 
 * Cascade configuration
 * Parent configuration file -> configuration file -> [conf -> def, def -> conf]
 */
export function cascadeConfigurationStringAsExtension(cascadedConfigString: string, baseConfig: IGenericConfig) {
    
    /* Apply new configuraion layer */
    const cascadeConfigBase = cascadeConfigurationStringAsExtensionBasic(cascadedConfigString, baseConfig);

    /* Allow definitions to use self config variables */
    const baseConfigUpdateConfig = cascadeConfigurationObjectsConfig(cascadeConfigBase, baseConfig);
    const cascadeConfigUpdateDefinition = cascadeConfigurationStringAsExtensionBasic(cascadedConfigString, baseConfigUpdateConfig);
    const cascadeConfigUpdate1 = cascadeConfigurationObjectsDefinitions(cascadeConfigUpdateDefinition, cascadeConfigBase);

    /* Allow config to use self definition variables */
    const baseConfigUpdateDefinition = cascadeConfigurationObjectsDefinitions(cascadeConfigBase, baseConfig);
    const cascadeConfigUpdateConfig = cascadeConfigurationStringAsExtensionBasic(cascadedConfigString, baseConfigUpdateDefinition);
    const cascadeConfigUpdate2 = cascadeConfigurationObjectsConfig(cascadeConfigUpdateConfig, cascadeConfigUpdate1);

    return cascadeConfigUpdate2;
}

export function cascadeConfigurationStringAsDefault(baseString: string, extensionConfig: IGenericConfig) {
    const cascadeExtended = cascadeConfigurationStringAsExtension(baseString, extensionConfig);

    /* Restore pre-existing conflict fields */
    return cascadeConfigurationObjects(extensionConfig, cascadeExtended);
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
            `${config.managed.caseNameUnique}. Please ensure ${c} is set in "config"`);
        }
    });

    if (err) {
        throw "error";
    }
}
