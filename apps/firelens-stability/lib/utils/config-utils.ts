import { evaluateTemplateString } from "../templating/handlebars-templater.js";
import * as Path from "path"
import * as Constants from "../constants.js"
import { getJsonFromFile } from "./utils.js";

export function cascadeLists<IComponentType>(lists: IComponentType[][]): IComponentType[] {
    /* An adapter to the cascadeConfigurationLists function */
    const adapter = lists.map(l => ({
        config: {
            "list.adapter": l
        },
        definitions: {},
        managed: {},
    }));

    const cascade = cascadeConfigurationLists(adapter as any as IGenericConfig[]);
    return cascade.config["list.adapter"];
}

export function cascadeConfigurationLists(configs: IGenericConfig[]) {
    /* Treat config lists differently */
    /* Merge each list and override same named entries */

    /* Find config lists */
    const configLists = configs.map(config =>
        Object.keys(config.config)
        .filter(k => k.startsWith("lists."))
        .map(k => config.config[k])
    );

    /* Mutate configLists into entries - overrides are last */
    const entries = configLists.map(
        list => Object.entries(list).map(([k,v]) => {
            return {
                "listName": k,
                "items": v
            }
        }
    )).flat();

    /* Build merged lists abstract structure */
    const mergedListsAbstract = {};
    entries.forEach(entry => {
        entry.items.forEach(item => {
            /* In most javascript implementations, order is preserved, duplicates are not */
            mergedListsAbstract[entry.listName] = mergedListsAbstract[entry.listName] ?? [];
            mergedListsAbstract[entry.listName][item.name ?? "null"] = item; /* preserve unnamed with random name */
        });
    });

    /* Rebuild merged lists */
    const mergedEntries = Object.entries(mergedListsAbstract).map(([listName,items]) => (
        [
            listName, Object.entries(items).map((name, item) => item)
        ]
    ))
    const mergedLists = Object.fromEntries(mergedEntries);

    /* Stable sort lists */
    const sortedMergedLists = mergedLists.sort((a, b) => a?.order ?? 1 - b?.order ?? 1);

    /* Cascade the configuration objects */
    let cascadedConfig: IGenericConfig = {} as IGenericConfig;
    configs.forEach(config => {
        cascadedConfig = {
            config: {
                ...(cascadedConfig?.config ?? {}),
                ...config.config,
            },
            definitions: {
                ...(cascadedConfig?.definitions ?? {}),
                ...config.definitions,
            },
            managed: {
                ...(cascadedConfig?.managed ?? {}),
                ...config.managed,
            }
        };
    });

    /* Add merged lists to config object */
    cascadedConfig = {
        config: {
            ...(cascadedConfig?.config ?? {}),
            ...sortedMergedLists
        },
        definitions: cascadedConfig.definitions,
        managed: cascadedConfig.managed,
    }

    return cascadedConfig;
}


export function cascadeConfigurationObjects(extensionConfig: IGenericConfig, baseConfig: IGenericConfig) {

    return cascadeConfigurationLists([baseConfig, extensionConfig]);

}

export function cascadeConfigurationObjectsConfig(extensionConfig: IGenericConfig, baseConfig: IGenericConfig) {
    const cascade = cascadeConfigurationObjects(extensionConfig, baseConfig);
    return {
        ...baseConfig,
        config: cascade.config,
    }
}

export function cascadeConfigurationObjectsDefinitions(extensionConfig: IGenericConfig, baseConfig: IGenericConfig) {
    const cascade = cascadeConfigurationObjects(extensionConfig, baseConfig);
    return {
        ...baseConfig,
        definitions: cascade.definitions,
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
