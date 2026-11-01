"""Audit downloaded Overture segments against the campus boundary and OSM."""
import collections
import json
import math
import pathlib
import sys
import tempfile
import xml.etree.ElementTree as ET

sys.path.insert(0, str(pathlib.Path(tempfile.gettempdir()) / "silverest_overture_lib"))
from shapely.geometry import LineString, Point, shape, mapping
from shapely.ops import transform, unary_union

HERE = pathlib.Path(__file__).resolve().parent
CAMPUS = HERE.parent.parent
raw = json.loads((HERE / "silverest_overture_transportation.geojson").read_text(encoding="utf-8"))
boundary = shape(json.loads((CAMPUS / "campus_boundary.json").read_text(encoding="utf-8"))["geometry"])
lat0 = -15.355
def metres(g):
    return transform(lambda x, y, z=None: ((x - 28.469) * 111320 * math.cos(math.radians(lat0)), (y - lat0) * 110574), g)

osm_root = ET.parse(CAMPUS / "source" / "map(4).osm").getroot()
nodes = {n.get("id"): (float(n.get("lon")), float(n.get("lat"))) for n in osm_root.findall("node")}
osm_lines = []
osm_refs = set()
for way in osm_root.findall("way"):
    tags = {t.get("k"): t.get("v") for t in way.findall("tag")}
    if "highway" not in tags:
        continue
    coords = [nodes[n.get("ref")] for n in way.findall("nd") if n.get("ref") in nodes]
    if len(coords) > 1:
        osm_lines.append(metres(LineString(coords)))
        osm_refs.add("w" + way.get("id"))
osm_union = unary_union(osm_lines)

ped_classes = {"footway", "path", "pedestrian", "steps", "sidewalk", "crosswalk"}
counts = collections.Counter()
positions = collections.Counter()
inside = []
crossing = []
outside = []
ped = []
service = []
additional = []
matched = 0
service_overlap = []
for feature in raw["features"]:
    p = feature["properties"]
    g = shape(feature["geometry"])
    cls = p.get("class")
    counts[str(cls)] += 1
    if boundary.covers(g):
        position = "inside"
        inside.append(feature)
    elif boundary.intersects(g):
        position = "crossing"
        crossing.append(feature)
    else:
        position = "outside"
        outside.append(feature)
    positions[position] += 1
    p["campus_position"] = position
    if position == "outside":
        continue
    if cls in ped_classes:
        ped.append(feature)
        clipped = metres(g.intersection(boundary))
        overlap = clipped.intersection(osm_union.buffer(2)).length / clipped.length if clipped.length else 0
        src_refs = {s.get("record_id", "").split("@")[0] for s in p.get("sources") or []}
        if overlap < 0.9 and not src_refs.intersection(osm_refs):
            additional.append(feature)
    if cls == "service":
        service.append(feature)
        clipped = metres(g.intersection(boundary))
        overlap = clipped.intersection(osm_union.buffer(2)).length / clipped.length if clipped.length else 0
        service_overlap.append(overlap)
        if overlap >= 0.9:
            matched += 1

def write(name, features):
    (HERE / name).write_text(json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8")
write("silverest_overture_pedestrian.geojson", ped)
write("silverest_overture_service.geojson", service)
write("silverest_overture_additional.geojson", additional)

ped_clipped = [metres(shape(f["geometry"]).intersection(boundary)) for f in ped]
ped_union = unary_union(ped_clipped) if ped_clipped else None
canonical = json.loads((CAMPUS / "campus_places.json").read_text(encoding="utf-8"))["places"]
distances = {}
for place in canonical:
    loc = place["coordinates"]
    point = metres(Point(loc["lng"], loc["lat"]))
    distances[place["id"]] = round(point.distance(ped_union), 2) if ped_union else None
coverage = {str(d): sum(v is not None and v <= d for v in distances.values()) for d in (5, 10, 25, 50)}
result = {
    "release": "2026-09-23.1",
    "bbox": [28.466848, -15.357015, 28.471409, -15.352995],
    "total": len(raw["features"]),
    "positions": dict(positions),
    "class_counts_bbox": dict(counts),
    "class_counts_campus_intersecting": dict(collections.Counter(f["properties"].get("class") for f in inside + crossing)),
    "pedestrian_length_m_inside_boundary": round(ped_union.length, 2) if ped_union else 0,
    "pedestrian_count_campus_intersecting": len(ped),
    "additional_pedestrian_count": len(additional),
    "service_count_campus_intersecting": len(service),
    "service_segments_geometrically_matched_within_2m_at_90_percent": matched,
    "service_overlap_fractions": [round(x, 3) for x in service_overlap],
    "canonical_destination_count": len(canonical),
    "canonical_coverage": coverage,
    "canonical_distances_m": distances,
}
(HERE / "silverest_overture_audit.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, indent=2))
