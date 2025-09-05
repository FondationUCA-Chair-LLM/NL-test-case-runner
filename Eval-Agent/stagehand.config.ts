import type { ConstructorParams } from "@browserbasehq/stagehand";
import dotenv from "dotenv";

import { CustomOpenAIClient } from "./llm_clients/customOpenAI_client.js";
import { OpenAI } from "openai";

dotenv.config();

//test suite
export const test_suite = "test_cases.json"; // "test_casesV2.json"; // "test_casesV3.json"; // "test_casesV4.json"; // "test_casesV5.json";

export const model_eval="qwen2.5:7b"; //"granite3.3:2b"; //"devstral:24b"; //"mistral:7b"; //"mistral-nemo:12b"; //"qwen2.5:32b-instruct-q4_K_M"; //"deepseek-r1:14b"; //"mistral:7b"; //"qwen2.5:7b"; //"llama3.3:70b"; //"qwen2.5:7b";
export const model_assert="qwen2.5:7b"; //"granite3.3:2b"; //"devstral:24b";//"mistral:7b"; //"mistral-nemo:12b"; //"qwen2.5:32b-instruct-q4_K_M"; //"deepseek-r1:14b"; //"mistral:7b"; //"qwen2.5:7b"; //"llama3.3:70b"; //"qwen2.5:7b";
export const model_nav="qwen2.5:7b"; //"granite3.3:2b"; //"devstral:24b"; //"mistral:7b"; //"mistral-nemo:12b"; //"qwen2.5:32b-instruct-q4_K_M"; //"qwen2.5:7b"; //"mistral:7b"; //"qwen2.5:7b"; //"llama3.3:70b"; //"qwen2.5:7b"; //"qwen2.5:32b-instruct-q4_K_M";
export const server = "http://192.168.128.44:11434";  //"http://192.168.128.44:11434"; //"http://localhost:11434";

export var NUM_RUNS = 20; 

//debug
console.debug = () => {};
export const StagehandConfig: ConstructorParams = {
  verbose: 0 /* Verbosity level for logging: 0 = silent, 1 = info, 2 = all */,
  domSettleTimeoutMs: 30_000 /* Timeout for DOM to settle in milliseconds */,

  // LLM configuration

  llmClient: new CustomOpenAIClient({
    modelName: model_nav,
    client: new OpenAI({
      baseURL: server+"/v1",
      apiKey: "ollama",
      //timeout: 60_000, // 1 minutes
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
