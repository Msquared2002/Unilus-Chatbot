const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");


const urls = [

"https://web.unilus.ac.zm/",
"https://web.unilus.ac.zm/aboutunilus/",
"https://web.unilus.ac.zm/contact-us/",
"https://web.unilus.ac.zm/faq/",
"https://web.unilus.ac.zm/fees/",
"https://web.unilus.ac.zm/accomodation/",
"https://web.unilus.ac.zm/academics-detail/",
"https://web.unilus.ac.zm/calendars-and-time-tables/",
"https://web.unilus.ac.zm/unilus-it-support-helpdesk/",
"https://web.unilus.ac.zm/careers/",
"https://web.unilus.ac.zm/research-and-consultancy/",
"https://web.unilus.ac.zm/apply-online/"


];


async function scrape(url){

    try{

        console.log("Scraping:", url);


        const response =
            await axios.get(url);


        const $ = cheerio.load(response.data);


        $("script").remove();
        $("style").remove();


        const text =
            $("body")
            .text()
            .replace(/\s+/g," ")
            .trim();


        return {

            url,
            content:text

        };


    }
    catch(error){

        console.log(
            "FAILED:",
            url
        );

        return null;

    }

}



async function run(){

    const results=[];


    for(const url of urls){

        const page =
            await scrape(url);


        if(page){

            results.push(page);

        }

    }



    fs.writeFileSync(

        "./data/unilus_website.json",

        JSON.stringify(
            results,
            null,
            2
        )

    );


    console.log(
        "Website scrape complete:",
        results.length
    );


}



run();