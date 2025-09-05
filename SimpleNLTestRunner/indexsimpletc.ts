import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import {model_eval, model_assert, deviation_model_assert, deviation_model_eval, deviation_model_nav, server, StagehandConfig} from "./stagehand.config.js";
import chalk from "chalk";
import boxen from "boxen";
import { drawObserveOverlay, clearOverlays, actWithCache } from "./utils.js";
import { z } from "zod";
import { PromptTemplate } from "@langchain/core/prompts";
import { Ollama } from "@langchain/ollama";

import {StrictAsserter} from "./assertaction.js"
import { Obs } from "./Observe.js";
import { EvaluateAction } from "./Evaluation_Action.js";
import { prompt_extract, prompt_assert, prompt_eval } from "./prompts.js";


/**
 * 🤘 Welcome to Stagehand! Thanks so much for trying us out!
 * 🛠️ CONFIGURATION: stagehand.config.ts will help you configure Stagehand
 *
 * 📝 Check out our docs for more fun use cases, like building agents
 * https://docs.stagehand.dev/
 *
 * 💬 If you have any feedback, reach out to us on Slack!
 * https://stagehand.dev/slack
 *
 * 📚 You might also benefit from the docs for Zod, Browserbase, and Playwright:
 * - https://zod.dev/
 * - https://docs.browserbase.com/
 * - https://playwright.dev/docs/intro
 */

let test: string[] = [
"Open 'https://www.uca.fr/en'",
            "Click on 'European University'",
            "Click on 'ALL NEWS '",
            "Assert that the page has links",
            "Assert that the page has a link with the word 'ARTEMIS' in its description",
            "Assert that the page has links containing with the word 'ARTEMIS'"
];
async function main({
  page,
  context,
  stagehand,
}: {
  page: Page; // Playwright Page with act, extract, and observe methods
  context: BrowserContext; // Playwright BrowserContext
  stagehand: Stagehand; // Stagehand instance
}) {
  var variablename: string | undefined;
  var data: Obs = new Obs();
  var readiness: boolean | undefined;
  var verdict: number = 1; // 1 = true, 0 = false -1 = inconclusive
  var observed: boolean = false;

  var tc_consistency = 0.0; //consistency of the test case, 0.0 to 1.0
  var tc_se=1.0; // readiness consistency
  var tc_sa=1.0; //assert consistency
  
  //navigation & evaluation
  for (var i = 0; i < test.length; i++) {
   if (i==0) {
     const site = test[0].match(/'([^']*)'/);
        if (!site) {
            console.log("No valid web site found.");
            verdict = -1; //inconclusive
            break;
        }
        try {
          await page.goto(site[1]);
      } catch (error) {
      console.error("Error navigating to the site:", error);
      verdict = -1; //inconclusive
      break;
    }
        //observe
        [data, observed] = await observe(data, true, page);
         //*******TOCHECK retour agent mis a true ? */
        if (observed == false) {verdict = 0; //fail
          break;
        }
   }
   else {
        if (test[i].startsWith("Assert")==false){
          //evaluate
          readiness = EvaluateAction.evaluateWithoutLLM(test[i], data);
          if (readiness == true) tc_se=1.0;
          else{
            try {
              readiness = await evaluateWithLLM(page, test[i], data);
              tc_se=1-deviation_model_eval;
              if (readiness == false){
                       console.log ("Fail, evaluate-next KO");
                       verdict = -1;
                       break;
              }   
            } catch (error) {
              console.error("Error readiness action:", error);
              verdict = -1; //inconclusive
              break;
            }
          }
          console.log("***current step :"+test[i]  +"***");
          try {
            let r= await page.act({action: test[i], timeoutMs: 30_000, domSettleTimeoutMs: 30_000});
          await page.waitForTimeout(5000);
          tc_consistency += tc_se* (1-deviation_model_nav); //increment consistency
          //observe
          [data, observed] = await observe(data, r.success, page); //*******TOCHECK true A MODIFER PAR RETOUR AGENT NAVIGATION */
          if (observed == false) {verdict = -1; //fail
            break;
          }
          } catch (error) {
            console.error("Error performing action:", error);
            verdict = -1; // inconclusive
            break;
          }
        }
        else break;
      }}
  //assertions
  console.log("********** Assertions **********");
  var result: string | undefined;
  var j=i;
  while (j>0 && verdict == 1 && j < test.length) {      
    //strict assert  
    const verdict1 = await StrictAsserter.assertWithoutLlm(test[j], page);
    if ( verdict1 == true)
    {
      console.log("*** Verdict (strict assert) "+ j  +": true***");
      tc_sa = 1.0; //consistency
    }
    else {
      if (typeof result == 'undefined')
      {
        //extract
        try{
          result = await extract(data,page);
        } catch (error) {
          console.error("Error extracting data:", error);
          verdict = -1; // inconclusive
          break;
        } 
      }
      //LLM Assert
      try{
      const verdict2 = await assert(page,result, test[j]);
      let v2 ="";
      if (verdict2.includes("False") || verdict2.includes("false")) v2 = "False";
      else v2 = "True";
      console.log("*** Verdict (llm assert) line"+ j  +": "+v2+" ***");
      tc_sa = (1-deviation_model_assert); //increment consistency
      if (v2=="False") {
                     verdict = 0;
                     break;
      }
  } catch (error) {
    console.error("Error during assertion:", error);
    verdict = -1; // inconclusive
    break;
  }
    }
  tc_consistency += tc_sa; //increment consistency
  j++;
}
console.log("********** End of Assertions **********");
const verdictMsg = verdict === 1 ? "PASS" : verdict === 0 ? "FAIL" : "INCONCLUSIVE";
console.log(`Final Verdict: ${verdictMsg}`);
console.log("Test case consistency: " + tc_consistency/(j-1));
  

  stagehand.log({
    category: "create-browser-app",
    message: `Metrics`,
    auxiliary: {
      metrics: {
        value: JSON.stringify(stagehand.metrics),
        type: "object",
      },
    },
  });
}

