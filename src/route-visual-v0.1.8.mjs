// Bounded visual geometry for a shared Owlbear PATH item.
// This function NEVER modifies movement's original anchors or its measured distance.
const SAME=1e-9;
const distanceToSegmentSquared=(p,a,b)=>{
  const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
  if(den<=SAME)return (p.x-a.x)**2+(p.y-a.y)**2;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den));
  const x=a.x+t*dx,y=a.y+t*dy;
  return (p.x-x)**2+(p.y-y)**2;
};
function rdpIndices(points,toleranceSquared){
  const n=points.length,keep=new Uint8Array(n),stack=[[0,n-1]];
  keep[0]=keep[n-1]=1;
  while(stack.length){
    const [start,end]=stack.pop();
    if(end<=start+1)continue;
    let largest=-1,index=-1;
    for(let i=start+1;i<end;i++){
      const dist=distanceToSegmentSquared(points[i],points[start],points[end]);
      if(dist>largest){largest=dist;index=i;}
    }
    if(largest>toleranceSquared&&index>start&&index<end){
      keep[index]=1;
      stack.push([start,index],[index,end]);
    }
  }
  const indices=[];
  for(let i=0;i<n;i++)if(keep[i])indices.push(i);
  return indices;
}
const same=(a,b)=>Math.abs(a.x-b.x)<SAME&&Math.abs(a.y-b.y)<SAME;
export const MAX_VISIBLE_POINTS=144;
export const MIN_UPDATE_INTERVAL_MS=100;
// Preserve hundreds of genuine turns under normal use; only trim an exceptionally
// overloaded asynchronous input backlog.
export const MAX_TRACE_QUEUE=512;
export function visibleRoute(points,limit=MAX_VISIBLE_POINTS){
  const result=[];
  for(const p of points){
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
    if(!result.length||!same(result[result.length-1],p))result.push({x:p.x,y:p.y});
  }
  const max=Math.max(2,Math.floor(limit));
  if(result.length<=max)return result;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of result){
    minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);
    maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);
  }
  const upper=(maxX-minX)**2+(maxY-minY)**2+1;
  let low=0,high=upper,chosen=[0,result.length-1];
  // Binary search for the smallest simplification error that fits the
  // shared path budget. Iterative RDP avoids call-stack exhaustion.
  for(let step=0;step<16;step++){
    const test=(low+high)/2;
    const indices=rdpIndices(result,test);
    if(indices.length<=max){chosen=indices;high=test;}
    else low=test;
  }
  return chosen.map(index=>result[index]);
}
// When trace events arrive faster than Owlbear can snap them, retain endpoints
// and preferentially remove the least meaningful intermediate pending point.
// The current end-drag event is handled separately and can never be discarded.
export function boundTraceMoves(queue,limit=MAX_TRACE_QUEUE){
  const cap=Math.max(3,Math.floor(limit));
  while(queue.length>cap){
    let candidate=-1,minimum=Infinity;
    for(let i=1;i<queue.length-1;i++){
      const previous=queue[i-1],current=queue[i],next=queue[i+1];
      if(previous.type!=="move"||current.type!=="move"||next.type!=="move")continue;
      const a=previous.pointer,b=current.pointer,c=next.pointer;
      // Perpendicular deviation weighs corners more heavily than straight lines.
      const importance=distanceToSegmentSquared(b,a,c);
      if(importance<minimum){minimum=importance;candidate=i;}
    }
    // Non-move controls (pin/end/undo) must never be discarded.
    if(candidate<0)break;
    queue.splice(candidate,1);
  }
  return queue;
}
