import assert from "node:assert/strict";
import test from "node:test";
import {detectSnapLattice} from "../src/core-v0.1.6.mjs";

const WAYPOINT="com.routecraft.waypoint-movement/waypoint";
const TRACE="com.routecraft.waypoint-movement/trace";
const tools=[],modes=[],actions=[],interactionStarts=[];
const tokens=new Map(),overlays=new Map(),snapCalls=[];
let count=0;
const pref={snap:true};
const status={textContent:""};
const square=(v,offset)=>offset+Math.round((v-offset)/100)*100;
function gridSnap(p,sensitivity,corners,centers){
  snapCalls.push({p:{...p},sensitivity,corners,centers});
  if(sensitivity===undefined&&!pref.snap)return {...p};
  const corner={x:square(p.x,0),y:square(p.y,0)};
  const center={x:square(p.x,50),y:square(p.y,50)};
  if(corners&&!centers)return corner;
  if(centers&&!corners)return center;
  const d=a=>(p.x-a.x)**2+(p.y-a.y)**2;
  return d(corner)<d(center)?corner:center;
}
function builder(type){
  const item={id:type+"-"+(++count),type,text:{plainText:""}};
  const obj={build:()=>item};
  for(const name of ["name","layer","position","commands","strokeColor","strokeWidth","fillOpacity","locked","disableHit","fontSize","fontWeight","fillColor","backgroundColor","backgroundOpacity","padding","cornerRadius"])
    obj[name]=v=>{item[name]=v;return obj;};
  obj.plainText=v=>{item.text.plainText=v;return obj;};
  return obj;
}
globalThis.document={getElementById(){return status;}};
globalThis.window={matchMedia(){return {matches:false};}};
globalThis.__WAYPOINT_TEST_SDK__={
  default:{
    isAvailable:true,
    onReady(cb){queueMicrotask(cb);},
    tool:{
      async create(x){tools.push(x);},
      async createMode(x){modes.push(x);},
      async createAction(x){actions.push(x);},
      async setMetadata(){},async activateMode(){},
      onToolChange(){},onToolModeChange(){}
    },
    scene:{
      grid:{
        async getType(){return "SQUARE";},
        async getDpi(){return 100;},
        async getMeasurement(){return "CHEBYSHEV";},
        async getScale(){return {parsed:{unit:"ft",multiplier:5,digits:0}};},
        async snapPosition(...args){return gridSnap(...args);}
      },
      local:{
        async addItems(items){for(const item of items)overlays.set(item.id,item);},
        async updateItems(ids,mutate){mutate(ids.map(id=>overlays.get(id)).filter(Boolean));},
        async deleteItems(ids){for(const id of ids)overlays.delete(id);}
      },
      items:{async updateItems(ids,mutate){mutate(ids.map(id=>tokens.get(id)).filter(Boolean));}}
    },
    interaction:{
      async startItemInteraction(item){interactionStarts.push(item.id);return [mutate=>mutate(item),()=>{}];}
    },
    player:{async hasPermission(){return true;}},
    notification:{async show(){}}
  },
  buildPath:()=>builder("path"),buildLabel:()=>builder("label"),Command:{MOVE:"MOVE",LINE:"LINE"}
};
await import("../src/extension-v0.1.6.mjs");
async function until(fn,description){
  const deadline=Date.now()+1400;
  while(Date.now()<deadline){
    if(fn())return;
    await new Promise(resolve=>setTimeout(resolve,5));
  }
  throw new Error("Timed out "+description+"; status="+status.textContent);
}
const movementMode=()=>modes.find(x=>x.id===WAYPOINT);
function token(id,x,y,w=100,h=w,sx=1,sy=sx){
  const item={id,type:"IMAGE",layer:"CHARACTER",locked:false,position:{x,y},image:{width:w,height:h},grid:{dpi:100},scale:{x:sx,y:sy}};
  tokens.set(id,item);return item;
}
async function move(item,position,options={}){
  const m=modes.find(x=>x.id===(options.trace?TRACE:WAYPOINT));
  const modeId=m.id;
  const previous=interactionStarts.length;
  const pointerStart=options.pointerStart||item.position;
  m.onToolDragStart({activeMode:modeId},{target:item,pointerPosition:{...pointerStart}});
  await until(()=>interactionStarts.length>previous,"drag start");
  m.onToolDragMove({activeMode:modeId},{pointerPosition:position,ctrlKey:!!options.ctrlKey});
  m.onToolDragEnd({activeMode:modeId},{pointerPosition:position,ctrlKey:!!options.ctrlKey});
  const expect=options.expected;
  await until(()=>!expect || (item.position.x===expect.x&&item.position.y===expect.y),"drag commit");
  // Wait for drag-end interaction release before regrabbing the same token.
  await new Promise(resolve=>setTimeout(resolve,0));
}
async function end(){
  actions.find(a=>a.id.endsWith("/end")).onClick();
  await until(()=>overlays.size===0,"End Movement cleanup");
}
test("toolbar and End Movement remain registered in version 0.1.6",async()=>{
  await until(()=>modes.length===2&&actions.length===2,"toolbar registration");
  assert.equal(tools.length,1);
  assert.ok(actions.find(a=>a.id.endsWith("/end")));
});
test("Medium token already center-aligned continues to snap to centers",async()=>{
  snapCalls.length=0;pref.snap=true;
  const t=token("medium-1",50,50);
  await move(t,{x:132,y:221},{expected:{x:150,y:250}});
  assert.deepEqual(t.position,{x:150,y:250});
  assert.ok(snapCalls.some(x=>x.sensitivity===1&&x.corners===false&&x.centers===true),"startup probes center");
  assert.ok(snapCalls.some(x=>x.sensitivity===undefined&&x.corners===false&&x.centers===true),"native user sensitivity used while moving");
  await end();
});
test("Large token placed on grid intersections maintains its own corner snapping",async()=>{
  const t=token("large-corner",100,200,200);
  await move(t,{x:221,y:326},{expected:{x:200,y:300}});
  assert.deepEqual(t.position,{x:200,y:300});
  await end();
});
test("Intentionally center-placed Large token is NOT forced to corners",async()=>{
  const t=token("large-center",150,250,200);
  await move(t,{x:221,y:326},{expected:{x:250,y:350}});
  assert.deepEqual(t.position,{x:250,y:350});
  await end();
});
test("Scaled Gargantuan token at center retains pre-existing alignment",async()=>{
  const t=token("giant-center",150,250,100,100,4,4);
  await move(t,{x:221,y:326},{expected:{x:250,y:350}});
  await end();
});
test("Custom rectangular token can snap X to intersections, Y to centers",async()=>{
  const t=token("rectangle",100,250,200,300);
  await move(t,{x:223,y:322},{expected:{x:200,y:350}});
  assert.deepEqual(t.position,{x:200,y:350});
  await end();
});
test("Ctrl overrides snapping during the drag without relocating the origin",async()=>{
  const t=token("ctrl-override",50,50);
  const origin={...t.position};
  await move(t,{x:123,y:208},{expected:{x:123,y:208},ctrlKey:true});
  assert.deepEqual(origin,{x:50,y:50});
  await end();
});
test("Scene/user preference to disable snapping produces free movement",async()=>{
  pref.snap=false;
  const t=token("native-settings",50,50);
  await move(t,{x:123,y:208},{expected:{x:123,y:208}});
  assert.equal(t.position.x,123);
  await end();
  pref.snap=true;
});
test("Waypoint zero and measurement survive release/regrab with native snapping",async()=>{
  const t=token("two-segments",50,50);
  await move(t,{x:142,y:61},{expected:{x:150,y:50}});
  await move(t,{x:152,y:153},{expected:{x:150,y:150}});
  await until(()=>[...overlays.values()].some(item=>item.type==="label"&&item.text.plainText==="10 ft"),"10ft cumulative movement");
  const path=[...overlays.values()].find(item=>item.type==="path");
  assert.deepEqual(path.commands,[["MOVE",50,50],["LINE",150,50],["LINE",150,150]]);
  await end();
  assert.equal(overlays.size,0);
});
