import { IDatajet, ILogData } from "../core/ext-types.js";

interface IDatajetConfig {
    logStream: "stdout" | "stderr" | "auto",
    defaultStream: "stdout" | "stderr",
}

const defaultConfig: IDatajetConfig = {
    logStream: "auto",
    defaultStream: "stdout",
}

const stdoutDatajet: IDatajet = {
    name: "stdout",
    defaultConfig: defaultConfig,
    createConfiguredDatajet: function (config: IDatajetConfig) {

        return {
            datajetTemplate: this,
            transmitBatch: async (batch: Array<ILogData>) => {
                batch.forEach(log => {
                    const logMethod = (config.logStream !== "auto")
                        ? config.logStream
                        : (log.stream ?? config.defaultStream);
                    
                    if (logMethod === "stdout") {
                        console.log(log.text);
                    }

                    else if (logMethod === "stderr") {
                        console.error(log.text);
                    }
                });
                return true;
            }
        }

    }
}

export default stdoutDatajet;
