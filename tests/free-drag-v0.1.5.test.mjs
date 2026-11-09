import assert from "node:assert/strict";
import test from "node:test";

const TOOL="com.routecraft.waypoint-movement/tool";
const WAYPOINT="com.routecraft.waypoint-movement/waypoint";
const modes=[];
const actions=[];
const tokens=new Map();
const overlays=new Map();
const interactions=[];
const snapFlags=[];
let seq=0;
const status={textContent:""};

function builder(type){
  const item={id:type+"-"+(++seq),type,text:{plainText:""}};
  const obj={build:()=>item};
  for(const method of ["name","layer","position","commands","strokeColor","strokeWidth",
    "fillOpacity","locked","disableHit","fontSize","fontWeight","fillColor",
    "backgroundColor","backgroundOpacity","padding","cornerRadius"]){
    obj[method]=value=>{item[method]=value;return obj;};
  }
  obj.plainText=value=>{item.text.plainText=value;return obj;};
  return obj;
}
globalThis.document={getElementById(){return status;}};
globalThis.window={matchMedia(){return {matches:false};}};
globalThis.__WAYPOINT_TEST_SDK__={
  default:{
    isAvailable:true,
    onReady(fn){queueMicrotask(fn);},
    tool:{
      async create(){},
      async createMode(m){modes.push(m);},
      async createAction(a){actions.push(a);},
      async setMetadata(){},
      async activateMode(){},
      onToolChange(){},onToolModeChange(){}
    },
    scene:{
      grid:{
        async getDpi(){return 100;},
        async getType(){return "SQUARE";},
        async getMeasurement(){return "CHEBYSHEV";},
        async getScale(){return {parsed:{multiplier:5,unit:"ft",digits:0}};},
        async snapPosition(point,sensitivity,corners,center){
          snapFlags.push({sensitivity,corners,center});
          return corners&&!center?{x:0,y:0}:{x:50,y:50};
        }
      },
      local:{
        async addItems(items){for(const item of items)overlays.set(item.id,item);},
        async updateItems(ids,mutate){mutate(ids.map(id=>overlays.get(id)).filter(Boolean));},
        async deleteItems(ids){for(const id of ids)overlays.delete(id);}
      },
      items:{
        async updateItems(ids,mutate){mutate(ids.map(id=>tokens.get(id)).filter(Boolean));}
      }
    },
    interaction:{
      async startItemInteraction(item){
        interactions.push(item.id);
        return [mutate=>mutate(item),()=>{}];
      }
    },
    player:{async hasPermission(){return true;}},
    notification:{async show(){}}
  },
  buildPath:()=>builder("path"),
  buildLabel:()=>builder("label"),
  Command:{MOVE:"MOVE",LINE:"LINE"}
};

await import("../src/extension-v0.1.5.mjs");

async function until(fn,label,timeout=1200){
  const stop=Date.now()+timeout;
  while(Date.now()<stop){
    if(fn())return;
    await new Promise(resolve=>setTimeout(resolve,5));
  }
  throw new Error("Timed out waiting for "+label+"; status: "+status.textContent);
}
const mode=()=>modes.find(m=>m.id===WAYPOINT);
function character(id,size,point){
  const item={id,type:"IMAGE",layer:"CHARACTER",locked:false,
    image:{width:100*size,height:100*size},grid:{dpi:100},
    scale:{x:1,y:1},position:{...point}};
  tokens.set(id,item);
  return item;
}
async function drag(item,destination){
  const m=mode();
  const current={...item.position};
  m.onToolDragStart({activeMode:WAYPOINT},{target:item,pointerPosition:current});
  await until(()=>interactions.filter(id=>id===item.id).length>0 && overlays.size===2,"movement start");
  m.onToolDragMove({activeMode:WAYPOINT},{pointerPosition:destination});
  m.onToolDragEnd({activeMode:WAYPOINT},{pointerPosition:destination});
  await until(()=>item.position.x!==(current.x) || item.position.y!==(current.y),"token movement commit");
  // Wait for the drag-end callback to finish releasing its interaction before another grab.
  await new Promise(resolve=>setTimeout(resolve,0));
}
async function end(){
  const end=actions.find(a=>a.id.endsWith("/end"));
  end.onClick();
  await until(()=>overlays.size===0,"End Movement clears local overlay");
}

test("Medium token follows pointer freely without snapping to grid lines or centers",async()=>{
  await until(()=>modes.length===2 && actions.length===2,"tool registration");
  const item=character("medium",1,{x:50,y:50});
  await drag(item,{x:123,y:208});
  assert.deepEqual(item.position,{x:123,y:208});
  assert.equal(snapFlags.length,0,"dragging must not invoke Owlbear grid snapping");
  await end();
});

test("large token keeps its size and follows arbitrary cursor coordinates",async()=>{
  const item=character("large",2,{x:0,y:0});
  await drag(item,{x:123,y:208});
  assert.deepEqual(item.position,{x:123,y:208});
  await end();
});

test("a second drag of the same token retains the first waypoint and accumulates distance",async()=>{
  const item=character("twodrags",1,{x:50,y:50});
  await drag(item,{x:120,y:208});
  const first={...item.position};
  assert.deepEqual(first,{x:120,y:208});
  // This second drag happens without pressing End Movement.
  const before=interactions.length;
  const m=mode();
  m.onToolDragStart({activeMode:WAYPOINT},{target:item,pointerPosition:first});
  await until(()=>interactions.length>before,"regrab token");
  m.onToolDragMove({activeMode:WAYPOINT},{pointerPosition:{x:248,y:326}});
  m.onToolDragEnd({activeMode:WAYPOINT},{pointerPosition:{x:248,y:326}});
  await until(()=>item.position.x===248 && item.position.y===326,"second drag commits");
  await until(()=>[...overlays.values()].some(i=>i.type==="label"&&i.text.plainText==="14 ft"),"cumulative measurement");
  const path=[...overlays.values()].find(i=>i.type==="path");
  assert.deepEqual(path.commands,[
    ["MOVE",50,50],["LINE",120,208],["LINE",248,326]
  ]);
  await end();
});

test("dragging from an off-center grab keeps the token anchored under the same point",async()=>{
  const item=character("offset",1,{x:50,y:50});
  const m=mode();
  const previousInteractions=interactions.length;
  m.onToolDragStart({activeMode:WAYPOINT},{target:item,pointerPosition:{x:73,y:89}});
  await until(()=>interactions.length>previousInteractions,"off-center grab");
  m.onToolDragMove({activeMode:WAYPOINT},{pointerPosition:{x:159,y:208}});
  m.onToolDragEnd({activeMode:WAYPOINT},{pointerPosition:{x:159,y:208}});
  await until(()=>item.position.x===136 && item.position.y===169,"offset movement commit");
  assert.equal(snapFlags.length,0);
  await end();
});
