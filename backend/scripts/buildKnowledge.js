const fs = require("fs");


const handbook =
fs.readFileSync(
    "./data/handbook.txt",
    "utf8"
);


// Remove page markers
let cleaned =
handbook.replace(
    /-- \d+ of \d+ --/g,
    ""
);


// Remove excessive spaces
cleaned =
cleaned.replace(
    /\n\s*\n\s*\n/g,
    "\n\n"
);


// Save cleaned version

fs.writeFileSync(
    "./data/handbook_clean.txt",
    cleaned
);


console.log(
    "Handbook cleaned"
);


console.log(
    "Characters:",
    cleaned.length
);