import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import {model_eval, model_assert, server, StagehandConfig, NUM_RUNS, test_suite} from "./stagehand.config.js";
import chalk from "chalk";
import boxen from "boxen";
import { drawObserveOverlay, clearOverlays, actWithCache } from "./utils.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { PromptTemplate } from "@langchain/core/prompts";
import { Ollama } from "@langchain/ollama";
import { Obs } from "./Observe.js";

import * as fs from "fs";
import * as path from "path";
import { exit } from "process";
import { prompt_assert, prompt_eval, prompt_extract, prompt_extract2 } from "./prompts.js";
import { extract, splitWithOverlap } from "./Extractor.js";

var NUM_RUNS_TEMP = NUM_RUNS; 


/* function evaluation */
function loadTestCases(filename: string): any {
    const filePath = path.resolve(filename);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileContent);
}

async function main({
  page,
  context,
  stagehand,
}: {
  page: Page; // Playwright Page with act, extract, and observe methods
  context: BrowserContext; // Playwright BrowserContext
  stagehand: Stagehand; // Stagehand instance
}) {

      const test_cases = loadTestCases(test_suite);
    let total_eval: number[] = [];
    let total_nav: number[] = [];
    let total_assert: number[] = [];
    for (const test_case of test_cases) {
        console.log(`\n📋 Test Case: ${test_case.name} -----------------------------`);
        let all_eval: number[] = [];
        let all_nav: number[] = [];
        let all_assert: number[] = [];
        
        NUM_RUNS_TEMP=NUM_RUNS;

         for (let i = 0; i < NUM_RUNS_TEMP; i++) {
            console.log(`🚀 Run #${i + 1} -----------------------------`);
            const [eval_r, nav_r, assert_r] = await run_search(test_case.actions, test_case.expected);
            all_eval.push(...eval_r);
            all_nav.push(...nav_r);
            all_assert.push(...assert_r);
            console.log(all_assert);
        }
         // results to global totals
        total_eval.push(...all_eval);
        total_nav.push(...all_nav);
        total_assert.push(...all_assert);

        
        const [meval, mnav, massert] = compute_STD(all_eval, all_nav, all_assert);

        console.log(`\n📊 Final Metrics for Test Case: ${test_case.name}`);
        console.log(`✅ Match Rate Eval:   ${(average(all_eval)).toFixed(2)}`);
        console.log(`✅ Match Rate Nav:    ${(average(all_nav)).toFixed(2)}`);
        console.log(`✅ Match Rate Assert: ${(average(all_assert)).toFixed(2)}`);
        console.log(`📐 Eval Std Dev:      ${meval.toFixed(4)}`);
        console.log(`📐 Nav Std Dev:       ${mnav.toFixed(4)}`);
        console.log(`📐 Assert Std Dev:    ${massert.toFixed(4)}`);
        console.log(`📐 Nb of runs :    ${NUM_RUNS_TEMP}`);

        // Clear for next test case
        all_eval = [];
        all_nav = [];
        all_assert = [];
    }

    // Compute it across all test cases
    const [g_eval, g_nav, g_assert] = compute_STD(total_eval, total_nav, total_assert);

    console.log("\n 📊 GLOBAL METRICS ACROSS ALL TEST CASES -----------------------------");
    console.log(`🌍 Global Match Rate Eval:   ${(average(total_eval)).toFixed(2)}`);
    console.log(`🌍 Global Match Rate Nav:    ${(average(total_nav)).toFixed(2)}`);
    console.log(`🌍 Global Match Rate Assert: ${(average(total_assert)).toFixed(2)}`);
    console.log(`📐 Global Eval Std Dev:      ${g_eval.toFixed(4)}`);
    console.log(`📐 Global Nav Std Dev:       ${g_nav.toFixed(4)}`);
    console.log(`📐 Global Assert Std Dev:    ${g_assert.toFixed(4)}`);
    
}

function average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

