import {MODES,clonePoint,createMovement,finishDrag,formatDistance,measureDistance,moveCursor,pinWaypoint,restoreMovement,rewindCommittedSegment,routePoints,saveMovement,snapSquare,undoWaypoint} from "./core-v0.1.4.mjs";

const ROOT="com.routecraft.waypoint-movement",TOOL=ROOT+"/tool",WAYPOINT=ROOT+"/waypoint",TRACE=ROOT+"/trace",END=ROOT+"/end",UNDO=ROOT+"/undo",ACTIVE=ROOT+"/active";
const icon=name=>new URL("../assets/"+name+".svg",import.meta.url).href;
const status=document.getElementById("status");
let OBR,buildPath,buildLabel,Command,session=null,drag=null,closing=null;
const say=s=>{if(status)status.textContent=s;};
const warn=(message,e)=>{console.error("Waypoint Movement:",message,e);try{void OBR.notification.show("Waypoint Movement: "+message,"WARNING");}catch{}};
const chosen=context=>context?.activeMode===TRACE?MODES.TRACE:MODES.WAYPOINT;
const posLabel=(p,dpi)=>({x:p.x+dpi*.45,y:p.y-dpi*.3});
const distanceText=s=>formatDistance(measureDistance(s.movement,{dpi:s.dpi,rule:s.rule,multiplier:s.scale.multiplier}),s.scale.unit,s.scale.digits);
async function active(value){await OBR.tool.setMetadata(TOOL,{[ACTIVE]:value});}
async function overlay(s){
  const p=buildPath().name("Waypoint Movement route").layer("RULER").position({x:0,y:0}).commands([[Command.MOVE,s.movement.origin.x,s.movement.origin.y]]).strokeColor("#22c997").strokeWidth(5).fillOpacity(0).locked(true).disableHit(true).build();
  const l=buildLabel().name("Waypoint Movement distance").layer("RULER").plainText(distanceText(s)).position(posLabel(s.movement.origin,s.dpi)).fontSize(Math.max(16,Math.min(27,s.dpi*.24))).fontWeight(700).fillColor("#ffffff").backgroundColor("#102a26").backgroundOpacity(.94).padding(8).cornerRadius(9).locked(true).disableHit(true).build();
  s.pathId=p.id;s.labelId=l.id;await OBR.scene.local.addItems([p,l]);
}
function refresh(s=session){
  if(!s||!s.pathId||s.disposed)return;s.dirty=true;if(s.painting)return;
  s.painting=(async()=>{
    while(s.dirty&&!s.disposed){
      s.dirty=false;
      const commands=routePoints(s.movement).map((p,i)=>[i===0?Command.MOVE:Command.LINE,p.x,p.y]);
      const label=distanceText(s),position=posLabel(s.movement.cursor,s.dpi);
      await OBR.scene.local.updateItems([s.pathId,s.labelId],items=>{
        for(const item of items){
          if(item.id===s.pathId)item.commands=commands;
          if(item.id===s.labelId){item.position=position;item.text.plainText=label;}
        }
      });
    }
  })().catch(e=>{if(!s.disposed)console.error("Waypoint overlay update failed",e)}).finally(()=>{s.painting=null;if(s.dirty&&!s.disposed)refresh(s);});
}
async function clear(){
  const s=session;session=null;
  if(s){s.disposed=true;if(s.painting)await s.painting;try{await OBR.scene.local.deleteItems([s.pathId,s.labelId].filter(Boolean));}catch(e){console.debug(e)}}
  try{await active(false);}catch{}
}
function enqueue(d,op){
  if(d.cancelled||(d.ending&&op.type!=="end"))return;
  if(d.mode!==MODES.TRACE&&op.type==="move"&&d.queue.at(-1)?.type==="move")d.queue[d.queue.length-1]=op;
  else d.queue.push(op);
  if(d.ready)process(d);
}
function process(d){
  if(d.processing||!d.ready)return d.processing;
  d.processing=(async()=>{
    while(d.queue.length&&!d.cancelled&&drag===d){
      const op=d.queue.shift();
      if(op.type==="move"){
        const point=snapSquare({x:op.pointer.x+d.offset.x,y:op.pointer.y+d.offset.y},d.session.dpi,d.session.corner);
        moveCursor(d.session.movement,point);
        if(d.interaction)d.interaction[0](item=>{item.position=clonePoint(point)});
        refresh(d.session);
      }else if(op.type==="pin"){pinWaypoint(d.session.movement);refresh(d.session);}
      else if(op.type==="undo"){undoWaypoint(d.session.movement);refresh(d.session);}
      else if(op.type==="end"){
        finishDrag(d.session.movement);
        const position=clonePoint(d.session.movement.cursor);
        try{
          await OBR.scene.items.updateItems([d.tokenId],items=>{for(const item of items)item.position=position;});
        }catch(e){restoreMovement(d.session.movement,d.previous);warn("Failed to commit token position",e);}
        finally{try{d.interaction?.[1]();}catch{}if(drag===d)drag=null;refresh(d.session);}
        break;
      }
    }
  })().catch(e=>{warn("Movement processing error",e);try{d.interaction?.[1]();}catch{}if(drag===d)drag=null;})
    .finally(()=>{d.processing=null;if(d.queue.length&&!d.cancelled&&drag===d)process(d);});
  return d.processing;
}
function finishDragEvent(d=drag,pointer){
  if(!d||d.ending||d.cancelled)return;
  if(pointer)enqueue(d,{type:"move",pointer:clonePoint(pointer)});
  enqueue(d,{type:"end"});d.ending=true;if(d.ready)process(d);
}
async function cancelDrag(d=drag){
  if(!d||d.cancelled)return;
  d.cancelled=true;d.queue.length=0;
  try{await d.begin;}catch{}
  if(d.processing)await d.processing;
  if(d.session&&d.previous){restoreMovement(d.session.movement,d.previous);refresh(d.session);}
  try{d.interaction?.[1]();}catch{}if(drag===d)drag=null;
}
async function endMovement(){
  if(closing)return closing;
  closing=(async()=>{
    if(drag&&!drag.cancelled){
      const d=drag;finishDragEvent(d);await d.begin;
      while(drag===d&&(d.queue.length||d.processing)){if(!d.processing)process(d);if(d.processing)await d.processing;}
    }
    await clear();
  })().catch(e=>warn("Could not end movement",e)).finally(()=>{closing=null;});
  return closing;
}
async function switchTool(){if(drag)await cancelDrag(drag);await endMovement();}
function startDrag(context,event){
  const item=event.target;
  if(!item||item.layer!=="CHARACTER"||item.locked||event.transformer||drag)return;
  const d={tokenId:item.id,mode:chosen(context),queue:[],ready:false,processing:null,interaction:null,cancelled:false,ending:false,begin:null,session:null,previous:null,offset:null};
  drag=d;
  d.begin=(async()=>{
    if(closing)await closing;
    const [permission,grid]=await Promise.all([OBR.player.hasPermission("CHARACTER_UPDATE"),OBR.scene.grid.getType()]);
    if(!permission){warn("You don't have permission to move tokens");if(drag===d)drag=null;return;}
    if(grid!=="SQUARE"){warn("Only square grids are currently supported");if(drag===d)drag=null;return;}
    if(session&&session.movement.tokenId!==item.id)await clear();
    if(drag!==d||d.cancelled)return;
    if(!session){
      const [dpi,rule,scale,corner]=await Promise.all([OBR.scene.grid.getDpi(),OBR.scene.grid.getMeasurement(),OBR.scene.grid.getScale(),OBR.scene.grid.snapPosition({x:0,y:0},1,true,false)]);
      session={movement:createMovement(item.id,item.position,d.mode),dpi,rule,scale:scale.parsed,corner,pathId:null,labelId:null,painting:null,dirty:false,disposed:false};
      await overlay(session);await active(true);
    }
    if(drag!==d||d.cancelled)return;
    d.session=session;d.previous=saveMovement(session.movement);
    d.offset={x:session.movement.cursor.x-event.pointerPosition.x,y:session.movement.cursor.y-event.pointerPosition.y};
    d.interaction=await OBR.interaction.startItemInteraction(item);
    if(drag!==d||d.cancelled){try{d.interaction[1]();}catch{}return;}
    d.ready=true;process(d);
  })().catch(e=>{warn("Could not start movement",e);if(drag===d)drag=null;try{d.interaction?.[1]();}catch{}});
}
async function undoCommitted(){
  if(!session||drag||closing)return;
  const s=session,previous=saveMovement(s.movement);
  if(!rewindCommittedSegment(s.movement))return;
  try{const position=clonePoint(s.movement.cursor);await OBR.scene.items.updateItems([s.movement.tokenId],items=>{for(const item of items)item.position=position;});refresh(s);}
  catch(e){restoreMovement(s.movement,previous);warn("Could not undo the last movement segment",e);}
}
function mode(id,title,graphic){
  return {id,icons:[{icon:icon(graphic),label:title,filter:{activeTools:[TOOL]}}],
    onToolDragStart:startDrag,
    onToolDragMove(_,event){if(drag&&!drag.ending)enqueue(drag,{type:"move",pointer:clonePoint(event.pointerPosition)});},
    onToolDragEnd(_,event){finishDragEvent(drag,event.pointerPosition);},
    onToolDragCancel(){void cancelDrag();},
    onDeactivate(){void switchTool();},
    onKeyDown(_,event){
      if(event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
      if(event.code==="KeyE"&&drag&&!drag.ending)enqueue(drag,{type:"pin"});
      if(event.code==="Backspace"||event.code==="KeyZ"){
        if(drag&&!drag.ending)enqueue(drag,{type:"undo"});
        else void undoCommitted();
      }
    }
  };
}
async function register(){
  const touch=window.matchMedia?.("(pointer: coarse)")?.matches??false;
  // Register the tool first without referencing a mode that does not yet exist.
  await OBR.tool.create({id:TOOL,defaultMetadata:{[ACTIVE]:false},icons:[{icon:icon("route"),label:"Waypoint Movement"}]});
  say("Right-hand movement tool registered; configuring modes…");
  await OBR.tool.createMode(mode(WAYPOINT,"Waypoint Movement · E for corners","route"));
  await OBR.tool.createMode(mode(TRACE,"Trace Movement · follow drag","trace"));
  await OBR.tool.createAction({id:END,icons:[{icon:icon("end"),label:"End Movement",filter:{activeTools:[TOOL]}}],onClick(){void endMovement();}});
  await OBR.tool.createAction({id:UNDO,icons:[{icon:icon("undo"),label:"Undo Last Waypoint",filter:{activeTools:[TOOL]}}],onClick(){if(drag&&!drag.ending)enqueue(drag,{type:"undo"});else void undoCommitted();}});
  await active(false);
  try { await OBR.tool.activateMode(TOOL,touch?TRACE:WAYPOINT); }
  catch(e) { console.warn("Movement mode not preselected; click a mode in the toolbar.",e); }
  OBR.tool.onToolChange(id=>{if(id!==TOOL)void switchTool();});
  OBR.tool.onToolModeChange(id=>{if((id===WAYPOINT||id===TRACE)&&session&&session.movement.mode!==(id===TRACE?MODES.TRACE:MODES.WAYPOINT))void endMovement();});
  say("Waypoint Movement registered. Select its tool in the Owlbear room.");
}
async function boot(){
  // Load the locally hosted pinned SDK; Owlbear no longer needs a third-party CDN.
  const sdk=globalThis.__WAYPOINT_TEST_SDK__ ?? await import("../vendor/owlbear-sdk-3.1.0.mjs");
  ({default:OBR,buildPath,buildLabel,Command}=sdk);
  if(!OBR.isAvailable){say("Extension files loaded. Install the public manifest in Owlbear to activate.");return;}
  OBR.onReady(()=>{void register().catch(e=>warn("Tool registration failed",e));});
}
boot().catch(e=>{say("SDK loading failed; check the browser console.");console.error(e);});
