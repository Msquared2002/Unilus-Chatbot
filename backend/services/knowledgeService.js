const fs = require("fs");

const {
    createEmbedding
}
=
require("./vectorService");



const knowledge =
JSON.parse(
    fs.readFileSync(
        "./data/knowledge_vectors.json",
        "utf8"
    )
);



console.log(
    "Loaded knowledge vectors:",
    knowledge.length
);





// Cosine similarity
function cosineSimilarity(a,b){

    let dot = 0;
    let normA = 0;
    let normB = 0;


    for(let i=0;i<a.length;i++){

        dot += a[i] * b[i];

        normA += a[i] * a[i];

        normB += b[i] * b[i];

    }


    return dot /
    (
        Math.sqrt(normA) *
        Math.sqrt(normB)
    );

}





async function searchKnowledge(question){


    const queryVector =
    await createEmbedding(
        question
    );



    const results =
    knowledge.map(item=>{


        const score =
        cosineSimilarity(
            queryVector,
            item.embedding
        );


        return {

            ...item,

            score

        };


    });



    return results

    .sort(
        (a,b)=>
        b.score-a.score
    )

    .slice(0,5);


}




module.exports = {

    searchKnowledge

};