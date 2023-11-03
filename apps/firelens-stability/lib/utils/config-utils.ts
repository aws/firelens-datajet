import { evaluateTemplateString } from "../templating/handlebars-templater.js";
import * as Path from "path"
import * as Constants from "../constants.js"
import { getJsonFromFile } from "./utils.js";

export function cascadeLists<IComponentType>(lists: IComponentType[][]): IComponentType[] {
    /* An adapter to the cascadeConfigurationLists function */
    const adapter = lists.map(l => ({
        config: {
            "lists.adapter": l
        },
        definitions: {},
        managed: {},
    }));

    const cascade = cascadeConfigurationLists(adapter as any as IGenericConfig[]);
    return cascade.config["lists.adapter"];
}

export function cascadeConfigurationLists(configs: IGenericConfig[]) {
    /* Treat config lists differently */
    /* Merge each list and override same named entries */

    /* Find config lists */
    const configLists = configs.map(config =>
        Object.entries(config?.config ?? [])
        .filter(([k, _]) => k.startsWith("lists."))
    );

    /* Mutate configLists into entries - overrides are last */
    const entries = configLists.map(
        list => list.map(([k,v]) => {
            return {
                "listName": k,
                "items": v
            }
        }
    )).flat();

    /* Build merged lists abstract structure */
    const mergedListsAbstract: {[listName: string]: {[itemName: string]: any}} = {};
    entries.forEach(entry => {
        entry.items.forEach(item => {
            /* In most javascript implementations, order is preserved, duplicates are not */
            mergedListsAbstract[entry.listName] = mergedListsAbstract[entry.listName] ?? [];
            mergedListsAbstract[entry.listName][item.name ?? "null"] = item; /* preserve unnamed with random name */
        });
    });

    /* Rebuild merged lists */
    const mergedEntries = Object.entries(mergedListsAbstract).map(([listName,items]) => {
        const itemsList = Object.entries(items).map(([name, item]) => item);
        
        /* Stable sort lists by order */
        const sortedItemsList = itemsList.sort((a, b) => a?.order ?? 1 - b?.order ?? 1)
        return [
            listName, sortedItemsList
        ]
    })
    const mergedLists = Object.fromEntries(mergedEntries);

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
            ...mergedLists,
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
    try {
        const nextConfigLayer = JSON.parse(nextConfigLayerString);

        /* Apply new configuraion layer */
        return cascadeConfigurationObjects(nextConfigLayer, baseConfig);

    } catch (e) {
        console.log("Unable to parse json configuration from string:");
        console.log(nextConfigLayerString);
        throw e;
    }
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