/**
 * This is the main function that runs when you do npm run start
 *
 * YOU PROBABLY DON'T NEED TO MODIFY ANYTHING BELOW THIS POINT!
 *
 */
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
    console.log("Observe : found ", obs.links.length, " links");
    console.log("Observe : found ", obs.buttons.length, " buttons");
    console.log("Observe : found ", obs.forms.length, " forms");
    console.log("Observe : found ", obs.fields.length, " fields");
    console.log("Observe : found ", obs.checkboxes.length, " checkboxes");
    console.log("Observe :  performed ", action_performed);

    if (action_performed==true) b=true; //and (old != obs): b=true // TODO PB ICI si on reste sur la même page il faut comparer 2 screenshots ???
    else b=false;
    return [obs, b];
}


async function extract(data: Obs,page: Page, ret?: z.AnyZodObject): Promise<string> {
  var result = "{\n";
  //insert content generated by Obserce
  result += Obs.eleToJson(data.links, "link");
  result += Obs.eleToJson(data.buttons, "button");
  result += Obs.eleToJson(data.checkboxes, "checkbox");
  result += Obs.eleToJson(data.fields, "field");
  result += Obs.eleToJson(data.forms, "form");
  result += Obs.eleToJson(data.selects, "select");
  //extract
    ret = z.object({
      elements : z.array(
      z.object({
      id: z.string(),
      description: z.string(),
      type: z.string()      
    }))});
      
    const result2 =  await page.extract({
      instruction: prompt_extract,
      schema: ret
      //modelName: model
    });
    for(var k=0; k<result2.elements.length; k++) {
      result += "{\"id\": "+result2.elements[k].id+", \"description\": "+result2.elements[k].description+", \"type\": "+result2.elements[k].type+"}\n";
    }
    result += "}";
    console.info("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    console.info(result);
    return result;
  }


async function assert(page: Page, result1: string, inst?: string, ret?:z.AnyZodObject) {
  //call langchain to evaluate assertion
  const prompt = PromptTemplate.fromTemplate(prompt_assert);      
  const llm = new Ollama({model: model_assert,
  temperature: 0,
  maxRetries: 5,
  baseUrl: server, // Base URL for the Ollama API PB ICI 404 ?
  // other params...
  });

  const chain = prompt.pipe(llm);
  const verdict = await chain.invoke({
  page: result1,
  input: inst,
});
return verdict;
}

// Appelle deux agents pour évaluer si l'action suivante peut être effectuée
async function evaluateWithLLM(page: Page, term: string, data: Obs): Promise<boolean> {
        console.log("\n", "Evaluate with LLM", term);
        let content = await extract(data, page);
        
   const prompt = PromptTemplate.fromTemplate(prompt_eval);      
  const llm = new Ollama({model: model_eval,
  temperature: 0,
  maxRetries: 5,
  baseUrl: server, // Base URL for the Ollama API PB ICI 404 ?
  // other params...
  });
  const chain = prompt.pipe(llm);
  const response = await chain.invoke({
  page: content,
  input: term,
  });
  console.log("\n", "Evaluate with LLM response", response);
  if (response.includes("True") || response.includes("true"))
    return true;
   else return false;
}

run();