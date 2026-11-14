// Inert SVG geometry importer. No remote URLs, scripts, styles or SVG markup enter the DOM.
// Supports polygon, polyline, rect, line, circle, ellipse and path M/L/H/V/C/S/Q/T/A/Z.
const MAX_BYTES = 1_500_000;
const MAX_PATHS = 160;
const MAX_POINTS = 25000;
const EPS = 1e-8;
const NO_CONTENT = new Set(['defs', 'clippath', 'mask', 'pattern', 'symbol', 'marker', 'filter', 'lineargradient', 'radialgradient', 'foreignobject', 'script', 'style']);
const matrixId = () => [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, p) => ({ x: m[0] * p.x + m[2] * p.z + m[4], z: m[1] * p.x + m[3] * p.z + m[5] });
const numericTokens = text => (String(text).match(/[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?/g) || []).map(Number);
const fnum = (attrs, name, fallback = 0) => {
  const v = Number(attrs[name]);
  return attrs[name] == null ? fallback : v;
};
function attributes(text) {
  const out = {};
  const re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(text))) out[m[1].toLowerCase()] = m[2] ?? m[3];
  return out;
}
function parseTransform(source = '') {
  let result = matrixId();
  const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(source))) {
    const v = numericTokens(m[2]);
    let t;
    if (m[1] === 'translate' && v.length >= 1) t = [1, 0, 0, 1, v[0], v[1] || 0];
    else if (m[1] === 'scale' && v.length >= 1) t = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
    else if (m[1] === 'rotate' && v.length >= 1) {
      const a = v[0] * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      t = [c, s, -s, c, 0, 0];
      if (v.length >= 3) t = mul(mul([1, 0, 0, 1, v[1], v[2]], t), [1, 0, 0, 1, -v[1], -v[2]]);
    } else if (m[1] === 'matrix' && v.length === 6) t = v;
    else if (m[1] === 'skewX' && v.length === 1) t = [1, 0, Math.tan(v[0] * Math.PI / 180), 1, 0, 0];
    else if (m[1] === 'skewY' && v.length === 1) t = [1, Math.tan(v[0] * Math.PI / 180), 0, 1, 0, 0];
    else throw new Error(`Unsupported SVG transform: ${m[1]}`);
    if (!t.every(Number.isFinite)) throw new Error('Invalid SVG transform.');
    result = mul(result, t);
  }
  return result;
}
function makePath(points, closed = false) {
  const cleaned = [];
  for (const p of points) if (!cleaned.length || Math.hypot(cleaned.at(-1).x - p.x, cleaned.at(-1).z - p.z) > EPS) cleaned.push(p);
  if (closed && cleaned.length > 1 && Math.hypot(cleaned.at(0).x - cleaned.at(-1).x, cleaned.at(0).z - cleaned.at(-1).z) < EPS) cleaned.pop();
  return { points: cleaned, closed };
}
// SVG endpoint-to-center conversion, see SVG implementation notes (F.6.5).
function sampleArc(p0, rx, ry, degrees, large, sweep, p1) {
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (rx < EPS || ry < EPS || Math.hypot(p0.x - p1.x, p0.z - p1.z) < EPS) return [p1];
  const phi = degrees * Math.PI / 180, c = Math.cos(phi), s = Math.sin(phi);
  const dx = (p0.x - p1.x) / 2, dy = (p0.z - p1.z) / 2;
  const xp = c * dx + s * dy, yp = -s * dx + c * dy;
  const factor = Math.sqrt((xp / rx) ** 2 + (yp / ry) ** 2);
  if (factor > 1) { rx *= factor; ry *= factor; }
  const l = (xp / rx) ** 2 + (yp / ry) ** 2;
  const q = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, (1 - l) / Math.max(l, EPS)));
  const cxp = q * rx * yp / ry, cyp = -q * ry * xp / rx;
  const cx = c * cxp - s * cyp + (p0.x + p1.x) / 2;
  const cy = s * cxp + c * cyp + (p0.z + p1.z) / 2;
  const theta = Math.atan2((yp - cyp) / ry, (xp - cxp) / rx);
  let theta0 = Math.atan2((-yp - cyp) / ry, (-xp - cxp) / rx);
  let delta = theta - theta0;
  if (sweep && delta < 0) delta += Math.PI * 2;
  if (!sweep && delta > 0) delta -= Math.PI * 2;
  const steps = Math.max(4, Math.min(96, Math.ceil(Math.abs(delta) * Math.max(rx, ry) / 5)));
  return Array.from({ length: steps }, (_, i) => {
    const a = theta0 + delta * (i + 1) / steps;
    return { x: cx + c * rx * Math.cos(a) - s * ry * Math.sin(a), z: cy + s * rx * Math.cos(a) + c * ry * Math.sin(a) };
  });
}
export function parsePathData(data) {
  if (data.length > 500000) throw new Error('SVG path is too large.');
  const tokenRe = /[a-zA-Z]|[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?/g;
  const tokens = data.match(tokenRe) || [];
  if (data.replace(tokenRe, '').replace(/[\s,]/g, '').length) throw new Error('Unsupported SVG path syntax.');
  const sizes = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
  const result = []; let points = [], closed = false, p = { x: 0, z: 0 }, start = p, cmd = '', lastCtrl = null, lastCmd = '';
  let index = 0;
  const flush = () => { if (points.length >= 2) result.push(makePath(points, closed)); points = []; closed = false; };
  while (index < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[index])) { cmd = tokens[index++]; if (!Object.hasOwn(sizes, cmd.toUpperCase())) throw new Error(`Unsupported SVG path command ${cmd}.`); }
    if (!cmd) throw new Error('SVG path has no command.');
    const upper = cmd.toUpperCase(), relative = cmd !== upper, n = sizes[upper];
    if (upper === 'Z') { closed = true; p = start; flush(); cmd = ''; lastCtrl = null; lastCmd = 'Z'; continue; }
    if (index + n > tokens.length || tokens.slice(index, index + n).some(x => /^[a-zA-Z]$/.test(x))) throw new Error('Malformed SVG path segment.');
    const vals = tokens.slice(index, index + n).map(Number); index += n;
    const to = (x, z) => ({ x: relative ? p.x + x : x, z: relative ? p.z + z : z });
    let next, additions = [];
    if (upper === 'M' || upper === 'L') next = to(vals[0], vals[1]);
    else if (upper === 'H') next = { x: (relative ? p.x : 0) + vals[0], z: p.z };
    else if (upper === 'V') next = { x: p.x, z: (relative ? p.z : 0) + vals[0] };
    else if (upper === 'C' || upper === 'S' || upper === 'Q' || upper === 'T') {
      let cp1, cp2;
      if (upper === 'C') { cp1 = to(vals[0], vals[1]); cp2 = to(vals[2], vals[3]); next = to(vals[4], vals[5]); }
      if (upper === 'S') { cp1 = ['C','S'].includes(lastCmd) && lastCtrl ? { x: 2 * p.x - lastCtrl.x, z: 2 * p.z - lastCtrl.z } : p; cp2 = to(vals[0], vals[1]); next = to(vals[2], vals[3]); }
      if (upper === 'Q') { cp1 = to(vals[0], vals[1]); next = to(vals[2], vals[3]); }
      if (upper === 'T') { cp1 = ['Q','T'].includes(lastCmd) && lastCtrl ? { x: 2 * p.x - lastCtrl.x, z: 2 * p.z - lastCtrl.z } : p; next = to(vals[0], vals[1]); }
      const cubic = upper === 'C' || upper === 'S';
      const detail = Math.max(8, Math.min(64, Math.ceil(Math.hypot(next.x - p.x, next.z - p.z) / 3)));
      for (let i = 1; i <= detail; i++) {
        const t = i / detail, u = 1 - t;
        const x = cubic ? u ** 3 * p.x + 3 * u * u * t * cp1.x + 3 * u * t * t * cp2.x + t ** 3 * next.x : u * u * p.x + 2 * u * t * cp1.x + t * t * next.x;
        const z = cubic ? u ** 3 * p.z + 3 * u * u * t * cp1.z + 3 * u * t * t * cp2.z + t ** 3 * next.z : u * u * p.z + 2 * u * t * cp1.z + t * t * next.z;
        additions.push({ x, z });
      }
      lastCtrl = cubic ? cp2 : cp1;
    } else if (upper === 'A') { next = to(vals[5], vals[6]); additions = sampleArc(p, vals[0], vals[1], vals[2], Boolean(vals[3]), Boolean(vals[4]), next); }
    if (upper === 'M') { flush(); start = next; points = [next]; cmd = relative ? 'l' : 'L'; }
    else { if (!points.length) points = [p]; points.push(...(additions.length ? additions : [next])); }
    if (!['C','S','Q','T'].includes(upper)) lastCtrl = null;
    p = next;
    lastCmd = upper;
    if (points.length > MAX_POINTS) throw new Error('SVG path exceeds point limit.');
  }
  flush();
  return result;
}
export function parseSvgPlan(source) {
  if (typeof source !== 'string' || source.length < 10 || source.length > MAX_BYTES || !/<svg[\s>]/i.test(source)) throw new Error('Select an SVG document up to 1.5 MB.');
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('SVG documents with a DTD or entities are not supported.');
  const root = source.match(/<svg\b([^>]*)>/i);
  if (!root) throw new Error('Missing SVG root.');
  const rootAttr = attributes(root[1]);
  const vb = numericTokens(rootAttr.viewbox || '');
  if (vb.length !== 4 || vb.some(x => !Number.isFinite(x)) || vb[2] <= 0 || vb[3] <= 0 || vb[2] > 100000 || vb[3] > 100000) throw new Error('SVG must include a valid viewBox.');
  const cx = vb[0] + vb[2] / 2, cz = vb[1] + vb[3] / 2;
  const all = []; const stack = [{ tag: '@root', matrix: matrixId(), ignored: false }];
  const tokenRe = /<\/?[A-Za-z][^>]*>/g;
  let match;
  while ((match = tokenRe.exec(source))) {
    const tagText = match[0], closing = /^<\//.test(tagText);
    const name = (tagText.match(/^<\/?([\w:-]+)/) || [,''])[1].toLowerCase();
    if (closing) { if (stack.length > 1) stack.pop(); continue; }
    const selfClosing = /\/\s*>$/.test(tagText);
    const a = attributes(tagText);
    const parent = stack.at(-1);
    const ignored = parent.ignored || NO_CONTENT.has(name);
    const m = mul(parent.matrix, parseTransform(a.transform || ''));
    if (!ignored && ['path','polygon','polyline','rect','line','circle','ellipse'].includes(name)) {
      const label = (a.id || a['inkscape:label'] || `${name} ${all.length + 1}`).slice(0, 80);
      let shapes = [];
      if (name === 'path') shapes = parsePathData(a.d || '');
      else if (name === 'polygon' || name === 'polyline') {
        const v = numericTokens(a.points || '');
        if (v.length < 4 || v.length % 2) throw new Error('Invalid SVG polygon coordinates.');
        shapes = [makePath(Array.from({length: v.length / 2}, (_, i) => ({x:v[2*i], z:v[2*i+1]})), name === 'polygon')];
      } else if (name === 'rect') {
        const x = fnum(a,'x'), z = fnum(a,'y'), w = fnum(a,'width'), h = fnum(a,'height');
        shapes = [makePath([{x,z},{x:x+w,z},{x:x+w,z:z+h},{x,z:z+h}],true)];
      } else if (name === 'line') shapes = [{points:[{x:fnum(a,'x1'),z:fnum(a,'y1')},{x:fnum(a,'x2'),z:fnum(a,'y2')}],closed:false}];
      else {
        const x=fnum(a,'cx'),z=fnum(a,'cy'),rx=fnum(a,name==='circle'?'r':'rx'),rz=fnum(a,name==='circle'?'r':'ry');
        if (rx>0 && rz>0) shapes=[makePath(Array.from({length:96},(_,i)=>({x:x+Math.cos(2*Math.PI*i/96)*rx,z:z+Math.sin(2*Math.PI*i/96)*rz})),true)];
      }
      for (const shape of shapes) {
        if (shape.points.length < 2) continue;
        if (all.length >= MAX_PATHS) throw new Error('SVG contains too many paths (maximum 160).');
        const points = shape.points.map(p => { const t=apply(m,p); return {x:Math.round((t.x-cx)*1000)/1000,z:Math.round((t.z-cz)*1000)/1000}; });
        if (points.some(p => !Number.isFinite(p.x)||!Number.isFinite(p.z)||Math.abs(p.x)>100000||Math.abs(p.z)>100000)) throw new Error('SVG geometry outside supported coordinate range.');
        all.push({ name: label, closed: shape.closed, points });
        if (all.reduce((sum,p)=>sum+p.points.length,0)>MAX_POINTS) throw new Error('SVG contains too many vertices (maximum 25,000).');
      }
    }
    if (!selfClosing) stack.push({tag:name,matrix:m,ignored});
  }
  if (!all.length) throw new Error('No supported vector geometry found in SVG.');
  return { name: 'Imported SVG', viewBox: vb, scale: 1, rotation: 0, offsetX: 0, offsetZ: 0, visible: true, paths: all };
}
export function planPoint(plan, point) {
  const angle = plan.rotation * Math.PI / 180, c=Math.cos(angle),s=Math.sin(angle);
  return {x: plan.offsetX + plan.scale * (c*point.x-s*point.z), z: plan.offsetZ + plan.scale*(s*point.x+c*point.z)};
}
function containsOrigin(points) {
  let within=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];
    if(((a.z>0)!==(b.z>0))&&(0<(b.x-a.x)*(-a.z)/(b.z-a.z)+a.x))within=!within;
  }
  return within;
}
export function tracePlanOutline(plan, pathIndex, surface, count = 32) {
  const path=plan?.paths?.[pathIndex];
  if(!path?.closed || path.points.length<3) throw new Error('Choose a closed SVG path for outline tracing.');
  const polygon=path.points.map(p=>planPoint(plan,p));
  if(!containsOrigin(polygon)) throw new Error('Selected path must enclose the center of the playing surface. Adjust scale/position first.');
  const points=[];
  for(let i=0;i<count;i++){
    const a=2*Math.PI*i/count,dx=Math.cos(a),dz=Math.sin(a),hits=[];
    for(let j=0;j<polygon.length;j++){
      const p=polygon[j],q=polygon[(j+1)%polygon.length],vx=q.x-p.x,vz=q.z-p.z;
      const den=dx*vz-dz*vx;
      if(Math.abs(den)<EPS)continue;
      const t=(p.x*vz-p.z*vx)/den, u=(p.x*dz-p.z*dx)/den;
      if(t>EPS&&u>=-EPS&&u<=1+EPS)hits.push(t);
    }
    hits.sort((a,b)=>a-b);
    if(!hits.length) throw new Error('Could not trace a radial outline from the selected path.');
    const radius=hits[0];
    points.push({x:Math.cos(a)*radius,z:Math.sin(a)*radius});
  }
  return {mode:'custom',points};
}
