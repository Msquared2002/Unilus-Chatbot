const timetableService = require("./timetableService");
const timetableVectorService = require("./timetableVectorService");
const knowledgeService = require("./knowledgeService");



// Extract course codes like BIT320, ICT615
function extractCourseCode(question){

    const match =
        question.match(
            /\b[A-Z]{2,5}\d{3}\b/i
        );


    return match
        ? match[0].toUpperCase()
        : null;

}



// Extract possible lecturer names
// Extract possible lecturer names
function extractLecturer(question){

    const text =
        question.replace(/[?.,]/g,"");


    const matchWithTitle =
        text.match(
            /\b(Mr|Mrs|Ms|Dr)\s+[A-Za-z]+/i
        );


    if(matchWithTitle){

        return matchWithTitle[0];

    }


    const names = [
        "eddie",
        "joseph",
        "mwanza",
        "chileshe",
        "chela"
    ];


    for(const name of names){

        if(
            text.toLowerCase()
            .includes(name)
        ){

            return name;

        }

    }


    return null;

}

// Extract academic year from question
function extractYear(question){

    const text =
        question.toLowerCase();


    if(
        text.includes("1st year") ||
        text.includes("first year") ||
        text.includes("year 1")
    ){
        return 1;
    }


    if(
        text.includes("2nd year") ||
        text.includes("second year") ||
        text.includes("year 2")
    ){
        return 2;
    }


    if(
        text.includes("3rd year") ||
        text.includes("third year") ||
        text.includes("year 3")
    ){
        return 3;
    }


    if(
        text.includes("4th year") ||
        text.includes("fourth year") ||
        text.includes("year 4")
    ){
        return 4;
    }


    return null;

}

function extractCourseName(question){


    const text =
        question
        .toLowerCase();



    const commonCourses = [

        "project management",
        "data structures",
        "web development",
        "group studio",
        "system implementation",
        "systems development",
        "advanced java",
        "database",
        "network",
        "software engineering"

    ];



    for(const course of commonCourses){


        if(text.includes(course)){

            return course;

        }

    }


    return null;

}

