import { ILogData } from "../core/ext-types";

const filterBatch = (batch: Array<ILogData>) => {
    batch.map(log => {
        log.text = log.text
    })
}