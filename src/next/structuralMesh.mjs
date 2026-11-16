// The mesh format is world XYZ followed by a unit normal per vertex.
function triangle(out, a, b, c, normal) {
  const [x,y,z] = b.map((v,i) => v-a[i]);
  const [u,v,w] = c.map((value,i) => value-a[i]);
  const cross = [y*w-z*v,z*u-x*w,x*v-y*u];
  if (cross.reduce((sum,value,i) => sum+value*normal[i],0) < 0) [b,c] = [c,b];
  const length = Math.hypot(...normal);
  const n = normal.map(value => value/length);
  out.push(...a,...n,...b,...n,...c,...n);
}

export function structuralQuad(out, a, b, c, d, normal) {
  triangle(out,a,b,c,normal);
  triangle(out,a,c,d,normal);
}

// Store the exterior roof separately so the cutaway can expose the bowl.
export function addRoofShell(out, perimeter, count, crownRise, thickness) {
  const bands = 8;
  const sample = (i, t, drop) => {
    const [x,y,z] = perimeter(i % count);
    return [x*t,y+crownRise*(1-t*t)-drop,z*t];
  };
  for (const [drop, sign] of [[0,1],[thickness,-1]]) {
    for (let i=0;i<count;i++) {
      const [x,,z] = perimeter(i);
      const length = Math.hypot(x,z);
      const normal = t => [sign*x*2*crownRise*t/length**2,sign,sign*z*2*crownRise*t/length**2];
      triangle(out,sample(i,0,drop),sample(i,1/bands,drop),sample(i+1,1/bands,drop),normal(0));
      for (let j=1;j<bands;j++) {
        const t=j/bands, next=(j+1)/bands;
        structuralQuad(out,sample(i,t,drop),sample(i+1,t,drop),
          sample(i+1,next,drop),sample(i,next,drop),normal((t+next)/2));
      }
    }
  }
}

export function addRoundVolume(out, x, z, radius, bottom, top) {
  const count=48;
  const point=(a,y)=>[x+radius*Math.cos(a),y,z+radius*Math.sin(a)];
  for(let i=0;i<count;i++){
    const a=i*2*Math.PI/count,b=(i+1)*2*Math.PI/count,m=(a+b)/2;
    structuralQuad(out,point(a,bottom),point(b,bottom),point(b,top),point(a,top),
      [Math.cos(m),0,Math.sin(m)]);
    triangle(out,[x,top,z],point(a,top),point(b,top),[0,1,0]);
  }
}
