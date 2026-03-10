import { Runnable } from "@langchain/core/runnables";
import { LLM } from "@langchain/core/language_models/llms";
import { PromptTemplate } from "@langchain/core/prompts";
import { prompt_assert } from "./prompts.js";

export default class Asserter {

  /**
   * Assert that something is present in at least one chunk or is not present in all chunks.
   * @param chunks The chunks.
   * @param chain The chain to call the LLM.
   * @param negative_assertion Weither or not the instruction is for a negativ assertion.
   * @param assert_one_chunk T
   * @param inst The instruction.
   * @returns Weither or not the instruction is true for all chunks if this is for a negativ assertion,
   * @returns Weither or not the instruction is true for at least one chunk otherwise.
   */
  private static async is_here(chunks: string[], chain: any, negative_assertion: boolean, assert_one_chunk: (chunk: string, chain: Runnable, inst?: string) => Promise<boolean>, inst?: string): Promise<boolean> {
    for (let index = 0; index < chunks.length; index++) {
      if ((await assert_one_chunk(chunks[index], chain, inst)) != negative_assertion) {
        console.debug(`\tstopped at chunk n°${index} : "${chunks[index]}"`);
        return !negative_assertion;
      }
      //console.log(result);
    }
    return negative_assertion;
  }

  /**
   * Define weither or not an instruction is for a negativ assertion.
   * @param inst : the instruction.
   * @returns true if the instruction is for a negativ assertion, false otherwise.
  */
  static is_negative_assertion(inst?: string): boolean {
    if (!inst) return false;
    const match = inst.toLowerCase().match(/not\b|[^ ]n't\b|\bnever\b|\bnone\b|\bnothing\b/)
    if (match) {
      console.log(`(Negative assertion detected)`);
      return true;
    }
    console.log(`(Positive assertion detected)`);
    return false;
  }

  /**
   * Assert that a chunk match an instruction.
   * @param chunk The chunk.
   * @param chain The chain to call the LLM.
   * @param inst The instruction.
   * @returns Weither or not the instruction is correct for this chunk
   */
  static async assert_chunk(chunk: string, chain: Runnable, inst?: string): Promise<boolean> {
    let verdict = await chain.invoke({
      page: chunk,
      input: inst,
    });
    //convert response into boolean
    //should extract formatted response here instead
    verdict = verdict.toLowerCase();
    //console.log("*******Assertion response:", verdict);
    let match = verdict.match(/<\/think>\s*(.*)/s);
    let verdict22 = match ? match[1] : verdict;
    match = verdict22.match(/verdict:(.*)/);
    verdict22 = match ? match[1] : verdict22;
    return (verdict22.includes("false") ? false : true);
  }

  /**
   * Create the chain to call the llm, decompose the result into chunks and
   * concat the result of all chuncks getting with the `assert_one_chunk` function.
   * @param negative_assertion Weither or not the instruction is a negativ assertion.
   * @param chunks The list of all chunks.
   * @param llm The llm to use.
   * @param assert_one_chunk The function that does the assertion for one chunk taking a chunk, the chain and the instruction and returning weither or not the instruction is true for the chunk.
   * @param inst The instruction.
   * @returns Weither or not the instruction is true for all chunks if this is for a negative instruction,
   * @returns Weither or not the instruction is true for at least one chunk otherwise.
   */
  static async assert_all_chunks(negative_assertion: boolean, chunks: string[], llm: LLM, assert_one_chunk: (chunk: string, chain: Runnable, inst?: string) => Promise<boolean>, inst?: string): Promise<boolean> {
    const prompt = PromptTemplate.fromTemplate(prompt_assert);
    const chain = prompt.pipe(llm);
    return await Asserter.is_here(chunks, chain, negative_assertion, assert_one_chunk, inst);
  }
}