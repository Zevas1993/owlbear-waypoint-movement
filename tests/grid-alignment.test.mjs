import assert from "node:assert/strict";
import test from "node:test";
import {
  MODES,createMovement,finishDrag,measureDistance,moveCursor,pinWaypoint,
  snapSquare,tokenGridFootprint,tokenSnapOrigin
} from "../src/core.mjs";

const dpi=100;
const corner={x:0,y:0};
const center={x:50,y:50};
const token=(width,height=width,scaleX=1,scaleY=scaleX)=>({
  type:"IMAGE",
  image:{width,height},
  grid:{dpi:100},
  scale:{x:scaleX,y:scaleY}
});
const snapped=(item,position)=>snapSquare(position,dpi,tokenSnapOrigin(item,corner,center));

test("Medium 1x1 characters snap to cell centers instead of grid intersections",()=>{
  assert.deepEqual(tokenGridFootprint(token(100)),{columns:1,rows:1});
  assert.deepEqual(tokenSnapOrigin(token(100),corner,center),center);
  assert.deepEqual(snapped(token(100),{x:128,y:213}),{x:150,y:250});
});
test("Large 2x2 characters snap to intersections so four squares remain aligned",()=>{
  assert.deepEqual(tokenGridFootprint(token(200)),{columns:2,rows:2});
  assert.deepEqual(tokenSnapOrigin(token(200),corner,center),corner);
  assert.deepEqual(snapped(token(200),{x:128,y:213}),{x:100,y:200});
});
test("Huge 3x3 characters return to centers, Gargantuan 4x4 to intersections",()=>{
  assert.deepEqual(snapped(token(300),{x:128,y:213}),{x:150,y:250});
  assert.deepEqual(snapped(token(400),{x:128,y:213}),{x:100,y:200});
});
test("Scaled-up Medium character snaps as a Large character",()=>{
  assert.deepEqual(tokenGridFootprint(token(100,100,2,2)),{columns:2,rows:2});
  assert.deepEqual(snapped(token(100,100,2,2),{x:128,y:213}),{x:100,y:200});
});
test("Rectangular 2x3 and 3x2 tokens align independently on each axis",()=>{
  assert.deepEqual(snapped(token(200,300),{x:128,y:213}),{x:100,y:250});
  assert.deepEqual(snapped(token(300,200),{x:128,y:213}),{x:150,y:200});
});
test("Respects offset square grids, not just a grid starting at world origin",()=>{
  const c={x:17,y:29},m={x:67,y:79};
  assert.deepEqual(snapSquare({x:140,y:212},100,tokenSnapOrigin(token(100),c,m)),{x:167,y:179});
  assert.deepEqual(snapSquare({x:140,y:212},100,tokenSnapOrigin(token(200),c,m)),{x:117,y:229});
});
test("Missing image dimensions fall back to center snapping, not unsafe intersections",()=>{
  assert.deepEqual(tokenSnapOrigin({scale:{x:1,y:1}},corner,center),center);
  assert.deepEqual(tokenGridFootprint({image:{width:0,height:200},grid:{dpi:0}}),{columns:1,rows:1});
});
test("Snapping changes do not alter waypoint zero or reset cumulative movement",()=>{
  const m=createMovement("character-1",{x:50,y:50},MODES.WAYPOINT);
  const original=m.origin;
  moveCursor(m,snapped(token(100),{x:149,y:51}));
  pinWaypoint(m);
  finishDrag(m);
  moveCursor(m,snapped(token(100),{x:147,y:151}));
  finishDrag(m);
  assert.deepEqual(m.origin,original);
  assert.deepEqual(m.anchors,[{x:50,y:50},{x:150,y:50},{x:150,y:150}]);
  assert.equal(measureDistance(m,{dpi:100,rule:"CHEBYSHEV",multiplier:5}),10);
});
