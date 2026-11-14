/* Local motorcycle routing over the UMMA OpenStreetMap extract. */
(() => {
 'use strict';
 const asset = new URL('../../assets/maps/nha-trang-roads.json.gz?v=1', document.currentScript.src);
 let graph;
 const distance = (a, b) => Math.hypot((a.lat-b.lat)*111195, (a.lng-b.lng)*108700);
 function projection(point, a, b) {
  const x = (b.lng-a.lng)*108700, y = (b.lat-a.lat)*111195;
  const t = Math.max(0, Math.min(1, (((point.lng-a.lng)*108700*x+(point.lat-a.lat)*111195*y)/(x*x+y*y)) || 0));
  const snapped = {lat:a.lat+(b.lat-a.lat)*t, lng:a.lng+(b.lng-a.lng)*t};
  return {t, point:snapped, gap:distance(point,snapped)};
 }
 function build({nodes, roads, names, restrictions}) {
  const points = nodes.map(([lat,lng]) => ({lat:lat/100000,lng:lng/100000}));
  const edges = points.map(() => []), segments = [], turns = new Map();
  roads.forEach(([direction,speed,name,ids], road) => {
   for (let i=1; i<ids.length; i++) {
    const a=ids[i-1], b=ids[i];
    const meters=distance(points[a],points[b]);
    const segment={a,b,road,name:names[name],direction,meters,seconds:meters*3.6/speed};
    segments.push(segment);
    if (direction>=0) edges[a].push({to:b,...segment});
    if (direction<=0) edges[b].push({to:a,...segment});
   }
  });
  for (const [node,from,to,rule] of restrictions) {
   const key=node+':'+from;
   if (!turns.has(key)) turns.set(key,[]);
   turns.get(key).push({to,rule});
  }
  return {points,edges,segments,turns};
 }
 function nearest(graph, point) {
  let best;
  for (const segment of graph.segments) {
   const candidate=projection(point,graph.points[segment.a],graph.points[segment.b]);
   if (!best || candidate.gap<best.gap) best={...candidate,segment};
  }
  return best?.gap<=130?best:null;
 }
 function push(heap, item) {
  let i=heap.length;
  heap.push(item);
  while(i>0){
   const p=(i-1)>>1;
   if(heap[p].rank<=item.rank)break;
   heap[i]=heap[p];i=p;
  }
  heap[i]=item;
 }
 function pop(heap) {
  const first=heap[0], tail=heap.pop();
  if(!heap.length)return first;
  let i=0;
  while(i*2+1<heap.length){
   let next=i*2+1;
   if(next+1<heap.length&&heap[next+1].rank<heap[next].rank)next++;
   if(heap[next].rank>=tail.rank)break;
   heap[i]=heap[next];i=next;
  }
  heap[i]=tail;
  return first;
 }
 function route(g, origin, destination) {
  const start=nearest(g,origin), end=nearest(g,destination);
  if(!start||!end)return null;
  const {points,edges,turns}=g, first=start.segment, last=end.segment;
  const heap=[], visited=new Map();
  let result;
  function offer(node, road, previous, edge, fraction){
   const seconds=(previous?.seconds||0)+edge.seconds*fraction;
   const meters=(previous?.meters||0)+edge.meters*fraction;
   if(node===-1){
    if(!result||seconds<result.seconds)result={node,previous,edge,seconds,meters};
    return;
   }
   const key=node+':'+road+':'+(previous?.node??-1);
   if((visited.get(key)??Infinity)<=seconds)return;
   visited.set(key,seconds);
   push(heap,{key,node,road,previous,edge,seconds,meters,rank:seconds+distance(points[node],end.point)*3.6/55});
  }
  if(first===last && (first.direction===0||(end.t-start.t)*first.direction>=0)) {
   offer(-1,first.road,null,first,Math.abs(end.t-start.t));
  }
  if(start.t===0||first.direction<=0)offer(first.a,start.t===0?-1:first.road,null,first,start.t);
  if(start.t===1||first.direction>=0)offer(first.b,start.t===1?-1:first.road,null,first,1-start.t);
  function allowed(current,edge){
   return (turns.get(current.node+':'+current.road)||[]).every(({to,rule})=>{
    if(rule.startsWith('only_'))return edge.road===to;
    if(rule==='no_u_turn'&&to===current.road)return edge.road!==to||edge.to!==current.previous?.node;
    return edge.road!==to;
   });
  }
  while(heap.length){
   const current=pop(heap);
   if(result&&current.rank>=result.seconds)break;
   if(current.seconds!==visited.get(current.key))continue;
   if(current.node===last.a&&(end.t===0||(last.direction>=0&&allowed(current,{...last,to:last.b}))))offer(-1,last.road,current,last,end.t);
   if(current.node===last.b&&(end.t===1||(last.direction<=0&&allowed(current,{...last,to:last.a}))))offer(-1,last.road,current,last,1-end.t);
   for(const edge of edges[current.node]){
    if(allowed(current,edge))offer(edge.to,edge.road,current,edge,1);
   }
  }
  if(!result)return null;
  const path=[end.point], steps=[];
  for(let item=result;item;item=item.previous){
   if(item.node!==-1)path.push(points[item.node]);
   if(item.edge.name&&steps.at(-1)!==item.edge.name)steps.push(item.edge.name);
  }
  path.push(start.point);
  return {path:path.reverse(),streets:steps.reverse(),meters:result.meters,seconds:result.seconds,
   startGap:start.gap,endGap:end.gap};
 }
 window.UmmaNhaTrangRouter={
  async route(from,to){
   graph ??= fetch(asset).then(response=>{
    if(!response.ok)throw Error('Road data unavailable');
    return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
   }).then(build).catch(error=>{graph=null;throw error;});
   return route(await graph,from,to);
  }
 };
})();
