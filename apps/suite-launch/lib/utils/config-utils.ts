import { evaluateTemplateString } from "../templating/handlebars-templater.js";


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
    const baseConfigLayerString = evaluateTemplateString(baseString, extensionConfig);    const nextConfigLayer = JSON.parse(nextConfigLayerString);
    const baseConfigLayer = JSON.parse(baseConfigLayerString);

    /* Apply extension config to defaults */
    return cascadeConfigurationObjects(extensionConfig, baseConfigLayer);
}
