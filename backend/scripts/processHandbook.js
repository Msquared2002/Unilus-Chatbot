require("dotenv").config();

const fs = require("fs");
const aiService = require("../services/aiService");


async function process(){

    const handbook = fs.readFileSync(
        "./data/handbook_clean.txt",
        "utf8"
    );


    console.log(
        "Handbook size:",
        handbook.length
    );


    // Split into chunks
    const chunks = [];

    const chunkSize = 8000;


    for(
        let i = 0;
        i < handbook.length;
        i += chunkSize
    ){

        chunks.push(
            handbook.substring(
                i,
                i + chunkSize
            )
        );

    }


    console.log(
        "Chunks:",
        chunks.length
    );


    let knowledge = [];


    for(
        let i = 0;
        i < chunks.length;
        i++
    ){

        console.log(
            "Processing chunk",
            i + 1
        );


        const prompt = `

You are creating a University of Lusaka chatbot knowledge base.

Read this handbook section and create between 5-10 useful student question-answer pairs.

Focus on:
- academic rules
- registration procedures
- student services
- fees and payments
- examinations
- accommodation
- library rules
- IT services
- important contacts
- university policies

Only use information found in the handbook section.
Do not invent answers.

Prioritize factual information.
Never answer "I don't have that information" unless the provided text truly lacks it.

Create questions that students would realistically ask.

Return ONLY valid JSON.

Format:

[
 {
  "source":"handbook",
  "topic":"",
  "question":"",
  "answer":""
 }
]


Handbook section:

${chunks[i]}

`;



        let response;


        while(true){

            try {

                response =
                    await aiService.askAI(prompt);

                break;

            }
            catch(error){

                if(error.status === 429){

                    console.log(
                        "Rate limited. Waiting..."
                    );

                    await new Promise(resolve =>
                        setTimeout(resolve,15000)
                    );

                }
                else{

                    throw error;

                }

            }

        }


        // Wait before next AI request
        await new Promise(resolve =>
            setTimeout(resolve,8000)
        );



        try{


            let cleaned = response
                .replace(/```json/g, "")
                .replace(/```/g, "")
                .trim();



            const start = cleaned.indexOf("[");
            const end = cleaned.lastIndexOf("]");


            if(
                start !== -1 &&
                end !== -1
            ){

                cleaned = cleaned.substring(
                    start,
                    end + 1
                );

            }



            const parsed =
                JSON.parse(cleaned);



            knowledge.push(
                ...parsed
            );


        }
        catch(error){

            console.log(
                "Failed chunk",
                i + 1
            );


            console.log(
                error.message
            );

        }


    }



    fs.writeFileSync(

        "./data/handbook_knowledge.json",

        JSON.stringify(
            knowledge,
            null,
            2
        )

    );


    console.log(
        "DONE",
        knowledge.length,
        "entries created"
    );


}


process();