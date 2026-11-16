// Deterministic illustrative concert stage augmentation for the shared venue plan.
// Geometry is in metres. This does not assert any promoter's real stage layout.
export function addIllustrativeConcertStage(plan, model) {
  if (model?.project?.liveStage !== 'end') return plan;
  const length = Number(model?.surface?.length);
  const width = Number(model?.surface?.width);
  if (!Number.isFinite(length) || !Number.isFinite(width) || length <= 0 || width <= 0)
    throw new Error('The concert stage requires a valid playing surface.');
  const stageWidth = Math.min(16, width * .79);
  const depth = Math.min(8, length * .24);
  const z = -length * .27;
  // Each WebGL box has position XYZ, dimensions XYZ, yaw, RGB and pick ID.
  // Negative pick IDs prevent the stage being misidentified as a ticket seat.
  const blocks = [
    [0,.55,z,stageWidth,1.1,depth,0,.14,.17,.24,-1],
    [0,3.3,z-depth*.48,stageWidth*.82,4.4,.18,0,.08,.10,.15,-1],
    [0,3.5,z-depth*.48+.11,stageWidth*.74,3.4,.08,0,.19,.36,.56,-1],
    [-stageWidth*.47,1.8,z,.18,3.6,depth,0,.12,.14,.21,-1],
    [stageWidth*.47,1.8,z,.18,3.6,depth,0,.12,.14,.21,-1],
  ];
  if (!plan?.instanceData || plan.instanceData.length%11)
    throw new Error('Stage requires a valid native WebGL instance plan.');
  const existing=plan.instanceData;
  const extended=new Float32Array(existing.length+blocks.length*11);
  extended.set(existing);
  extended.set(blocks.flat(), existing.length);
  return {...plan, instanceData:extended, instanceCount:extended.length/11,
    concertStageStatus:'illustrative-layout-not-an-official-event-map'};
}
