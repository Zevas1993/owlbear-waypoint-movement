import assert from "node:assert/strict";
import test from "node:test";
import {tokenFootprint,detectSnapLattice,combineSnappedAxes} from "../src/core-v0.1.6.mjs";
const token=(position,w=100,h=w,sx=1,sy=sx)=>({
  position,image:{width:w,height:h},grid:{dpi:100},scale:{x:sx,y:sy}
});
test("Medium already in cell center uses center on both axes",()=>{
  assert.deepEqual(detectSnapLattice(token({x:50,y:150}),{x:0,y:100},{x:50,y:150}),{x:"center",y:"center"});
});
test("Large already on intersection keeps intersection, no forced move to centers",()=>{
  assert.deepEqual(detectSnapLattice(token({x:100,y:200},200),{x:100,y:200},{x:150,y:250}),{x:"corner",y:"corner"});
});
test("Large intentionally center-aligned stays at centers despite its size",()=>{
  assert.deepEqual(detectSnapLattice(token({x:150,y:250},200),{x:100,y:200},{x:150,y:250}),{x:"center",y:"center"});
});
test("Token scale is only an alignment tie-breaker, not a mandatory snapping choice",()=>{
  const giant=token({x:150,y:250},100,100,4,4);
  assert.deepEqual(tokenFootprint(giant),{columns:4,rows:4});
  assert.deepEqual(detectSnapLattice(giant,{x:100,y:200},{x:150,y:250}),{x:"center",y:"center"});
});
test("Rectangular and custom-aligned tokens can snap one axis to corners and one to centers",()=>{
  const item=token({x:100,y:250},200,300);
  const lattice=detectSnapLattice(item,{x:100,y:300},{x:150,y:250});
  assert.deepEqual(lattice,{x:"corner",y:"center"});
  assert.deepEqual(combineSnappedAxes({x:211,y:324},{x:200,y:300},{x:250,y:350},lattice),{x:200,y:350});
});
test("No scene-grid snapping remains a valid user preference",()=>{
  const p={x:209,y:301};
  assert.deepEqual(combineSnappedAxes(p,p,p,{x:"center",y:"corner"}),p);
});
test("Missing or invalid token measurements default to one-cell fallback",()=>{
  assert.deepEqual(tokenFootprint({position:{x:0,y:0}}),{columns:1,rows:1});
  assert.deepEqual(detectSnapLattice({position:{x:0,y:0}}, {x:10,y:10},{x:10,y:10}),{x:"center",y:"center"});
});
