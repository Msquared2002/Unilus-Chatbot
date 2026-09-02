const fs = require("fs");
const { PDFParse } = require("pdf-parse");


const filePath = "./data/University-of-Lusaka-Student-Handbook.pdf";


async function extractHandbook() {

    try {

        const buffer = fs.readFileSync(filePath);


        const parser = new PDFParse({
            data: buffer
        });


        const result = await parser.getText();


        fs.writeFileSync(
            "./data/handbook.txt",
            result.text,
            "utf8"
        );


        console.log(
            "✅ Handbook extracted successfully"
        );


        console.log(
            "Characters extracted:",
            result.text.length
        );


    } catch(error) {

        console.error(
            "❌ Extraction failed:",
            error.message
        );

    }

}


extractHandbook();