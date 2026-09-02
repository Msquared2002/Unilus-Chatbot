const fs = require("fs");
const path = require("path");

const { PDFParse } = require("pdf-parse");


const PDF_FOLDER =
"./data/pdfs";


const OUTPUT =
"./data/pdf_text.json";



async function extractPDFs(){


    const files =
        fs.readdirSync(PDF_FOLDER)
        .filter(
            file =>
            file.toLowerCase().endsWith(".pdf")
        );


    console.log(
        "PDF files found:",
        files.length
    );



    let documents = [];



    for(
        let i = 0;
        i < files.length;
        i++
    ){

        const file = files[i];


        console.log(
            `Processing ${i+1}/${files.length}:`,
            file
        );



        const buffer =
            fs.readFileSync(
                path.join(
                    PDF_FOLDER,
                    file
                )
            );


        const parser = new PDFParse({
    data: buffer
});


const data =
    await parser.getText();


await parser.destroy();



        documents.push({

            source:file,

            text:data.text

        });


    }



    fs.writeFileSync(
        OUTPUT,
        JSON.stringify(
            documents,
            null,
            2
        )
    );



    console.log(
        "PDF extraction complete"
    );

}



extractPDFs();