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

    constructor() {
        // Use anchored, case-insensitive regexes derived from the ABNF grammar.
        // We accept only single-quoted strings like: 'some value' (no escaped single quotes).
        const Q = "'([^']*)'"; // capture everything between single quotes except single quote itself
        const WS = "\\s+";

        this.patterns = [
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
    async CheckStep(task: string[], i: number): Promise<string[]> {
        //check step
        let parseResult = this.parse(task[i]);
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
            console.log(`Converted step: ${step2}`);
            step2 = step2.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            // Si la conversion renvoie plusieurs lignes, insérer chaque ligne dans le tableau task
            const lines = step2.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            // Remplacer l'élément courant par les lignes converties
            task.splice(i, 1, ...lines);
            console.log(`Inserted ${lines.length} steps at index ${i}`);
            console.log(`New task list: ${task}`);
            //re-parse
            const parseResult = this.parse(task[i]);
            if (!parseResult.matched) { return []; }
        }
        return task;
    }
}