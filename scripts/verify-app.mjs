import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const read = (path) => readFileSync(path, "utf8");
const kitchen = read("js/cafe/kitchen.js");
const cafe = read("js/cafe/cafe.js");
const testMode = read("js/cafe/test-mode.js");
const productsAdmin = read("js/cafe/products-admin.js");
const staffAdmin = read("js/cafe/staff-admin.js");
const inventoryAdmin = read("js/cafe/inventory-admin.js");
const locationAdmin = read("js/admin/location-admin.js");
const courierRoute = read("js/maps/courier-route.js");
const html = read("index.html");

for (const [name, source] of [["kitchen.js", kitchen], ["cafe.js", cafe], ["test-mode.js", testMode], ["products-admin.js", productsAdmin], ["staff-admin.js", staffAdmin], ["inventory-admin.js", inventoryAdmin], ["location-admin.js", locationAdmin], ["courier-route.js", courierRoute]]) {
  new vm.Script(source, { filename: name });
  console.log("PASS syntax:", name);
}

assert.ok(kitchen.includes('action:"updateDelivery"'), "delivery request action missing");
for (const status of ["waiting_courier", "courier_assigned", "picked_up", "delivered"]) {
  assert.ok(kitchen.includes(status), `delivery status missing in kitchen.js: ${status}`);
}
console.log("PASS delivery request and supported statuses");
assert.match(kitchen, /orderStaffRole === "courier" && \["courier_assigned","picked_up"\]\.includes\(order\.delivery_status\)/, "courier delivery actions must be restricted to pickup and delivered transitions");
console.log("PASS courier delivery actions are limited to assigned/picked-up orders");

assert.ok(kitchen.includes('action:"updatePayment"'), "payment request action missing");
assert.match(kitchen, /can_accept_payments|canAcceptPayments/, "payment permission check missing");
console.log("PASS payment request and permission check");

assert.match(kitchen, /Последние подтверждённые оплаты|Принял:/, "payment ledger UI missing");
assert.match(html, /js\/cafe\/kitchen\.js\?v=\d+/, "kitchen script cache version missing");
assert.match(html, /js\/cafe\/test-mode\.js\?v=\d+/, "test-mode script cache version missing");
assert.ok(cafe.includes("navigator.geolocation.getCurrentPosition"), "nearest cafe geolocation missing");
assert.ok(cafe.includes("cafeLocationMode"), "manual/nearest cafe selection missing");
assert.ok(cafe.includes("locations.every"), "nearest cafe must require coordinates for every active cafe");
assert.ok(cafe.includes("locationId"), "selected cafe must be sent with the order");
assert.ok(cafe.includes("stockAvailable"), "customer menu must filter and cap quantities by available stock");
assert.ok(inventoryAdmin.includes('action:"save"'), "branch stock save action missing");
assert.ok(inventoryAdmin.includes('action:"createProduct"'), "branch product creation action missing");
assert.ok(html.includes("js/cafe/inventory-admin.js?v=2"), "inventory admin script reference missing");
console.log("PASS per-cafe stock filtering, product creation, prices and inventory editor");
assert.ok(locationAdmin.includes("locationAdminMap"), "interactive location map module missing");
assert.ok(locationAdmin.includes("location_manager") === false, "unexpected hardcoded branch mapping");
assert.ok(locationAdmin.includes("admin_upsert_location") === false, "location writes must be routed through secured edge function");
assert.ok(html.includes("leaflet.js") && html.includes("locationAdminMap"), "Leaflet location map not wired into app");
console.log("PASS dynamic location directory, map, and location admin UI");
assert.ok(kitchen.includes("data-show-route"), "delivery order map action missing");
assert.ok(courierRoute.includes("router.project-osrm.org"), "courier road routing service missing");
assert.ok(html.includes("js/maps/courier-route.js"), "courier route map script not loaded");
console.log("PASS courier route map and navigation fallback");
console.log("PASS customer nearest/manual cafe selection");
assert.ok(kitchen.includes("accepted_by_telegram_id"), "accepted order owner must be visible to staff");
assert.ok(kitchen.includes('action:"assignCourier"'), "courier assignment request missing");
assert.ok(kitchen.includes("data-courier-select"), "courier selector missing");
console.log("PASS courier assignment UI and request");
assert.ok(productsAdmin.includes('action:"save"'), "product create/update request missing");
assert.ok(productsAdmin.includes('action:"setActive"'), "product activate/deactivate request missing");
assert.ok(productsAdmin.includes("adminProductsButton"), "product catalog admin entry missing");
assert.ok(staffAdmin.includes('courier:"Курьер"'), "courier role label missing");
assert.match(html, /js\/cafe\/products-admin\.js\?v=\d+/, "product admin script reference missing");
console.log("PASS product catalog create/edit/deactivate UI and courier role");
console.log("PASS payment ledger and cache-busted script references");
console.log("NOTE: these are repository/static checks, not a live Telegram payment or delivery transaction.");

// Regression checks: complete staff checkout must appear together after the first item.
const appCss = read("css/app.css");
assert.match(html, /<div id="staffOrderSummary" class="cafe-cart" hidden>/, "empty order summary must start hidden");
assert.match(html, /<div id="staffOrderSummary"[\s\S]*?<form id="staffOrderForm"[\s\S]*?<\/form>\s*<\/div>/, "full checkout form must be inside the order summary");
for (const id of ["staffOrderCart","staffOrderTotal","staffOrderType","staffOrderCustomerName","staffOrderNote","staffPaymentTiming","staffOrderPayment","staffCashReceived","staffCashDue","staffCashChange","staffOrderSubmit"]) {
  assert.match(html, new RegExp('id="' + id + '"'), "checkout field missing: " + id);
}
assert.match(kitchen, /summary\.hidden=!items\.length/, "summary visibility must follow cart contents");
assert.match(appCss, /#staffOrderSummary\[hidden\]\s*\{\s*display:\s*none\s*!important/, "hidden order summary must override styles");
assert.ok(!html.includes('id="staffOrderCustomerPhone"'), "guest phone should stay removed");
assert.match(html, /js\/cafe\/kitchen\.js\?v=40/, "Telegram must load updated checkout JS");
assert.match(html, /css\/app\.css\?v=27/, "Telegram must load updated checkout CSS");
console.log("PASS full checkout fields, cart visibility, and Telegram cache invalidation");

assert.match(html, /id="staffClosedOrdersToggle"/, "closed orders tab missing");
assert.match(html, /id="staffClosedOrdersWrap" hidden/, "closed orders panel missing");
assert.match(kitchen, /function renderStaffClosedOrders\(\)/, "closed order rendering missing");
assert.match(kitchen, /\["completed","cancelled"\]\.includes\(o\.status\)/, "closed order status filter missing");
console.log("PASS closed order tab and statuses");

const kitchenLive=read("js/cafe/kitchen-live.js");
new vm.Script(kitchenLive,{filename:"kitchen-live.js"});
assert.match(html,/js\/cafe\/kitchen-live\.js\?v=1/,"kitchen live module missing");
assert.match(kitchen,/ummaKitchenLive\?\.update\(orders\)/,"kitchen list must update alerts");
assert.match(kitchen,/ummaKitchenLive\?\.start\(\)/,"kitchen must start polling");
assert.match(kitchenLive,/data-kitchen-ack/,"new dishes need explicit acknowledgement");
assert.match(kitchenLive,/10000/,"kitchen must poll for new orders");
assert.match(html,/id="kitchenTabletToggle"/,"kitchen tablet mode missing");
console.log("PASS kitchen add-on detection, tablet mode, polling and acknowledgement");
