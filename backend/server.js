require("dotenv").config();

const express = require("express");
const cors = require("cors");

const timetableRoutes = require("./routes/timetableRoutes");

const chatRoutes = require("./routes/chatRoutes");


const app = express();


// Middleware
app.use(cors());

app.use(express.json());


// Timetable API routes
app.use(
    "/api/timetable",
    timetableRoutes
);


// Chatbot API routes
app.use(
    "/api/chat",
    chatRoutes
);


// Health check route
app.get(
    "/",
    (req, res) => {

        res.send(
            "UNILUS Chatbot Backend Running"
        );

    }
);


// Start server
app.listen(
    5000,
    () => {

        console.log(
            "Server running on port 5000"
        );

    }
);