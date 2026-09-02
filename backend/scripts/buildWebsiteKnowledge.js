require("dotenv").config();

const fs = require("fs");
const aiService = require("../services/aiService");


async function process(){

    const website =
        JSON.parse(
            fs.readFileSync(
                "./data/unilus_website.json",
                "utf8"
            )
        );


    console.log(
        "Website pages:",
        website.length
    );


    let knowledge = [];

    const MAX_CONTENT_LENGTH = 12000;


    for(let i = 0; i < website.length; i++){

        console.log(
            "\nProcessing page",
            i + 1,
            website[i].url
        );


        const prompt = `

You are creating a University of Lusaka chatbot knowledge base.

Website page:
${website[i].url}

Create between 5-8 useful question-answer pairs.

Focus on:
- admissions
- programmes
- fees
- contacts
- campuses
- accommodation
- library
- IT services
- student services
- procedures
- requirements
- important university information

Avoid:
- menus
- footer text
- repeated links
- image descriptions

Rules:
- Only use information explicitly written on this page.
- Copy exact names, locations, dates, fees, contacts and requirements when available.
- Do not create vague answers.
- Do not say "details can be found on the website".
- Every answer must directly answer the question.
- If the page contains a location, include the exact location.
- If the page contains contact details, include them.
- Never create placeholder answers.
- Never say "available on campus".
- Never say "details can be found on the website".
- Never refer users to sections/pages instead of answering.
- If exact information is not available, do not create that question.
- Only create questions that can be answered directly from the page.

IMPORTANT:
Your entire response must be valid JSON.
Do not include explanations.
Do not include markdown.
Do not include \`\`\`.
Do not write anything before or after the JSON.

Format:

[
 {
  "source":"website",
  "topic":"",
  "question":"",
  "answer":""
 }
]


Website content:

${website[i].content.substring(0, MAX_CONTENT_LENGTH)}

`;



        let response;

let attempts = 0;


while(attempts < 3){

    try{

        response =
            await aiService.askAI(prompt);

        break;

    }
    catch(error){

        attempts++;

        if(error.status === 429){

            console.log(
                `Rate limited. Attempt ${attempts}/3. Waiting 60 seconds...`
            );


            await new Promise(resolve =>
                setTimeout(resolve,60000)
            );

        }
        else{

            console.log(error);
            break;

        }

    }

}


if(!response){

    console.log(
        "Skipping page:",
        website[i].url
    );

    continue;

}



        try{


            let cleaned =
                response
                .replace(/```json/g,"")
                .replace(/```/g,"")
                .trim();



            const start =
                cleaned.indexOf("[");


            const end =
                cleaned.lastIndexOf("]");


            if(start === -1 || end === -1){

                throw new Error(
                    "No JSON array found"
                );

            }


            cleaned =
                cleaned.substring(
                    start,
                    end + 1
                );


            const parsed =
                JSON.parse(cleaned);



            const filtered =
parsed.filter(item =>
    item.answer &&
    !(
        item.answer.toLowerCase().includes("i don't have") ||
        item.answer.toLowerCase().includes("i do not have") ||
        item.answer.toLowerCase().includes("information is unavailable") ||
        item.answer.toLowerCase().includes("not available") ||
        item.answer.toLowerCase().includes("details can be found") ||
        item.answer.toLowerCase().includes("library section")
    )
);


knowledge.push(...filtered);


            console.log(
                "Added:",
                    filtered.length
            );


        }
        catch(error){

    console.log(
        "JSON FAILED:",
        website[i].url
    );

    console.log(
        "AI RESPONSE:",
        response
    );


    console.log(
        "Retrying with strict JSON prompt..."
    );


    const retryPrompt = `

You are a JSON repair tool.

Extract only the JSON array from the response below.

Fix:
- missing commas
- invalid quotes
- trailing commas
- markdown wrappers

Do not change the information.

Return ONLY:

[
 {
  "source":"website",
  "topic":"",
  "question":"",
  "answer":""
 }
]

No explanations.
No markdown.
No comments.


Original response:

${response}

`;



    try{


        let retry;

while(true){

    try{

        retry =
            await aiService.askAI(retryPrompt);

        break;

    }
    catch(error){

        if(error.status === 429){

            console.log(
                "Retry rate limited. Waiting..."
            );

            await new Promise(resolve =>
                setTimeout(resolve,45000)
            );

        }
        else{

            throw error;

        }

    }

}



        let fixed =
            retry
            .replace(/```json/g,"")
            .replace(/```/g,"")
            .trim();



        const start =
            fixed.indexOf("[");


        const end =
            fixed.lastIndexOf("]");

        if(start === -1 || end === -1){
    throw new Error("Retry produced no JSON");
}



        fixed =
            fixed.substring(
                start,
                end + 1
            );



        const parsed =
            JSON.parse(fixed);



        const filtered =
    parsed.filter(item =>
        item.answer &&
        !(
            item.answer.toLowerCase().includes("i don't have") ||
            item.answer.toLowerCase().includes("i do not have") ||
            item.answer.toLowerCase().includes("information is unavailable") ||
            item.answer.toLowerCase().includes("not available")
        )
    );


knowledge.push(...filtered);


        console.log(
            "Recovered:",
                filtered.length
        );


    }
    catch(retryError){

        console.log(
            "Recovery failed"
        );

    }

}



        await new Promise(resolve =>
            setTimeout(resolve,60000)
        );


    }



    fs.writeFileSync(

        "./data/website_knowledge.json",

        JSON.stringify(
            knowledge,
            null,
            2
        )

    );


    console.log(
        "\nWebsite knowledge created:",
        knowledge.length
    );


}


process();