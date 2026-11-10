import assert from "node:assert/strict";
import test from "node:test";
import {detectSnapLattice} from "../src/core-v0.1.8.mjs";

const WAYPOINT="com.routecraft.waypoint-movement/waypoint";
const TRACE="com.routecraft.waypoint-movement/trace";
const tools=[],modes=[],actions=[],interactionStarts=[];
const TOOL="com.routecraft.waypoint-movement/tool";
const OWNER="com.routecraft.waypoint-movement/owner";
let toolChanged, activeTool=TOOL;
const ownItems=()=>[...overlays.values()].filter(item=>item.metadata?.[OWNER]==="test-player");
const tokens=new Map(),overlays=new Map(),snapCalls=[];
const metrics={sharedUpdates:0};
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
      onToolChange(fn){toolChanged=fn;},onToolModeChange(){},
      async getActiveTool(){return activeTool;}
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
        async addItems(){throw new Error("Ruler must not use scene.local.addItems");},
        async updateItems(){throw new Error("Ruler must not use scene.local.updateItems");},
        async deleteItems(){throw new Error("Ruler must not use scene.local.deleteItems");}
      },
      items:{
        async getItems(filter){
          if(Array.isArray(filter))return filter.map(id=>tokens.get(id)??overlays.get(id)).filter(Boolean);
          return [...overlays.values()].filter(filter);
        },
        async addItems(items){for(const item of items)overlays.set(item.id,item);},
        async updateItems(ids,mutate){
          const shared=ids.some(id=>overlays.has(id));
          if(shared){
            metrics.sharedUpdates++;
            // Artificial slow network; should NOT cause request backlogs.
            await new Promise(resolve=>setTimeout(resolve,10));
          }
          const found=ids.map(id=>overlays.get(id)??tokens.get(id)).filter(Boolean);
          mutate(found);
        },
        async deleteItems(ids){for(const id of ids)overlays.delete(id);}
      }
    },
    interaction:{
      async startItemInteraction(item){interactionStarts.push(item.id);return [mutate=>mutate(item),()=>{}];}
    },
    player:{id:"test-player",async hasPermission(){return true;}},
    notification:{async show(){}}
  },
  buildPath:()=>builder("path"),buildLabel:()=>builder("label"),Command:{MOVE:"MOVE",LINE:"LINE"}
};
// Simulate a player returning after a browser crash while another player has a route.
overlays.set("abandoned-self",{id:"abandoned-self",layer:"RULER",metadata:{[OWNER]:"test-player"},type:"path"});
overlays.set("live-other",{id:"live-other",layer:"RULER",metadata:{[OWNER]:"other-player"},type:"path"});
await import("../src/extension-v0.1.8.mjs");
async function until(fn,description,timeout=1400){
  const deadline=Date.now()+timeout;
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
  await until(()=>ownItems().length===0,"End Movement cleanup");
}
test("reload removes abandoned shared paths belonging only to this player",async()=>{
  await until(()=>modes.length===2&&actions.length===2,"toolbar ready");
  await until(()=>!overlays.has("abandoned-self"),"abandoned player route cleanup");
  assert.ok(overlays.has("live-other"),"another player's active route must not be removed");
  overlays.delete("live-other");
});
test("toolbar and End Movement remain registered in version 0.1.8",async()=>{
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
  assert.equal(ownItems().length,0);
});

