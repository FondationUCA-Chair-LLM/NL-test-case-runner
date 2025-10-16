import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import { model_eval, model_assert, server, StagehandConfig, deviation_model_assert, deviation_model_nav, deviation_model_eval, NUM_RUNS, test_suite } from "./stagehand.config.js";
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
import { EvaluateAction } from "./Evaluate_Action.js";
import { StrictAsserter } from "./StrictAsserter.js";
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
  for (const test_case of test_cases) {
    var nbexpectedtests = 0;
    console.log(`\n📋 Test Case: ${test_case.name} -----------------------------`);
    NUM_RUNS_TEMP = NUM_RUNS;
    let consistency_ch: string[] = [];
    let verdicts: number[] = [];
    let verdictsMatch: boolean;
    let verdicts_allruns: number[] = [];
    for (let i = 0; i < NUM_RUNS_TEMP; i++) {
      console.log(`🚀 Run #${i + 1} -----------------------------`);
      verdicts = await run_search(test_case.actions);
      console.log(`\n🔍 Assertions res. for Test Case "${test_case.name}":`, verdicts);
      //store last verdict of the test case
      const lastVerdict = verdicts.at(-1);
      if (typeof lastVerdict !== "undefined") {
        verdicts_allruns.push(lastVerdict);
      }
      if (Array.isArray(test_case.expected)) verdictsMatch = verdicts.every((v, idx) => v === test_case.expected[idx]);
      else verdictsMatch = verdicts.every((v, idx) => v === 1);
      console.log(`✅ Verdicts match expected: ${verdictsMatch}`);
      if (verdictsMatch)
        nbexpectedtests++;
      const verdictString = verdicts.join(",");
      consistency_ch.push(verdictString);
    }
    //next lines usefull for the experimentation
    console.log(`Nb of expected verdicts: ${nbexpectedtests}`);
    console.log(`Ratio of 'expected verdicts': ${nbexpectedtests / NUM_RUNS_TEMP}`);

    //Verdicts summary on all runs
    if (verdicts_allruns.length > 1) {
      //compute number of verdcits 0, 1, -1
      const passCount = verdicts_allruns.filter(v => v === 1).length;
      const failCount = verdicts_allruns.filter(v => v === 0).length;
      const inconclusiveCount = verdicts_allruns.filter(v => v === -1).length;
      console.log(`Pass verdicts: ${passCount}`);
      console.log(`Fail verdicts: ${failCount}`);
      console.log(`Inconclusive verdicts: ${inconclusiveCount}`);
    }

    //real consistency use only for experiementations ; returns inf if all_verdicts empty
    const counts_ch = consistency_ch.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const maxCount_ch = Math.max(...Object.values(counts_ch));
    const mostFrequent_ch = Object.keys(counts_ch).find(key => counts_ch[key] === maxCount_ch);
    console.log(`Most frequent verdict pattern: ${mostFrequent_ch} (Real consistency: ${maxCount_ch / NUM_RUNS_TEMP})`);


  }
}

async function run_search(
  task: string[],
): Promise<number[]> {
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

  const all_verdicts = await simple_run(
    task, context, page
  );

  await stagehand.close();
  return all_verdicts;
}

