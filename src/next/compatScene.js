// Compatibility adapter for school and public seat viewer pages. No Three.js CDN.
import { NativeVenueRenderer } from './webgl.js';
import { buildVenuePlan } from './venuePlan.mjs';
export class SeatScene {
  constructor(canvas,onSeat=()=>{},onSection=()=>{}) {
    this.renderer=new NativeVenueRenderer(canvas,onSeat);
    this.selectedSeat=null;this.mode='orbit';this.viewOptions={posture:'seated',target:'center',zoom:1};
  }
  load(model){this.model=model;this.plan=buildVenuePlan(model);this.renderer.load(this.plan);
    this.selectedSeat=model.seats.find(s=>s.tier===0&&s.row===7)||model.seats[0]||null;
    this.renderer.setViewOptions(this.viewOptions);this.setView('orbit');}
  highlight(seat){this.selectedSeat=seat||null;if(this.mode==='seat'&&seat)this.setView('seat');}
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
