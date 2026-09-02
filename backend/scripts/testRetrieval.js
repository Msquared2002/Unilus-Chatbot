require("dotenv").config();

const fs = require("fs");

const {
    createEmbedding
} = require("../services/vectorService");

const aiService = require("../services/aiService");


const vectors =
JSON.parse(
    fs.readFileSync(
        "./data/knowledge_vectors.json",
        "utf8"
    )
);



function cosineSimilarity(a,b){

    let dot = 0;
    let magA = 0;
    let magB = 0;


    for(let i=0;i<a.length;i++){

        dot += a[i] * b[i];

        magA += a[i] * a[i];

        magB += b[i] * b[i];

    }


    return dot /
    (
        Math.sqrt(magA)
        *
        Math.sqrt(magB)
    );

}



async function test(){

const query =
"Where is the library located?";


console.log(
"Question:",
query
);



const queryVector =
await createEmbedding(query);



const results =
vectors.map(item => ({

    ...item,

    score:
    cosineSimilarity(
        queryVector,
        item.embedding
    )

}))
.sort(
(a,b)=>b.score-a.score
)
.filter(item => item.score > 0.40)
.slice(0,5);



console.log("\nTop results:\n");


results.forEach((r,i)=>{

console.log(
`\n${i+1}.
Score: ${r.score}

Question:
${r.question}

Answer:
${r.answer}

Source:
${r.source}
`
);


});

const context =
results
.map(item =>
`
Topic:
${item.topic}

Question:
${item.question}

Answer:
${item.answer}
`
)
.join("\n\n");



const answer =
await aiService.askAI(
    query,
    context
);



console.log(
"\nFINAL AI RESPONSE:\n"
);


console.log(answer);


}


test();