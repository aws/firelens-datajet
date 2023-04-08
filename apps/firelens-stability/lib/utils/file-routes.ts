import { dirname } from "path";
import { fileURLToPath } from 'url';
import * as Constants from "../constants.js";

/* This file and function is not needed */
interface IDervivationParameters {
    executionContext?: IExecutionContext,
    testCase?: ITestCase,
}
/*
function derivePath(pathName: string, p: IDervivationParameters) {
    const root = dirname(fileURLToPath(import.meta.url));
    const templates = {
        "archive": path.join(root, Constants.paths.,  ),
        "test"
    }
}
*/
