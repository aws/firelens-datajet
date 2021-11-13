
import { IAsyncCommandChain, IClient } from "../core/ext-types.js"
import express from "express";
import { IExecutionResult } from "../core/pipeline-types.js";

function makeCommandChain() {
    const exposeResolve = function (resolve) {
        this.resolveNext = resolve;
    };
    const commandChainTemplate: any = {
        command: null,
        resolveNext: function (_: IAsyncCommandChain) {},
    };

    commandChainTemplate.next = new Promise<IAsyncCommandChain>(
            exposeResolve.bind(commandChainTemplate)
    );    
    
    return commandChainTemplate as IAsyncCommandChain;
}

/*
 * Corresponding environment variables
 * CLIENT_REQUEST_PORT=<request path>
 *  | default_value: 3333
 * CLIENT_REQUEST_ACCESS_TOKEN=<access token>
 *  | default_value: none
 */
const requestClient: IClient = {
    name: "request",
    makeCommandGenerator: () => {
        /* 
         * Utilize function closure to spin up server and
         * stream commands to generator
         */
        
        /* Create a command chain to notify async generator with commands */
        const asyncCommandChain: IAsyncCommandChain = makeCommandChain();
        let serverCommandChainLink: IAsyncCommandChain = asyncCommandChain;

        const app = express();
        app.use(express.json());

        const defaultPort = 3333;
        const port = process.env.CLIENT_REQUEST_PORT ?? defaultPort;

        /* security */
        app.use(function (req, res, next) {
            if (process.env.CLIENT_REQUEST_ACCESS_TOKEN === undefined) {
                next();
            }

            let bearerToken = "";
            if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
                bearerToken = req.headers.authorization.split(' ')[1];
            }
            
            if (bearerToken == process.env.CLIENT_REQUEST_ACCESS_TOKEN) {
                next();
                return;
            }

            res.status(401);
            res.json({
                "status": "Unauthorized, please include bearer token.",
            });
        })


        /* accept execution requests via post endpoint */
        let testId = 1;
        app.post('/execute', async function (req, res) {
            const config = req.body;

            const handleExecutionResult = async (executionResult: IExecutionResult) => {
                res.json({
                    testId,
                    status: `Execution ${(executionResult.isExecutionSuccess) ? "success" : "failed"}. Validation ${(executionResult.isValidationSuccess) ? "success" : "failed"}`,
                    metrics: [], /* Add metrics evaluation */
                    testConfiguration: config,
                    executionResult,
                });
                ++testId;
            };

            let nextServerCommandChainLink = makeCommandChain();
            nextServerCommandChainLink.command = {
                    pipelineConfiguration: config,
                    handleExecutionResult: handleExecutionResult,
                };

            serverCommandChainLink.resolveNext(nextServerCommandChainLink);
            serverCommandChainLink = nextServerCommandChainLink;

            return;
        });

        /* launch server */
        const server = app.listen(port, function () {
            console.log(`Listening for test configurations on port: ${port}`);
        });

        /* wrap server in generator, stream from command chain */
        return (async function*() {
            let asyncCommandChainLink = asyncCommandChain;
            while (true) {
                if (asyncCommandChainLink.command !== null) {
                    yield asyncCommandChainLink.command;
                }
                asyncCommandChainLink = await asyncCommandChainLink.next;
            }
        })();
    }
};

export default requestClient;
