const fs = require("fs");

const {
    createEmbedding
}
=
require("../services/vectorService");



const general =
JSON.parse(
fs.readFileSync(
"./data/knowledge.json",
"utf8"
)
);


const handbook =
JSON.parse(
fs.readFileSync(
"./data/handbook_knowledge.json",
"utf8"
)
);


const website =
JSON.parse(
fs.readFileSync(
"./data/website_knowledge.json",
"utf8"
)
);


const pdf =
JSON.parse(
fs.readFileSync(
"./data/pdf_knowledge.json",
"utf8"
)
);



const knowledge = [

    ...general.map(item => ({
        ...item,
        source:"general"
    })),


    ...handbook.map(item => ({
        ...item,
        source:"handbook"
    })),


    ...website.map(item => ({
        ...item,
        source:"website"
    })),


    ...pdf.map(item => ({
        ...item,
        source:"pdf"
    }))

];



async function generate(){


console.log(
"Total entries:",
knowledge.length
);



const vectors = [];



for(
let i=0;
i<knowledge.length;
i++
){


const item =
knowledge[i];


console.log(
`Processing ${i+1}/${knowledge.length}`
);



const answerText =
typeof item.answer === "object"
    ? JSON.stringify(item.answer)
    : item.answer || "";


const text =
`
Topic:
${item.topic || ""}

Question:
${item.question || ""}

Answer:
${answerText}
`;



const embedding =
await createEmbedding(
text
);



vectors.push({

    ...item,

    embedding

});


}



fs.writeFileSync(

"./data/knowledge_vectors.json",

JSON.stringify(
vectors,
null,
2
)

);



console.log(
"Knowledge vectors created"
);


}



generate();