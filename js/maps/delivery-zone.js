/* Delivery polygons use [latitude, longitude], without a repeated closing vertex. */
(() => {
  'use strict';
  const point = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;
  function contains(zone, p) {
    if (!point(p) || !Array.isArray(zone) || zone.length < 3 || !zone.every(point)) return false;
    const [y,x] = p;
    let inside = false;
    for (let i=0,j=zone.length-1;i<zone.length;j=i++) {
      const [ay,ax]=zone[j], [by,bx]=zone[i];
      const cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
      if (Math.abs(cross)<=1e-10 && x>=Math.min(ax,bx)-1e-10 && x<=Math.max(ax,bx)+1e-10 && y>=Math.min(ay,by)-1e-10 && y<=Math.max(ay,by)+1e-10) return true;
      if ((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside;
    }
    return inside;
  }
  window.ummaDeliveryZone = Object.freeze({contains});
})();
