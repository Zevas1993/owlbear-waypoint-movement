// Route mathematics. No Owlbear API dependencies.
export const MODES = Object.freeze({WAYPOINT:"waypoint",TRACE:"trace"});
const EPS=1e-6;
export const clonePoint=p=>({x:Number(p.x),y:Number(p.y)});
export function snapSquare(position,dpi,corner={x:0,y:0}){
  if(!(dpi>0))return clonePoint(position);
  return {x:corner.x+Math.round((position.x-corner.x)/dpi)*dpi,y:corner.y+Math.round((position.y-corner.y)/dpi)*dpi};
}
// Token images are sized in their own source-grid DPI, independent of the scene DPI.
// Odd footprints align their image origin to cell centers; even footprints to intersections.
// Do this independently on each axis for rectangular 2x3 or 3x2 tokens.
export function tokenGridFootprint(item){
  const dpi=Number(item?.grid?.dpi);
  const width=Number(item?.image?.width);
  const height=Number(item?.image?.height);
  const scaleX=Math.abs(Number(item?.scale?.x??1));
  const scaleY=Math.abs(Number(item?.scale?.y??1));
  const cells=(dimension,scale)=>dpi>0&&dimension>0&&scale>0
    ?Math.max(1,Math.round(dimension*scale/dpi)):1;
  return {columns:cells(width,scaleX),rows:cells(height,scaleY)};
}
export function tokenSnapOrigin(item,corner,center){
  const {columns,rows}=tokenGridFootprint(item);
  return {
    x:columns%2===0?corner.x:center.x,
    y:rows%2===0?corner.y:center.y
  };
}
export const samePoint=(a,b)=>!!a&&!!b&&Math.abs(a.x-b.x)<EPS&&Math.abs(a.y-b.y)<EPS;
export function createMovement(tokenId,start,mode=MODES.WAYPOINT){
  const origin=clonePoint(start);
  return {tokenId,origin,anchors:[clonePoint(origin)],cursor:clonePoint(origin),mode:mode===MODES.TRACE?MODES.TRACE:MODES.WAYPOINT};
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
  if(m.mode===MODES.TRACE)anchor(m,p,true);
  return true;
}
export const pinWaypoint=m=>anchor(m,m.cursor,false);
export const finishDrag=m=>anchor(m,m.cursor,m.mode===MODES.TRACE);
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
