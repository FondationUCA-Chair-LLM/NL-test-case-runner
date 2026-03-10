
export const prompt_extract = `Extract all the elements of the current page. Return these elements with the format (id, description, type).\n 
Use the the DOM structure to get the type (button, link, StaticText).\n
The description should be the text content of the element.\n
Read the descriptions and the types of the elements carrefully to not forget any element.\n
example:\n
<a href="https://toto.org" id="1">Example</a>\n
id: 1, description: 'Example', type: 'link'\n
`;

export const prompt_extract2 = `Extract all the elements of the current page whose description includes some terms given below. Return these elements with the format (id, description, type).\n 
Use the the DOM structure to get the type (button, link, StaticText).\n
The description should be the text content of the element.\n
Read the descriptions and the types of the elements carrefully to not forget any element.\n
example:\n
<a href="https://toto.org" id="1">Example</a>\n
id: 1, description: 'Example', type: 'link'\n
Terms: `;

export const prompt_assert = `Your task is to return the result of an Assertion evaluated on a Web page. You will be given the page content and an Assertion.\n
The page content is a list of elements formatted as 'id, description, type'\n 
Respond 'True' if the Assertion is true and 'False' if the Assertion is not true.\n
Let think step by step and return the final verdict.\n
Read the descriptions and the types of the elements carrefully.\n
If a string is given in the assertion, strictly look for this string only\n
Response format depending on your evaluation: 'Verdict: true' or 'Verdict: false'\n
Assertion: {input},\n
Page: {page}`;

export const prompt_eval = `Your task is to check if an action can be performed on the page. You will be given a page content and an action.
The page content is a list of elements formatted as 'id, description, type'\n 
Respond 'True' if the action can be performed on the page and 'False' otherwise.\n
Let think step by step and return the final verdict.\n
Read the descriptions and the types of the elements carrefully.\n
Response format depending on your evaluation: 'Verdict: true' or 'Verdict: false'\n'\n
Action: {input}, 
Page: {page}`;

export const prompt_convert = `Your task is to convert test steps so that it can be recognized by the grammar given below.\n
The given step does not match the grammar.\n
Let think step by step and Respond "only" with the new step or the sequence of steps that can be recognized by the grammar.\n
Response format: 'Converted Step(s): step1, step2, etc. '\n

Step: {step}\n
EBNF Grammar:\n
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

# Notes:
# - Keywords are case-insensitive in practice (e.g. "Fill" or "fill" both accepted).
# - The grammar accepts both "click on 'X'" and "click 'X'" forms because the "on" is optional for CLICK.
# - Type/Enter/Fill productions allow both "in 'UI element'" and "in the field 'UI element'".
`;