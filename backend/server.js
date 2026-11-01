require("dotenv").config();

const express = require("express");
const cors = require("cors");

const timetableRoutes = require("./routes/timetableRoutes");

const chatRoutes = require("./routes/chatRoutes");

const campusRoutes = require("./routes/campusRoutes");


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


// Campus navigation API routes
app.use(
    "/api/campus",
    campusRoutes
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
const PORT = process.env.PORT || 5000;
app.listen(
    PORT,
    () => {

        console.log(
            `Server running on port ${PORT}`
        );

    }
);