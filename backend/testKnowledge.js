const knowledgeService =
require("./services/knowledgeService");


const questions = [

    "Who handles transcripts?",

    "What documents are needed for admission?",

    "When was UNILUS established?",

    "What services does UNILUS provide?",

    "What is BIT programme?"

];


for(const question of questions){

    console.log("\n====================");

    console.log("QUESTION:");
    console.log(question);


    const results =
    knowledgeService.searchKnowledge(question);


    console.log("\nRESULTS:");

    console.log(results.slice(0,3));

}