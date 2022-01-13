
import { IDatajet, ILogData } from "../core/ext-types.js"
import net from 'net'

/* 
 * Sends logs to Fluent Bit through tcp
 */

interface IDatajetConfig {
    host: string,
    port: number,
}

const defaultConfig: IDatajetConfig = {
    host: "127.0.0.1",
    port: 5170,
}

const tcpDatajet: IDatajet = {
    name: "tcp",
    defaultConfig: defaultConfig,
    createConfiguredDatajet: function (config: IDatajetConfig) {
        
        /* create tcp connection */
        var client = new net.Socket();
        client.connect(config.port, config.host, function() {
            console.log('Connected tcp');
        });

        return {
            datajetTemplate: this,
            transmitBatch: async (batch: Array<ILogData>) => {
                for (const log of batch) {
                    client.write(JSON.stringify(log));
                }
                return true;
            }
        }
    }
}

export default tcpDatajet;
