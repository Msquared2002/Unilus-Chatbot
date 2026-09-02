const timetableService = require("./timetableService");
const timetableVectorService = require("./timetableVectorService");
const aiService = require("./aiService");
const retrievalService = require("./retrievalService");



// Detect what type of question the student is asking
function detectIntent(question) {

    const text = question.toLowerCase();


    const timetableIndicators = [

        "timetable",
        "schedule",
        "class",
        "lecture",
        "venue",
        "room",
        "course",
        "module",
        "where",
        "when",
        "day",
        "time",
        "teach",
        "teaches",
        "lecturer",
        "teacher",
        "professor"

    ];


    const hasTimetableWord =
        timetableIndicators.some(
            word => text.includes(word)
        );


    if(hasTimetableWord){

        return "timetable";

    }


    return "general";

}




// Extract course code from question
function extractCourseCode(question) {

    const match = question.match(
        /\b[A-Z]{2,5}\d{3}\b/i
    );


    if (match) {

        return match[0].toUpperCase();

    }


    return null;

}




// Extract day from question
function extractDay(question) {

    const days = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday"
    ];


    for (const day of days) {

        if (
            question
            .toLowerCase()
            .includes(day.toLowerCase())
        ) {

            return day;

        }

    }


    return null;

}




// Clean venue names
function cleanVenue(venue) {

    if (!venue) {

        return "Not available";

    }


    return venue
        .replace(/capacity/gi, "")
        .replace(/\s+/g, " ")
        .trim();

}




// Format timetable response
function formatTimetableResponse(records) {


    if (records.length === 0) {

        return "I couldn't find any timetable information matching your request.";

    }


    let response =
    "📚 Timetable Information\n\n";



    records.forEach((record,index)=>{


        response +=
`${index + 1}. ${record.course_code} - ${record.course_name}

📅 Day: ${record.day}

⏰ Time: ${record.time}

📍 Venue: ${cleanVenue(record.venue_name)}

👨‍🏫 Lecturer: ${record.lecturer_name || "Not available"}
`;



        if(record.venue_capacity){

            response +=
`\n👥 Capacity: ${record.venue_capacity}\n`;

        }



        response +=
"\n----------------------------\n\n";


    });



    return response;

}



// Handle timetable questions
async function handleTimetableQuestion(question) {

    console.log("HANDLE TIMETABLE:", question);


    const courseCode =
    extractCourseCode(question);


    const day =
    extractDay(question);


    console.log("Course:", courseCode);
    console.log("Day:", day);



    let results = [];



    if(courseCode){


        results =
        timetableService.getByCourse(
            courseCode
        );
        console.log("SEARCH OUTPUT:", results);


    }
    else{


    results =
    timetableService.search(
        question
    );


    console.log(
        "NORMAL SEARCH:",
        results.length
    );


    if(results.length === 0){

    console.log(
        "No normal timetable match. Trying vector search..."
    );


    const vectorResults =
    await timetableVectorService.searchTimetable(
        question
    );


    console.log(
        "VECTOR RESULTS:",
        vectorResults.map(item => ({
            course: item.course_code,
            name: item.course_name,
            day: item.day,
            score: item.score
        }))
    );


    results =
    vectorResults.filter(
        item => item.score >= 0.45
    );


    console.log(
        "AFTER VECTOR FILTER:",
        results.length
    );

}


}



    if(day){


        results =
        results.filter(
            item =>
            item.day.toLowerCase()
            ===
            day.toLowerCase()
        );


    }



    return formatTimetableResponse(results);

}

function formatContext(context){

    let text = "";


    if(context.timetable.length > 0){

        text += `
UNILUS TIMETABLE INFORMATION:

`;

        context.timetable.forEach(item=>{

            text += `
Course Code: ${item.course_code}
Course Name: ${item.course_name}
Day: ${item.day}
Time: ${item.time}
Venue: ${item.venue_name || "Not available"}
Lecturer: ${item.lecturer_name || "Not available"}

`;

        });

    }



    if(context.knowledge.length > 0){

        text += `
UNILUS KNOWLEDGE INFORMATION:

`;

        context.knowledge.forEach(item=>{

            text += `
Topic:
${item.topic}

Information:
${item.answer}

`;

        });

    }


    return text;

}



// Main chatbot handler
async function answerQuestion(question, sessionId){


    console.log(
        "Retrieving information..."
    );



    const context =
        await retrievalService.retrieve(
            question
        );



    const answer =
await aiService.askAI(
    question,
    formatContext(context)
);


return {
    answer,
    sessionId
};


}





module.exports = {

    answerQuestion,
    detectIntent

};