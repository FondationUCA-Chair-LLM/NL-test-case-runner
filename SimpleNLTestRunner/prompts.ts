
export const prompt_extract2 = "Extract all the elements with the format (id, description, type).\n Use the the DOM structure to get the type (button, link, title).";

export const prompt_extract = `Extract all the elements of the current page. Return these elements with the format (id, description, type).\n 
Use the the DOM structure to get the type (button, link, StaticText).\n
The description should be the text content of the element.\n
example1:\n
<a href="https://toto.org" id="1">Example</a>\n
id: 1, description: 'Example', type: 'link'\n
`;

export const prompt_assert = `Your task is to return the result of an Assertion evaluated on the page. You will be given the page content and an Assertion.\n
                Tha page content is a list of elements formatted as 'id, description, type'\n 
                Respond 'True' if the Assertion is True and 'False' otherwise.\n
                Let think step by step and return the final verdict.\n
                Read the descriptions and the types of the elements carrefully.\n
                Assertion: {input},\n
                Page: {page}'
                `;