async function retrieve(question){


    let context = {

        timetable: [],

        knowledge: []

    };



    console.log(
        "RETRIEVING:",
        question
    );



    /*
        1. Exact course lookup
    */


    const courseCode =
        extractCourseCode(question);

    const year =
    extractYear(question);

    const courseName =
extractCourseName(question);


console.log(
    "EXTRACTED COURSE NAME:",
    courseName
);


    console.log(
        "EXTRACTED YEAR:",
        year
    );

    if(courseCode){


        const results =
            timetableService.getByCourse(
                courseCode
            );


        console.log(
            "COURSE MATCH:",
            results.length
        );


        if(results.length){

            context.timetable =
                results.slice(0,10);

        }


    }



    /*
    2. Lecturer lookup
*/


if(context.timetable.length === 0){


    const lecturer =
        extractLecturer(question);



    console.log(
        "EXTRACTED LECTURER:",
        lecturer
    );



    if(lecturer){


    let results =
        timetableService.getByLecturer(
            lecturer
        );


    console.log(
        "LECTURER MATCH BEFORE YEAR FILTER:",
        results.length
    );



    if(year){

        results =
        results.filter(
            item =>
            Number(item.year) === year
        );


        console.log(
            "LECTURER MATCH AFTER YEAR FILTER:",
            results.length
        );

    }



    if(results.length > 0){

        context.timetable =
            results;

    }


}


}


    /*
    3. Normal keyword search
*/


const timetableKeywords = [
    "timetable",
    "schedule",
    "class",
    "lecture time",
    "lecturer",
    "course code",
    "venue",
    "room",
    "when is my class",
    "what time is my class"
];


const lowerQuestion =
    question.toLowerCase();


const isAcademicInfoQuestion =
    [
        "programme",
        "programmes",
        "degree",
        "qualification",
        "study",
        "faculty",
        "school"
    ]
    .some(word =>
        lowerQuestion.includes(word)
    );


const isTimetableQuestion =
    timetableKeywords.some(word =>
        lowerQuestion.includes(word)
    )
    ||
    (
        lowerQuestion.includes("my")
        &&
        (
            lowerQuestion.includes("class")
            ||
            lowerQuestion.includes("lecture")
        )
    );



if(
    context.timetable.length === 0 &&
    isTimetableQuestion
){

    let results =
    timetableService.search(
        question
    );


    console.log(
        "KEYWORD RESULTS:",
        results.length
    );



    console.log(
        results.slice(0,10).map(r => ({
            score: r.score,
            code: r.course_code,
            name: r.course_name
        }))
    );



    // Filter by extracted course name
    if(courseName){


        const filteredResults =
            results.filter(
                item =>
                item.course_name &&
                item.course_name
                .toLowerCase()
                .includes(courseName)
            );



        console.log(
            "COURSE NAME FILTER:",
            filteredResults.length
        );



        if(filteredResults.length > 0){

            results =
                filteredResults;

        }


    }



    context.timetable =
        results.slice(0,10);


}






    /*
        4. Semantic vector fallback
    */


    if(
    context.timetable.length === 0 &&
    isTimetableQuestion
){


        const vectorResults =
            await timetableVectorService.searchTimetable(
                question
            );



        console.log(
            "VECTOR FALLBACK:",
            vectorResults.length
        );



        context.timetable =
            vectorResults
            .filter(
                item =>
                item.score >= 0.35
            )
            .slice(0,10);



    }





    /*
    5. Knowledge base
*/


let knowledgeResults = [];


if(
    !isTimetableQuestion ||
    isAcademicInfoQuestion
){

    knowledgeResults =
        await knowledgeService.searchKnowledge(
            question
        );

}



console.log(
    "KNOWLEDGE SAMPLE:",
    {
        topic: knowledgeResults[0]?.topic,
        question: knowledgeResults[0]?.question,
        score: knowledgeResults[0]?.score
    }
);



if(
    knowledgeResults.length > 0
){


    knowledgeResults =
    knowledgeResults.sort((a,b)=>{


        let boostA = 0;
        let boostB = 0;


        const q =
        question.toLowerCase();



        /*
            Programme related questions
        */

        const programmeIntent =
            q.includes("programme") ||
            q.includes("programmes") ||
            q.includes("degree") ||
            q.includes("qualification") ||
            q.includes("study") ||
            q.includes("course") ||
            q.includes("courses");



        if(programmeIntent){


            if(
                a.topic &&
                (
                    a.topic.toLowerCase().includes("programme") ||
                    a.topic.toLowerCase().includes("program")
                )
            ){

                boostA += 0.3;

            }



            if(
                b.topic &&
                (
                    b.topic.toLowerCase().includes("programme") ||
                    b.topic.toLowerCase().includes("program")
                )
            ){

                boostB += 0.3;

            }

        }



        /*
            Fees related questions
        */

        const feeIntent =
            q.includes("fee") ||
            q.includes("fees") ||
            q.includes("cost") ||
            q.includes("tuition");



        if(feeIntent){


            if(
                a.topic &&
                a.topic.toLowerCase().includes("fee")
            ){

                boostA += 0.3;

            }



            if(
                b.topic &&
                b.topic.toLowerCase().includes("fee")
            ){

                boostB += 0.3;

            }

        }



        return (
            (b.score + boostB)
            -
            (a.score + boostA)
        );


    });



    /*
        Accept only meaningful matches
    */

    if(
        knowledgeResults[0].score >= 0.40
    ){


        context.knowledge =

            knowledgeResults
            .slice(0,5)
            .map(item => ({

                topic:item.topic,
                question:item.question,
                answer:item.answer,
                score:item.score

            }));

    }


}



    console.log(
        "FINAL CONTEXT:",
        {
            timetable:
            context.timetable.length,

            knowledge:
            context.knowledge.length
        }
    );



    return context;


}



module.exports = {

    retrieve

};