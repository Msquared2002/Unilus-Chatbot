require("dotenv").config();

const chatService =
require("./services/chatService");



async function test(){

    const questions = [

        "Who handles transcripts?",

        "What documents are needed for admission?",

        "Show me BIT320 timetable",

        "When is my class on Monday?",

        "Explain artificial intelligence"

    ];


    for(const question of questions){

        console.log("\n====================");
        console.log("QUESTION:");
        console.log(question);

        console.log("\nANSWER:");

        const answer =
        await chatService.answerQuestion(question);

        console.log(answer);

    }

}


test();