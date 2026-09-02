const {
searchTimetable
}
=
require("./services/timetableVectorService");


async function test(){


const results =
await searchTimetable(
"Where is Group Studio on Monday"
);



console.log(results);


}


test();