import { IDatajet } from "../core/ext-types.js"
import firelensDatajet from "./firelens-datajet.js"
import stdoutDatajet from "./stdout-datajet.js"
import stdcurlDatajet from "./stdcurl-datajet.js"
import tcpDatajet from "./tcp-datajet.js";

const index : Array<IDatajet> = [
    firelensDatajet,
    stdoutDatajet,
    stdcurlDatajet,
    tcpDatajet,
];

export default index;
