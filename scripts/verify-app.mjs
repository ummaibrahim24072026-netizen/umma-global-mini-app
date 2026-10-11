import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const read = (path) => readFileSync(path, "utf8");
const kitchen = read("js/cafe/kitchen.js");
const testMode = read("js/cafe/test-mode.js");
const productsAdmin = read("js/cafe/products-admin.js");
const staffAdmin = read("js/cafe/staff-admin.js");
const html = read("index.html");

for (const [name, source] of [["kitchen.js", kitchen], ["test-mode.js", testMode], ["products-admin.js", productsAdmin], ["staff-admin.js", staffAdmin]]) {
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
