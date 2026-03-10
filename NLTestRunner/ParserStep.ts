import { PromptTemplate } from "@langchain/core/prompts";
import { prompt_convert } from "./prompts.js";
import { model_convert_step, server } from "./stagehand.config.js";
import { Ollama } from "@langchain/ollama";

type ParseResult = {
    matched: boolean;
    production?: string;
    captures?: string[];
    sentence: string;
};

export class ParserStep {
    private patterns: { name: string; re: RegExp }[];

/*Listes des chaines attendues
open 'web site'
click on 'UI element'
check 'UI element'
uncheck 'UI element'
select 'value' on 'UI element'
scroll
press 'value'
type in 'value' in the field 'UI element'
type in 'value' in 'UI element'
Fill the field 'UI element' with 'value'
Fill 'UI element' with 'value'
Enter 'value' in 'UI element'
Enter 'value' in the field 'UI element'
*/

/*EBNF-style grammar
<COMMAND> ::= <OPEN> | <CLICK> | <CHECK> | <UNCHECK> | <SELECT> | <SCROLL> | <PRESS> | <TYPE> | <FILL> | <ENTER>

<OPEN>    ::= "open" <WS> <QUOTE>
<CLICK>   ::= "click" [ <WS> "on" ] <WS> <QUOTE>
<CHECK>   ::= "check" <WS> <QUOTE>
<UNCHECK> ::= "uncheck" <WS> <QUOTE>
<SELECT>  ::= "select" <WS> <QUOTE> <WS> "on" <WS> <QUOTE>
<SCROLL>  ::= "scroll"
<PRESS>   ::= "press" <WS> <QUOTE>

# type variants:
<TYPE>    ::= "type" <WS> "in" <WS> <QUOTE> <WS> "in" [ <WS> "the" <WS> "field" ] <WS> <QUOTE>

# fill variants:
<FILL>    ::= "fill" [ <WS> "the" <WS> "field" ] <WS> <QUOTE> <WS> "with" <WS> <QUOTE>

# enter variants:
<ENTER>   ::= "enter" <WS> <QUOTE> <WS> "in" [ <WS> "the" <WS> "field" ] <WS> <QUOTE>

# terminals:
<QUOTE>   ::= "'" <TEXT> "'"
<TEXT>    ::= (any character except a single quote)*
<WS>      ::= (one or more whitespace characters)

*/

/*; ABNF grammar for the supplied command forms
; (string literals are case-insensitive per RFC 5234)

command    = open / click / check / uncheck / select / scroll / press / type-in / fill / enter

; terminals for spacing
SP         = %x20
HTAB       = %x09
WSP        = SP / HTAB

; quoted string: single-quoted content (does not allow unescaped single quote)
quoted     = "'" quoted-text "'"
quoted-text = *(%x20-26 / %x28-7E)   ; printable ASCII excluding single-quote (0x27)

; productions
open       = "open" 1*WSP quoted

click      = "click" [ 1*WSP "on" ] 1*WSP quoted

check      = "check" 1*WSP quoted

uncheck    = "uncheck" 1*WSP quoted

select     = "select" 1*WSP quoted 1*WSP "on" 1*WSP quoted

scroll     = "scroll"

press      = "press" 1*WSP quoted

; "type in" variants:
; examples accepted:
;   type in 'value' in the field 'UI element'
;   type in 'vale' in 'UI element'
type-in    = "type" 1*WSP "in" 1*WSP quoted 1*WSP "in" [ 1*WSP "the" 1*WSP "field" ] 1*WSP quoted

; "fill" variants:
; examples:
;   Fill the field 'UI element' with 'value'
;   Fill 'UI element' with 'value'
fill       = "fill" [ 1*WSP "the" 1*WSP "field" ] 1*WSP quoted 1*WSP "with" 1*WSP quoted

; "enter" variants:
; examples:
;   Enter 'value' in 'UI element'
;   Enter 'values' in the field 'UI element'
enter      = "enter" 1*WSP quoted 1*WSP "in" [ 1*WSP "the" 1*WSP "field" ] 1*WSP quoted
*/

