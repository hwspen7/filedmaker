// Compatibility adapter for school and public seat viewer pages. No Three.js CDN.
import { NativeVenueRenderer } from './webgl.js';
import { buildVenuePlan } from './venuePlan.mjs';
export class SeatScene {
  constructor(canvas,onSeat=()=>{},onSection=()=>{}) {
    this.renderer=new NativeVenueRenderer(canvas,onSeat);
    this.selectedSeat=null;this.mode='orbit';this.viewOptions={posture:'seated',target:'center',zoom:1};
  }
  load(model){
    this.model=model;this.plan=buildVenuePlan(model);
    // Add an explicitly illustrative concert stage as regular WebGL box
    // instances. No unverified event seating or sightlines are claimed.
    if(model.project?.liveStage==='end'){
      const length=model.surface.length, width=model.surface.width;
      const stageWidth=Math.min(16,width*.79),depth=Math.min(8,length*.24);
      const z=-length*.27;
      const blocks=[
        [0,.55,z,stageWidth,1.1,depth,0,.14,.17,.24,-1],
        [0,3.3,z-depth*.48,stageWidth*.82,4.4,.18,0,.08,.10,.15,-1],
        [0,3.5,z-depth*.48+.11,stageWidth*.74,3.4,.08,0,.19,.36,.56,-1],
        [-stageWidth*.47,1.8,z, .18,3.6,depth,0,.12,.14,.21,-1],
        [stageWidth*.47,1.8,z, .18,3.6,depth,0,.12,.14,.21,-1],
      ];
      const existing=this.plan.instanceData;
      const extended=new Float32Array(existing.length+blocks.length*11);
      extended.set(existing);
      extended.set(blocks.flat(),existing.length);
      this.plan.instanceData=extended;
      this.plan.instanceCount=extended.length/11;
    }
    this.renderer.load(this.plan);
    this.selectedSeat=model.seats.find(s=>s.tier===0&&s.row===7)||model.seats[0]||null;
    this.renderer.setViewOptions(this.viewOptions);this.setView('orbit');}
  highlight(seat){this.selectedSeat=seat||null;this.renderer.highlight(seat);if(this.mode==='seat'&&seat)this.setView('seat');}
  setView(mode){this.mode=mode;
    const mapped={orbit:'overview',plan:'top',section:'section',seat:'human'}[mode]||'overview';
    if((mapped==='human'||mapped==='section')&&!this.selectedSeat)return;
    this.renderer.view(mapped,this.selectedSeat);}
  setViewOptions(opts){this.viewOptions={...this.viewOptions,...opts};this.renderer.setViewOptions(this.viewOptions);}
  resize(){this.renderer.resize();}
  capture(){return this.renderer.capture();}
  async exportGLB(){throw Error('GLB export remains in Legacy Editor. The new WebGL2 viewer exports accurate seat IDs and screenshots, not unverified construction geometry.');}
  dispose(){this.renderer.dispose();}
}
