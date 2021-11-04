 
import generatorTemplates from "./generators/generator-index.js"
import datajetTemplates from "./datajets/datajet-index.js"
import { buildStage, deepFreezePipeline, executePipeline } from "./core/pipeline.js";
import { IExecutePipelineConfig } from "./core/pipeline-types.js";
import dotenv from 'dotenv';
import express from "express";

dotenv.config();
const app = express();
app.use(express.json());

const defaultPort = 3333;
const port = process.env.PORT ?? defaultPort;

/* security */
app.use(function (req, res, next) {
    if (process.env.ACCESS_TOKEN === undefined) {
        next();
    }

    let bearerToken = "";
    if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
        bearerToken = req.headers.authorization.split(' ')[1];
    }
    
    if (bearerToken == process.env.ACCESS_TOKEN) {
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

    const findGeneratorByName = (name: string) => generatorTemplates
        .find((generatorTemplate => generatorTemplate.name === config.generator.name));

    const findDatajetByName = (name: string) => datajetTemplates
        .find((datajetTemplate => datajetTemplate.name === config.datajet.name));

    const stage = {
        generator: findGeneratorByName(config.generator.name)
            .createConfiguredGenerator({
                ...findGeneratorByName(config.generator.name).defaultConfig,
                ...config.generator.config ?? {},
            }),
        datajet: findDatajetByName(config.datajet.name)
            .createConfiguredDatajet({
                ...findDatajetByName(config.datajet.name).defaultConfig,
                ...config.datajet.config ?? {},
            }),
        config: config.stage,
    }

    const pipeline = buildStage(stage);
    let executionSuccess = true;
    let validationSuccess = true;
    const pipelineConfig: IExecutePipelineConfig = {
        onExecutionFailure: async () => {
            executionSuccess = false;
            console.log("Execution failed");
        },
        onValidationFailure: async () => {
            validationSuccess = false;
            console.log("Validation failed");
        }
    };

    deepFreezePipeline(pipeline);
    const executionResult = await executePipeline(pipeline, pipelineConfig);
    res.json({
        testId,
        status: `Execution ${(executionSuccess) ? "success" : "failed"}. Validation ${(validationSuccess) ? "success" : "failed"}`,
        metrics: [], /* Add metrics evaluation */
        testConfiguration: config,
        executionResult,
    });
    ++testId;
    return;
});

/* launch server */
const server = app.listen(port, function () {
    console.log(`Listening for test configurations on port: ${port}`);
});
