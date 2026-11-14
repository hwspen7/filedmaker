// Marker profile selection without renderer dependencies.
export function markerPlan(surface){
  const sport=surface?.sport;
  if(sport==='basketball')return {sport,scoreboard:'center-hung',goals:'hoops',benches:2};
  if(sport==='football')return {sport,scoreboard:'end-zone',goals:'goalposts',benches:2};
  if(sport==='soccer')return {sport,scoreboard:'sideline',goals:'goal-nets',benches:2};
  throw new Error('Unsupported playing surface for marker kit.');
}
