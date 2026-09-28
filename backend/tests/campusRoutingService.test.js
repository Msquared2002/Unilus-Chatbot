const test = require("node:test");
const assert = require("node:assert/strict");
const repository = require("../services/campusRepository");
const routing = require("../services/campusRoutingService");
const navigation = require("../services/navigationService");

test("canonical Silverest place IDs remain available after OSM refresh", () => {
  const places = repository.getAllPlaces();
  assert.equal(places.length, 23);
  assert.equal(new Set(places.map((place) => place.id)).size, 23);
  for (const id of ["knowledge_field_1", "knowledge_field_2", "p_c_school_of_business",
    "unilus_library", "cafeteria_school_of_medicine", "the_growcery", "unilus_hospital",
    "hostel_school_of_medicine_side", "unilus_hostel_school_of_medicine_side",
    "running_track_athletics", "sports_pitch_soccer", "unilus_gym", "unilus_swimming_pool"]) {
    assert.ok(repository.getPlaceById(id), `preserved ${id}`);
  }
  for (const place of places) assert.equal(repository.getPlaceById(place.id), place);
});

test("campus boundary checks coordinates", () => {
  assert.equal(routing.insideCampus({ lat: -15.3550065, lng: 28.4691214 }), true);
  assert.equal(routing.insideCampus({ lat: -15.3, lng: 28.4 }), false);
});

test("route endpoint service never fabricates a path without network data", () => {
  const result = routing.route({ origin: { type: "place", placeId: "unilus_library" },
    destination: { placeId: "cafeteria_school_of_medicine" } });
  assert.equal(result.statusCode, 503);
  assert.equal(result.body.code, "PEDESTRIAN_NETWORK_REQUIRED");
  assert.equal(result.body.route, undefined);
});

test("route requests reject unknown places and outside GPS origins", () => {
  assert.equal(routing.route({ origin: { type: "place", placeId: "unilus_library" },
    destination: { placeId: "missing" } }).body.code, "DESTINATION_NOT_FOUND");
  assert.equal(routing.route({ origin: { type: "coordinates", lat: -15.3, lng: 28.4 },
    destination: { placeId: "unilus_library" } }).body.code, "ORIGIN_OUTSIDE_CAMPUS");
});

test("two-place chat keeps origin and destination roles", () => {
  const result = navigation.tryHandleNavigation("Take me from the hospital to Knowledge Field 1");
  assert.equal(result.queryType.intentType, "route_unavailable");
  assert.equal(result.routeIntent.origin.placeId, "unilus_hospital");
  assert.equal(result.routeIntent.destination.placeId, "knowledge_field_1");
  assert.equal(result.navigation.placeId, "knowledge_field_1");
});
