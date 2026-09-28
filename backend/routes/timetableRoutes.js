const express = require("express");

const router = express.Router();

const timetableService = require("../services/timetableService");


// GET ALL TIMETABLE RECORDS
router.get("/", (req, res) => {

    const data = timetableService.getAll();

    res.json(data);

});


// GET BY COURSE CODE
// Example:
// /api/timetable/course/BIT320

router.get("/course/:code", (req, res) => {

    const results = timetableService.getByCourse(
        req.params.code
    );

    res.json(results);

});


// GET BY PROGRAMME
// Example:
// /api/timetable/programme/BIT32

router.get("/programme/:code", (req, res) => {

    const results = timetableService.getByProgramme(
        req.params.code
    );

    res.json(results);

});


// GET BY LECTURER
// Example:
// /api/timetable/lecturer/John

router.get("/lecturer/:name", (req, res) => {

    const results = timetableService.getByLecturer(
        req.params.name
    );

    res.json(results);

});


// GET BY DAY
// Example:
// /api/timetable/day/Monday

router.get("/day/:day", (req, res) => {

    const results = timetableService.getByDay(
        req.params.day
    );

    res.json(results);

});


// SEARCH EVERYTHING
// Example:
// /api/timetable/search?q=project

router.get("/search", (req, res) => {

    const query = req.query.q;


    if (!query) {

        return res.status(400).json({
            message: "Search query is required"
        });

    }


    const results = timetableService.search(
        query
    );


    res.json(results);

});


module.exports = router;