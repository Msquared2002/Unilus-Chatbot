"""Refresh local Silverest GIS data from a complete OSM XML export.

Usage: python scripts/updateCampusOsm.py path/to/export.osm
Application place IDs and search metadata live in campus_place_catalog.json.
No runtime service reads this importer or the OSM export.
"""

import argparse
import hashlib
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

DATA = Path(__file__).resolve().parents[1] / "data" / "campus"
BOUNDARY_ID = "1558103619"
PHYSICAL_TAGS = {"building", "amenity", "leisure", "sport", "office", "shop", "tourism", "healthcare"}


def tags(element):
    return {tag.attrib["k"]: tag.attrib["v"] for tag in element.findall("tag")}


def on_segment(point, a, b, tolerance=1e-10):
    cross = (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0])
    return abs(cross) <= tolerance and min(a[0], b[0]) - tolerance <= point[0] <= max(a[0], b[0]) + tolerance and min(a[1], b[1]) - tolerance <= point[1] <= max(a[1], b[1]) + tolerance


def contains(point, ring):
    inside = False
    x, y = point
    for a, b in zip(ring, ring[1:]):
        if on_segment(point, a, b):
            return True
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            inside = not inside
    return inside


def signed_area(ring):
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:])) / 2


def orientation(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def intersects(a, b, c, d):
    return orientation(a, b, c) * orientation(a, b, d) < -1e-20 and orientation(c, d, a) * orientation(c, d, b) < -1e-20


def validate_ring(ring, label):
    if len(ring) < 4 or ring[0] != ring[-1] or abs(signed_area(ring)) < 1e-12:
        raise ValueError(f"Invalid closed polygon: {label}")
    edges = list(zip(ring, ring[1:]))
    for i, (a, b) in enumerate(edges):
        if a == b:
            raise ValueError(f"Zero-length polygon edge: {label}")
        for j, (c, d) in enumerate(edges):
            if j <= i + 1 or (i == 0 and j == len(edges) - 1):
                continue
            if intersects(a, b, c, d):
                raise ValueError(f"Self-intersecting polygon: {label}")


def representative(ring):
    area = signed_area(ring)
    x = sum((a[0] + b[0]) * (a[0] * b[1] - b[0] * a[1]) for a, b in zip(ring, ring[1:])) / (6 * area)
    y = sum((a[1] + b[1]) * (a[0] * b[1] - b[0] * a[1]) for a, b in zip(ring, ring[1:])) / (6 * area)
    return [x, y]


def assemble_rings(segments, label):
    pending = [list(segment) for segment in segments]
    rings = []
    while pending:
        current = pending.pop(0)
        while current[0] != current[-1]:
            for i, segment in enumerate(pending):
                if current[-1] == segment[0]:
                    current.extend(segment[1:]); pending.pop(i); break
                if current[-1] == segment[-1]:
                    current.extend(list(reversed(segment))[1:]); pending.pop(i); break
            else:
                raise ValueError(f"Incomplete multipolygon: {label}")
        rings.append(current)
    return rings


def build_geometry(element, kind, ways, nodes):
    ref = f"{kind}/{element.attrib['id']}"
    if kind == "way":
        ids = [n.attrib["ref"] for n in element.findall("nd")]
        if len(ids) < 4 or ids[0] != ids[-1] or any(n not in nodes for n in ids):
            raise ValueError(f"Incomplete or open way: {ref}")
        ring = [nodes[n] for n in ids]
        validate_ring(ring, ref)
        return {"type": "Polygon", "coordinates": [ring]}
    if tags(element).get("type") != "multipolygon":
        raise ValueError(f"Unsupported relation: {ref}")
    groups = {"outer": [], "inner": []}
    for member in element.findall("member"):
        role = member.attrib.get("role")
        if member.attrib.get("type") != "way" or role not in groups:
            continue
        way = ways.get(member.attrib["ref"])
        if way is None:
            raise ValueError(f"Missing member way in {ref}")
        ids = [n.attrib["ref"] for n in way.findall("nd")]
        if any(n not in nodes for n in ids):
            raise ValueError(f"Missing member node in {ref}")
        groups[role].append(ids)
    outer = assemble_rings(groups["outer"], ref)
    inner = assemble_rings(groups["inner"], ref) if groups["inner"] else []
    polygons = []
    for ids in outer:
        ring = [nodes[n] for n in ids]
        validate_ring(ring, ref)
        polygons.append([ring])
    for ids in inner:
        ring = [nodes[n] for n in ids]
        validate_ring(ring, ref)
        holders = [poly for poly in polygons if contains(representative(ring), poly[0])]
        if len(holders) != 1:
            raise ValueError(f"Ambiguous multipolygon hole: {ref}")
        holders[0].append(ring)
    if not polygons:
        raise ValueError(f"No outer ring: {ref}")
    return {"type": "MultiPolygon", "coordinates": polygons} if len(polygons) > 1 else {"type": "Polygon", "coordinates": polygons[0]}


def outer_rings(geometry):
    if geometry["type"] == "Point":
        return []
    return [geometry["coordinates"][0]] if geometry["type"] == "Polygon" else [poly[0] for poly in geometry["coordinates"]]


def location(geometry):
    if geometry["type"] == "Point":
        return {"lat": geometry["coordinates"][1], "lng": geometry["coordinates"][0]}
    ring = max(outer_rings(geometry), key=lambda r: abs(signed_area(r)))
    point = representative(ring)
    holes = geometry["coordinates"][1:] if geometry["type"] == "Polygon" else []
    if not contains(point, ring) or any(contains(point, hole) for hole in holes):
        point = ring[0]
    return {"lat": round(point[1], 7), "lng": round(point[0], 7)}


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def import_osm(source, output_dir=DATA, dry_run=False):
    root = ET.parse(source).getroot()
    nodes = {n.attrib["id"]: [float(n.attrib["lon"]), float(n.attrib["lat"])] for n in root.findall("node")}
    ways = {w.attrib["id"]: w for w in root.findall("way")}
    relations = {r.attrib["id"]: r for r in root.findall("relation")}
    if BOUNDARY_ID not in ways:
        raise ValueError(f"Campus boundary way {BOUNDARY_ID} is absent")
    boundary_way = ways[BOUNDARY_ID]
    if tags(boundary_way).get("name") != "University of Lusaka Silverest Campus":
        raise ValueError("Campus boundary name does not match the expected Silverest campus")
    boundary_geometry = build_geometry(boundary_way, "way", ways, nodes)
    boundary_ring = boundary_geometry["coordinates"][0]
    catalog = load(output_dir / "campus_place_catalog.json")["places"]
    previous_places = load(output_dir / "campus_places.json").get("places", [])
    previous_buildings = load(output_dir / "campus_buildings.json").get("buildings", [])
    sha = hashlib.sha256(source.read_bytes()).hexdigest()
    provenance = {"file": source.name, "sha256": sha, "boundaryOsmRef": f"way/{BOUNDARY_ID}"}
    boundary = {"name": tags(boundary_way)["name"], "category": "campus_boundary",
                "description": "University of Lusaka Silverest Campus boundary",
                "operator": tags(boundary_way).get("operator"), "website": tags(boundary_way).get("website"),
                "coordinates": location(boundary_geometry), "geometry": boundary_geometry,
                "osm_ref": f"way/{BOUNDARY_ID}", "tags": tags(boundary_way), "source": provenance}
    objects = {}
    for id, node in ((n.attrib["id"], n) for n in root.findall("node")):
        t = tags(node)
        if not (PHYSICAL_TAGS & t.keys()):
            continue
        point = nodes[id]
        if contains(point, boundary_ring):
            ref = f"node/{id}"
            geometry = {"type": "Point", "coordinates": point}
            objects[ref] = {"osm_ref": ref, "name": t.get("name"), "coordinates": location(geometry),
                            "geometry": geometry, "tags": t}
    for kind, elements in (("way", ways), ("relation", relations)):
        for id, element in elements.items():
            ref = f"{kind}/{id}"
            if ref == f"way/{BOUNDARY_ID}":
                continue
            t = tags(element)
            if not (PHYSICAL_TAGS & t.keys()) or (kind == "relation" and t.get("type") != "multipolygon"):
                continue
            if kind == "way" and (not element.findall("nd") or element.findall("nd")[0].attrib["ref"] != element.findall("nd")[-1].attrib["ref"]):
                continue  # service roads and other line features are not physical polygons
            geometry = build_geometry(element, kind, ways, nodes)
            if all(contains(point, boundary_ring) for ring in outer_rings(geometry) for point in ring):
                objects[ref] = {"osm_ref": ref, "name": t.get("name"), "coordinates": location(geometry),
                                "geometry": geometry, "tags": t}

    places = []
    seen_ids = set()
    used_refs = set()
    for entry in catalog:
        id, ref = entry["id"], entry["osm_ref"]
        if id in seen_ids or ref in used_refs:
            raise ValueError(f"Duplicate canonical ID or OSM reference: {id} {ref}")
        seen_ids.add(id); used_refs.add(ref)
        obj = objects.get(ref)
        if obj is None:
            raise ValueError(f"Canonical place {id} has missing/outside OSM object {ref}; reconcile manually")
        aliases = list(dict.fromkeys([*entry.get("search_aliases", []), entry["name"], obj["name"] or "", entry["category"]]))
        aliases = [a for a in aliases if a]
        places.append({"id": id, "osm_ref": ref, "name": entry["name"], "category": entry["category"],
                       "description": entry.get("description", ""), "coordinates": obj["coordinates"],
                       "geometry": obj["geometry"], "search_aliases": aliases, "tags": obj["tags"],
                       "source": {"osm": {"type": ref.split("/")[0], "id": ref.split("/")[1]}, "export": provenance}})

    buildings = []
    for ref, obj in sorted(objects.items()):
        buildings.append({"id": "osm_" + ref.replace("/", "_"), **obj,
                          "category": "building" if "building" in obj["tags"] else "facility",
                          "source": {"osm": {"type": ref.split("/")[0], "id": ref.split("/")[1]}, "export": provenance}})
    search_index = {}; aliases = {}; lookup = {}
    for place in places:
        ref = place["osm_ref"]
        aliases[ref] = place["search_aliases"]
        lookup[ref] = place["id"]
        terms = [*place["search_aliases"], place["id"].replace("_", " "), place["category"]]
        for term in terms:
            key = " ".join(term.lower().split())
            if key and key not in search_index:
                search_index[key] = ref
    if len(places) != len(catalog) or len(buildings) != len(set(b["osm_ref"] for b in buildings)):
        raise ValueError("Output count/uniqueness validation failed")
    geometries = [json.dumps(b["geometry"], sort_keys=True) for b in buildings]
    if len(geometries) != len(set(geometries)):
        raise ValueError("Duplicate physical geometry detected")
    presentation_path = output_dir.parents[2] / "dummy environment" / "chatbot-widget" / "campus-data" / "presentation.json"
    if presentation_path.exists():
        presentation_ids = set(load(presentation_path)["silverest"]["places"])
        if presentation_ids != seen_ids:
            raise ValueError(f"Presentation IDs differ from canonical IDs: {sorted(presentation_ids ^ seen_ids)}")
    old_place_refs = {p["osm_ref"] for p in previous_places}
    old_building_refs = {b["osm_ref"] for b in previous_buildings}
    new_building_refs = set(objects)
    summary = {"oldPlaces": len(previous_places), "newPlaces": len(places),
               "oldGeometry": len(previous_buildings), "newGeometry": len(buildings),
               "addedGeometryRefs": sorted(new_building_refs - old_building_refs),
               "removedGeometryRefs": sorted(old_building_refs - new_building_refs),
               "missingOldPlaceRefs": sorted(old_place_refs - set(objects)),
               "newNames": {p["id"]: p["name"] for p in places}}
    if not dry_run:
        write(output_dir / "campus_boundary.json", boundary)
        write(output_dir / "campus_places.json", {"source": provenance, "places": places})
        write(output_dir / "campus_buildings.json", {"source": provenance, "buildings": buildings})
        write(output_dir / "campus_search_index.json", {"search_index": search_index, "aliases": aliases,
                                                         "place_id_lookup": lookup})
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="local .osm XML export")
    parser.add_argument("--dry-run", action="store_true", help="validate and show changes without writing")
    args = parser.parse_args()
    try:
        print(json.dumps(import_osm(args.source, dry_run=args.dry_run), indent=2))
    except (OSError, ValueError, ET.ParseError) as error:
        print(f"Campus import failed: {error}", file=sys.stderr)
        sys.exit(1)