test("new tracking items are global scene items visible to another player's scene view",async()=>{
  activeTool=TOOL;
  const foreign={id:"foreign-route",metadata:{[OWNER]:"another-player"},type:"path"};
  overlays.set(foreign.id,foreign);
  const t=token("global-route-token",50,50);
  const m=movementMode();
  const before=interactionStarts.length;
  m.onToolDragStart({activeMode:WAYPOINT},{target:t,pointerPosition:{...t.position}});
  await until(()=>interactionStarts.length>before && ownItems().length===2,"global route appears on scene");
  assert.equal(ownItems().length,2);
  assert.ok(ownItems().every(item=>item.layer==="RULER"));
  m.onToolDragMove({activeMode:WAYPOINT},{pointerPosition:{x:149,y:50}});
  await until(()=>ownItems().some(item=>item.type==="path"&&item.commands?.length===2),"global line updated during drag");
  const remoteView=[...overlays.values()].filter(item=>item.layer==="RULER");
  assert.equal(remoteView.length,2,"a second player sees both live ruler items");
  m.onToolDragEnd({activeMode:WAYPOINT},{pointerPosition:{x:149,y:50}});
  await until(()=>t.position.x===150,"token commit");
  await end();
  assert.ok(overlays.has(foreign.id),"End Movement must not remove another player's shared ruler");
  overlays.delete(foreign.id);
});
test("tool-change event ends movement globally without clicking End Movement",async()=>{
  activeTool=TOOL;
  const t=token("autoend-event",50,50);
  await move(t,{x:130,y:50},{expected:{x:150,y:50}});
  await until(()=>ownItems().length===2,"global overlay present before tool switch");
  assert.equal(typeof toolChanged,"function");
  activeTool="rodeo.owlbear.tool/move";
  toolChanged(activeTool);
  await until(()=>ownItems().length===0,"global cleanup on tool change");
  activeTool=TOOL;
});
test("mode deactivation also clears the global ruler on tool switch",async()=>{
  activeTool=TOOL;
  const t=token("autoend-deactivate",50,50);
  await move(t,{x:130,y:50},{expected:{x:150,y:50}});
  assert.equal(ownItems().length,2);
  movementMode().onDeactivate({activeMode:WAYPOINT});
  await until(()=>ownItems().length===0,"global cleanup on mode deactivation");
});
test("tool-state safety net clears shared path if tool-change event is missed",async()=>{
  activeTool=TOOL;
  const t=token("autoend-missed-event",50,50);
  await move(t,{x:130,y:50},{expected:{x:150,y:50}});
  assert.equal(ownItems().length,2);
  activeTool="rodeo.owlbear.tool/measure";
  await until(()=>ownItems().length===0,"watchdog cleanup after silent tool switch",2500);
  activeTool=TOOL;
});
test("mobile Trace regrab keeps shared line and End Movement removes it globally",async()=>{
  activeTool=TOOL;
  const t=token("touch-trace",50,50);
  await move(t,{x:145,y:50},{trace:true,expected:{x:150,y:50}});
  assert.equal(ownItems().length,2);
  await move(t,{x:150,y:151},{trace:true,expected:{x:150,y:150}});
  await until(()=>ownItems().some(item=>item.type==="label"&&item.text.plainText==="10 ft"),"shared label after touch regrab");
  await end();
  assert.equal(ownItems().length,0);
});

test("switching tools during an unfinished drag cancels and clears global rulers",async()=>{
  activeTool=TOOL;
  const t=token("mid-drag-switch",50,50);
  const m=movementMode();
  const startCount=interactionStarts.length;
  m.onToolDragStart({activeMode:WAYPOINT},{target:t,pointerPosition:{...t.position}});
  await until(()=>interactionStarts.length>startCount && ownItems().length===2,"mid-drag shared ruler start");
  m.onToolDragMove({activeMode:WAYPOINT},{pointerPosition:{x:145,y:50}});
  activeTool="rodeo.owlbear.tool/measure";
  toolChanged(activeTool);
  await until(()=>ownItems().length===0,"tool switch cancels global mid-drag path",2500);
  activeTool=TOOL;
});
test("End Movement button also clears a live global path during an unfinished drag",async()=>{
  activeTool=TOOL;
  const t=token("mid-drag-end",50,50);
  const m=movementMode();
  const startCount=interactionStarts.length;
  m.onToolDragStart({activeMode:WAYPOINT},{target:t,pointerPosition:{...t.position}});
  await until(()=>interactionStarts.length>startCount && ownItems().length===2,"live ruler started");
  m.onToolDragMove({activeMode:WAYPOINT},{pointerPosition:{x:145,y:50}});
  actions.find(a=>a.id.endsWith("/end")).onClick();
  await until(()=>ownItems().length===0,"End Movement clears shared live route",2500);
});

