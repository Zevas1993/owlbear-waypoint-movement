import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const events=[];
const tools=[];
const modes=[];
const actions=[];
const state={};
globalThis.document={getElementById(){return {textContent:""};}};
globalThis.window={matchMedia(){return {matches:false};}};
globalThis.__WAYPOINT_TEST_SDK__={
  default:{
    isAvailable:true,
    onReady(fn){queueMicrotask(fn);},
    tool:{
      async create(x){events.push("tool");tools.push(x);},
      async createMode(x){events.push("mode");modes.push(x);},
      async createAction(x){events.push("action");actions.push(x);},
      async setMetadata(id,patch){Object.assign(state,patch);},
      async activateMode(id,mode){events.push("activate");state.mode=mode;},
      onToolChange(){},onToolModeChange(){}
    },
    notification:{async show(){}}
  },
  buildPath(){},buildLabel(){},Command:{MOVE:0,LINE:1}
};

await import("../src/extension-v0.1.6.mjs");

async function ready(){
  for(let i=0;i<100;i++){if(actions.length===2)return;await new Promise(resolve=>setTimeout(resolve,5));}
  throw new Error("Tool registration did not complete");
}

test("background registers a toolbar tool and both movement modes",async()=>{
  await ready();
  assert.equal(tools.length,1);
  assert.equal(tools[0].id,"com.routecraft.waypoint-movement/tool");
  assert.equal(tools[0].icons[0].label,"Waypoint Movement");
  assert.deepEqual(events.slice(0,3),["tool","mode","mode"]);
  assert.equal(modes.length,2);
  assert.equal(state.mode,"com.routecraft.waypoint-movement/waypoint");
});

test("End Movement remains a visible Owlbear tool action",async()=>{
  await ready();
  const action=actions.find(a=>a.id.endsWith("/end"));
  assert.ok(action);
  assert.equal(action.icons[0].label,"End Movement");
  assert.deepEqual(action.icons[0].filter.activeTools,["com.routecraft.waypoint-movement/tool"]);
  assert.equal(action.disabled,undefined);
});

test("manifest points to Pages hosted entry and diagnostic panel",()=>{
  const m=JSON.parse(fs.readFileSync(new URL("../manifest.json",import.meta.url),"utf8"));
  assert.match(m.background_url,/index-v0\.1\.6\.html$/);
  assert.match(m.action.popover,/diagnostics-v0\.1\.6\.html$/);
  assert.equal(m.version,"0.1.6");
});

test("SDK is vendored locally so no CDN fetch is required",()=>{
  const code=fs.readFileSync(new URL("../src/extension-v0.1.6.mjs",import.meta.url),"utf8");
  const sdk=fs.readFileSync(new URL("../vendor/owlbear-sdk-3.1.0.mjs",import.meta.url),"utf8");
  assert.match(code,/owlbear-sdk-3\.1\.0\.mjs/);
  assert.doesNotMatch(code,/https:\/\/esm/);
  assert.ok(sdk.length>70000);
  assert.match(sdk,/export\{/);
});

test("native snap tool uses Owlbear grid and an immutable source module",()=>{
  const code=fs.readFileSync(new URL("../src/extension-v0.1.6.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(code,/snapSquare/);
  assert.match(code,/OBR\.scene\.grid\.snapPosition\(raw,undefined/);
  assert.match(code,/\.\/core-v0\.1\.6\.mjs/);
});
