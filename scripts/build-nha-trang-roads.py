"""Build UMMA's routing data from OpenStreetMap XML extracts covering the delivery zone."""
import gzip
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

SPEED = dict(motorway=55, motorway_link=35, trunk=45, trunk_link=30,
             primary=36, primary_link=25, secondary=30, secondary_link=23,
             tertiary=26, tertiary_link=20, residential=21, unclassified=21,
             living_street=12, service=12)
nodes, ways, relations = {}, {}, {}
for filename in sys.argv[1:]:
    for element in ET.parse(filename).getroot():
        if element.tag not in ('node', 'way', 'relation'):
            continue
        identifier = int(element.attrib['id'])
        if element.tag == 'node':
            nodes[identifier] = [round(float(element.attrib[key]) * 100000)
                                 for key in ('lat', 'lon')]
        elif element.tag in ('way', 'relation'):
            tags = {tag.attrib['k']: tag.attrib['v'] for tag in element.findall('tag')}
            if element.tag == 'way':
                ways[identifier] = (tags, [int(nd.attrib['ref']) for nd in element.findall('nd')])
            elif tags.get('type') == 'restriction':
                relations[identifier] = (tags, [member.attrib for member in element.findall('member')])

indexes, roads, names, name_indexes, used_ways = {}, [], [], {}, {}
for identifier, (tags, refs) in ways.items():
    kind = tags.get('highway')
    access = next((tags[k] for k in ('motorcycle', 'motor_vehicle', 'vehicle', 'access') if k in tags), '')
    if kind not in SPEED or access in ('no', 'private', 'destination', 'customers', 'delivery', 'agricultural', 'forestry'):
        continue
    if tags.get('service') in ('driveway', 'parking_aisle', 'drive-through') or any(ref not in nodes for ref in refs):
        continue
    if any(key.endswith(':conditional') and ('access' in key or 'vehicle' in key or 'motorcycle' in key or 'oneway' in key) for key in tags):
        continue
    oneway = tags.get('oneway:motorcycle', tags.get('oneway', ''))
    if oneway in ('reversible', 'alternating'):
        continue
    direction = -1 if oneway == '-1' else 1 if oneway in ('yes', '1', 'true') or (
        not oneway and (kind == 'motorway' or tags.get('junction') in ('roundabout', 'circular'))) else 0
    speed = SPEED[kind]
    if re.fullmatch(r'\d+', tags.get('maxspeed', '')):
        speed = min(speed, max(5, int(tags['maxspeed'])))
    if tags.get('surface') in ('unpaved', 'gravel', 'ground', 'dirt', 'sand'):
        speed = min(speed, 10)
    name = tags.get('name', '')
    if name not in name_indexes:
        name_indexes[name] = len(names)
        names.append(name)
    used_ways[identifier] = len(roads)
    roads.append([direction, speed, name_indexes[name], [indexes.setdefault(ref, len(indexes)) for ref in refs]])

restrictions = []
for tags, members in relations.values():
    if any(mode in re.split('[;, ]+', tags.get('except', '')) for mode in ('motorcycle', 'motor_vehicle', 'vehicle')):
        continue
    rule = tags.get('restriction:motorcycle', tags.get('restriction:motor_vehicle', tags.get('restriction', '')))
    incoming = [used_ways.get(int(m['ref'])) for m in members if m['role'] == 'from' and m['type'] == 'way']
    outgoing = [used_ways.get(int(m['ref'])) for m in members if m['role'] == 'to' and m['type'] == 'way']
    via = [m for m in members if m['role'] == 'via']
    if len(via) != 1 or via[0]['type'] != 'node' or not rule.startswith(('no_', 'only_')):
        continue
    junction = indexes.get(int(via[0]['ref']))
    if junction is not None:
        for first in incoming:
            for last in outgoing:
                if first is not None and (last is not None or rule.startswith('only_')):
                    restrictions.append([junction, first, last, rule])
data = dict(nodes=[nodes[i] for i in indexes], roads=roads, names=names, restrictions=restrictions)
encoded = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode()
Path('assets/maps/nha-trang-roads.json.gz').write_bytes(gzip.compress(encoded, mtime=0))
print(len(indexes), 'nodes;', len(roads), 'roads;', len(restrictions), 'turn restrictions')
