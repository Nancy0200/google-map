import json
import math

with open('route_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

steps = data['routes'][0]['legs'][0]['steps']

points = []
dist_accum = 0
R = 6371.0

def haversine(lat1, lon1, lat2, lon2):
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

for step in steps:
    name = step.get('name', '無名道路')
    if not name: name = '無名道路'
    coords = step['geometry']['coordinates']
    for i in range(len(coords)):
        lng, lat = coords[i]
        if len(points) > 0:
            dist_accum += haversine(points[-1]['lat'], points[-1]['lng'], lat, lng)
        points.append({
            'lat': lat,
            'lng': lng,
            'road': name,
            'dist': round(dist_accum, 3),
            'km': math.floor(dist_accum)
        })

cleaned = [points[0]]
for p in points[1:]:
    if p['lat'] != cleaned[-1]['lat'] or p['lng'] != cleaned[-1]['lng']:
        cleaned.append(p)

with open('real_route.js', 'w', encoding='utf-8') as f:
    f.write("const REAL_ROUTE = " + json.dumps(cleaned, ensure_ascii=False) + ";")