async function run_search(
    task: string[],
    expected: number[]
): Promise<[number[], number[], number[]]> {
    const stagehand = new Stagehand({
    ...StagehandConfig,
  });
  await stagehand.init();

  if (StagehandConfig.env === "BROWSERBASE" && stagehand.browserbaseSessionID) {
    console.log(
      boxen(
        `View this session live in your browser: \n${chalk.blue(
          `https://browserbase.com/sessions/${stagehand.browserbaseSessionID}`,
        )}`,
        {
          title: "Browserbase",
          padding: 1,
          margin: 3,
        },
      ),
    );
  }

  const page = stagehand.page;
  const context = stagehand.context;
  
const [eval_results, nav_results, assert_results] = await simple_run(
        task, expected, context, page
    );

  await stagehand.close();

  return [eval_results, nav_results, assert_results];
}

function extractTermsBetweenQuotes(str: string): string {
  const matches = str.match(/'([^']*)'/g);
  if (!matches) return "";
  // On extrait les termes et on les rejoint dans une seule chaîne séparée par une virgule ou un espace
  return matches.map(s => s.slice(1, -1)).join(", ");
}

async function simple_run(
    task: string[],
    expected: number[],
    context: BrowserContext,
    page: Page
): Promise<[number[], number[], number[]]> {
    var verdict: boolean = true;
    var data: Obs = new Obs();
    var observed: boolean = false;
    var readiness: boolean = true;
    const eval_results: number[] = [];
    const nav_results: number[] = [];
    const assert_results: number[] = [];

    for (var i = 0; i < task.length; i++) {
        if (i === 0) {
            const site = task[0].match(/'([^']*)'/);
            if (!site) {
                console.log("No valid web site found.");
                return [[], [], []];
            }
            try {
                await page.goto(site[1]);
                await page.waitForTimeout(5000);
                [data, observed] = await observe(data, true, page);

            } catch (error) {
                console.log(`Navigation failed for ${site[1]}:`, error);
                return [[], [], []];
                verdict=false;
                break;
            }
        } else {
            if (!task[i].startsWith("Assert")) {
               try {
              readiness =  await evaluateWithLLM(page, task[i], data);
              eval_results.push((Number(readiness) === expected[i]) ? 1 : 0);
               }
               catch(error) {//eval_results.push(0); 
              console.log(`Evaluation failed at step ${i}: ${task[i]} ->`, error);
                NUM_RUNS_TEMP++;
                continue;  
              }

                try {
                    const r = await page.act({ action: task[i] });
                    await page.waitForTimeout(5000);
                    //console.log('action', r.success);
                    [data, observed] = await observe(data, r.success, page);
                        nav_results.push((Number(observed) === expected[i]) ? 1 : 0);
                        if (observed == false ) { verdict = false;
                     break;}
                        
                    }
                 catch (error) {
                    console.log(`Action failed at step ${i}: ${task[i]} ->`, error);
                     //nav_results.push(0);
                     verdict = false;
                     NUM_RUNS_TEMP++; 
                     break;
                    
                }
            } else {
                break;
            }
        }
    }

    console.log("********** Assertions **********");
    var result: string | undefined;
    var j = i;
    while (verdict === true && j < task.length) {
        let verdict2= false;
        try {
            if (typeof result === 'undefined') {
                const terms = extractTermsBetweenQuotes(task[j]);
                result = await extract(data, page); // undefined, terms);
            }
            verdict2 = await assert(page, result, task[j]);
            //console.log(verdict2, "********");
        } catch (error) {
            console.log(`Assertion failed at step ${j}: ${task[j]} ->`, error);
            //assert_results.push(0);
            NUM_RUNS_TEMP++; 
            j++;
            continue;
        }
        const comp= (verdict2 == false) ? 0 : 1;
        assert_results.push(comp=== expected[j] ? 1 : 0);
        verdict=verdict2;
        if (verdict==false) {
                break;
            }
        
        j++;
    }

    console.log("********** End of Assertions **********");
    console.log("Final verdict: " + verdict);

    return [eval_results, nav_results, assert_results];
}

async function run() {
  const stagehand = new Stagehand({
    ...StagehandConfig,
  });
  await stagehand.init();

  if (StagehandConfig.env === "BROWSERBASE" && stagehand.browserbaseSessionID) {
    console.log(
      boxen(
        `View this session live in your browser: \n${chalk.blue(
          `https://browserbase.com/sessions/${stagehand.browserbaseSessionID}`,
        )}`,
        {
          title: "Browserbase",
          padding: 1,
          margin: 3,
        },
      ),
    );
  }

  const page = stagehand.page;
  const context = stagehand.context;
  await main({
    page,
    context,
    stagehand,
  });
  await stagehand.close();
  
}

async function observe(old: Obs, action_performed: boolean, page: Page, ): Promise<[Obs, boolean]> {
    var obs = new Obs();
    var b: boolean = false;
    await obs.getUIElements(page);
    //debug
    console.debug("Observe : found ", obs.links.length, " links");
    console.debug("Observe : found ", obs.buttons.length, " buttons");
    console.debug("Observe : found ", obs.forms.length, " forms");
    console.debug("Observe : found ", obs.fields.length, " fields");
    console.debug("Observe : found ", obs.checkboxes.length, " checkboxes");
    console.debug("Observe :  performed ", action_performed);

    if (action_performed==true) b=true; //and (old != obs): b=true // TODO PB ICI si on reste sur la même page il faut comparer 2 screenshots ???
    else b=false;
    return [obs, b];
}

async function assert(page: Page, result1: string, inst?: string, ret?:z.AnyZodObject) {
  
  //call langchain to evaluate assertion
  const prompt = PromptTemplate.fromTemplate(prompt_assert);      
  const llm = new Ollama({model: model_assert,
  temperature: 0,
  maxRetries: 5,
  baseUrl: server, // Base URL for the Ollama API PB ICI 404 ?
  //verbose: true, // for debug
  // other params...
  });
 
const chunks = splitWithOverlap(result1, 4000, 50);
const result: any[] = [];
const chain = prompt.pipe(llm);
for (const chunk of chunks) {
    var verdict = await chain.invoke({
      page: chunk,
      input: inst,
    });
    //convert response into boolean
    //should extract formatted response here instead
    verdict = verdict.toLowerCase();
    //console.log("*******Assertion response:", verdict);
    var match = verdict.match(/<\/think>\s*(.*)/s);
    var verdict22 = match ? match[1] : verdict;
    match = verdict22.match(/verdict:(.*)/);
    verdict22 = match ? match[1] : verdict22;
    let result_assert = (verdict22.includes("false")? false : true);
    result.push(result_assert);
    //console.log(result);
  }
  return result.reduce((acc, val) => acc || val, false);

}

// Appelle deux agents pour évaluer si l'action suivante peut être effectuée
async function evaluateWithLLM(page: Page, term: string, data: Obs): Promise<boolean> {
        console.debug("Evaluate with LLM", term, "\n");
        let content = await extract(data, page);
        
   const prompt = PromptTemplate.fromTemplate(prompt_eval);      
  const llm = new Ollama({model: model_eval,
  temperature: 0,
  maxRetries: 5,
  baseUrl: server, // Base URL for the Ollama API PB ICI 404 ?
  // other params...
  });
  const chain = prompt.pipe(llm);
  var response = await chain.invoke({
  page: content,
  input: term,
  });
  console.debug("\n", "Evaluate with LLM response", response);
  response = response.toLowerCase();
  var match = response.match(/<\/think>\s*(.*)/s);
  var response = match ? match[1] : response;
  match = response.match(/verdict:(.*)/);
  response = match ? match[1] : response;

  return response === "true" || (typeof response === "string" && (response.includes("true")||response.includes("yes")));
    }


function normalized_std(binary_results: number[]): number {
    if (binary_results.length === 0) {
        return 0;
    }
    const p = average(binary_results);
    return 2 * Math.sqrt(p * (1 - p));
}

function compute_STD(
    eval_results: number[],
    nav_results: number[],
    assert_results: number[]
): [number, number, number] {
    const meval = normalized_std(eval_results);
    const mnav = normalized_std(nav_results);
    const massert = normalized_std(assert_results);
    return [meval, mnav, massert];
}

run();