    constructor() {
        // Use anchored, case-insensitive regexes derived from the ABNF grammar.
        // We accept only single-quoted strings like: 'some value' (no escaped single quotes).
        const Q = "'([^']*)'"; // capture everything between single quotes except single quote itself
        const WS = "\\s+";

        this.patterns = [
            { name: "OPTIONAL", re:  RegExp("^\\s*optional\\s+(.+?)\\s*$", "i") },
            { name: "OPEN", re: new RegExp("^\\s*open" + WS + Q + "\\s*$", "i") },
            // click optionally allows "on": "click 'X'" or "click on 'X'"
            { name: "CLICK", re: new RegExp("^\\s*click(?:" + WS + "on)?" + WS + Q + "\\s*$", "i") },
            { name: "CHECK", re: new RegExp("^\\s*check" + WS + Q + "\\s*$", "i") },
            { name: "UNCHECK", re: new RegExp("^\\s*uncheck" + WS + Q + "\\s*$", "i") },
            // select 'value' on 'UI element'
            { name: "SELECT", re: new RegExp("^\\s*select" + WS + Q + WS + "on" + WS + Q + "\\s*$", "i") },
            { name: "SCROLL", re: new RegExp("^\\s*scroll\\s*$", "i") },
            { name: "PRESS", re: new RegExp("^\\s*press" + WS + Q + "\\s*$", "i") },
            // type in 'value' in ['the field'] 'UI element'
            { name: "TYPE", re: new RegExp("^\\s*type" + WS + "in" + WS + Q + WS + "in" + "(?:" + WS + "the" + WS + "field)?" + WS + Q + "\\s*$", "i") },
            // fill [the field] 'UI element' with 'value'
            { name: "FILL", re: new RegExp("^\\s*fill(?:" + WS + "the" + WS + "field)?" + WS + Q + WS + "with" + WS + Q + "\\s*$", "i") },
            // enter 'value' in ['the field'] 'UI element'
            { name: "ENTER", re: new RegExp("^\\s*enter" + WS + Q + WS + "in" + "(?:" + WS + "the" + WS + "field)?" + WS + Q + "\\s*$", "i") },
        ];
    }

    /**
     * Parse a single sentence and return which production matched and captured groups.
     */
    parse(sentence: string): ParseResult {
        for (const p of this.patterns) {
            const m = p.re.exec(sentence);
            if (m) {
                // m[0] is full match, m[1..] are capture groups. Remove any undefined trailing groups.
                const captures = Array.from(m.slice(1)).filter((g) => g !== undefined);
                return {
                    matched: true,
                    production: p.name,
                    captures,
                    sentence,
                };
            }
        }
        return { matched: false, sentence };
    }

    // Check and possibly convert a step using LLM if unrecognized.
    // Returns updated task array.
    // If conversion fails, returns empty array.
    async CheckStep(task: string[], i: number): Promise<string[]> {
        //check step
        const parseResult = this.parse(task[i]);
        if (!parseResult.matched) {
            console.log(`Unrecognized action format at step: ${task[i]}`);
            // try to convert with LLM
            //call langchain to evaluate assertion
            const prompt = PromptTemplate.fromTemplate(prompt_convert);
            const llm = new Ollama({
                model: model_convert_step,
                temperature: 0,
                maxRetries: 5,
                baseUrl: server, // Base URL for the Ollama API PB ICI 404 ?
                //verbose: true, // for debug
                // other params...
            });
            const chain = prompt.pipe(llm);
            // cast the invoke result to string so TypeScript knows step2 is a string
            let step2 = (await chain.invoke({
                step: task[i],
            })) as string;
            console.debug(`Converted step: ${step2}`);
            // Nettoyer la réponse pour ne garder que la ou les étapes converties
            step2 = step2.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            // supprimer 'Converted Step(s):'
            step2 = step2.replace(/^Converted Step\(s\):/i, '').trim();
            
            // Si la conversion renvoie plusieurs lignes, insérer chaque ligne dans le tableau task
            const lines = step2.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            // Remplacer l'élément courant par les lignes converties
            task.splice(i, 1, ...lines);
            console.log(`Inserted ${lines.length} steps at index ${i}`);
            console.log(lines);
            console.debug(`New task list: ${task}`);
            //re-parse
            const parseResult = this.parse(task[i]);
            if (!parseResult.matched) { return []; }
        }
        return task;
    }
}