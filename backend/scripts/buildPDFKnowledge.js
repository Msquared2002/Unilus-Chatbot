const fs = require("fs");


const pdfDocs =
JSON.parse(
    fs.readFileSync(
        "./data/pdf_text.json",
        "utf8"
    )
);


const output = [];



function cleanText(text){

    return text
        .replace(/--\s*\d+\s*of\s*\d+\s*--/g,"")
        .replace(/\s+/g," ")
        .trim();

}



function chunkText(text,size=800){

    const chunks=[];

    let start=0;


    while(start < text.length){

        chunks.push(
            text.substring(
                start,
                start + size
            )
        );


        start += size - 200;

    }


    return chunks;

}




function generateMetadata(filename){

    const name = filename.toLowerCase();



    if(name.includes("pharmacy")){
        return {
            topic:"Bachelor of Pharmacy Fees",
            question:"How much are the fees for Bachelor of Pharmacy at UNILUS?"
        };
    }



    if(name.includes("nursing")){
        return {
            topic:"Bachelor of Nursing Fees",
            question:"How much are the fees for Bachelor of Nursing at UNILUS?"
        };
    }



    if(name.includes("medicine")){
        return {
            topic:"Bachelor of Medicine Fees",
            question:"How much are the fees for Bachelor of Medicine and Surgery at UNILUS?"
        };
    }



    if(name.includes("defer")){
        return {
            topic:"Programme Deferment",
            question:"How do I defer my studies at UNILUS?"
        };
    }



    if(name.includes("examination")){
        return {
            topic:"Examination Rules",
            question:"What are the examination rules at UNILUS?"
        };
    }



    if(name.includes("handbook")){
        return {
            topic:"Student Handbook",
            question:"What information is contained in the UNILUS student handbook?"
        };
    }



    if(name.includes("prospectus")){
        return {
            topic:"UNILUS Prospectus",
            question:"What programmes does UNILUS offer?"
        };
    }



    if(name.includes("fees")){
        return {
            topic:"UNILUS Fees",
            question:"What are the fees at UNILUS?"
        };
    }



    return {
    topic: filename.replace(".pdf",""),
    question:"General information from this UNILUS document"
};

}

function generateQuestions(chunk, defaultQuestion){


    const text =
    chunk.toLowerCase();


    const questions=[];



    if(
        (
            text.includes("vice chancellor") ||
            text.includes("vice-chancellor")
        )
        &&
        (
            text.includes("prof") ||
            text.includes("professor") ||
            text.includes("pinalo")
        )
    ){

        questions.push(
            "Who is the Vice Chancellor of UNILUS?"
        );

    }



    if(
    text.includes("library") &&
    (
        text.includes("library ") ||
        text.includes("the library")
    )
)
    {

    if(
    (
        text.includes("plot") ||
        text.includes("address") ||
        text.includes("silverest campus") ||
        text.includes("mass media campus") ||
        text.includes("leopards hill campus")
    )
    &&
    (
        text.includes("library") ||
        text.includes("location")
    )
)
    {

        questions.push(
            "Where is the UNILUS library located?"
        );

    }


    if(
        (
            text.includes("electronic information") ||
            text.includes("collection of literature") ||
            text.includes("information resources") ||
            text.includes("knowledge resources")
        )
        &&
        !text.includes("library committee")
    ){

        questions.push(
            "What resources does the UNILUS library provide?"
        );

    }


    if(
        (
            text.includes("opening hours") ||
            text.includes("open Monday") ||
            text.includes("circulation desk")
        )
    ){

        questions.push(
            "What are the UNILUS library opening hours?"
        );

    }

}



    if(
        text.includes("fee") ||
        text.includes("tuition")
    ){

        questions.push(
            "How much are the fees?"
        );


        questions.push(
            "What are the tuition fees for this programme?"
        );

    }



    if(
        text.includes("defer")
    ){

        questions.push(
            "How do I defer my studies?"
        );

    }



    if(
        text.includes("examination")
    ){

        questions.push(
            "What are the examination rules?"
        );

    }



    if(
        questions.length === 0
    ){

        questions.push(
            defaultQuestion
        );

    }



    return questions;

}

const seenChunks = new Set();

pdfDocs.forEach(doc=>{


    console.log(
        "Processing:",
        doc.source
    );


    const meta =
generateMetadata(
    doc.source
);



    const cleaned =
        cleanText(
            doc.text
        );



    const chunks =
        chunkText(cleaned);




    


chunks.forEach((chunk,index)=>{


    const hash = chunk.trim().toLowerCase();


    if(seenChunks.has(hash))
        return;


    seenChunks.add(hash);


    if(chunk.length < 200)
        return;


    const questions =
    generateQuestions(
        chunk,
        meta.question
    );


    questions.forEach(question=>{


        output.push({

            topic:
            meta.topic,


            question,


            answer:
            chunk,


            source:
            doc.source,


            chunk:index+1

        });


    });


});



});





console.log(
    "Generated chunks:",
    output.length
);




fs.writeFileSync(

    "./data/pdf_knowledge.json",

    JSON.stringify(
        output,
        null,
        2
    )

);




console.log(
    "PDF knowledge created"
);