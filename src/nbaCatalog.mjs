// 2026–27 NBA venue directory. These are names and affiliations, NOT surveyed 3D models.
// Primary reference: https://www.nba.com/news/all-30-nba-arenas-by-team (2026-10-28).
// Philadelphia venue naming additionally verified with the venue operator.
export const NBA_DIRECTORY_SOURCE = 'https://www.nba.com/news/all-30-nba-arenas-by-team';
const teams = [
  ['hawks','Atlanta Hawks','State Farm Arena','Atlanta','GA','US'],
  ['celtics','Boston Celtics','TD Garden','Boston','MA','US'],
  ['nets','Brooklyn Nets','Barclays Center','Brooklyn','NY','US'],
  ['hornets','Charlotte Hornets','Spectrum Center','Charlotte','NC','US'],
  ['bulls','Chicago Bulls','United Center','Chicago','IL','US'],
  ['cavaliers','Cleveland Cavaliers','Rocket Arena','Cleveland','OH','US'],
  ['mavericks','Dallas Mavericks','American Airlines Center','Dallas','TX','US'],
  ['nuggets','Denver Nuggets','Ball Arena','Denver','CO','US'],
  ['pistons','Detroit Pistons','Little Caesars Arena','Detroit','MI','US'],
  ['warriors','Golden State Warriors','Chase Center','San Francisco','CA','US'],
  ['rockets','Houston Rockets','Toyota Center','Houston','TX','US'],
  ['pacers','Indiana Pacers','Gainbridge Fieldhouse','Indianapolis','IN','US'],
  ['clippers','Los Angeles Clippers','Intuit Dome','Inglewood','CA','US'],
  ['lakers','Los Angeles Lakers','Crypto.com Arena','Los Angeles','CA','US'],
  ['grizzlies','Memphis Grizzlies','FedExForum','Memphis','TN','US'],
  ['heat','Miami Heat','Kaseya Center','Miami','FL','US'],
  ['bucks','Milwaukee Bucks','Fiserv Forum','Milwaukee','WI','US'],
  ['timberwolves','Minnesota Timberwolves','Target Center','Minneapolis','MN','US'],
  ['pelicans','New Orleans Pelicans','Smoothie King Center','New Orleans','LA','US'],
  ['knicks','New York Knicks','Madison Square Garden','New York','NY','US'],
  ['thunder','Oklahoma City Thunder','Paycom Center','Oklahoma City','OK','US'],
  ['magic','Orlando Magic','Kia Center','Orlando','FL','US'],
  ['sixers','Philadelphia 76ers','Xfinity Mobile Arena','Philadelphia','PA','US'],
  ['suns','Phoenix Suns','Mortgage Matchup Center','Phoenix','AZ','US'],
  ['blazers','Portland Trail Blazers','Moda Center','Portland','OR','US'],
  ['kings','Sacramento Kings','Golden 1 Center','Sacramento','CA','US'],
  ['spurs','San Antonio Spurs','Frost Bank Center','San Antonio','TX','US'],
  ['raptors','Toronto Raptors','Scotiabank Arena','Toronto','ON','CA'],
  ['jazz','Utah Jazz','Delta Center','Salt Lake City','UT','US'],
  ['wizards','Washington Wizards','Capital One Arena','Washington','DC','US'],
];
export const NBA_CATALOG = Object.freeze(teams.map(([id,team,arena,city,region,country])=>Object.freeze({
  id,team,arena,city,region,country,league:'NBA',season:'2026-27',
  identitySource:id==='sixers' ? 'https://comcastspectacor.com/news/2025/05/xfinity-mobile-arena-new-name/' : NBA_DIRECTORY_SOURCE,
  modelStatus: ['knicks','warriors','lakers','bulls','clippers'].includes(id) ? 'documented-features-and-illustrative-geometry' : 'identity-only',
})));
export const NBA_CATALOG_IDS = Object.freeze(NBA_CATALOG.map(item=>item.id));
export function getNBAArena(id){return NBA_CATALOG.find(item=>item.id===id)||null;}