async function simple_run(
  task: string[],
  context: BrowserContext,
  page: Page
): Promise<number[]> {
  var verdict: number = 1; // 1 = pass, 0 = fail -1 = inconclusive
  var tc_consistency: number = 0.0; //consistency
  var tc_se: number = 0.0; //consistency for evaluate
  var tc_sa: number = 0.0; //consistency for assert
  var data: Obs = new Obs();
  var observed: boolean = false;
  var readiness: boolean = true;
  var all_verdicts: number[] = [];

  for (var i = 0; i < task.length; i++) {
    if (i === 0) {
      const site = task[0].match(/'([^']*)'/);
      if (!site) {
        console.log("No valid web site found.");
        verdict = -1; //inconclusive
        break;
      }
      try {
        await page.goto(site[1]);
        await page.waitForTimeout(5000);
        [data, observed] = await observe(data, true, page);

      } catch (error) {
        console.log(`Navigation failed for ${site[1]}:`, error);
        verdict = -1; //inconclusive
        return [verdict];
      }
      //observe
      [data, observed] = await observe(data, true, page);
      //*******TOCHECK retour agent mis a true ? */
      if (observed == false) {
        verdict = -1; // inconclusive
        return [verdict];
      }
    } else {
      if (!task[i].startsWith("Assert")) {
        //evaluate
        readiness = EvaluateAction.evaluateWithoutLLM(task[i], data);
        if (readiness == true || task[i].startsWith("Optional")) tc_se = 1.0;
        else {
          try {
            readiness = await evaluateWithLLM(page, task[i], data);
            tc_se = 1 - 2 * deviation_model_eval;
            if (readiness == false) {
              console.log("Fail, evaluate-next KO ", task[i]);
              verdict = -1;
              all_verdicts.push(verdict);
              i = i == 1 ? 2 : i;
              console.log("Test case consistency estimation: " + tc_consistency / (i - 1));
              return all_verdicts;
            }
          }
          catch (error) {//eval_results.push(0); 
            console.log(`Evaluation failed at step ${i}: ${task[i]} ->`, error);
            verdict = -1; //inconclusive  
            all_verdicts.push(verdict);
            if (NUM_RUNS_TEMP - NUM_RUNS <= 5) NUM_RUNS_TEMP++;
            i = i == 1 ? 2 : i;
            console.log("Test case consistency estimation: " + tc_consistency / (i - 1));
            return all_verdicts;
          }
        }
        try {
          const r = await page.act({ action: task[i] });
          await page.waitForTimeout(5000);
          console.debug('Action', task[i], r.success);
          tc_consistency += tc_se * (1 - 2 * deviation_model_nav); //increment consistency
          //observe
          [data, observed] = await observe(data, r.success, page);
          if (observed == false) {
            verdict = -1;
            all_verdicts.push(verdict);
            console.log("Test case consistency estimation: " + tc_consistency / (i));
            return all_verdicts;
          }

        }
        catch (error) {
          console.log(`Action failed at step ${i}: ${task[i]} ->`, error);
          //nav_results.push(0);
          verdict = -1;
          if (NUM_RUNS_TEMP - NUM_RUNS <= 5) NUM_RUNS_TEMP++;
          all_verdicts.push(verdict);
          i = i == 1 ? 2 : i;
          console.log("Test case consistency estimation: " + tc_consistency / (i - 1));
          return all_verdicts;
        }
      } else break;

    }
  }
  //assertions
  console.log("********** Assertions **********");
  var result: string | undefined;
  var j = i;
  while (j > 0 && verdict == 1 && j < task.length) {
    let verdict2 = false;
    //strict assert
    const verdict1 = await StrictAsserter.assertWithoutLlm(task[j], page);
    if (verdict1 == true) {
      console.log("*** Verdict (strict assert) " + j + ": true***");
      tc_sa = 1.0; //consistency
      all_verdicts.push(1);
    }
    else {
      try {
        if (typeof result === 'undefined') {
          const terms = extractTermsBetweenQuotes(task[j]);
          result = await extract(data, page); // undefined, terms);
        }
        verdict2 = await assert(page, result, task[j]);
        console.log("*** Verdict (LLM assert) " + j + ": " + verdict2 + "***");
        all_verdicts.push(verdict2 ? 1 : 0);
        tc_sa = (1 - 2 * deviation_model_assert); //increment consistency
        //console.log(verdict2);
        if (verdict2 == false) { verdict = 0; }
      } catch (error) {
        console.log(`Assertion failed at step ${j}: ${task[j]} ->`, error);
        //assert_results.push(0);
        if (NUM_RUNS_TEMP - NUM_RUNS <= 5) NUM_RUNS_TEMP++;
        j++;
        verdict = -1; // inconclusive
        all_verdicts.push(verdict);
        j = j == 1 ? 2 : j;
        console.log("Test case consistency estimation: " + tc_consistency / (j - 1));
        return all_verdicts;
      }
    }

    tc_consistency += tc_sa; //increment consistency
    j++;
  }

  console.log("********** End of Assertions **********");
  console.log("Final verdict: " + verdict);
  j = j == 0 ? i : j;
  j = j == 1 ? 2 : j;
  console.log("Test case consistency estimation: " + tc_consistency / (j - 1));
  return all_verdicts;

}
function extractTermsBetweenQuotes(str: string): string {
  const matches = str.match(/'([^']*)'/g);
  if (!matches) return "";
  // On extrait les termes et on les rejoint dans une seule chaîne séparée par une virgule ou un espace
  return matches.map(s => s.slice(1, -1)).join(", ");
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

async function observe(old: Obs, action_performed: boolean, page: Page,): Promise<[Obs, boolean]> {
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

  if (action_performed == true) b = true; //and (old != obs): b=true // TODO PB ICI si on reste sur la même page il faut comparer 2 screenshots ???
  else b = false;
  return [obs, b];
}

async function assert(page: Page, result1: string, inst?: string, ret?: z.AnyZodObject) {

  //call langchain to evaluate assertion
  const prompt = PromptTemplate.fromTemplate(prompt_assert);
  const llm = new Ollama({
    model: model_assert,
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
    let result_assert = (verdict22.includes("false") ? false : true);
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
  const llm = new Ollama({
    model: model_eval,
    temperature: 0,
    maxRetries: 5,
    baseUrl: server, // Base URL for the Ollama API PB ICI 404 ?
    // other params...
  });

const chunks = splitWithOverlap(content, 4000, 50);
const result: any[] = [];
const chain = prompt.pipe(llm);
for (const chunk of chunks) {
    var response = await chain.invoke({
      page: chunk,
      input: term,
    });
  console.debug("\n", "Evaluate with LLM response", response);
  response = response.toLowerCase();
  var match = response.match(/<\/think>\s*(.*)/s);
  var response = match ? match[1] : response;
  match = response.match(/verdict:(.*)/);
  response = match ? match[1] : response;
  result.push(response === "true" || (typeof response === "string" && (response.includes("true") || response.includes("yes"))));
}
  return result.reduce((acc, val) => acc || val, false);
}


run();