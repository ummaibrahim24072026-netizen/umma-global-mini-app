import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('staff.html', 'utf8');
const parser = 'js/maps/delivery-location.js';
const courier = 'js/maps/courier-route.js';
assert.ok(html.includes(parser) && html.indexOf(parser) < html.indexOf(courier));
const dom = new JSDOM(html, {url: 'https://synthetic-qa.invalid/staff.html', runScripts: 'outside-only'});
const {window: w} = dom;
const d = w.document;
const $ = id => d.getElementById(id);
const tick = () => new Promise(resolve => setImmediate(resolve));
let fix, denied, stopped = 0, path, visible, position, rejectRoute = false;
const calls = [];
class Map {
 getBounds() { return {contains: () => true}; }
 fitBounds() {}
}
class Marker {
 setMap() {}
 setPosition(point) { position = point; }
 setVisible() {}
}
class Polyline {
 setPath(points) { path = points; }
 setVisible(value) { visible = value; }
 setMap() {}
}
const Route = {async computeRoutes(request) {
 calls.push(request);
 if (rejectRoute) throw Error('no route');
 return {routes: [{path: [request.origin, {lat: 12.29, lng: 109.21}], durationMillis: 360000,
  distanceMeters: 1800, legs: [{steps: [{instructions: 'Поверните направо'}]}]}]};
}};
Object.defineProperty(w.navigator, 'geolocation', {value: {
 watchPosition(success, failure) { fix = success; denied = failure; return 0; },
 clearWatch() { stopped++; }
}});
try {
 w.eval(readFileSync(parser, 'utf8'));
 w.eval(readFileSync(courier, 'utf8'));
 const button = d.createElement('button');
 button.dataset.showRoute = 'true';
 button.dataset.routeOrderNumber = '42';
 button.dataset.routeAddress = 'Квартира 7\nТочка доставки: 12.28,109.22';
 d.body.append(button);
 button.click();
 await tick();
 assert.match($('courierMapMessage').textContent, /ключ/);
 assert.equal(d.querySelector('#courierMapModal a'), null);
 w.google = {maps: {Polyline, SymbolPath: {CIRCLE: 0}, importLibrary: async () => ({Map, Marker, Route})}};
 button.click();
 await tick();
 assert.equal($('courierMapModal').hidden, false);
 fix({coords: {latitude: 12.24, longitude: 109.2, accuracy: 12}, timestamp: Date.now()});
 await tick();
 assert.equal(calls[0].destination.lat, 12.28);
 assert.equal(calls[0].travelMode, 'TWO_WHEELER');
 assert.equal(path.length, 2);
 assert.equal(visible, true);
 assert.match($('courierMapMessage').textContent, /6 мин/);
 assert.equal($('courierRouteSteps').textContent, 'Поверните направо');
 fix({coords: {latitude: 12.25, longitude: 109.2, accuracy: 12}, timestamp: Date.now()});
 assert.equal(position.lat, 12.25);
 rejectRoute = true;
 $('courierRouteRefresh').click();
 await tick();
 assert.equal(calls.length, 2);
 assert.equal(visible, false);
 assert.match($('courierMapMessage').textContent, /не построил/);
 denied({code: 1});
 assert.match($('courierMapMessage').textContent, /Разрешите геолокацию/);
 w.UmmaCourierMap.close();
 assert.equal(stopped, 1);
 assert.equal($('courierMapModal').hidden, true);
 button.dataset.routeAddress = 'Legacy Street';
 button.click();
 await tick();
 fix({coords: {latitude: 12.24, longitude: 109.2, accuracy: 12}, timestamp: Date.now()});
 await tick();
 assert.equal(calls.at(-1).destination, 'Legacy Street, Vietnam');
 w.UmmaCourierMap.close();
 console.log('PASS web courier Google Maps: pickup/drop-off parsing, road route, ETA, directions, GPS movement, errors and cleanup');
} finally { w.close(); }
