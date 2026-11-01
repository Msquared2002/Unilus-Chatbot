"""Fixture tests for the offline OSM importer."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "updateCampusOsm.py"
spec = importlib.util.spec_from_file_location("campus_import", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

BOUNDARY = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]
BUILDING = {"type": "Polygon", "coordinates": [[[0.4, 0.4], [0.6, 0.4],
                                                    [0.6, 0.6], [0.4, 0.6], [0.4, 0.4]]]}
PLACES = [{"id": "library", "osm_ref": "way/20", "geometry": BUILDING}]


def fixture(extra):
    xml = '<osm version="0.6">' + extra + '</osm>'
    root = ET.fromstring(xml)
    nodes = {n.attrib['id']: [float(n.attrib['lon']), float(n.attrib['lat'])]
             for n in root.findall('node')}
    ways = {w.attrib['id']: w for w in root.findall('way')}
    return root, nodes, ways


class PedestrianImportTests(unittest.TestCase):
    def test_pedestrian_classes_and_metadata(self):
        nodes = ''.join(f'<node id="{i}" lon="{0.1 + i * 0.01}" lat="0.2" />' for i in range(1, 10))
        ways = ''.join(f'<way id="{i}"><nd ref="{i}"/><nd ref="{i+1}"/>'
                       f'<tag k="highway" v="{kind}"/><tag k="surface" v="paved"/></way>'
                       for i, kind in enumerate(('footway', 'path', 'pedestrian', 'steps'), 1))
        root, points, lines = fixture(nodes + ways)
        geo, access, warnings = mod.import_pedestrian_and_access(root, points, lines, BOUNDARY, [], {})
        self.assertEqual([f['properties']['kind'] for f in geo['features']],
                         ['footway', 'path', 'pedestrian', 'steps'])
        self.assertEqual(geo['features'][0]['properties']['osm_tags']['surface'], 'paved')
        self.assertEqual(geo['features'][0]['properties']['node_ids'], ['1', '2'])
        self.assertEqual(access['access_points'], [])
        self.assertEqual(warnings, [])

    def test_crossing_and_sidewalk(self):
        root, points, lines = fixture('''<node id="1" lon="0.1" lat="0.2"/>
          <node id="2" lon="0.2" lat="0.2"/>
          <way id="1"><nd ref="1"/><nd ref="2"/><tag k="highway" v="footway"/>
          <tag k="footway" v="crossing"/></way>
          <way id="2"><nd ref="2"/><nd ref="1"/><tag k="highway" v="footway"/>
          <tag k="footway" v="sidewalk"/></way>''')
        geo, _, _ = mod.import_pedestrian_and_access(root, points, lines, BOUNDARY, [], {})
        self.assertEqual([f['properties']['kind'] for f in geo['features']], ['crossing', 'footway'])

    def test_main_preference_multiple_entrances_and_gate(self):
        root, points, lines = fixture('''<node id="1" lon="0.4" lat="0.5"><tag k="entrance" v="yes"/></node>
          <node id="2" lon="0.6" lat="0.5"><tag k="entrance" v="main"/><tag k="wheelchair" v="yes"/></node>
          <node id="3" lon="0.5" lat="0.4"><tag k="barrier" v="gate"/></node>''')
        _, access, warnings = mod.import_pedestrian_and_access(root, points, lines, BOUNDARY, PLACES, {})
        self.assertEqual(len(access['access_points']), 3)
        self.assertEqual([a['id'] for a in access['access_points'] if a['primary']], ['osm_node_2'])
        self.assertEqual(access['access_points'][1]['osm_tags']['wheelchair'], 'yes')
        self.assertEqual(access['access_points'][2]['barrier'], 'gate')
        self.assertEqual(warnings, [])

    def test_unassociated_node_has_no_nearest_building_fallback(self):
        root, points, lines = fixture('''<node id="1" lon="0.7" lat="0.7">
          <tag k="entrance" v="yes"/></node>''')
        _, access, warnings = mod.import_pedestrian_and_access(root, points, lines, BOUNDARY, PLACES, {})
        self.assertEqual(access['access_points'], [])
        self.assertTrue(any('Unassociated' in w for w in warnings))

    def test_outside_path_is_not_imported(self):
        root, points, lines = fixture('''<node id="1" lon="0.5" lat="0.5"/>
          <node id="2" lon="1.2" lat="0.5"/>
          <way id="1"><nd ref="1"/><nd ref="2"/><tag k="highway" v="path"/></way>''')
        geo, _, warnings = mod.import_pedestrian_and_access(root, points, lines, BOUNDARY, [], {})
        self.assertEqual(geo['features'], [])
        self.assertTrue(any('outside campus' in w for w in warnings))

    def test_foot_access_restriction_is_retained(self):
        root, points, lines = fixture('''<node id="1" lon="0.1" lat="0.2"/>
          <node id="2" lon="0.2" lat="0.2"/>
          <way id="1"><nd ref="1"/><nd ref="2"/><tag k="highway" v="footway"/>
          <tag k="foot" v="no"/></way>''')
        geo, _, _ = mod.import_pedestrian_and_access(root, points, lines, BOUNDARY, [], {})
        self.assertEqual(geo['features'][0]['properties']['osm_tags']['foot'], 'no')
        self.assertFalse(geo['features'][0]['properties']['pedestrian_allowed'])

    def test_complete_import_preserves_canonical_id(self):
        xml = '''<osm version="0.6">
          <node id="1" lon="0" lat="0"/><node id="2" lon="1" lat="0"/>
          <node id="3" lon="1" lat="1"/><node id="4" lon="0" lat="1"/>
          <node id="5" lon="0.4" lat="0.4"/><node id="6" lon="0.6" lat="0.4"/>
          <node id="7" lon="0.6" lat="0.6"/><node id="8" lon="0.4" lat="0.6"/>
          <way id="1558103619"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/>
            <tag k="name" v="University of Lusaka Silverest Campus"/></way>
          <way id="20"><nd ref="5"/><nd ref="6"/><nd ref="7"/><nd ref="8"/><nd ref="5"/>
            <tag k="building" v="yes"/></way></osm>'''
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            source = folder / 'campus.osm'
            source.write_text(xml)
            (folder / 'campus_place_catalog.json').write_text(json.dumps({'places': [
                {'id': 'library', 'osm_ref': 'way/20', 'name': 'Library', 'category': 'academic'}]}))
            (folder / 'campus_places.json').write_text(json.dumps({'places': []}))
            (folder / 'campus_buildings.json').write_text(json.dumps({'buildings': []}))
            result = mod.import_osm(source, output_dir=folder, dry_run=True)
            self.assertEqual(result['newPlaces'], 1)
            self.assertEqual(result['newNames']['library'], 'Library')
            mod.import_osm(source, output_dir=folder)
            self.assertEqual(json.loads((folder / 'campus_places.json').read_text())['places'][0]['id'], 'library')
            self.assertEqual(json.loads((folder / 'campus_osm_pedestrian.geojson').read_text())['features'], [])
            self.assertTrue((folder / 'source' / 'silverest_latest.osm').exists())


if __name__ == '__main__':
    unittest.main()
