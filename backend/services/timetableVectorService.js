const fs=require("fs");

const {
createEmbedding
}
=
require("./vectorService");



const timetableVectors =
JSON.parse(
fs.readFileSync(
"./data/timetable_vectors.json",
"utf8"
)
);



console.log(
"Loaded timetable vectors:",
timetableVectors.length
);





function cosineSimilarity(a,b){

let dot=0;
let normA=0;
let normB=0;


for(let i=0;i<a.length;i++){

dot += a[i]*b[i];

normA += a[i]*a[i];

normB += b[i]*b[i];

}


return dot /
(
Math.sqrt(normA) *
Math.sqrt(normB)
);

}




async function searchTimetable(question){


const queryVector =
await createEmbedding(question);



return timetableVectors
.map(item=>{


return {

...item,

score:
cosineSimilarity(
queryVector,
item.embedding
)

};


})


.sort(
(a,b)=>
b.score-a.score
)


.slice(0,5);



}



module.exports={

searchTimetable

};