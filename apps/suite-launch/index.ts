#!/usr/bin/env node
import meow from 'meow';
import { promises as fs } from 'fs';
import { inspectExecution } from "./lib/commands/inspect-execution.js"
import { stopExecution } from "./lib/commands/stop-execution.js"
import { executeTests } from './lib/commands/start-execution.js';
import { dirname } from "path";
import { fileURLToPath } from 'url';
import './lib/types.js';

const cli = meow(
`
    Usage
    $ firelens-stability [command=start] [options]

    Commands
    start   - start a stability test execution
    stop    - stop stability test execution
    inspect - get test results for stability test execution
    help    - show this help

    Global Options (firelens-stability [=start, console, init])
    help                 - show this help
    
    Start options (firelens-stability [=start])
    --file, -f           - execution json from file
    --param, -p          - execution json as parameter
    
    Stop options (firelens-stability [=stop])
    <execution-id>       - execution id to stop

    Inspect options (firelens-stability [=inspect])
    <execution-id>       - execution id to generate summary for
    `,
    {
        importMeta: import.meta,
        flags: {
            file: {
                type: "string",
                alias: "f",
                default: `${dirname(fileURLToPath(import.meta.url))}/execution.json`,
            },
            param: {
                type: "string",
                alias: "p",
                default: ""
            }
        }
    }
);

async function main() {

    const command =  cli.input[0] ?? "start";

    if (command === "help") {
        cli.showHelp(0);
        return;
    }

    if (command === "start") {
        let execString = cli.flags.param;
        if (execString === "") {
            const execFilePath = cli.flags.file;
            execString = await fs.readFile(execFilePath, "utf-8");
        }
        const exec: IExecution = JSON.parse(execString);
        try {
            await executeTests(exec);
            return process.exit(0);
        }
        catch (e) {
            console.log(`stability-tests start exited with error ${e}`)
            process.exit(1);
        }
    }

    else if (command === "stop") {
        const executionId = cli.input[1];
        try {
            await stopExecution(executionId);
            return process.exit(0);
        }
        catch {
            process.exit(0);
        }
    }

    else if (command === "inspect") {
        const executionId = cli.input[1];
        try {
            await inspectExecution(executionId);
            return process.exit(0);
        }
        catch {
            process.exit(0);
        }
    }

}

main();
