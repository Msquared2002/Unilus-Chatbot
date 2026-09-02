require("dotenv").config();

const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});


async function checkModels(){

    const models = await groq.models.list();

    console.log(models.data);

}


checkModels();