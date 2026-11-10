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
    scene:{items:{async getItems(){return [];}},onReadyChange(){}},
    notification:{async show(){}}
  },
  buildPath(){},buildLabel(){},Command:{MOVE:0,LINE:1}
};

await import("../src/extension-v0.1.9.mjs");

async function ready(){
  for(let i=0;i<100;i++){if(actions.length===2)return;await new Promise(resolve=>setTimeout(resolve,5));}
  throw new Error("Tool registration did not complete");
}

test("background registers the toolbar and only Waypoint mode",async()=>{
  await ready();
  assert.equal(tools.length,1);
  assert.equal(tools[0].id,"com.routecraft.waypoint-movement/tool");
  assert.equal(tools[0].icons[0].label,"Waypoint Movement");
  assert.deepEqual(events.slice(0,2),["tool","mode"]);
  assert.equal(modes.length,1);
  assert.ok(!modes.some(mode=>mode.id?.includes("/trace")));
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
  assert.match(m.background_url,/index-v0\.1\.9\.html$/);
  assert.match(m.action.popover,/diagnostics-v0\.1\.9\.html$/);
  assert.equal(m.version,"0.1.9");
});

test("SDK is vendored locally so no CDN fetch is required",()=>{
  const code=fs.readFileSync(new URL("../src/extension-v0.1.9.mjs",import.meta.url),"utf8");
  const sdk=fs.readFileSync(new URL("../vendor/owlbear-sdk-3.1.0.mjs",import.meta.url),"utf8");
  assert.match(code,/owlbear-sdk-3\.1\.0\.mjs/);
  assert.doesNotMatch(code,/https:\/\/esm/);
  assert.ok(sdk.length>70000);
  assert.match(sdk,/export\{/);
});

test("native snap tool uses Owlbear grid and an immutable source module",()=>{
  const code=fs.readFileSync(new URL("../src/extension-v0.1.9.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(code,/snapSquare/);
  assert.match(code,/OBR\.scene\.grid\.snapPosition\(raw,undefined/);
  assert.match(code,/\.\/core-v0\.1\.9\.mjs/);
});

test("all players share the active path and tool switching is watched",()=>{
  const code=fs.readFileSync(new URL("../src/extension-v0.1.9.mjs",import.meta.url),"utf8");
  assert.match(code,/OBR\.scene\.items\.addItems\(/);
  assert.match(code,/OBR\.scene\.items\.updateItems\(/);
  assert.match(code,/OBR\.scene\.items\.deleteItems\(/);
  assert.doesNotMatch(code,/OBR\.scene\.local\./);
  assert.match(code,/OBR\.tool\.onToolChange\(/);
  assert.match(code,/OBR\.tool\.getActiveTool\(/);
});

test("long-route renderer bounds shared geometry and renews long token drags",()=>{
  const code=fs.readFileSync(new URL("../src/extension-v0.1.9.mjs",import.meta.url),"utf8");
  const renderer=fs.readFileSync(new URL("../src/route-visual-v0.1.8.mjs",import.meta.url),"utf8");
  assert.match(code,/visibleRoute\(routePoints/);
  assert.match(code,/MIN_UPDATE_INTERVAL_MS/);
  assert.match(code,/renewTokenInteraction/);
  assert.match(renderer,/MAX_VISIBLE_POINTS=144/);
});

test("new release uses current player color and removes Trace-mode registration",()=>{
  const code=fs.readFileSync(new URL("../src/extension-v0.1.9.mjs",import.meta.url),"utf8");
  const core=fs.readFileSync(new URL("../src/core-v0.1.9.mjs",import.meta.url),"utf8");
  assert.match(code,/OBR\.player\.getColor\(\)/);
  assert.match(code,/OBR\.player\.onChange/);
  assert.match(code,/\.strokeColor\(s\.lineColor\)/);
  assert.match(code,/item\.style=\{/);
  assert.equal((code.match(/OBR\.tool\.createMode\(/g)||[]).length,1);
  assert.doesNotMatch(code,/TRACE|Trace Movement|boundTraceMoves/);
  assert.doesNotMatch(core,/TRACE|trace/);
});
