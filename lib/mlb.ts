const BRAVES_TEAM_ID = 144;
const BASE = 'https://statsapi.mlb.com/api';

export async function getTodaysGame() {
  const today = new Date().toISOString().split('T')[0];
  const url = `${BASE}/v1/schedule?sportId=1&teamId=${BRAVES_TEAM_ID}&date=${today}&hydrate=probablePitcher,linescore,team`;
  const res = await fetch(url, { next: { revalidate: 30 } });
  const data = await res.json();
  return data.dates?.[0]?.games?.[0] ?? null;
}export async function getStandings() {
  const url = `https://statsapi.mlb.com/api/v1/standings?leagueId=104&season=${new Date().getFullYear()}&standingsTypes=regularSeason`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  return res.json();
}

export async function getLast10() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 14);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=144&startDate=${fmt(start)}&endDate=${fmt(end)}&hydrate=team,linescore`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  const data = await res.json();
  
  const games = (data.dates ?? []).flatMap((d: any) => d.games);
  return games.filter((g: any) => g.status?.abstractGameState === 'Final').slice(-10);
}