/**
 * navigationService.js
 * ======================
 *
 * The single entry point chatService.js calls for campus navigation.
 * Ties together:
 *
 *   navigationIntentDetector  -> is this a navigation question, and
 *                                which kind (locate / proximity)?
 *   locationSearchService     -> which known place(s) does it mention?
 *   campusRepository          -> coordinates, geometry, nearby places
 *   mapResponseBuilder        -> the frontend map-instruction payload
 *
 * Answers are built deterministically from the dataset rather than
 * sent to the LLM. Navigation questions have one correct answer
 * ("the library is here"), so a template is faster, cheaper, and more
 * reliable than an extra model call — the same reasoning
 * resourceService.js's registry lookup uses instead of semantic
 * search for a known link.
 *
 * tryHandleNavigation() returns null when the question isn't a
 * navigation request (or mentions no known place), so the caller can
 * fall through to the existing timetable/knowledge/AI pipeline
 * unchanged.
 */

const campusRepository = require("./campusRepository");
const locationSearchService = require("./locationSearchService");
const navigationIntentDetector = require("./navigationIntentDetector");
const mapResponseBuilder = require("./mapResponseBuilder");
const routingService = require("./campusRoutingService");

const NEARBY_LIMIT = 3;
const NEARBY_MAX_METERS = 200; // covers same-cluster buildings without pulling in the whole campus

function categoryLabel(category) {
  return (category || "").replace(/_/g, " ");
}

function buildLocateAnswer(place) {
  const nearest = campusRepository.getNearby(place.id, { limit: 1, maxDistanceMeters: NEARBY_MAX_METERS });
  const location = nearest.length ? `, near ${nearest[0].place.name}` : " on the Silverest Campus";
  return `The ${place.name} is a ${categoryLabel(place.category)}${location}. I've highlighted it on the map.`;
}

function buildProximityAnswer(place, nearby) {
  if (!nearby.length) {
    return `I don't have anything close to ${place.name} in the current campus dataset.`;
  }
  const names = nearby.map((entry) => entry.place.name).join(", ");
  return `Near ${place.name}, you'll find: ${names}.`;
}

/**
 * @param {string} question
 * @returns {null | {answer: string, queryType: object, navigation: object,
 *                   sources: Array, resources: Array,
 *                   recommendedResources: Array, timetableMatches: number}}
 */
function tryHandleNavigation(question) {
  // Keep two-place language separate from ordinary place lookup. No path is
  // claimed until the independent routing service has a verified network.
  const fromTo = (question || "").match(/\bfrom\s+(.+?)\s+to\s+(.+?)(?:[?.!]|$)/i);
  if (fromTo) {
    const origin = locationSearchService.findBestMatch(fromTo[1]);
    const destination = locationSearchService.findBestMatch(fromTo[2]);
    if (origin && destination) {
      const routing = routingService.route({ from: { place_id: origin.place.id }, to: { place_id: destination.place.id } });
      return {
        answer: routing.body.status === 'ok'
          ? `Walking route from ${origin.place.name} to ${destination.place.name}: ${Math.round(routing.body.distance_m)} m, about ${Math.max(1, Math.round(routing.body.duration_s / 60))} min. View it on the map.`
          : `I can show ${destination.place.name} on the map. A walking route from ${origin.place.name} needs verified entrances and paths.`,
        queryType: { isNavigation: true, intentType: routing.body.status === 'ok' ? "route" : "route_unavailable" },
        routeIntent: { origin: { type: "place", placeId: origin.place.id },
          destination: { placeId: destination.place.id } },
        route: routing.body.status === 'ok' ? routing.body : null,
        routeStatus: routing.body.status,
        navigation: mapResponseBuilder.buildLocateResponse(destination.place),
        sources: [], resources: [], recommendedResources: [], timetableMatches: 0,
      };
    }
  }
  const intent = navigationIntentDetector.classify(question);
  if (!intent.hasLocateTrigger && !intent.hasProximityTrigger) return null;

  const matches = locationSearchService.findAllMatches(question, { limit: 2 });
  if (!matches.length) return null; // trigger phrase, but no known place mentioned

  const primaryPlace = matches[0].place;
  const matchedFacility = matches[0].facility;

  const requestsRoute = /\b(?:take me to|navigate to|how (?:do|can) i get to|directions? to|route me to|go to)\b/i.test(question || '');
  if (requestsRoute && !intent.hasProximityTrigger) {
    return {
      answer: `I can show ${primaryPlace.name}. Where are you starting from? You can choose your current location on the map if you allow location access.`,
      queryType: { isNavigation: true, intentType: 'route_start_required' },
      routeIntent: { destination: { placeId: primaryPlace.id }, origin: null },
      navigation: mapResponseBuilder.buildLocateResponse(primaryPlace),
      sources: [], resources: [], recommendedResources: [], timetableMatches: 0,
    };
  }

  if (intent.hasProximityTrigger) {
    const nearby = campusRepository.getNearby(primaryPlace.id, {
      limit: NEARBY_LIMIT,
      maxDistanceMeters: NEARBY_MAX_METERS,
    });

    return {
      answer: buildProximityAnswer(primaryPlace, nearby),
      queryType: { isNavigation: true, intentType: "proximity" },
      navigation: mapResponseBuilder.buildProximityResponse(primaryPlace, nearby),
      sources: [],
      resources: [],
      recommendedResources: [],
      timetableMatches: 0,
    };
  }

  return {
    answer: matchedFacility
      ? `${matchedFacility.name} is a food outlet in the ${primaryPlace.name} area. I've highlighted ${primaryPlace.name} on the map.`
      : buildLocateAnswer(primaryPlace),
    queryType: { isNavigation: true, intentType: "locate" },
    navigation: mapResponseBuilder.buildLocateResponse(primaryPlace),
    sources: [],
    resources: [],
    recommendedResources: [],
    timetableMatches: 0,
  };
}

module.exports = { tryHandleNavigation, NEARBY_LIMIT, NEARBY_MAX_METERS };
