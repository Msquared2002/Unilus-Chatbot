require("dotenv").config();

const retrievalService =
require("../services/retrievalService");

const aiService =
require("../services/aiService");


async function test(){


const question =
"Where is the library located?";


const context =
await retrievalService.retrieve(
    question
);



console.log(
"CONTEXT:",
JSON.stringify(
context,
null,
2
)
);



const answer =
await aiService.askAI(
    question,
    JSON.stringify(context)
);



console.log(
"\nANSWER:\n"
);

console.log(answer);


}


test();