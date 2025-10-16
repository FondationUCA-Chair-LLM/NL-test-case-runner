import type { ConstructorParams } from "@browserbasehq/stagehand";
import dotenv from "dotenv";

import { CustomOpenAIClient } from "./llm_clients/customOpenAI_client.js";
import { OpenAI } from "openai";

dotenv.config();

//test suite
export const test_suite = "tests.json"; // "test_cases.json"; // "test_casesV2.json"; // "test_casesV3.json"; // "test_casesV4.json"; // "test_casesV5.json";

// number of runs for each test case
export var NUM_RUNS = 1; 

//models
export const model_eval= "qwen3:14b"; //"llama3.3:70b"; //"mistral-nemo:latest" ; //"qwen3:14b"; //"qwen3:14b"; //"qwen3:14b"; //"llama3.3:70b"; //"qwen2.5:7b";
export const model_assert="qwen3:14b"; //"llama3.3:70b"; //"mistral-nemo:latest"; //"qwen3:14b"; //"qwen2.5:7b"; //"llama3.3:70b"; //"qwen2.5:7b";
export const model_nav="qwen3:14b"; //"llama3.3:70b"; //"mistral-nemo:latest"; //"qwen3:14b"; //"qwen2.5:7b"; //"llama3.3:70b"; //"qwen2.5:7b"; //"qwen2.5:32b-instruct-q4_K_M";
export const server = "http://192.168.128.44:11434"; // "http://localhost:11434"; //"http://192.168.128.44:11434"

//deviations of model
//llama3.3:70b
//export const deviation_model_eval=0.029807545;
//export const deviation_model_nav=0.014214106	;
//export const deviation_model_assert=0.06870104;

//q3.14b
export const deviation_model_eval=0.065140091;
export const deviation_model_nav=0.0;
export const deviation_model_assert=0.043187707;

//mistral nemo
//export const deviation_model_eval=0.224253337;
//export const deviation_model_nav=0.249873162;
//export const deviation_model_assert=0.078445817;

// Disable console.debug to avoid cluttering the output
console.debug = () => {};
export const StagehandConfig: ConstructorParams = {
  verbose: 0 /* Verbosity level for logging: 0 = silent, 1 = info, 2 = all */,
  domSettleTimeoutMs: 30_000 /* Timeout for DOM to settle in milliseconds */,
  experimental: true,
  // LLM configuration for stagehand
  llmClient: new CustomOpenAIClient({
    modelName: model_nav,
    client: new OpenAI({
      baseURL: server+"/v1",
      apiKey: "ollama",
    }),
  }),

  // Browser configuration
  env: "LOCAL" /* Environment to run in: LOCAL or BROWSERBASE */,
  apiKey: process.env.BROWSERBASE_API_KEY /* API key for authentication */,
  projectId: process.env.BROWSERBASE_PROJECT_ID /* Project identifier */,
  browserbaseSessionID:
    undefined /* Session ID for resuming Browserbase sessions */,
  browserbaseSessionCreateParams: {
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    browserSettings: {
      blockAds: true,
      viewport: {
        width: 1024,
        height: 768,
      },
    },
  },
  localBrowserLaunchOptions: {
    viewport: {
      width: 1024,
      height: 768,
    },
  } /* Configuration options for the local browser */,
};

export default StagehandConfig;
