const fs = require("fs");
const path = require("path");

const timetable = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, "../data/chatbot_timetable.json"),
        "utf8"
    )
);

console.log(
    "BIT320 COUNT:",
    timetable.filter(
        item => item.course_code === "BIT320"
    ).length
);

function normalize(text) {
    if (!text) return "";
    return text.toString().trim().toLowerCase();
}

function getAll() {
    return timetable;
}

function getByCourse(courseCode) {
    const code = normalize(courseCode);

    return timetable.filter(
        record => normalize(record.course_code) === code
    );
}

function getByProgramme(programmeCode) {
    const code = normalize(programmeCode);

    return timetable.filter(
        record => normalize(record.programme_code) === code
    );
}

function getByLecturer(name) {

    const lecturer =
        normalize(name)
        .replace(
            /^(mr|mrs|ms|dr)\s+/,
            ""
        );


    return timetable.filter(
        record => {

            const databaseName =
                normalize(record.lecturer_name)
                .replace(
                    /^(mr|mrs|ms|dr)\s+/,
                    ""
                );


            return databaseName.includes(
                lecturer
            );

        }
    );

}

function getByDay(day) {
    const d = normalize(day);

    return timetable.filter(
        record => normalize(record.day) === d
    );
}

function search(query) {


    const words =
    normalize(query)
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(word => word.length > 2);

    const queryText =
    normalize(query);


    const results =
    timetable
    .map(record => {


        const searchableText =
        `
        ${record.course_code || ""}
        ${record.course_name || ""}
        ${record.programme_code || ""}
        ${record.programme_name || ""}
        ${record.lecturer_name || ""}
        ${record.venue_name || ""}
        ${record.day || ""}
        `
        .toLowerCase();



        let score = 0;

const courseName =
    normalize(record.course_name);



// Exact course name
if(
    courseName === queryText
){
    score += 100;
}



// Whole course name appears in question
else if(
    queryText.includes(courseName)
){
    score += 50;
}



// Question appears inside course name
else if(
    courseName.includes(queryText)
){
    score += 40;
}



// Give priority to exact course code matches
if(
    record.course_code &&
    queryText.includes(
        normalize(record.course_code)
    )
){

    score += 10;

}



    // Normal word matching
words.forEach(word => {


    if(searchableText.includes(word)){

        score += 2;

    }


});


// Strong penalty for unrelated "management/project" matches
const courseWords =
    courseName
    .split(/\s+/)
    .filter(word => word.length > 3);



let matchedCourseWords = 0;


courseWords.forEach(word => {

    if(queryText.includes(word)){

        matchedCourseWords++;

    }

});


// Reward courses where most words match
if(courseWords.length > 0){

    const ratio =
        matchedCourseWords / courseWords.length;


    if(ratio === 1){

        score += 30;

    }
    else if(ratio >= 0.5){

        score += 10;

    }

}



        return {

            ...record,

            score

        };


    })


    .filter(
        item => item.score > 0
    )


    .sort((a,b)=>{

    if(b.score !== a.score){

        return b.score - a.score;

    }


    const aMatches =
        normalize(a.course_name)
        .split(" ")
        .filter(
            word => queryText.includes(word)
        ).length;


    const bMatches =
        normalize(b.course_name)
        .split(" ")
        .filter(
            word => queryText.includes(word)
        ).length;


    return bMatches - aMatches;

});


    return results;

}

module.exports = {

    getAll,

    getByCourse,

    getByProgramme,

    getByLecturer,

    getByDay,

    search

};