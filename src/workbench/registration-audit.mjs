// Independent checks of a court homography. The four fitting anchors have
// exactly zero training residual and cannot certify geometric accuracy.
import {registerCourt} from './registration.mjs';
export function assessRegistration(corners,width,length,checkpoints=[]){
  const homography=registerCourt(corners,width,length);
  if(!Array.isArray(checkpoints)||checkpoints.length>100)
    throw Error('Use at most 100 independent check points');
  const residuals=checkpoints.map((p,i)=>{
    if(!p||!Number.isFinite(p.pixelX)||!Number.isFinite(p.pixelY)||
      !Number.isFinite(p.actualX)||!Number.isFinite(p.actualZ))
      throw Error('Invalid independent check point '+(i+1));
    const prediction=homography.toWorld({x:p.pixelX,y:p.pixelY});
    return Math.hypot(prediction.x-p.actualX,prediction.z-p.actualZ);
  });
  const rms=residuals.length?
    Math.sqrt(residuals.reduce((s,x)=>s+x*x,0)/residuals.length):null;
  return {anchorTrainingResidualM:homography.residual,independentCheckpoints:residuals.length,
    rmsErrorM:rms,maxErrorM:residuals.length?Math.max(...residuals):null,
    status:!residuals.length?'unverified':rms<.15?'review':'recalibrate',
    note:residuals.length?'Check point residuals are independent of the four fitting anchors':
      'Exactly fitted corners do not establish real-world accuracy'};
}
