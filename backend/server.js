require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { attachUser } = require("./middleware/attachUser");

const timetableRoutes = require("./routes/timetableRoutes");

const chatRoutes = require("./routes/chatRoutes");

const campusRoutes = require("./routes/campusRoutes");

const supportRoutes = require("./routes/supportRoutes");

const authRoutes = require("./routes/authRoutes");

const knowledgeRoutes = require("./routes/knowledgeRoutes");

const knowledgeUpdater = require("./services/knowledgeUpdater");


const app = express();


// Middleware
app.use(cors());

app.use(express.json());

// Reads the sign-in token (if any) and sets req.user on every request
app.use(attachUser);


// Sign-in (/api/auth/login, /api/auth/me)
app.use(
    "/api/auth",
    authRoutes
);


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


// Tickets, feedback and staff API routes
// (/api/tickets/:ref, /api/feedback, /api/admin/...)
app.use(
    "/api",
    supportRoutes
);


// Knowledge base management: staff upload, delete, status, website refresh
// (/api/admin/documents, /api/admin/knowledge, ...)
app.use(
    "/api",
    knowledgeRoutes
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


// Documents marked "restricted" by staff stay hidden from public users after a restart
try {
    knowledgeUpdater.syncRestrictedSources();
} catch (error) {
    console.log("[knowledge] could not load restricted-document settings:", error.message);
}

// Optional timed website refresh (set KNOWLEDGE_REFRESH_HOURS in .env)
knowledgeUpdater.startScheduler();


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
