import fs from "fs";
import path from "path";
import { IDatajet, ILogData } from "../core/ext-types.js";

interface IDatajetConfig {
    path: string,
    name: string,
    key: string,
}

const defaultConfig: IDatajetConfig = {
    path: "./",
    name: "output-logs.log",
    key: null
}

const fileDatajet: IDatajet = {
    name: "file",
    defaultConfig: defaultConfig,
    createConfiguredDatajet: function (config: IDatajetConfig) {

        const file = path.resolve(`${config.path}/${config.name}`);
        const logStream = fs.createWriteStream(file, { flags: 'a' }); /* 27.48 seconds - 27.862 */

        return {
            datajetTemplate: this,
            transmitBatch: async (batch: Array<ILogData>) => {
                /* does stringify take too long? */
                const len = batch.length;
                for (let i = 0; i < len; ++i) {
                    const log = batch[i];
                    /* const str = `${log[config.key] ?? "null"}\n`; */
                    /* log[config.key] ?? "null" */

                    logStream.write((config.key) ?
                        `${log[config.key] ?? "null"}\n` : /* Elapsed time: 27.48 seconds - 27.41 seconds single string */
                        ((typeof log === "object") ?
                            JSON.stringify(log) :
                            log ?? "null"));
                    // fs.writeFileSync(file, , { flag: 'a+' });
                }
                return true;
            }
        }
    }
}

export default fileDatajet;
