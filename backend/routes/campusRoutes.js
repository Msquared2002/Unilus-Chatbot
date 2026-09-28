const express = require("express");

const router = express.Router();

const campusRepository = require("../services/campusRepository");
const locationSearchService = require("../services/locationSearchService");
const navigationService = require("../services/navigationService");
const campusRoutingService = require("../services/campusRoutingService");
const { loadSources, buildGraph } = require("../services/campusGraphBuilder");
const { validateSources } = require("../services/campusRoutingValidator");

// Developer-only editor reads local source geometry. Editing is exported to
// files by the browser; this API never writes GIS data.
router.get("/routing/editor-data", (req, res) => {
    if (process.env.CAMPUS_ROUTING_EDITOR !== "true") return res.sendStatus(404);
    const sources = loadSources();
    res.json({ boundary: sources.boundary, buildings: campusRepository.getAllBuildings(),
        places: campusRepository.getAllPlaces(), roads: sources.roads,
        walkways: sources.walkwayGeojson, access_points: sources.accessPoints });
});

router.post("/routing/validate", (req, res) => {
    if (process.env.CAMPUS_ROUTING_EDITOR !== "true") return res.sendStatus(404);
    const sources = loadSources();
    const report = validateSources({ walkwayGeojson: req.body.walkways,
        accessPoints: req.body.access_points || [], boundary: sources.boundary,
        buildings: campusRepository.getAllBuildings(), roads: sources.roads,
        placeIds: new Set(campusRepository.getAllPlaces().map(p => p.id)) });
    if (!report.errors.length) {
        const walkways = req.body.walkways.features.map(f => ({ id: f.properties.id, kind: f.properties.kind,
            source: f.properties.source || "manual_survey", level: f.properties.level || 0,
            accessible: f.properties.accessible, coordinates: f.geometry.coordinates }));
        const graph = buildGraph({ ...sources, walkways, accessPoints: req.body.access_points || [] });
        for (const [id, state] of Object.entries(graph.access_points))
            if (!state.connected) report.warnings.push(`Entrance not connected to network: ${id}`);
        if (graph.stats.connected_component_count > 1)
            report.warnings.push(`${graph.stats.connected_component_count} disconnected network components`);
        report.graph_stats = graph.stats;
    }
    res.json(report);
});


// GET CAMPUS BOUNDARY
// Example:
// /api/campus/boundary
router.get("/boundary", (req, res) => {

    res.json(campusRepository.getBoundary());

});


// GET ALL NAMED PLACES
// Example:
// /api/campus/places
router.get("/places", (req, res) => {

    res.json(campusRepository.getAllPlaces());

});


// GET A SINGLE PLACE BY ID (for the info card)
// Example:
// /api/campus/places/unilus_library
router.get("/places/:id", (req, res) => {

    const place = campusRepository.getPlaceById(req.params.id);

    if (!place) {

        return res.status(404).json({
            error: `No place found with id "${req.params.id}"`
        });

    }

    res.json(place);

});


// GET NEAREST PLACES TO A GIVEN PLACE
// Example:
// /api/campus/places/unilus_library/nearby?limit=3
router.get("/places/:id/nearby", (req, res) => {

    const place = campusRepository.getPlaceById(req.params.id);

    if (!place) {

        return res.status(404).json({
            error: `No place found with id "${req.params.id}"`
        });

    }

    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const nearby = campusRepository.getNearby(
        place.id,
        limit ? { limit } : undefined
    );

    res.json(
        nearby.map((entry) => ({
            place: entry.place,
            distanceMeters: Math.round(entry.distanceMeters)
        }))
    );

});


// GET ALL UNNAMED BUILDING FOOTPRINTS (for the 2.5D / grey base layer)
// Example:
// /api/campus/buildings
router.get("/buildings", (req, res) => {

    res.json(campusRepository.getAllBuildings());

});


// SEARCH PLACES BY FREE TEXT
// Example:
// /api/campus/search?q=where+is+the+library
router.get("/search", (req, res) => {

    const query = req.query.q;

    if (!query) {

        return res.status(400).json({
            message: "Search query is required"
        });

    }

    const matches = locationSearchService.findAllMatches(query, { limit: 5 });

    res.json(
        matches.map((m) => ({
            place: m.place,
            score: m.score,
            matchedAlias: m.matchedAlias,
            facility: m.facility || null
        }))
    );

});


// RUN A QUESTION THROUGH THE NAVIGATION PIPELINE DIRECTLY
// Useful for testing the navigation module without going through
// the general /api/chat endpoint.
// Example body: { "question": "Where is the library?" }
router.post("/navigate", (req, res) => {

    const question = req.body.question;

    if (!question) {

        return res.status(400).json({
            error: "\"question\" is required in the request body"
        });

    }

    const result = navigationService.tryHandleNavigation(question);

    if (!result) {

        return res.status(404).json({
            message: "Not recognised as a campus navigation question, or no known place was mentioned."
        });

    }

    res.json(result);

});


// Reserved for verified pedestrian routing. Never returns a decorative route.
router.post("/route", (req, res) => {
    const result = campusRoutingService.route(req.body);
    res.status(result.statusCode).json(result.body);
});

module.exports = router;
