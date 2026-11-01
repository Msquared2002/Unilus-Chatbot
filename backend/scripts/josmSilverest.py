"""Local JOSM Remote Control helper for reviewed Silverest mapping.

JOSM must be running with Remote Control enabled. No command uploads to OSM.
"""
import argparse
from pathlib import Path
import sys
from urllib.parse import urlencode
from urllib.request import urlopen

BASE = "http://127.0.0.1:8111"
BBOX = {"left": "28.466848", "right": "28.471409",
        "bottom": "-15.357015", "top": "-15.352995"}


def request(command, params=None):
    url = BASE + "/" + command + ("?" + urlencode(params) if params else "")
    with urlopen(url, timeout=15) as response:
        return response.read()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("status", "load", "zoom"):
        commands.add_parser(name)
    for name in ("open", "review", "export"):
        cmd = commands.add_parser(name)
        cmd.add_argument("file", type=Path)
    new_node = commands.add_parser("add-node")
    new_node.add_argument("lat", type=float)
    new_node.add_argument("lon", type=float)
    new_node.add_argument("--tag", action="append", default=[])
    new_node.add_argument("--new-objects-enabled", action="store_true")
    new_way = commands.add_parser("add-way")
    new_way.add_argument("points", help="lat,lon;lat,lon;...")
    new_way.add_argument("--tag", action="append", default=[])
    new_way.add_argument("--new-objects-enabled", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "status":
            print(request("version").decode())
        elif args.command == "load":
            request("load_and_zoom", BBOX)
            print("Silverest loaded and zoomed in JOSM")
        elif args.command == "zoom":
            request("zoom", BBOX)
            print("JOSM zoomed to Silverest")
        elif args.command == "open":
            request("open_file", {"filename": str(args.file.resolve())})
            print("Opened local OSM file in JOSM")
        elif args.command == "review":
            data = args.file.read_text(encoding="utf-8")
            if "<osm" not in data:
                raise ValueError("Prepared review file must be OSM XML")
            request("load_data", {"new_layer": "true", "layer_name": "Silverest review",
                                  "data": data})
            print("Loaded prepared geometry into a JOSM review layer")
        elif args.command == "export":
            data = request("export")
            if not data.strip() or b"<osm" not in data:
                raise ValueError("JOSM returned no active OSM layer; check Remote Control export permission")
            args.file.parent.mkdir(parents=True, exist_ok=True)
            args.file.write_bytes(data)
            print(f"Exported active JOSM layer to {args.file.resolve()}")
        elif args.command in {"add-node", "add-way"}:
            if not args.new_objects_enabled:
                raise ValueError("JOSM requires its 'Create new objects' Remote Control permission. "
                                 "Enable it in JOSM, review the geometry, then pass --new-objects-enabled")
            if any("=" not in tag or "|" in tag for tag in args.tag):
                raise ValueError("Tags must be key=value and cannot contain '|'")
            params = {"addtags": "|".join(args.tag)} if args.tag else {}
            if args.command == "add-node":
                params.update({"lat": args.lat, "lon": args.lon})
                request("add_node", params)
            else:
                points = [pair.split(",") for pair in args.points.split(";")]
                if len(points) < 2 or any(len(pair) != 2 for pair in points):
                    raise ValueError("Way needs at least two lat,lon pairs")
                for pair in points:
                    float(pair[0]); float(pair[1])
                params["way"] = args.points
                request("add_way", params)
            print("Created object in JOSM for human review; nothing was uploaded")
    except (OSError, ValueError) as error:
        print(f"JOSM helper failed: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
