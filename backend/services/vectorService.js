const { pipeline } = require("@xenova/transformers");


let extractor;


// Load embedding model once
async function loadModel(){

    if(!extractor){

        extractor = await pipeline(
            "feature-extraction",
            "Xenova/all-MiniLM-L6-v2"
        );

        console.log(
            "Embedding model loaded"
        );

    }

    return extractor;

}




async function createEmbedding(text){

    const model =
    await loadModel();


    const output =
    await model(
        text,
        {
            pooling:"mean",
            normalize:true
        }
    );


    return Array.from(
        output.data
    );

}



module.exports = {
    createEmbedding
};