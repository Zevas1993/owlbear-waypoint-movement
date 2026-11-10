import assert from "node:assert/strict";
import test from "node:test";
import {visibleRoute,boundTraceMoves,MAX_VISIBLE_POINTS,MAX_TRACE_QUEUE} from "../src/route-visual-v0.1.8.mjs";
import {MODES,createMovement,moveCursor,measureDistance,finishDrag,pinWaypoint,routePoints} from "../src/core-v0.1.8.mjs";
const p=(x,y)=>({x,y});
test("a 3000-turn zigzag fits into one bounded shared ruler PATH without dropping its endpoints",()=>{
  const positions=[p(0,0)];
  for(let i=1;i<=3000;i++)positions.push(p(i*3,i%2?45:0));
  const first=[...positions],drawn=visibleRoute(positions);
  assert.ok(drawn.length<=MAX_VISIBLE_POINTS);
  assert.deepEqual(drawn[0],positions[0]);
  assert.deepEqual(drawn.at(-1),positions.at(-1));
  assert.equal(positions.length,first.length,"visible simplification must not mutate actual route");
  assert.deepEqual(positions[100],first[100]);
});
test("ordinary corner paths are unchanged below the geometry budget",()=>{
  const points=[p(0,0),p(100,0),p(100,100),p(200,100),p(200,200)];
  assert.deepEqual(visibleRoute(points),points);
});
test("repeated, non-finite, and duplicate cursor samples do not create invalid path commands",()=>{
  const points=[p(0,0),p(0,0),p(20,20),p(NaN,1),p(20,20),p(30,10)];
  assert.deepEqual(visibleRoute(points),[p(0,0),p(20,20),p(30,10)]);
});
test("a 12000-point trace does not overflow call stacks and never exceeds shared geometry budget",()=>{
  const points=[p(0,0)];
  for(let i=1;i<=12000;i++)points.push(p(i%300,(i%2)*120));
  const out=visibleRoute(points);
  assert.ok(out.length<=MAX_VISIBLE_POINTS);
  assert.deepEqual(out[0],points[0]);
  assert.deepEqual(out.at(-1),points.at(-1));
});
test("trace backlog prefers corner events, keeps endpoints, and never deletes controls",()=>{
  const q=[{type:"pin"}];
  for(let i=0;i<1000;i++){
    q.push({type:"move",pointer:p(i*3,(i%7===0)?100:0)});
    boundTraceMoves(q);
  }
  q.push({type:"end"});
  assert.equal(q[0].type,"pin");
  assert.equal(q.at(-1).type,"end");
  assert.deepEqual(q.at(-2).pointer,p(999*3,(999%7===0)?100:0));
  assert.ok(q.length<=MAX_TRACE_QUEUE+2);
});
test("visual simplification never changes exact cumulative trace measurement",()=>{
  const m=createMovement("zigzag",p(0,0),MODES.TRACE);
  for(let i=0;i<1000;i++){
    const next=p(i*100,(i%2)*100);
    moveCursor(m,next);
  }
  finishDrag(m);
  const actual=routePoints(m);
  const shown=visibleRoute(actual);
  assert.ok(shown.length<=MAX_VISIBLE_POINTS);
  const exact=measureDistance(m,{dpi:100,rule:"CHEBYSHEV",multiplier:5});
  assert.ok(exact>0);
  assert.equal(exact,1000*5,"every zigzag step should still count");
  assert.ok(actual.length>shown.length,"visual path must be simplified independently");
});
test("many manual E waypoints retain the original route and exact distance",()=>{
  const m=createMovement("manual",p(0,0),MODES.WAYPOINT);
  for(let i=1;i<=400;i++){
    moveCursor(m,p(i*100,(i%2)*100));
    pinWaypoint(m);
  }
  const exact=measureDistance(m,{dpi:100,rule:"CHEBYSHEV",multiplier:5});
  assert.equal(exact,400*5);
  assert.equal(m.anchors.length,401);
  assert.ok(visibleRoute(routePoints(m)).length<=MAX_VISIBLE_POINTS);
  assert.deepEqual(m.origin,p(0,0));
});
