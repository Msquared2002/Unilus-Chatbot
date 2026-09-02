const {
createEmbedding
}
=
require("./services/vectorService");


async function test(){


const vector =
await createEmbedding(
"Where is Group Studio on Monday?"
);


console.log(
vector.length
);


console.log(
vector.slice(0,10)
);


}


test();