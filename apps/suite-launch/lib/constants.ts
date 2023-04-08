import * as Path from "path";
import { fileURLToPath } from "url";

/* Root directory of application */
const r = Path.join(Path.dirname(fileURLToPath(import.meta.url)), "..");

export const paths = {
    "executionConfig": `${r}/config/execution-config.json`,
    "collectionConfig": `${r}/config/collection-config.json`,
    "collections": `${r}/collections`,
    "templates": `${r}/templates`,
    "auto": `${r}/auto`,
}

export const folderNames = {
    "archives": "archives",
    "records": "records",
    "summary": "summary",
    "cases": "cases",
}

export const fileNames = {
    "suiteConfig": "suite-config.json",
    "caseConfig": "case-config.json",
    "templateDefaultConfig": "default-config.json",
    "taskDefinition": "task-definition.json",
    "execution": "execution.json",
}

export const defaults = {
    "config": {
        cluster: "",
        region: "us-west-2",
        taskCount: 1,
    }
}
