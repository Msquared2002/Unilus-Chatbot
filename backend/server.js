require("dotenv").config();

const express = require("express");
const cors = require("cors");

const timetableRoutes = require("./routes/timetableRoutes");

const chatRoutes = require("./routes/chatRoutes");

const campusRoutes = require("./routes/campusRoutes");

const supportRoutes = require("./routes/supportRoutes");


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


// Tickets, feedback and admin API routes
// (/api/tickets/:ref, /api/feedback, /api/admin/...)
app.use(
    "/api",
    supportRoutes
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
