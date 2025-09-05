
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
