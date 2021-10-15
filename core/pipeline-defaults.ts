import { IExecutePipelineConfig } from "./pipeline-types.js";

/* Default pipeline configuration values */
const pipelineConfigDefaults: Required<IExecutePipelineConfig> = {


    validationFailureAction: "terminate",
    executionFailureAction: "terminate",
    onValidationFailure: async () => {},
    onExecutionFailure: async () => {},


}
export default pipelineConfigDefaults;