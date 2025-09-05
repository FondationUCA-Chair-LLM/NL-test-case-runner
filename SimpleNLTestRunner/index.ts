import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import {model_eval, model_assert, server, StagehandConfig} from "./stagehand.config.js";
import chalk from "chalk";
import boxen from "boxen";
import { drawObserveOverlay, clearOverlays, actWithCache } from "./utils.js";
import { z } from "zod";

import { PromptTemplate } from "@langchain/core/prompts";
import { Ollama } from "@langchain/ollama";
import { Obs } from "./Observe.js";
import { prompt_assert, prompt_extract } from "./prompts.js";

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
/*"name": "Change Password after Sign Up",
        "actions": [
            "Open the website 'https://google-gruyere.appspot.com/start'",
            "Click on 'Agree & Start'",
            "Click on 'Sign up'",
            "Fill the form with 'User' toto and 'Password' toto",
            "Click on 'Profile'",
            "Fill the form with 'OLD Password' toto and 'NEW Password' titi",
            "Click on 'Sign out'",
            "Click on 'Sign in'",
            "Fill the form with 'User' toto and 'Password' titi",
            "Assert that 'toto' is displayed on this page"*/
let test3: string[] = [
            "Open the website 'https://google-gruyere.appspot.com/start'",
            "Click on 'Agree & Start'",
            "Click on 'Sign up'",
            "Type in 'toto' in the field  'User name'",
            "Type in 'toto' in the field  'Password'",
            "Click on 'Create account'",
            "Click on 'Home'",
            "Click on 'Profile'",
            "Type in 'toto' in the field  'OLD Password'",
            "Type in 'titi' in the field  'NEW Password'",
            "Click on 'Update'",
            "Click on 'Sign out'",
            "Click on 'Sign in'",
            "Type in 'toto' in the field  'User name'",
            "Type in 'titi' in the field  'Password'",
            "Click on 'Login'",
            "Assert that 'toto' is displayed on this page"
];

let test: string[] =  [
    "Open the website 'http://localhost/watermanagement/'",
    "Type in 'admin' in the field 'Username'",
    "Type in 'admin' in the field 'Password'",
    "Click on 'Login'",
    "Assert that 'Missing Password' is displayed on this page"

];

//"name": "Access ARTEMIS Selection News from News Section",
let test2: string[] = [
        "Open https://eu-artemis.eu/",
        "Click on 'News'",
        "Click on 'ARTEMIS is selected as an European University Alliance'",
        "Assert that the page title is 'ARTEMIS is selected as a European University !'",
        "Assert that the page contains text about 'ARTEMIS being selected as a European University'"
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
    var verdict: number = 1; // 1 = true, 0 = false -1 = inconclusive
    var data: Obs = new Obs();
    var observed: boolean = false;
  for (var i = 0; i < test.length; i++) {
   if (i==0)
    {
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
        if (test[i].startsWith("Assert")==false && test[i].startsWith("assert")==false){
          console.log("***current step :"+test[i]  +"***");
          try {
            let r= await page.act({action: test[i], timeoutMs: 30_000, domSettleTimeoutMs: 30_000});
          await page.waitForTimeout(5000);
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
    console.log("***current step :"+test[j]  +"***");  
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
      var verdict2 = await assert(page,result, test[j]);
      let v2="";
      //should extract formatted response here instead
          verdict2 = verdict2.toLowerCase();
          var match = verdict2.match(/<\/think>\s*(.*)/s);
          var verdict22 = match ? match[1] : verdict2;
          match = verdict22.match(/verdict:(.*)/);
          verdict22 = match ? match[1] : verdict22;
          let result_assert = (verdict22.includes("false") || verdict22.includes("no")? 0 : 1);
          
      if (result_assert==0) v2 = "False"; else v2 = "True";
      console.log("*** Verdict (llm assert) line"+ j  +": "+v2+" ***");
      if (v2=="False") {
                     verdict = 0;
                     break;
      }
  } catch (error) {
    console.error("Error during assertion:", error);
    verdict = -1; // inconclusive
    break;
  }
  j++;
}
console.log("********** End of Assertions **********");
const verdictMsg = verdict === 1 ? "PASS" : verdict === 0 ? "FAIL" : "INCONCLUSIVE";
console.log(`Final Verdict: ${verdictMsg}`);


  

  // Use act() to take actions on the page
  

  /* Use observe() to plan an action before doing it
  const [action] = await page.observe(
    "Type 'Tell me in one sentence why I should use Stagehand' into the search box",
  );
  await drawObserveOverlay(page, [action]); // Highlight the search box
  await page.waitForTimeout(1_000);
  await clearOverlays(page); // Remove the highlight before typing
  await page.act(action); // Take the action

  // For more on caching, check out our docs: https://docs.stagehand.dev/examples/caching
  await page.waitForTimeout(1_000);
  await actWithCache(page, "Click the suggestion to use AI");
  await page.waitForTimeout(5_000);

  // Use extract() to extract structured data from the page
  const { text } = await page.extract({
    instruction:
      "extract the text of the AI suggestion from the search results",
    schema: z.object({
      text: z.string(),
    }),
  });
  stagehand.log({
    category: "create-browser-app",
    message: `Got AI Suggestion`,
    auxiliary: {
      text: {
        value: text,
        type: "string",
      },
    },
  });*/
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
 *
 */
async function run() {
  const stagehand = new Stagehand({
    ...StagehandConfig,
    //systemPrompt:"IMPORTANT, if there is a button for accepting cookies, click on this button before performing an action given by the user", // You can set a system prompt here if you want to customize the LLM's behavior
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

    if (action_performed==true) b=true; //&& (!old.equals(obs))) b=true; // TODO PB ICI si on reste sur la même page il faut comparer 2 screenshots ???
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
    for (let k = 0; k < result2.elements.length; k++) {
      result += `{"id": ${result2.elements[k].id}, "description": ${result2.elements[k].description}, "type": ${result2.elements[k].type}}\n`;
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

run();