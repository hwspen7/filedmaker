// Geometry planning for documented Schottenstein Center features. Placement is
// an explicit architectural estimate, NEVER a surveyed location.
import { resolveTiers } from './model.mjs';
import { isSchottensteinReference } from './venues.mjs';
import { OSU_FACTS } from './osuFacts.mjs';

export function schottensteinFeaturePlan(project) {
  if (!isSchottensteinReference(project)) return null;
  const tiers=resolveTiers(project);
  const highest=tiers.at(-1);
  const roofApprox=highest.startHeight + highest.rows * highest.rise + 7.5;
  const club=tiers[1] || tiers[0];
  const facts=OSU_FACTS['schottenstein-center'];
  return {
    evidence:facts.videoUpgrade.source,
    modelStatus:'screen feature identity documented; dimensions and position illustrative',
    board:{y:Math.max(12,Math.min(roofApprox-5,25)), widthM:6.8, heightM:3.6,
      faceCount:4, facetsPerFace:3, underbelly:true, geometryConfidence:'estimated'},
    ribbon:{y:club.startHeight + Math.max(1,club.rows)*club.rise + .4,
      widthM:facts.videoUpgrade.ribbonHeightInches*.0254,
      publishedHeightInches:facts.videoUpgrade.ribbonHeightInches,
      geometryConfidence:'estimated ring position'},
    upperCorners:{displayCountVisualized:4, geometryConfidence:'illustrative only'},
    documentedVomitoryDisplayCount:facts.videoUpgrade.vomitoryDisplayCount,
    positionedVomitoryDisplays:0,
    note:'43 is the official count of added displays, not a claim that 43 verified entrance coordinates were supplied.'
  };
}