test("a 450-turn Trace session stays responsive, caps shared path geometry and commits its last position",async()=>{
  activeTool=TOOL;
  const t=token("stress-turns",50,50);
  const m=modes.find(x=>x.id===TRACE);
  const previous=interactionStarts.length;
  m.onToolDragStart({activeMode:TRACE},{target:t,pointerPosition:{...t.position}});
  await until(()=>interactionStarts.length>previous && ownItems().length===2,"Trace drag start",3000);
  const beforeUpdates=metrics.sharedUpdates;
  for(let i=1;i<=450;i++){
    m.onToolDragMove({activeMode:TRACE},{pointerPosition:{x:50+(i%10)*100,y:50+(i%2)*100}});
    if(i%6===0)await new Promise(resolve=>setTimeout(resolve,1));
  }
  const finalPointer={x:450,y:350};
  m.onToolDragEnd({activeMode:TRACE},{pointerPosition:finalPointer});
  await until(()=>t.position.x===450&&t.position.y===350,"final position after angled path",7000);
  await until(()=>ownItems().some(item=>item.type==="path"&&item.commands?.length>2),"shared route after stress",5000);
  const path=ownItems().find(item=>item.type==="path");
  assert.ok(path.commands.length<=144, "visible path must be bounded");
  assert.deepEqual(path.commands[0].slice(1),[50,50]);
  assert.deepEqual(path.commands.at(-1).slice(1),[450,350]);
  assert.ok(metrics.sharedUpdates-beforeUpdates<100,"global updates must be throttled below input event rate");
  assert.ok(ownItems().some(item=>item.type==="label"&&Number.parseInt(item.text.plainText)>0));
  await end();
});
test("many angled Waypoint+E moves preserve the exact running total while visible geometry stays bounded",async()=>{
  activeTool=TOOL;
  const t=token("waypoint-heavy",50,50);
  const m=movementMode();
  const prior=interactionStarts.length;
  m.onToolDragStart({activeMode:WAYPOINT},{target:t,pointerPosition:{...t.position}});
  await until(()=>interactionStarts.length>prior,"long waypoints start");
  for(let i=1;i<=190;i++){
    const coords={x:50+i*100,y:50+(i%2)*100};
    m.onToolDragMove({activeMode:WAYPOINT},{pointerPosition:coords});
    m.onKeyDown({}, {code:"KeyE",repeat:false,ctrlKey:false,metaKey:false,altKey:false});
    if(i%4===0)await new Promise(resolve=>setTimeout(resolve,1));
  }
  m.onToolDragEnd({activeMode:WAYPOINT},{pointerPosition:{x:19050,y:50}});
  await until(()=>t.position.x===19050,"many waypoints commit",7000);
  await until(()=>ownItems().some(item=>item.type==="label"&&item.text.plainText==="950 ft"),"exact distance after 190 turns",5000);
  const visible=ownItems().find(item=>item.type==="path");
  assert.ok(visible.commands.length<=144,"shared scene path bounded under 144 commands");
  await end();
});
test("a long drag renews its interaction before Owlbear's 30-second live update expiry",async()=>{
  activeTool=TOOL;
  const t=token("long-interaction",50,50);
  const m=movementMode();
  const prior=interactionStarts.length;
  m.onToolDragStart({activeMode:WAYPOINT},{target:t,pointerPosition:{...t.position}});
  await until(()=>interactionStarts.length>prior,"long drag start");
  const originalClock=Date.now;
  try{
    Date.now=()=>originalClock()+25000;
    m.onToolDragMove({activeMode:WAYPOINT},{pointerPosition:{x:250,y:50}});
    await until(()=>interactionStarts.length>prior+1,"interaction renewal",5000);
    assert.equal(interactionStarts.at(-1),"long-interaction");
    m.onToolDragEnd({activeMode:WAYPOINT},{pointerPosition:{x:250,y:50}});
    await until(()=>t.position.x===250,"long drag commit",5000);
  }finally{
    Date.now=originalClock;
  }
  await end();
});
