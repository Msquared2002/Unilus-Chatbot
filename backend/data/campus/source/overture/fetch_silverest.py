"""Fetch Overture segment features intersecting the requested Silverest bbox."""
import json
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(tempfile.gettempdir()) / "silverest_overture_lib"))
import duckdb
from shapely import wkb
from shapely.geometry import mapping

HERE = pathlib.Path(__file__).resolve().parent
con = duckdb.connect()
con.execute("SET extension_directory='" + str(pathlib.Path(tempfile.gettempdir()) / "silverest_duckdb_ext").replace("\\", "/") + "'")
con.execute("LOAD httpfs")
con.execute("SET enable_curl_server_cert_verification=false")
con.execute("SET s3_region='us-west-2'")
con.execute("SET threads=4")
url = "s3://overturemaps-us-west-2/release/2026-09-23.1/theme=transportation/type=segment/*"
sql = """SELECT * FROM read_parquet(?)
WHERE bbox.xmin <= 28.471409 AND bbox.xmax >= 28.466848
  AND bbox.ymin <= -15.352995 AND bbox.ymax >= -15.357015"""
rows = con.execute(sql, [url]).fetchall()
columns = [x[0] for x in con.description]
features = []
for row in rows:
    props = dict(zip(columns, row))
    geom = mapping(wkb.loads(props.pop("geometry")))
    features.append({"type": "Feature", "geometry": geom, "properties": props})
out = HERE / "silverest_overture_transportation.geojson"
out.write_text(json.dumps({"type": "FeatureCollection", "features": features}, default=str), encoding="utf-8")
print("release=2026-09-23.1", "segments=", len(features), "columns=", columns, "file=", out)
