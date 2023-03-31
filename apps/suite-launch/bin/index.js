#!/usr/bin/env node
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import meow from 'meow';
import { promises as fs } from 'fs';
import { inspectExecution } from "./lib/inspect-execution";
import { stopExecution } from "./lib/stop-execution";
import { executeTests } from './lib/pipeline';
var cli = meow("\n    Usage\n    $ firelens-stability [command=start] [options]\n\n    Commands\n    start   - start a stability test execution\n    stop    - stop stability test execution\n    inspect - get test results for stability test execution\n    help    - show this help\n\n    Global Options (firelens-stability [=start, console, init])\n    help                 - show this help\n    \n    Start options (firelens-stability [=start])\n    --file, -f           - execution json from file\n    --param, -p          - execution json as parameter\n    \n    Stop options (firelens-stability [=stop])\n    <execution-id>       - execution id to stop\n\n    Inspect options (firelens-stability [=inspect])\n    <execution-id>       - execution id to generate summary for\n    ", {
    importMeta: import.meta,
    flags: {
        file: {
            type: "string",
            alias: "f",
            default: "".concat(__dirname, "/execution.json"),
        },
        param: {
            type: "string",
            alias: "p",
            default: ""
        }
    }
});
function main() {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var command, execString, execFilePath, execString_1, exec, _b, executionId, _c, executionId, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    command = (_a = cli.input[0]) !== null && _a !== void 0 ? _a : "start";
                    if (command === "help") {
                        cli.showHelp(0);
                        return [2 /*return*/];
                    }
                    if (!(command === "start")) return [3 /*break*/, 7];
                    execString = cli.flags.param;
                    if (!(execString === "")) return [3 /*break*/, 2];
                    execFilePath = cli.flags.file;
                    return [4 /*yield*/, fs.readFile(execFilePath)];
                case 1:
                    execString_1 = _e.sent();
                    _e.label = 2;
                case 2:
                    exec = JSON.parse(execString);
                    _e.label = 3;
                case 3:
                    _e.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, executeTests(exec)];
                case 4:
                    _e.sent();
                    return [2 /*return*/, process.exit(0)];
                case 5:
                    _b = _e.sent();
                    process.exit(1);
                    return [3 /*break*/, 6];
                case 6: return [3 /*break*/, 16];
                case 7:
                    if (!(command === "stop")) return [3 /*break*/, 12];
                    executionId = cli.input[1];
                    _e.label = 8;
                case 8:
                    _e.trys.push([8, 10, , 11]);
                    return [4 /*yield*/, stopExecution(executionId)];
                case 9:
                    _e.sent();
                    return [2 /*return*/, process.exit(0)];
                case 10:
                    _c = _e.sent();
                    process.exit(0);
                    return [3 /*break*/, 11];
                case 11: return [3 /*break*/, 16];
                case 12:
                    if (!(command === "inspect")) return [3 /*break*/, 16];
                    executionId = cli.input[1];
                    _e.label = 13;
                case 13:
                    _e.trys.push([13, 15, , 16]);
                    return [4 /*yield*/, inspectExecution(executionId)];
                case 14:
                    _e.sent();
                    return [2 /*return*/, process.exit(0)];
                case 15:
                    _d = _e.sent();
                    process.exit(0);
                    return [3 /*break*/, 16];
                case 16: return [2 /*return*/];
            }
        });
    });
}
//# sourceMappingURL=index.js.map