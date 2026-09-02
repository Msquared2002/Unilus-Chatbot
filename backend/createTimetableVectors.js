const fs = require("fs");
const path = require("path");

const {
    createEmbedding
} = require("./services/vectorService");


// Load timetable data
const timetable =
JSON.parse(
    fs.readFileSync(
        path.join(
            __dirname,
            "data/chatbot_timetable.json"
        ),
        "utf8"
    )
);



async function createVectors(){


    console.log(
        "Total timetable records:",
        timetable.length
    );


    const vectors = [];



    for(
        let i = 0;
        i < timetable.length;
        i++
    ){


        console.log(
            `Processing ${i + 1}/${timetable.length}`
        );


        const item = timetable[i];



        const text = `

Course Code:
${item.course_code || ""}

Course Name:
${item.course_name || ""}

Course Information:
${item.course_code || ""} ${item.course_name || ""}

Lecturer:
${item.lecturer_name || ""}

Teaching Information:
${item.lecturer_name || "Unknown lecturer"} teaches ${item.course_code || ""} ${item.course_name || ""}.

Programme:
${item.programme_code || ""}
${item.programme_name || ""}

Schedule:
${item.course_code || ""} is scheduled on ${item.day || ""} from ${item.time || ""}.

Day:
${item.day || ""}

Time:
${item.time || ""}

Venue:
${item.venue_name || ""}

This record describes a University of Lusaka timetable entry.
`;



        const embedding =
        await createEmbedding(text);



        vectors.push({

            ...item,

            embedding

        });


    }



    fs.writeFileSync(

        path.join(
            __dirname,
            "data/timetable_vectors.json"
        ),

        JSON.stringify(
            vectors,
            null,
            2
        )

    );


    console.log(
        "Timetable vectors created successfully"
    );


}



createVectors();