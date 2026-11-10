// Route mathematics. No Owlbear API dependencies.
export const MODES = Object.freeze({WAYPOINT:"waypoint"});
const EPS=1e-6;
export const clonePoint=p=>({x:Number(p.x),y:Number(p.y)});
// Infer the token's existing snap lattice from the position Owlbear actually gave it.
// Size is ONLY a tie-breaker: an intentionally center-aligned Large token stays centered.
export function tokenFootprint(item){
  const dpi=Number(item?.grid?.dpi);
  const width=Number(item?.image?.width),height=Number(item?.image?.height);
  const sx=Math.abs(Number(item?.scale?.x??1)),sy=Math.abs(Number(item?.scale?.y??1));
  const cells=(length,scale)=>dpi>0&&length>0&&scale>0 ? Math.max(1,Math.round(length*scale/dpi)):1;
  return {columns:cells(width,sx),rows:cells(height,sy)};
}
function chooseAxis(existing,corner,center,size){
  const dCorner=Math.abs(existing-corner),dCenter=Math.abs(existing-center);
  if(Number.isFinite(dCorner)&&Number.isFinite(dCenter)){
    if(dCenter+1e-5<dCorner)return "center";
    if(dCorner+1e-5<dCenter)return "corner";
  }
  return size%2 ? "center" : "corner";
}
export function detectSnapLattice(token,corner,center){
  const footprint=tokenFootprint(token);
  const origin=token.position;
  return {
    x:chooseAxis(origin.x,corner.x,center.x,footprint.columns),
    y:chooseAxis(origin.y,corner.y,center.y,footprint.rows),
  };
}
export function combineSnappedAxes(original,corner,center,lattice){
  return {
    x:lattice.x==="corner" ? corner?.x??original.x : center?.x??original.x,
    y:lattice.y==="corner" ? corner?.y??original.y : center?.y??original.y,
  };
}
export const samePoint=(a,b)=>!!a&&!!b&&Math.abs(a.x-b.x)<EPS&&Math.abs(a.y-b.y)<EPS;
export function createMovement(tokenId,start){
  const origin=clonePoint(start);
  return {tokenId,origin,anchors:[clonePoint(origin)],cursor:clonePoint(origin),mode:MODES.WAYPOINT};
}
export function routePoints(m){
  const ps=m.anchors.map(clonePoint);
  if(!samePoint(ps[ps.length-1],m.cursor))ps.push(clonePoint(m.cursor));
  return ps;
}
function collinear(a,b,c){
  const abx=b.x-a.x,aby=b.y-a.y,bcx=c.x-b.x,bcy=c.y-b.y;
  const cross=abx*bcy-aby*bcx,dot=abx*bcx+aby*bcy,scale=Math.hypot(abx,aby)*Math.hypot(bcx,bcy);
  return scale>EPS && Math.abs(cross)<EPS*scale && dot>0;
}
function anchor(m,p,simplify=false){
  const point=clonePoint(p),ps=m.anchors;
  if(samePoint(ps[ps.length-1],point))return false;
  if(simplify && ps.length>1 && collinear(ps[ps.length-2],ps[ps.length-1],point))ps[ps.length-1]=point;
  else ps.push(point);
  return true;
}
export function moveCursor(m,p){
  if(samePoint(m.cursor,p))return false;
  m.cursor=clonePoint(p);
  return true;
}
export const pinWaypoint=m=>anchor(m,m.cursor,false);
export const finishDrag=m=>anchor(m,m.cursor,false);
export const saveMovement=m=>({anchors:m.anchors.map(clonePoint),cursor:clonePoint(m.cursor)});
export function restoreMovement(m,s){
  m.anchors=s.anchors.map(clonePoint);m.cursor=clonePoint(s.cursor);
}
export function undoWaypoint(m){
  if(m.anchors.length<=1)return false;
  m.anchors.pop();return true;
}
export function rewindCommittedSegment(m){
  if(m.anchors.length<=1)return false;
  m.anchors.pop();m.cursor=clonePoint(m.anchors[m.anchors.length-1]);return true;
}
// Diagonal alternation remains cumulative across the entire route.
export function measureCells(points,dpi,rule="CHEBYSHEV"){
  if(!(dpi>0)||points.length<2)return 0;
  let total=0,straight=0,diagonal=0;
  for(let i=1;i<points.length;i++){
    const dx=Math.abs(points[i].x-points[i-1].x)/dpi;
    const dy=Math.abs(points[i].y-points[i-1].y)/dpi;
    switch(rule){
      case "MANHATTAN":total+=dx+dy;break;
      case "EUCLIDEAN":total+=Math.hypot(dx,dy);break;
      case "ALTERNATING":diagonal+=Math.min(dx,dy);straight+=Math.max(dx,dy)-Math.min(dx,dy);break;
      default:total+=Math.max(dx,dy);break;
    }
  }
  return rule==="ALTERNATING"?straight+diagonal+Math.floor((diagonal+EPS)/2):total;
}
export const measureDistance=(m,{dpi,rule,multiplier=5}={})=>measureCells(routePoints(m),dpi,rule)*multiplier;
export function formatDistance(value,unit="ft",digits=0){
  const precision=Math.max(0,Math.min(4,Number(digits)||0));
  return Number(value||0).toFixed(precision)+" "+(unit||"units");
}
