// MLB league averages — preseason 2026 defaults, overwritten live every 2 min
// from the MLB team-wide stats endpoint (all 30 teams aggregated).
const MLB_BAT={avg:.248,obp:.318,slg:.413,ops:.731,hr:14,rbi:52,sb:8,_live:false};
const MLB_PIT={era:4.20,whip:1.28,k9:8.8,bb9:3.2,fip:4.15,_live:false};
let DATA=null, currentTab='overview', refreshTimer=null, lastRenderTime=0;
let playerQuery='';         // Shared search filter for Stats + Cards tabs
const TABS=['overview','cards','trends','stats','standings'];

// ── HEALTH MONITOR ──
const HEALTH=(()=>{
  const KEY='braves_hlog';
  let log=[];
  let st={calls:0,errs:0,fixes:0,warns:0,start:Date.now(),lastSync:null,lastSyncPlayers:0};
  let status='green';
  try{log=JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){}

  function _dot(){const d=document.getElementById('health-dot');if(d){d.className=status}}
  function _save(){try{localStorage.setItem(KEY,JSON.stringify(log.slice(0,150)))}catch(e){}}

  function _add(icon,type,msg){
    log.unshift({icon,type,msg,ts:Date.now(),t:new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit'})});
    if(log.length>200)log=log.slice(0,200);
    _save();_dot();
  }

  function fix(msg){st.fixes++;if(status==='red')status='yellow';_add('🔧','fix',msg);}
  function warn(msg){st.warns++;if(status==='green')status='yellow';_add('⚠️','warn',msg);}
  function err(msg){st.errs++;status='red';_add('❌','err',msg);}
  function ok(msg,players=0){st.lastSync=Date.now();st.lastSyncPlayers=players;if(status!=='red')status='green';_add('✅','ok',msg);_dot();}
  function info(msg){_add('ℹ️','info',msg);}

  async function safeFetch(url,retries=3){
    st.calls++;
    const label=url.split('?')[0].split('/').slice(-2).join('/');
    for(let i=0;i<retries;i++){
      try{
        const ctrl=typeof AbortController!=='undefined'?new AbortController():null;
        const tid=ctrl?setTimeout(()=>ctrl.abort(),8000):null;
        const res=await fetch(url,ctrl?{signal:ctrl.signal}:{});
        if(tid)clearTimeout(tid);
        if(!res.ok)throw new Error(`HTTP ${res.status}`);
        return res;
      }catch(e){
        if(i<retries-1){
          const wait=(i+1)*900;
          fix(`Retry ${i+1}/${retries-1} for ${label} (${e.message}) — waiting ${wait}ms`);
          await new Promise(r=>setTimeout(r,wait));
        }else{
          err(`${label} failed after ${retries} attempts: ${e.message}`);
          throw e;
        }
      }
    }
  }

  function safeRender(name,fn){
    try{fn();}catch(e){
      fix(`Render crash in "${name}": ${e.message} — showing recovery UI`);
      const c=document.getElementById('content');
      if(c)c.innerHTML=`<div class="card" style="text-align:center;border-color:var(--crimson);margin-top:20px">
        <div style="color:var(--crimson);margin-bottom:12px;font-size:13px">⚠️ "${name}" tab crashed and was recovered</div>
        <button data-act="reload-tab" style="padding:10px 24px;border:1px solid var(--green);border-radius:8px;background:none;color:var(--green);font-family:'DM Sans',sans-serif;font-size:14px;cursor:pointer">↺ Reload Tab</button>
      </div>`;
    }
  }

  function uptime(){
    const ms=Date.now()-st.start;
    const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000);
    return h?`${h}h ${m}m`:m?`${m}m ${s}s`:`${s}s`;
  }

  function getLog(){return log;}
  function getSt(){return{...st,status};}
  function clearLog(){log=[];_save();fix('Health log cleared manually');}

  return{fix,warn,err,ok,info,safeFetch,safeRender,uptime,getLog,getSt,clearLog};
})();

const SEED={
  record:{w:49,l:26,pct:'.654',home:'27-11',away:'22-15',last10:'7-3',runDiff:'+74',nleRank:1,nlRank:1},
  weather:{condition:'Partly Cloudy',emoji:'⛅',temp:82,feelsLike:87,humidity:65,wind:8,windDir:'SW',rainChance:20,hiTemp:85,loTemp:70,uvIndex:8,_live:false,venue:'Truist Park',
    forecast:[{day:'Today',hi:85,lo:70,icon:'⛅',rain:20},{day:'Mon',hi:88,lo:71,icon:'☀️',rain:5},{day:'Tue',hi:86,lo:70,icon:'⛅',rain:15},{day:'Wed',hi:84,lo:69,icon:'🌦️',rain:40},{day:'Thu',hi:81,lo:67,icon:'🌧️',rain:55}],alert:null},
  batters:[
    {name:'Drake Baldwin',     pos:'C', avg:.311,obp:.395,slg:.558,ops:.953,hr:16,rbi:46,sb:1},
    {name:'Matt Olson',        pos:'1B',avg:.271,obp:.351,slg:.554,ops:.905,hr:19,rbi:54,sb:1},
    {name:'Michael Harris II', pos:'CF',avg:.318,obp:.352,slg:.541,ops:.893,hr:15,rbi:43,sb:5},
    {name:'Ronald Acuña Jr.',  pos:'RF',avg:.258,obp:.381,slg:.447,ops:.828,hr:9, rbi:26,sb:15},
    {name:'Jarred Kelenic',    pos:'LF',avg:.279,obp:.338,slg:.481,ops:.819,hr:11,rbi:33,sb:3},
    {name:'Ozzie Albies',      pos:'2B',avg:.268,obp:.321,slg:.441,ops:.762,hr:10,rbi:34,sb:2},
    {name:'Jorge Mateo',       pos:'SS',avg:.291,obp:.332,slg:.412,ops:.744,hr:4, rbi:17,sb:9},
    {name:'Travis d\'Arnaud',  pos:'C', avg:.255,obp:.310,slg:.429,ops:.739,hr:7, rbi:22,sb:0},
    {name:'Austin Riley',      pos:'3B',avg:.218,obp:.292,slg:.374,ops:.666,hr:9, rbi:37,sb:2},
  ],
  pitchers:[
    {name:'Chris Sale',      pos:'SP',era:1.89,whip:0.91,k9:11.20,bb9:2.14,fip:2.88,w:9, sv:0},
    {name:'Spencer Strider', pos:'SP',era:2.84,whip:1.04,k9:12.30,bb9:3.10,fip:3.15,w:7, sv:0},
    {name:'Reynaldo López',  pos:'SP',era:3.22,whip:1.19,k9:8.40, bb9:3.50,fip:3.91,w:5, sv:0},
    {name:'Grant Holmes',    pos:'SP',era:3.68,whip:1.28,k9:8.10, bb9:3.80,fip:4.21,w:5, sv:0},
    {name:'Bryce Elder',     pos:'SP',era:3.95,whip:1.31,k9:7.40, bb9:3.20,fip:4.08,w:4, sv:0},
    {name:'Raisel Iglesias', pos:'RP',era:0.93,whip:0.82,k9:11.10,bb9:1.40,fip:2.05,w:1, sv:13},
    {name:'Dylan Lee',       pos:'RP',era:1.18,whip:0.58,k9:11.40,bb9:0.90,fip:1.80,w:3, sv:0},
    {name:'A.J. Minter',     pos:'RP',era:2.45,whip:1.02,k9:10.20,bb9:3.10,fip:2.98,w:2, sv:2},
    {name:'Tyler Kinley',    pos:'RP',era:3.04,whip:1.14,k9:9.60, bb9:3.00,fip:3.44,w:4, sv:0},
    {name:'Pierce Johnson',  pos:'RP',era:3.38,whip:1.21,k9:9.10, bb9:3.40,fip:3.72,w:2, sv:1},
  ],
  nle:[
    {name:'Atlanta Braves',       abbr:'ATL',w:49,l:26},
    {name:'New York Mets',        abbr:'NYM',w:38,l:34},
    {name:'Philadelphia Phillies',abbr:'PHI',w:36,l:36},
    {name:'Washington Nationals', abbr:'WSH',w:30,l:43},
    {name:'Miami Marlins',        abbr:'MIA',w:22,l:52},
  ],
  mlbTop:[
    {name:'Atlanta Braves',       abbr:'ATL',w:49,l:26},
    {name:'Los Angeles Dodgers',  abbr:'LAD',w:45,l:27},
    {name:'New York Yankees',     abbr:'NYY',w:43,l:29},
    {name:'Milwaukee Brewers',    abbr:'MIL',w:41,l:31},
    {name:'Cleveland Guardians',  abbr:'CLE',w:40,l:33},
    {name:'San Diego Padres',     abbr:'SD', w:39,l:33},
    {name:'Tampa Bay Rays',       abbr:'TB', w:38,l:34},
    {name:'Chicago Cubs',         abbr:'CHC',w:36,l:37},
  ],
  nextGames:[
    {n:1,date:'Mon Jun 16',time:'7:20 PM EDT',opp:'NYM',loc:'Truist Park'},
    {n:2,date:'Tue Jun 17',time:'7:20 PM EDT',opp:'NYM',loc:'Truist Park'},
  ],
  nextOpp:{name:'New York Mets',abbr:'NYM',rec:'38-34',era:'3.87',avg:'.248'},
  matchup:[
    {label:'Overall Record',   atl:'49-26 (.654)',opp:'38-34 (.528)',favors:'ATL'},
    {label:'Team ERA',         atl:'3.21',         opp:'3.87',        favors:'ATL'},
    {label:'Team AVG',         atl:'.271',         opp:'.248',        favors:'ATL'},
    {label:'Run Differential', atl:'+74',          opp:'+18',         favors:'ATL'},
    {label:'Home / Away',      atl:'Home',         opp:'Away',        favors:'ATL'},
    {label:'Bullpen ERA',      atl:'2.85',         opp:'3.94',        favors:'ATL'},
  ],
  lastGame:{
    date:'Sun, Jun 15, 2026',away:{abbr:'WSH',runs:1,hits:5,errors:1},
    home:{abbr:'ATL',runs:6,hits:11,errors:0},venue:'Truist Park',
    winner:'Spencer Strider',loser:'Patrick Corbin',
    recap:"Spencer Strider was dominant through seven innings, striking out 10 as Atlanta shut out Washington 6-1 Sunday. Drake Baldwin homered for the second straight game and Matt Olson drove in two — the Braves have won five of their last six and lead the NL East by 11 games.",
    innings:[{inn:'1',atl:0,wsh:0},{inn:'2',atl:2,wsh:0},{inn:'3',atl:0,wsh:1},{inn:'4',atl:1,wsh:0},{inn:'5',atl:0,wsh:0},{inn:'6',atl:2,wsh:0},{inn:'7',atl:1,wsh:0},{inn:'8',atl:0,wsh:0},{inn:'9',atl:0,wsh:0}],
    keyMoments:[
      {inn:'2nd',icon:'💥',player:'Drake Baldwin',      desc:'Solo HR — 16th of the season',               score:'ATL 1, WSH 0'},
      {inn:'2nd',icon:'🔥',player:'Matt Olson',         desc:'2-run double — extends the lead',            score:'ATL 3, WSH 0'},
      {inn:'4th',icon:'🚀',player:'Michael Harris II',  desc:'RBI single — back-to-back hits',             score:'ATL 4, WSH 0'},
      {inn:'6th',icon:'⚾',player:'Spencer Strider',    desc:'Strikes out the side — 9th K of the day',   score:'ATL 6, WSH 1'},
    ],
    atlBatters:[
      {name:'Ronald Acuña Jr.',  pos:'RF',ab:4,h:2,hr:0,rbi:0,r:1,note:''},
      {name:'Matt Olson',        pos:'1B',ab:4,h:2,hr:0,rbi:2,r:1,note:'2 RBI 🔥'},
      {name:'Austin Riley',      pos:'3B',ab:4,h:1,hr:0,rbi:1,r:1,note:'RBI single'},
      {name:'Ozzie Albies',      pos:'2B',ab:4,h:1,hr:0,rbi:0,r:0,note:''},
      {name:'Michael Harris II', pos:'CF',ab:4,h:2,hr:0,rbi:1,r:1,note:'RBI single'},
      {name:'Jarred Kelenic',    pos:'LF',ab:3,h:1,hr:0,rbi:0,r:1,note:''},
      {name:'Jorge Mateo',       pos:'SS',ab:3,h:1,hr:0,rbi:0,r:1,note:''},
      {name:'Drake Baldwin',     pos:'C', ab:3,h:1,hr:1,rbi:1,r:1,note:'Solo HR 💥'},
    ],
    atlPitchers:[
      {name:'Spencer Strider',  role:'SP (W)',ip:'7.0',h:4,er:1,k:10,bb:2,note:'Win vs WSH 🔥'},
      {name:'A.J. Minter',      role:'RP',   ip:'1.0',h:1,er:0,k:2,bb:0,note:'Scoreless'},
      {name:'Raisel Iglesias',  role:'RP',   ip:'1.0',h:0,er:0,k:2,bb:0,note:'Save #14'},
    ],
    recentResults:[
      {date:'Jun 12',opp:'WSH',r:'W',score:'7-3'},
      {date:'Jun 13',opp:'WSH',r:'W',score:'4-1'},
      {date:'Jun 14',opp:'WSH',r:'L',score:'3-5'},
      {date:'Jun 15',opp:'WSH',r:'W',score:'6-1'},
    ],
  },
  news:[],
};

function pct(w,l){if(!w&&!l)return'.000';return(w/(w+l)).toFixed(3).replace('0.','.')}
function gb(tw,tl,w,l){const g=((tw-w)+(l-tl))/2;return g===0?'—':g.toFixed(1)}
function rainColor(r){return r>=60?'var(--crimson)':r>=30?'var(--yellow)':'var(--green)'}
function sc(v,a,low=false){const d=low?a-v:v-a;return d>0.05*a?'var(--green)':d<-0.05*a?'var(--crimson)':'var(--yellow)'}
function badge(v,a,low,fmt){const c=sc(v,a,low);const cls=c.includes('green')?'badge bg':c.includes('crimson')?'badge br':'badge by';return`<span class="${cls}">${fmt?fmt(v):v}</span>`}
function stamp(){return new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})}
function _timeAgo(iso){if(!iso)return'';const ms=Date.now()-new Date(iso).getTime();if(ms<3600000)return Math.round(ms/60000)+'m ago';if(ms<86400000)return Math.round(ms/3600000)+'h ago';return Math.round(ms/86400000)+'d ago';}

// Parse "7:20 PM EDT" → minutes from local midnight (close enough for ET fans)
function _gameTimeMins(timeStr){
  if(!timeStr)return null;
  const m=timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if(!m)return null;
  let h=parseInt(m[1]),min=parseInt(m[2]);
  const pm=m[3].toUpperCase()==='PM';
  if(pm&&h!==12)h+=12;
  if(!pm&&h===12)h=0;
  return h*60+min;
}

function updateHdrContext(d){
  const el=document.getElementById('hdr-game-strip');
  if(!el)return;
  // Use local wall-clock date, not UTC, because MLB API game dates are Eastern Time.
  // toISOString() would roll to tomorrow after 8 PM EDT and break evening-game detection.
  const now=new Date();
  const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const nowMins=now.getHours()*60+now.getMinutes();

  // ── POST-GAME: today's game is in the completed list ──
  const doneToday=(d.completedGames||[]).find(g=>g.isoDate===today);
  if(doneToday){
    const lg=d.lastGame;
    const atlHome=lg.home?.abbr==='ATL';
    const atlR=atlHome?lg.home.runs:lg.away.runs;
    const oppR=atlHome?lg.away.runs:lg.home.runs;
    const oppAbbr=atlHome?lg.away.abbr:lg.home.abbr;
    const won=atlR>oppR;
    el.innerHTML=`<span class="hdr-gs-tag" style="background:${won?'#16a34a':'#CE1141'}">${won?'W':'L'}</span>`
      +`<span class="hdr-gs-score">ATL ${atlR} · ${pcEsc(oppAbbr)} ${oppR}</span>`
      +`<span class="hdr-gs-meta">FINAL · ${pcEsc(lg.date||'')}</span>`;
    return;
  }

  // ── TODAY'S UPCOMING / LIVE GAME ──
  const ng=(d.nextGames||[])[0];
  if(ng&&ng.isoDate===today){
    const gm=_gameTimeMins(ng.time);
    const elapsed=gm!=null?nowMins-gm:null;
    if(elapsed!=null&&elapsed>15&&elapsed<270){
      // heuristic: game started ≤15 min ago → show live indicator
      el.innerHTML=`<span class="hdr-gs-tag" style="background:#d97706;animation:pulse 1.4s infinite">LIVE</span>`
        +`<span class="hdr-gs-score">vs ${pcEsc(ng.opp)}</span>`
        +`<span class="hdr-gs-meta">${pcEsc(ng.loc||'')} · syncing every 2 min</span>`;
    }else{
      el.innerHTML=`<span class="hdr-gs-tag" style="background:#0369a1">TODAY</span>`
        +`<span class="hdr-gs-score">vs ${pcEsc(ng.opp)}</span>`
        +`<span class="hdr-gs-meta">${pcEsc(ng.time||'')} · ${pcEsc(ng.loc||'')}</span>`;
    }
    return;
  }

  // ── OFF-DAY: show next upcoming game ──
  if(ng){
    el.innerHTML=`<span class="hdr-gs-tag" style="background:#374151">NEXT</span>`
      +`<span class="hdr-gs-score">vs ${pcEsc(ng.opp)}</span>`
      +`<span class="hdr-gs-meta">${pcEsc(ng.date||'')} · ${pcEsc(ng.time||'')}</span>`;
    return;
  }

  el.innerHTML='';
}

// ── MLB LIVE DATA ──
const ATL_ID=144, NLE_DIV=204;
function _pad(n){return String(n).padStart(2,'0')}
function _fmtDate(d){return`${d.getFullYear()}-${_pad(d.getMonth()+1)}-${_pad(d.getDate())}`}
function _shortDate(s){const[,m,d]=s.split('-');return['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m)-1]+' '+parseInt(d)}
function _longDate(s){return new Date(s+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'long',day:'numeric',year:'numeric'})}
function _dayLabel(s){return new Date(s+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
function _gameTime(iso){if(!iso)return'TBD';try{return new Date(iso).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:'America/New_York'})+' EDT'}catch(e){return'TBD'}}
// ── Weather helpers (WMO codes → emoji/description) ──
function _wmoDesc(code){
  const c=code||0;
  if(c===0)return{emoji:'☀️',condition:'Clear'};
  if(c<=2)return{emoji:'🌤️',condition:'Mostly Clear'};
  if(c===3)return{emoji:'⛅',condition:'Partly Cloudy'};
  if(c<=48)return{emoji:'🌫️',condition:'Foggy'};
  if(c<=55)return{emoji:'🌦️',condition:'Drizzle'};
  if(c<=65)return{emoji:'🌧️',condition:'Rain'};
  if(c<=77)return{emoji:'❄️',condition:'Snow'};
  if(c<=82)return{emoji:'🌦️',condition:'Showers'};
  return{emoji:'⛈️',condition:'Thunderstorm'};
}
function _windDir(deg){return['N','NE','E','SE','S','SW','W','NW'][Math.round((deg||0)/45)%8];}

// MLB ballpark coordinates — used to show weather for the venue of the NEXT game,
// not just Truist Park. Matched by case-insensitive substring on the venue name.
const MLB_VENUES=[
  {m:'truist',        name:'Truist Park',        lat:33.8907, lon:-84.4677},
  {m:'yankee',        name:'Yankee Stadium',     lat:40.8296, lon:-73.9262},
  {m:'fenway',        name:'Fenway Park',        lat:42.3467, lon:-71.0972},
  {m:'camden',        name:'Camden Yards',       lat:39.2838, lon:-76.6217},
  {m:'tropicana',     name:'Tropicana Field',    lat:27.7683, lon:-82.6534},
  {m:'steinbrenner',  name:'Steinbrenner Field', lat:27.9797, lon:-82.5069},
  {m:'rogers',        name:'Rogers Centre',      lat:43.6414, lon:-79.3894},
  {m:'rate field',    name:'Rate Field',         lat:41.8299, lon:-87.6338},
  {m:'guaranteed',    name:'Rate Field',         lat:41.8299, lon:-87.6338},
  {m:'progressive',   name:'Progressive Field',  lat:41.4962, lon:-81.6852},
  {m:'comerica',      name:'Comerica Park',      lat:42.3390, lon:-83.0485},
  {m:'kauffman',      name:'Kauffman Stadium',   lat:39.0517, lon:-94.4803},
  {m:'target field',  name:'Target Field',       lat:44.9817, lon:-93.2778},
  {m:'daikin',        name:'Daikin Park',        lat:29.7572, lon:-95.3555},
  {m:'minute maid',   name:'Daikin Park',        lat:29.7572, lon:-95.3555},
  {m:'angel',         name:'Angel Stadium',      lat:33.8003, lon:-117.8827},
  {m:'sutter health', name:'Sutter Health Park', lat:38.5804, lon:-121.5133},
  {m:'coliseum',      name:'Oakland Coliseum',   lat:37.7516, lon:-122.2005},
  {m:'t-mobile',      name:'T-Mobile Park',      lat:47.5914, lon:-122.3325},
  {m:'globe life',    name:'Globe Life Field',   lat:32.7473, lon:-97.0847},
  {m:'citi field',    name:'Citi Field',         lat:40.7571, lon:-73.8458},
  {m:'nationals',     name:'Nationals Park',     lat:38.8730, lon:-77.0074},
  {m:'citizens bank', name:'Citizens Bank Park', lat:39.9061, lon:-75.1665},
  {m:'loandepot',     name:'loanDepot park',     lat:25.7781, lon:-80.2197},
  {m:'wrigley',       name:'Wrigley Field',      lat:41.9484, lon:-87.6553},
  {m:'great american',name:'Great American Ball Park',lat:39.0975,lon:-84.5069},
  {m:'american family',name:'American Family Field',lat:43.0280, lon:-87.9712},
  {m:'pnc park',      name:'PNC Park',           lat:40.4469, lon:-80.0057},
  {m:'busch',         name:'Busch Stadium',      lat:38.6226, lon:-90.1928},
  {m:'chase field',   name:'Chase Field',        lat:33.4453, lon:-112.0667},
  {m:'coors',         name:'Coors Field',        lat:39.7559, lon:-104.9942},
  {m:'dodger',        name:'Dodger Stadium',     lat:34.0739, lon:-118.2400},
  {m:'petco',         name:'Petco Park',         lat:32.7076, lon:-117.1570},
  {m:'oracle',        name:'Oracle Park',        lat:37.7786, lon:-122.3893},
];
function _venueCoords(venueName){
  if(!venueName)return null;
  const v=String(venueName).toLowerCase();
  return MLB_VENUES.find(p=>v.includes(p.m))||null;
}
function _weatherUrl(lat,lon){
  return`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=5&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,uv_index_max&timezone=auto`;
}

async function fetchLiveData(){
  const season=new Date().getFullYear();
  const today=new Date();
  const start=_fmtDate(new Date(+today-14*864e5));
  const end=_fmtDate(new Date(+today+7*864e5));
  // Season-wide schedule for the Trends trajectory charts
  const seasonStart=`${season}-03-15`;
  const seasonEnd=`${season}-10-15`;
  const base=`https://statsapi.mlb.com/api/v1`;
  const espnBase=`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb`;
  // Truist Park, Atlanta
  const LAT=33.891, LON=-84.468;

  // First parallel wave: primary data sources
  const [sr,gr,br,pr,rr,er,wr,ssr,lbr,lpr,nr,r40r]=await Promise.all([
    HEALTH.safeFetch(`${base}/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team,records`),
    HEALTH.safeFetch(`${base}/schedule?sportId=1&teamId=${ATL_ID}&startDate=${start}&endDate=${end}&hydrate=linescore,team,decisions`),
    HEALTH.safeFetch(`${base}/stats?stats=season&group=hitting&season=${season}&teamId=${ATL_ID}&playerPool=All&limit=60&sportId=1&gameType=R`).catch(()=>null),
    HEALTH.safeFetch(`${base}/stats?stats=season&group=pitching&season=${season}&teamId=${ATL_ID}&playerPool=All&limit=60&sportId=1&gameType=R`).catch(()=>null),
    HEALTH.safeFetch(`${base}/teams/${ATL_ID}/roster?rosterType=active&season=${season}`).catch(()=>null),
    HEALTH.safeFetch(`${espnBase}/teams/15?enable=roster,stats`).catch(()=>null),
    HEALTH.safeFetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=5&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,uv_index_max&timezone=auto`).catch(()=>null),
    HEALTH.safeFetch(`${base}/schedule?sportId=1&teamId=${ATL_ID}&startDate=${seasonStart}&endDate=${seasonEnd}&gameType=R`).catch(()=>null),
    HEALTH.safeFetch(`${base}/teams/stats?sportId=1&stats=season&season=${season}&group=hitting&gameType=R`).catch(()=>null),
    HEALTH.safeFetch(`${base}/teams/stats?sportId=1&stats=season&season=${season}&group=pitching&gameType=R`).catch(()=>null),
    HEALTH.safeFetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?teams=15&limit=12`).catch(()=>null),
    HEALTH.safeFetch(`${base}/teams/${ATL_ID}/roster?rosterType=40Man&season=${season}`).catch(()=>null)
  ]);

  // Parse schedule early so we can find last game ID for boxscore fetch
  const scheduleJ=await gr.json();
  let lastGamePk=null;
  let nextVenueName=null;
  for(const day of scheduleJ.dates||[]){
    for(const g of day.games||[]){
      const st=g.status?.abstractGameState;
      if(st==='Final') lastGamePk=g.gamePk;
      // First upcoming game wins — that is the venue the weather card should show
      else if(!nextVenueName&&(st==='Preview'||st==='Scheduled'||st==='Pre-Game')){
        nextVenueName=g.venue?.name||null;
      }
    }
  }
  // If the next game is away, fetch weather for THAT ballpark instead of Truist.
  const nextVenue=_venueCoords(nextVenueName);
  const venueWeatherP=(nextVenue&&nextVenue.name!=='Truist Park')
    ?HEALTH.safeFetch(_weatherUrl(nextVenue.lat,nextVenue.lon)).then(r=>r.json()).catch(()=>null)
    :Promise.resolve(null);

  // Second parallel wave: remaining JSON + boxscore for last game
  const [standingsJ,battingJ,pitchingJ,rosterJ,espnJ,weatherJ,seasonScheduleJ,leagueBatJ,leaguePitJ,boxscoreJ,newsJ,roster40ManJ,venueWeatherJ]=await Promise.all([
    sr.json(),
    br?br.json():Promise.resolve(null),
    pr?pr.json():Promise.resolve(null),
    rr?rr.json():Promise.resolve(null),
    er?er.json().catch(()=>null):Promise.resolve(null),
    wr?wr.json().catch(()=>null):Promise.resolve(null),
    ssr?ssr.json().catch(()=>null):Promise.resolve(null),
    lbr?lbr.json().catch(()=>null):Promise.resolve(null),
    lpr?lpr.json().catch(()=>null):Promise.resolve(null),
    lastGamePk?HEALTH.safeFetch(`${base}/game/${lastGamePk}/boxscore`).then(r=>r.json()).catch(()=>null):Promise.resolve(null),
    nr?nr.json().catch(()=>null):Promise.resolve(null),
    r40r?r40r.json().catch(()=>null):Promise.resolve(null),
    venueWeatherP
  ]);

  return{
    standings:standingsJ,
    schedule:scheduleJ,
    venueWeather:venueWeatherJ,
    venueName:(nextVenue&&nextVenue.name)||'Truist Park',
    batting:battingJ,
    pitching:pitchingJ,
    roster:rosterJ,
    roster40Man:roster40ManJ,
    espn:espnJ,
    weather:weatherJ,
    seasonSchedule:seasonScheduleJ,
    leagueBatting:leagueBatJ,
    leaguePitching:leaguePitJ,
    boxscore:boxscoreJ,
    news:newsJ
  };
}

function mergeLiveData(seed,live){
  const d=JSON.parse(JSON.stringify(seed));
  // ── Standings ──
  const allTeams=[];
  const nlTeams=[];
  const allDivs=[];
  for(const div of live.standings.records||[]){
    const isNLE=div.division?.id===NLE_DIV;
    const isNL=div.league?.id===104;
    const divTeams=[];
    for(const tr of div.teamRecords||[]){
      const abbr=tr.team.abbreviation||tr.team.name.split(' ').pop().slice(0,3).toUpperCase();
      const rec={name:tr.team.name,abbr,w:tr.wins,l:tr.losses,divId:div.division?.id,leagueId:div.league?.id};
      allTeams.push(rec);
      if(isNL) nlTeams.push(rec);
      divTeams.push(rec);
      if(tr.team.id===ATL_ID){
        d.record.w=tr.wins; d.record.l=tr.losses;
        d.record.pct=tr.winningPercentage||pct(tr.wins,tr.losses);
        const splits=tr.records?.splitRecords||[];
        const hm=splits.find(s=>s.type==='home');
        const aw=splits.find(s=>s.type==='away');
        const l10=splits.find(s=>s.type==='lastTen');
        if(hm) d.record.home=`${hm.wins}-${hm.losses}`;
        if(aw) d.record.away=`${aw.wins}-${aw.losses}`;
        if(l10) d.record.last10=`${l10.wins}-${l10.losses}`;
        const diff=(tr.runsScored||0)-(tr.runsAllowed||0);
        if(diff!==0) d.record.runDiff=diff>=0?`+${diff}`:`${diff}`;
        // keep matchup record row live
        d.matchup[0].atl=`${tr.wins}-${tr.losses} (${tr.winningPercentage||pct(tr.wins,tr.losses)})`;
        d.matchup[3].atl=d.record.runDiff;
      }
    }
    if(divTeams.length){
      divTeams.sort((a,b)=>(b.w/(b.w+b.l))-(a.w/(a.w+a.l)));
      const divName=({200:'AL West',201:'AL East',202:'AL Central',203:'NL West',204:'NL East',205:'NL Central'})[div.division?.id]||(div.division?.name||'Division');
      const leagueName=div.league?.id===104?'NL':div.league?.id===103?'AL':'';
      allDivs.push({id:div.division?.id,name:divName,league:leagueName,teams:divTeams});
      if(isNLE) d.nle=divTeams;
    }
  }
  if(allTeams.length){
    d.mlbTop=[...allTeams].sort((a,b)=>(b.w/(b.w+b.l))-(a.w/(a.w+a.l))).slice(0,10);
  }
  if(allDivs.length){
    // Stable, friendly ordering: AL E/C/W then NL E/C/W
    const order=[201,202,200,204,205,203];
    allDivs.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
    d.divisions=allDivs;
  }
  // ── Live rankings (drive dynamic NL East / NL win-% subtitles) ──
  const nleIdx=(d.nle||[]).findIndex(t=>t.abbr==='ATL');
  d.record.nleRank=nleIdx>=0?nleIdx+1:null;

  // ── NL Wild Card race ──
  // Division leaders are excluded; everyone else is sorted by win%. Top 3 hold
  // the wild card spots, the next few are "in the hunt".
  if(allDivs.length){
    const nlDivs=allDivs.filter(dv=>dv.league==='NL');
    const leaderAbbrs=new Set(nlDivs.map(dv=>dv.teams[0]?.abbr).filter(Boolean));
    const contenders=nlDivs
      .flatMap(dv=>dv.teams)
      .filter(t=>!leaderAbbrs.has(t.abbr))
      .sort((a,b)=>(b.w/(b.w+b.l))-(a.w/(a.w+a.l)));
    if(contenders.length){
      const cutoff=contenders[2]; // 3rd wild card = the line
      d.wildcard=contenders.slice(0,8).map((t,i)=>({
        ...t,
        seed:i+1,
        inSpot:i<3,
        gb:cutoff?gb(cutoff.w,cutoff.l,t.w,t.l):'—'
      }));
      d.record.wcRank=d.wildcard.findIndex(t=>t.abbr==='ATL')+1||null;
    }
    // Magic number to clinch the NL East (162-game season): 163 - W(leader) - L(runner-up)
    const nle=allDivs.find(dv=>dv.id===NLE_DIV);
    if(nle&&nle.teams.length>1&&nle.teams[0].abbr==='ATL'){
      const me=nle.teams[0],next=nle.teams[1];
      const mn=163-me.w-next.l;
      d.record.magicNumber=mn>0?mn:0;
    }else{
      d.record.magicNumber=null;
    }
  }
  if(nlTeams.length){
    nlTeams.sort((a,b)=>(b.w/(b.w+b.l))-(a.w/(a.w+a.l)));
    const nlIdx=nlTeams.findIndex(t=>t.abbr==='ATL');
    d.record.nlRank=nlIdx>=0?nlIdx+1:null;
  }

  // ── Live MLB league averages — every reference line / threshold reads MLB_BAT/PIT ──
  // Aggregate all 30 teams' totals (true rate stats) and per-team averages (for HR/RBI/SB).
  if(live.leagueBatting){
    const splits=(live.leagueBatting.stats||[]).flatMap(g=>g.splits||[]);
    if(splits.length){
      let H=0,AB=0,BB=0,HBP=0,SF=0,TB=0;
      for(const s of splits){
        const st=s.stat||{};
        H+=+st.hits||0; AB+=+st.atBats||0; BB+=+st.baseOnBalls||0;
        HBP+=+st.hitByPitch||0; SF+=+st.sacFlies||0;
        TB+=+st.totalBases||0;
      }
      if(AB>0){
        const avg=H/AB;
        const obp=(H+BB+HBP)/(AB+BB+HBP+SF);
        const slg=TB/AB;
        MLB_BAT.avg=+avg.toFixed(3);
        MLB_BAT.obp=+obp.toFixed(3);
        MLB_BAT.slg=+slg.toFixed(3);
        MLB_BAT.ops=+(obp+slg).toFixed(3);
        MLB_BAT._live=true;
      }
      // HR/RBI/SB stay at seed values — those represent "top-player thresholds"
      // for individual color coding, not league averages, so per-team aggregation
      // would dwarf individual totals.
    }
  }
  if(live.leaguePitching){
    const splits=(live.leaguePitching.stats||[]).flatMap(g=>g.splits||[]);
    if(splits.length){
      let ER=0,ipDec=0,H=0,BB=0,HBP=0,K=0,HR=0;
      for(const s of splits){
        const st=s.stat||{};
        ER+=+st.earnedRuns||0; H+=+st.hits||0;
        BB+=+st.baseOnBalls||0; HBP+=+st.hitByPitch||0;
        K+=+st.strikeOuts||0; HR+=+st.homeRuns||0;
        const ip=String(st.inningsPitched||'0').split('.');
        ipDec+=(parseInt(ip[0]||'0'))+(parseInt(ip[1]||'0')/3);
      }
      if(ipDec>0){
        const era=(ER*9)/ipDec;
        const whip=(H+BB)/ipDec;
        const k9=(K*9)/ipDec;
        const bb9=(BB*9)/ipDec;
        // FIP constant: solve so league FIP = league ERA → C = ERA - (13HR+3(BB+HBP)-2K)/IP
        const fipNoC=(13*HR+3*(BB+HBP)-2*K)/ipDec;
        const FIP_C=+(era-fipNoC).toFixed(2);
        MLB_PIT.era=+era.toFixed(2);
        MLB_PIT.whip=+whip.toFixed(2);
        MLB_PIT.k9=+k9.toFixed(1);
        MLB_PIT.bb9=+bb9.toFixed(1);
        MLB_PIT.fip=+era.toFixed(2); // by construction league FIP == league ERA
        MLB_PIT._fipC=FIP_C;
        MLB_PIT._live=true;
      }
    }
  }
  // ── Schedule ──
  const completed=[],upcoming=[];
  let _lastSchedGame=null;
  for(const day of live.schedule.dates||[]){
    for(const g of day.games||[]){
      const isHome=g.teams?.home?.team?.id===ATL_ID;
      const atlT=isHome?g.teams.home:g.teams.away;
      const oppT=isHome?g.teams.away:g.teams.home;
      const state=g.status?.abstractGameState;
      if(state==='Final'){
        const ar=atlT.score??0,or=oppT.score??0;
        completed.push({date:day.date,opp:oppT.team.abbreviation,r:ar>or?'W':'L',
          score:`${ar}-${or}`,isHome,atlRuns:ar,oppRuns:or,venue:g.venue?.name,gameDate:g.gameDate});
        _lastSchedGame=g; // capture full game object for linescore/decisions
      }else if(state==='Preview'||state==='Scheduled'||state==='Pre-Game'){
        upcoming.push({date:day.date,opp:oppT.team.abbreviation,isHome,venue:g.venue?.name,gameDate:g.gameDate});
      }
    }
  }
  completed.sort((a,b)=>a.date.localeCompare(b.date));
  upcoming.sort((a,b)=>a.date.localeCompare(b.date));
  if(completed.length){
    // Store last 10 for predictor settlement — keep ISO date for reliable matching
    d.completedGames=completed.slice(-10).map(g=>({isoDate:g.date,opp:g.opp,r:g.r,score:g.score}));
    d.lastGame.recentResults=completed.slice(-5).map(g=>({date:_shortDate(g.date),opp:g.opp,r:g.r,score:g.score}));
    const lg=completed[completed.length-1];
    d.lastGame.date=_longDate(lg.date);
    if(lg.isHome){d.lastGame.home={...d.lastGame.home,abbr:'ATL',runs:lg.atlRuns};d.lastGame.away={...d.lastGame.away,abbr:lg.opp,runs:lg.oppRuns};}
    else{d.lastGame.away={...d.lastGame.away,abbr:'ATL',runs:lg.atlRuns};d.lastGame.home={...d.lastGame.home,abbr:lg.opp,runs:lg.oppRuns};}
  }
  if(upcoming.length){
    // Include isoDate so predictor can do exact date matching
    d.nextGames=upcoming.slice(0,3).map((g,i)=>({n:i+1,isoDate:g.date,date:_dayLabel(g.date),time:_gameTime(g.gameDate),opp:g.opp,loc:g.isHome?'Truist Park':`@ ${g.venue||g.opp}`}));
    d.nextOpp={...d.nextOpp,abbr:upcoming[0].opp};
  }

  // ── Live player stats ──
  // Build position + jersey maps from active roster
  const posMap={},jerseyMap={};
  for(const p of live.roster?.roster||[]){
    posMap[p.person.id]=p.position?.abbreviation||'—';
    if(p.jerseyNumber)jerseyMap[p.person.id]=p.jerseyNumber;
  }
  // Build whitelist: prefer 40-man roster; fall back to active 26-man (posMap) so
  // traded/released players (who have no roster entry) are always excluded.
  const roster40Ids=(live.roster40Man?.roster||[]).map(p=>p.person.id);
  const rosterSet=roster40Ids.length>0
    ? new Set(roster40Ids)
    : new Set(Object.keys(posMap).map(Number));
  HEALTH.ok(`Roster whitelist: ${rosterSet.size} players (${roster40Ids.length>0?'40-man':'active-26 fallback'})`);

  // ── Injured / inactive: on the 40-man but NOT on the active 26-man ──
  // These players used to be silently hidden; now they get their own section.
  const inactive=[];
  for(const p of live.roster40Man?.roster||[]){
    const pid=p.person?.id;
    if(!pid||posMap[pid])continue; // posMap holds the active 26
    inactive.push({
      id:pid,
      name:p.person.fullName||'—',
      pos:p.position?.abbreviation||'—',
      status:p.status?.description||'Inactive'
    });
  }
  if(inactive.length){
    inactive.sort((a,b)=>a.name.localeCompare(b.name));
    d.inactive=inactive;
    HEALTH.info(`${inactive.length} players on 40-man but not active (IL / optioned)`);
  }else{
    d.inactive=[];
  }

  const fp=v=>parseFloat(String(v||'0').replace(/[^0-9.\-]/g,''))||0;

  if(live.batting){
    const splits=[...(live.batting.stats||[])].flatMap(s=>s.splits||[]);
    HEALTH.info(`MLB batting API: ${splits.length} player splits returned`);
    const batters=splits
      .filter(s=>parseInt(s.stat.plateAppearances||s.stat.atBats||0)>=10)
      .map(s=>{
        const pid=s.player?.id||s.person?.id;
        return{
          id:pid,
          jersey:jerseyMap[pid]||'',
          name:s.player?.fullName||s.person?.fullName||'Unknown',
          pos:posMap[pid]||s.position?.abbreviation||s.player?.primaryPosition?.abbreviation||'—',
          _active:!!posMap[pid],
          avg:fp(s.stat.avg),
          obp:fp(s.stat.obp),
          slg:fp(s.stat.slg),
          ops:fp(s.stat.ops),
          hr:s.stat.homeRuns||0,
          rbi:s.stat.rbi||0,
          sb:s.stat.stolenBases||0,
          h:s.stat.hits||0,
          ab:s.stat.atBats||0,
          r:s.stat.runs||0,
          bb:s.stat.baseOnBalls||0,
          so:s.stat.strikeOuts||0,
          pa:s.stat.plateAppearances||0,
          doubles:s.stat.doubles||0,
          triples:s.stat.triples||0,
        };
      })
      .filter(b=>b.ops>0&&(!b.id||!rosterSet.size||rosterSet.has(b.id)))
      .sort((a,b)=>b.ops-a.ops)
      .slice(0,12);
    if(batters.length>0){
      d.batters=batters;
      d._liveSource='mlb';
      HEALTH.ok(`Live batting: ${batters.length} players — leader ${batters[0].name} ${batters[0].ops.toFixed(3)} OPS`);
    }else{
      HEALTH.warn(`Batting API returned ${splits.length} splits but 0 with 10+ PA/AB — keeping SEED roster`);
    }
  }else{
    HEALTH.warn('MLB batting stats API failed — showing SEED roster');
  }

  if(live.pitching){
    const splits=[...(live.pitching.stats||[])].flatMap(s=>s.splits||[]);
    HEALTH.info(`MLB pitching API: ${splits.length} pitcher splits returned`);
    // Use live league-derived FIP constant when available; falls back to 2026 default.
    const FIP_C=(typeof MLB_PIT._fipC==='number')?MLB_PIT._fipC:3.15;
    const pitchers=splits
      .filter(s=>{
        const ip=String(s.stat.inningsPitched||'0');
        return(parseInt(ip.split('.')[0]||'0')>=3);
      })
      .map(s=>{
        const st=s.stat;
        const pid=s.player?.id||s.person?.id;
        const gs=st.gamesStarted||0,g=Math.max(st.gamesPitched||1,1);
        const isSP=gs>=2&&(gs/g)>=0.35;
        const ipParts=String(st.inningsPitched||'0').split('.');
        const ipDec=(parseInt(ipParts[0]||'0'))+(parseInt(ipParts[1]||'0')/3);
        const fipRaw=ipDec>0?((13*(st.homeRuns||0)+3*((st.baseOnBalls||0)+(st.hitByPitch||0))-2*(st.strikeOuts||0))/ipDec+FIP_C):0;
        return{
          id:pid,
          jersey:jerseyMap[pid]||'',
          name:s.player?.fullName||s.person?.fullName||'Unknown',
          pos:isSP?'SP':'RP',
          _active:!!posMap[pid],
          era:fp(st.era),
          whip:fp(st.whip),
          k9:fp(st.strikeoutsPer9Inn),
          bb9:fp(st.walksPer9Inn),
          fip:Math.max(0,parseFloat(fipRaw.toFixed(2))),
          w:st.wins||0,
          l:st.losses||0,
          sv:st.saves||0,
          ip:String(st.inningsPitched||'0'),
          k:st.strikeOuts||0,
          bbTotal:st.baseOnBalls||0,
          hrAllowed:st.homeRuns||0,
          gp:st.gamesPitched||0,
          gs:gs,
        };
      })
      .filter(p=>p.era>=0&&(!p.id||!rosterSet.size||rosterSet.has(p.id)))
      .sort((a,b)=>{if(a.pos!==b.pos)return a.pos==='SP'?-1:1;return a.era-b.era;})
      .slice(0,12);
    if(pitchers.length>0){
      d.pitchers=pitchers;
      const ace=pitchers.find(p=>p.pos==='SP')||pitchers[0];
      HEALTH.ok(`Live pitching: ${pitchers.length} pitchers — ace ${ace.name} ${ace.era.toFixed(2)} ERA`);
    }else{
      HEALTH.warn(`Pitching API returned ${splits.length} splits but 0 with 3+ IP — keeping SEED roster`);
    }
  }else{
    HEALTH.warn('MLB pitching stats API failed — showing SEED roster');
  }

  // ── ESPN supplemental (log presence) ──
  if(live.espn&&live.espn.team){
    try{
      const stats=live.espn.team.seasonStats||live.espn.team.record?.items?.[0]?.stats||[];
      HEALTH.info(`ESPN team data available — ${stats.length} stat fields`);
    }catch(e){HEALTH.warn(`ESPN parse failed: ${e.message}`);}
  }

  // ── Live weather from Open-Meteo ──
  // Prefer the ballpark hosting the NEXT game; fall back to Truist Park.
  const _wxSrc=live.venueWeather?.current?live.venueWeather:live.weather;
  d.weather.venue=live.venueName||'Truist Park';
  if(_wxSrc?.current){
    try{
      const c=_wxSrc.current;
      const dl=_wxSrc.daily;
      d.weather.temp=Math.round(c.temperature_2m);
      d.weather.feelsLike=Math.round(c.apparent_temperature);
      d.weather.humidity=Math.round(c.relative_humidity_2m);
      d.weather.wind=Math.round(c.wind_speed_10m);
      d.weather.windDir=_windDir(c.wind_direction_10m);
      const wx=_wmoDesc(c.weather_code);
      d.weather.emoji=wx.emoji;d.weather.condition=wx.condition;
      // rain chance and UV come from daily[0] (not available in current variables)
      if(dl){
        d.weather.rainChance=dl.precipitation_probability_max?.[0]||0;
        d.weather.uvIndex=Math.round(dl.uv_index_max?.[0]||0);
        d.weather.hiTemp=Math.round(dl.temperature_2m_max[0]);
        d.weather.loTemp=Math.round(dl.temperature_2m_min[0]);
        d.weather.forecast=(dl.time||[]).slice(0,5).map((dt,i)=>{
          const dn=i===0?'Today':new Date(dt+'T12:00:00').toLocaleDateString('en-US',{weekday:'short'});
          const w2=_wmoDesc(dl.weather_code[i]);
          return{day:dn,hi:Math.round(dl.temperature_2m_max[i]),lo:Math.round(dl.temperature_2m_min[i]),icon:w2.emoji,rain:dl.precipitation_probability_max[i]||0};
        });
      }
      d.weather._live=true;
      HEALTH.ok(`Live weather @ ${d.weather.venue}: ${d.weather.temp}°F ${d.weather.condition} ${d.weather.rainChance}% rain UV:${d.weather.uvIndex}`);
    }catch(e){HEALTH.warn(`Weather parse error: ${e.message}`);}
  }else{HEALTH.warn('Open-Meteo weather fetch failed — showing cached weather');}

  // ── Last game: decisions (WP/LP) + linescore from schedule hydration ──
  if(_lastSchedGame){
    if(_lastSchedGame.decisions?.winner?.fullName) d.lastGame.winner=_lastSchedGame.decisions.winner.fullName;
    if(_lastSchedGame.decisions?.loser?.fullName) d.lastGame.loser=_lastSchedGame.decisions.loser.fullName;
    if(_lastSchedGame.linescore?.innings?.length){
      const atlIsHome=d.lastGame.home.abbr==='ATL';
      const oppAbbr=(atlIsHome?d.lastGame.away.abbr:d.lastGame.home.abbr).toLowerCase();
      d.lastGame.innings=_lastSchedGame.linescore.innings.map(inn=>{
        const atlR=atlIsHome?(inn.home?.runs??0):(inn.away?.runs??0);
        const oppR=atlIsHome?(inn.away?.runs??0):(inn.home?.runs??0);
        const row={inn:String(inn.num),atl:atlR};
        row[oppAbbr]=oppR;
        return row;
      });
      // Live H/E totals
      const ls=_lastSchedGame.linescore.teams;
      if(ls){
        const atlObj=atlIsHome?d.lastGame.home:d.lastGame.away;
        const oppObj=atlIsHome?d.lastGame.away:d.lastGame.home;
        const atlT=atlIsHome?ls.home:ls.away;
        const oppT=atlIsHome?ls.away:ls.home;
        if(atlT){atlObj.hits=atlT.hits??atlObj.hits;atlObj.errors=atlT.errors??atlObj.errors;}
        if(oppT){oppObj.hits=oppT.hits??oppObj.hits;oppObj.errors=oppT.errors??oppObj.errors;}
      }
    }
    // Build a live recap from decisions + score
    const atlIsHome2=d.lastGame.home.abbr==='ATL';
    const atlR2=atlIsHome2?d.lastGame.home.runs:d.lastGame.away.runs;
    const oppR2=atlIsHome2?d.lastGame.away.runs:d.lastGame.home.runs;
    const oppAbbr2=atlIsHome2?d.lastGame.away.abbr:d.lastGame.home.abbr;
    const atlWon=atlR2>oppR2;
    if(atlWon){
      d.lastGame.recap=`${d.lastGame.winner} earned the win as Atlanta defeated ${oppAbbr2} ${atlR2}-${oppR2} on ${d.lastGame.date}. Stats updated live from MLB.com every 2 minutes.`;
    }else{
      d.lastGame.recap=`${d.lastGame.loser} took the loss as Atlanta fell to ${oppAbbr2} ${oppR2}-${atlR2} on ${d.lastGame.date}. Stats updated live from MLB.com every 2 minutes.`;
    }
  }

  // ── Live boxscore: batter & pitcher game lines ──
  if(live.boxscore?.teams){
    try{
      const atlIsHome=d.lastGame.home.abbr==='ATL';
      const atlTeam=live.boxscore.teams[atlIsHome?'home':'away'];
      if(atlTeam?.battingOrder?.length){
        const batters=atlTeam.battingOrder.map(id=>{
          const p=atlTeam.players['ID'+id];if(!p)return null;
          const b=p.stats?.batting||{};
          return{
            name:p.person.fullName,
            pos:(p.allPositions||[]).map(x=>x.abbreviation).join('/')||p.position?.abbreviation||'—',
            ab:b.atBats||0,h:b.hits||0,hr:b.homeRuns||0,rbi:b.rbi||0,r:b.runs||0,
            note:b.homeRuns>0?'HR 💥':b.rbi>=2?`${b.rbi} RBI 🔥`:b.hits>=3?`${b.hits}H 🔥`:''
          };
        }).filter(Boolean);
        if(batters.length) d.lastGame.atlBatters=batters;
      }
      if(atlTeam?.pitchers?.length){
        const saveP=_lastSchedGame?.decisions?.save?.fullName||'';
        const pitchers=atlTeam.pitchers.map(id=>{
          const p=atlTeam.players['ID'+id];if(!p)return null;
          const pit=p.stats?.pitching||{};
          const isW=p.person.fullName===d.lastGame.winner;
          const isSv=p.person.fullName===saveP;
          return{
            name:p.person.fullName,
            role:pit.gamesStarted>0?(isW?'SP (W)':'SP'):isW?'RP (W)':isSv?'RP (SV)':'RP',
            ip:pit.inningsPitched||'0.0',
            h:pit.hits||0,er:pit.earnedRuns||0,k:pit.strikeOuts||0,bb:pit.baseOnBalls||0,
            note:isW?'Win 🔥':isSv?'Save ✅':pit.earnedRuns===0&&parseInt(pit.inningsPitched)>0?'Scoreless':''
          };
        }).filter(Boolean);
        if(pitchers.length) d.lastGame.atlPitchers=pitchers;
      }
      // Build key moments from live batter lines
      const moments=[];
      for(const b of (d.lastGame.atlBatters||[])){
        if(b.hr>0) moments.push({inn:'—',icon:'💥',player:b.name,desc:`Home run — ${b.rbi} RBI`,score:''});
        else if(b.rbi>=3) moments.push({inn:'—',icon:'🔥',player:b.name,desc:`${b.rbi}-RBI performance`,score:''});
        else if(b.h>=3) moments.push({inn:'—',icon:'⚾',player:b.name,desc:`${b.h}-for-${b.ab} at the plate`,score:''});
      }
      if(moments.length) d.lastGame.keyMoments=moments.slice(0,5);
      HEALTH.ok(`Live boxscore: ${d.lastGame.atlBatters?.length||0} batters, ${d.lastGame.atlPitchers?.length||0} pitchers`);
    }catch(e){HEALTH.warn(`Boxscore parse error: ${e.message}`);}
  }else{HEALTH.warn('MLB boxscore fetch failed — showing cached last game');}

  // ── Season trajectory (every completed reg-season game) — drives Trends ──
  if(live.seasonSchedule){
    const traj=[];
    let cumW=0,cumL=0,cumRS=0,cumRA=0;
    for(const day of live.seasonSchedule.dates||[]){
      for(const g of day.games||[]){
        if(g.status?.abstractGameState!=='Final')continue;
        const isHome=g.teams?.home?.team?.id===ATL_ID;
        const atlT=isHome?g.teams.home:g.teams.away;
        const oppT=isHome?g.teams.away:g.teams.home;
        const rs=atlT.score??0,ra=oppT.score??0;
        const won=rs>ra;
        if(won)cumW++;else cumL++;
        cumRS+=rs;cumRA+=ra;
        traj.push({
          date:day.date,
          opp:oppT.team.abbreviation||'OPP',
          rs,ra,
          diff:rs-ra,
          won,
          gameNo:cumW+cumL,
          cumW,cumL,
          cumDiff:cumRS-cumRA,
          winPct:cumW/(cumW+cumL),
        });
      }
    }
    d.trajectory=traj;
  }

  // ── ESPN Analyst Feed ──
  // ESPN API may return articles at top level or nested under 'news'
  const rawArticles=live.news?.articles||live.news?.news?.articles||[];
  if(rawArticles.length){
    d.news=rawArticles.slice(0,12).map(a=>({
      headline:a.headline||a.title||'',
      desc:a.description||a.summary||'',
      byline:a.byline||a.source?.name||'',
      published:a.published||a.lastModified||'',
      url:a.links?.web?.href||a.link||a.url||null
    }));
    HEALTH.ok(`Analyst feed: ${d.news.length} articles loaded`);
  }else{
    HEALTH.warn(`ESPN news fetch failed — live.news keys: ${live.news?Object.keys(live.news).join(','):'null'}`);
  }
  // Mark that a live fetch has completed so the UI can show "unavailable" vs "loading"
  d._newsFetched=true;

  return d;
}

async function refreshAll(){
  // Skip the network round-trip when the page is hidden; reschedule so we
  // fire again 2 min later, and the visibility watchdog will force an
  // immediate refresh the moment the user returns to the tab.
  if(document.hidden){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>refreshAll(),2*60*1000);
    return;
  }
  const pill=document.getElementById('refresh-pill');
  const lbl=document.getElementById('refresh-label');
  if(pill) pill.classList.remove('live');
  if(lbl) lbl.textContent='Updating…';
  const liveResult=await fetchLiveData().then(v=>({status:'fulfilled',value:v}),e=>({status:'rejected',reason:e}));
  if(liveResult.status==='fulfilled'){
    DATA=mergeLiveData(SEED,liveResult.value);
    HEALTH.ok(`Live sync — ${DATA.record.w}-${DATA.record.l} · ${DATA.batters.length} batters · ${DATA.pitchers.length} pitchers`,DATA.batters.length);
  }else{
    DATA=SEED;
    HEALTH.fix(`Live fetch failed (${liveResult.reason?.message||'unknown'}) — using SEED fallback`);
  }
  // update header record live
  const rec=document.getElementById('hdr-rec');
  const sub=document.getElementById('hdr-rec-sub');
  if(rec) rec.textContent=`${DATA.record.w}-${DATA.record.l}`;
  const nleOrd=['1ST','2ND','3RD','4TH','5TH'];
  const nleTag=DATA.record.nleRank?(nleOrd[DATA.record.nleRank-1]||DATA.record.nleRank+'TH')+' NL EAST':'NL EAST';
  if(sub) sub.textContent=`${nleTag} · ${DATA.record.pct}`;
  updateHdrContext(DATA);
  const upEl=document.getElementById('last-updated');
  if(upEl) upEl.textContent=`Updated ${stamp()}`;
  if(pill) pill.classList.add('live');
  if(lbl) lbl.textContent='Refreshing every 2 min';
  renderTab(currentTab);
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(()=>refreshAll(),2*60*1000);
}

// Tab state lives in the URL hash so tabs are shareable, bookmarkable, and
// survive a refresh. The back button walks tab history.
function showTab(tab){
  if(!TABS.includes(tab))tab='overview';
  if(location.hash.slice(1)===tab){applyTab(tab);return;}
  location.hash=tab; // triggers hashchange -> applyTab
}

function applyTab(tab){
  if(!TABS.includes(tab))tab='overview';
  currentTab=tab;
  _animateNums=true;
  document.querySelectorAll('.nbtn').forEach(b=>{
    b.classList.toggle('active',b.dataset.tab===tab);
  });
  const c=document.getElementById('content');
  if(c) c.scrollTop=0;
  renderTab(tab);
}

function _tabFromHash(){
  const h=(location.hash||'').replace(/^#/,'').trim().toLowerCase();
  return TABS.includes(h)?h:'overview';
}

function renderTab(tab){
  const d=DATA||SEED;
  const c=document.getElementById('content');
  if(c) c.dataset.tab=tab;
  const fns={
    overview:()=>renderOverview(d),
    cards:()=>renderCards(d),
    trends:()=>renderTrends(d),
    stats:()=>renderStats(d),
    standings:()=>renderStandings(d),
  };
  if(fns[tab]){lastRenderTime=Date.now();HEALTH.safeRender(tab,fns[tab]);bindDynamic();}
}

// Animate every integer run inside an element from 0 up to its final value,
// preserving the surrounding characters ("49-26", "+74", ".654" all work).
function animateCount(el,ms){
  const finalTxt=el.textContent;
  const parts=finalTxt.match(/\d+|\D+/g);
  if(!parts||!/\d/.test(finalTxt))return;
  const targets=parts.map(p=>/^\d+$/.test(p)?parseInt(p,10):null);
  const t0=performance.now();
  const step=now=>{
    const k=Math.min(1,(now-t0)/ms);
    const e=1-Math.pow(1-k,3); // ease-out cubic
    el.textContent=parts.map((p,i)=>
      targets[i]===null?p:String(Math.round(targets[i]*e)).padStart(p.length,p[0]==='0'?'0':'')
    ).join('');
    if(k<1)requestAnimationFrame(step);
    else el.textContent=finalTxt;
  };
  requestAnimationFrame(step);
}

let _animateNums=false; // set on tab switch / boot, not on background refresh

// Re-attach listeners to elements created by innerHTML. Called after every
// render because innerHTML wipes previously bound nodes.
function bindDynamic(){
  // Count-up on the big stat numbers — only when the user just arrived on the
  // tab, so the 2-minute auto-refresh does not re-trigger it under them.
  if(_animateNums&&!window.matchMedia('(prefers-reduced-motion:reduce)').matches){
    document.querySelectorAll('#content .sv, #content .wt').forEach((el,i)=>{
      setTimeout(()=>animateCount(el,620),i*45);
    });
  }
  _animateNums=false;
  // Player headshots that 404 fall back to the initials placeholder.
  document.querySelectorAll('.pcard-photo img').forEach(img=>{
    if(img.dataset.bound)return;
    img.dataset.bound='1';
    img.addEventListener('error',()=>{
      const par=img.parentElement;
      if(par)par.classList.add('no-photo');
      img.remove();
    });
  });
  // Keep focus + caret in the search box across re-renders.
  const si=document.getElementById('player-search');
  if(si&&si.dataset.refocus!=='done'&&playerQuery){
    si.dataset.refocus='done';
    const pos=si.value.length;
    si.focus();
    try{si.setSelectionRange(pos,pos);}catch(e){}
  }
}

// ── OVERVIEW ──
function renderOverview(d){
  // Filter to active-roster players only for top-performer cards (excludes IL/injured)
  const activeBatters=d.batters.filter(b=>b._active!==false);
  const eligBatters=activeBatters.length?activeBatters:d.batters;
  const tb=eligBatters.length?eligBatters.reduce((a,b)=>b.ops>a.ops?b:a):null;
  const activeSP=d.pitchers.filter(p=>p.pos==='SP'&&p._active!==false);
  const eligSP=activeSP.length?activeSP:d.pitchers.filter(p=>p.pos==='SP');
  const tp=eligSP.length?eligSP.reduce((a,b)=>b.era<a.era?b:a):(d.pitchers.length?d.pitchers[0]:null);
  if(!tb)HEALTH.warn('No active batting data for overview — batter card hidden');
  if(!tp)HEALTH.warn('No active pitching data for overview — pitcher card hidden');
  // Dynamic subtitles — driven by live standings rankings
  const ord=n=>n==null?'':(['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th'][n-1]||`${n}th`);
  const nleSub=d.record.nleRank?`${ord(d.record.nleRank)} NL East`:'NL East';
  const nlSub=d.record.nlRank===1?'Best in NL':d.record.nlRank?`${ord(d.record.nlRank)} in NL`:'NL Win %';
  const recColor=d.record.nleRank===1?'var(--green)':d.record.nleRank===2?'var(--yellow)':d.record.nleRank?'var(--crimson)':'var(--dim)';
  const wpctColor=d.record.nlRank===1?'var(--green)':d.record.nlRank&&d.record.nlRank<=4?'var(--yellow)':'var(--crimson)';
  const homePct=(()=>{const[hw,hl]=String(d.record.home||'0-0').split('-').map(Number);return(hw+hl)?hw/(hw+hl):0;})();
  const awayPct=(()=>{const[aw,al]=String(d.record.away||'0-0').split('-').map(Number);return(aw+al)?aw/(aw+al):0;})();
  const l10Pct=(()=>{const[lw,ll]=String(d.record.last10||'0-0').split('-').map(Number);return(lw+ll)?lw/(lw+ll):0;})();
  const homeColor=homePct>=0.55?'var(--green)':homePct>=0.45?'var(--yellow)':'var(--crimson)';
  const awayColor=awayPct>=0.55?'var(--green)':awayPct>=0.45?'var(--yellow)':'var(--crimson)';
  const l10Color=l10Pct>=0.6?'var(--green)':l10Pct>=0.4?'var(--yellow)':'var(--crimson)';
  const rdNum=parseFloat(String(d.record.runDiff).replace('+',''))||0;
  const rdColor=rdNum>0?'var(--green)':rdNum<0?'var(--crimson)':'var(--yellow)';
  const newsHtml=(d.news&&d.news.length)
    ?d.news.map(a=>{
        const ta=_timeAgo(a.published);
        const safeByline=pcEsc(a.byline);
        const safeHdl=pcEsc(a.headline);
        const safeDesc=pcEsc(a.desc);
        const bl=safeByline?`<span class="social-byline">${safeByline}</span>`:'';
        const urlAttr=a.url?`data-url="${pcEsc(a.url)}"`:'';
        return`<div class="social-item" ${urlAttr}>
          <div class="social-meta"><span class="social-badge">ESPN</span>${bl}${ta?`<span class="social-time">· ${ta}</span>`:''}</div>
          <div class="social-hdl">${safeHdl}</div>
          ${safeDesc?`<div class="social-desc">${safeDesc}</div>`:''}
        </div>`;
      }).join('')
    :d._newsFetched
      ?`<div style="text-align:center;color:var(--dim);padding:24px;font-size:13px">No analyst stories available right now — check back soon ⚾</div>`
      :`<div style="text-align:center;color:var(--dim);padding:24px;font-size:13px">Loading analyst feed… ⚾</div>`;

  document.getElementById('content').innerHTML=`
    <div class="card">
      <div class="ct" style="color:var(--green)">📈 SEASON AT A GLANCE</div>
      <div class="sg">
        <div class="sb"><div class="sl">RECORD</div><div class="sv" style="color:${recColor}">${d.record.w}-${d.record.l}</div><div class="ss">${nleSub}</div></div>
        <div class="sb"><div class="sl">WIN %</div><div class="sv" style="color:${wpctColor}">${d.record.pct}</div><div class="ss">${nlSub}</div></div>
        <div class="sb"><div class="sl">HOME</div><div class="sv" style="color:${homeColor}">${d.record.home}</div><div class="ss">Truist Park</div></div>
        <div class="sb"><div class="sl">AWAY</div><div class="sv" style="color:${awayColor}">${d.record.away}</div><div class="ss">On the Road</div></div>
        <div class="sb"><div class="sl">LAST 10</div><div class="sv" style="color:${l10Color}">${d.record.last10}</div><div class="ss">Recent Form</div></div>
        <div class="sb"><div class="sl">RUN +/-</div><div class="sv" style="color:${rdColor}">${d.record.runDiff}</div><div class="ss">Differential</div></div>
      </div>
    </div>
    <div class="card">
      <div class="ct" style="color:var(--green)">🏆 TOP PERFORMERS <span style="font-size:9px;color:${d._liveSource?'var(--green)':'var(--yellow)'}">● ${d._liveSource?'LIVE':'SEED'}</span></div>
      <div class="plist">
        ${tb?`<div class="prow">
          <div class="ptop"><div class="prn">${pcEsc(tb.name)}</div><span class="prp bat">TOP BATTER</span></div>
          <div class="prstats" style="grid-template-columns:repeat(3,1fr)">
            <div class="pri"><div class="pril">HR</div>${badge(tb.hr,MLB_BAT.hr,false,v=>v)}</div>
            <div class="pri"><div class="pril">RBI</div>${badge(tb.rbi,MLB_BAT.rbi,false,v=>v)}</div>
            <div class="pri"><div class="pril">OPS</div>${badge(tb.ops,MLB_BAT.ops,false,v=>v.toFixed(3))}</div>
          </div>
        </div>`:''}
        ${tp?`<div class="prow">
          <div class="ptop"><div class="prn">${pcEsc(tp.name)}</div><span class="prp ${pcEsc(tp.pos).toLowerCase()}">TOP PITCHER</span></div>
          <div class="prstats" style="grid-template-columns:repeat(3,1fr)">
            <div class="pri"><div class="pril">ERA</div>${badge(tp.era,MLB_PIT.era,true,v=>v.toFixed(2))}</div>
            <div class="pri"><div class="pril">W</div><span class="badge bg">${tp.w}</span></div>
            <div class="pri"><div class="pril">WHIP</div>${badge(tp.whip,MLB_PIT.whip,true,v=>v.toFixed(2))}</div>
          </div>
        </div>`:''}
      </div>
    </div>

    <div class="card" style="background:linear-gradient(135deg,#0a1628,#0d1f2a);border-color:#38bdf844;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#38bdf8,#0ea5e9)"></div>
      <div class="ct" style="color:var(--blue)">🌤️ ${pcEsc((d.weather.venue||'Truist Park').toUpperCase())} WEATHER <span style="font-size:9px;color:${d.weather._live?'var(--green)':'var(--yellow)'}">● ${d.weather._live?'LIVE':'CACHED'}</span></div>
      <div class="wm"><div style="font-size:36px">${d.weather.emoji}</div><div class="wt">${d.weather.temp}°</div>
        <div><div style="font-weight:700;font-size:15px">${d.weather.condition}</div><div style="font-size:12px;color:var(--muted)">Feels like ${d.weather.feelsLike}°F</div><div style="font-size:12px;color:var(--muted)">Hi ${d.weather.hiTemp}° · Lo ${d.weather.loTemp}°</div></div>
      </div>
      <div class="wds">
        <div class="wdi"><span style="color:var(--dim)">💧 Humidity: </span><span style="font-family:'JetBrains Mono',monospace;font-weight:700">${d.weather.humidity}%</span></div>
        <div class="wdi"><span style="color:var(--dim)">🌬️ Wind: </span><span style="font-family:'JetBrains Mono',monospace;font-weight:700">${d.weather.wind} mph ${d.weather.windDir}</span></div>
        <div class="wdi"><span style="color:var(--dim)">🌧️ Rain: </span><span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:${rainColor(d.weather.rainChance)}">${d.weather.rainChance}%</span></div>
        <div class="wdi"><span style="color:var(--dim)">☀️ UV: </span><span style="font-family:'JetBrains Mono',monospace;font-weight:700">${d.weather.uvIndex}</span></div>
      </div>
      <div class="frow">${d.weather.forecast.map((f,i)=>`<div class="fday ${i===0?'today':''}"><div class="fl">${f.day}</div><div class="fi">${f.icon}</div><div class="fh">${f.hi}°</div><div class="fo">${f.lo}°</div><div class="fr" style="color:${rainColor(f.rain)}">${f.rain}%</div></div>`).join('')}</div>
      ${d.weather.alert?`<div class="abar">${d.weather.alert}</div>`:''}
    </div>
    <div class="card">
      <div class="ct" style="color:var(--muted)">📋 RECENT RESULTS</div>
      <div class="rrow">${d.lastGame.recentResults.map(r=>`<div class="rpill ${r.r==='W'?'w':'l'}"><div class="rd">${r.date} · ${r.opp}</div><div class="rl" style="color:${r.r==='W'?'var(--green)':'var(--crimson)'}">${r.r}</div><div class="rs">${r.score}</div></div>`).join('')}</div>
    </div>
    <div class="card" style="padding-bottom:12px">
      <div class="ct" style="color:var(--blue)">📰 ANALYST FEED <span style="font-size:9px;color:var(--dim);font-weight:400;letter-spacing:0;text-transform:none">· ESPN · scroll to read more</span></div>
      <div class="social-feed">${newsHtml}</div>
    </div>`;
}

// ── STATISTICS ──
function renderStats(d){
  const src=d._liveSource?`<span style="color:var(--green)">● LIVE — Updated ${stamp()}</span>`:`<span style="color:var(--yellow)">● SEED DATA — Live fetch failed, retrying…</span>`;
  const q=playerQuery.trim().toLowerCase();
  const allB=d.batters||[], allP=d.pitchers||[];
  const batters=q?allB.filter(b=>String(b.name).toLowerCase().includes(q)):allB;
  const pitchers=q?allP.filter(p=>String(p.name).toLowerCase().includes(q)):allP;
  const il=(d.inactive||[]).filter(p=>!q||String(p.name).toLowerCase().includes(q));
  const noHits=q&&!batters.length&&!pitchers.length&&!il.length;
  document.getElementById('content').innerHTML=`
    <div style="font-size:11px;margin-bottom:10px">${src}</div>
    ${searchBoxHtml(q?`${batters.length+pitchers.length} player${batters.length+pitchers.length===1?'':'s'} match “${pcEsc(playerQuery.trim())}”`:'')}
    ${noHits?`<div class="empty-msg">No players match “${pcEsc(playerQuery.trim())}” ⚾</div>`:''}
    <div class="leg"><span><span class="dot" style="background:var(--green)"></span>Above MLB Avg</span><span><span class="dot" style="background:var(--yellow)"></span>Near Avg</span><span><span class="dot" style="background:var(--crimson)"></span>Below Avg</span></div>
    ${batters.length?`<div class="card">
      <div class="ct" style="color:var(--green)">🏏 BATTING</div>
      <div style="font-size:9px;color:var(--dim);letter-spacing:1px;margin-bottom:8px">MLB AVG → ${MLB_BAT.avg.toFixed(3)} / ${MLB_BAT.obp.toFixed(3)} OBP / ${MLB_BAT.ops.toFixed(3)} OPS ${MLB_BAT._live?'<span style="color:var(--green)">● LIVE</span>':''}</div>
      <div class="plist">${batters.map(b=>`<div class="prow"><div class="ptop"><div class="prn">${pcEsc(b.name)}</div><span class="prp bat">${pcEsc(b.pos)}</span></div><div class="prstats"><div class="pri"><div class="pril">AVG</div>${badge(b.avg,MLB_BAT.avg,false,v=>v.toFixed(3))}</div><div class="pri"><div class="pril">OPS</div>${badge(b.ops,MLB_BAT.ops,false,v=>v.toFixed(3))}</div><div class="pri"><div class="pril">OBP</div>${badge(b.obp,MLB_BAT.obp,false,v=>v.toFixed(3))}</div><div class="pri"><div class="pril">SLG</div>${badge(b.slg,MLB_BAT.slg,false,v=>v.toFixed(3))}</div><div class="pri"><div class="pril">HR</div>${badge(b.hr,MLB_BAT.hr,false,v=>v)}</div><div class="pri"><div class="pril">RBI</div>${badge(b.rbi,MLB_BAT.rbi,false,v=>v)}</div><div class="pri"><div class="pril">SB</div>${badge(b.sb,MLB_BAT.sb,false,v=>v)}</div></div></div>`).join('')}</div>
    </div>`:''}
    ${pitchers.length?`<div class="card">
      <div class="ct" style="color:var(--red)">⚾ PITCHING</div>
      <div style="font-size:9px;color:var(--dim);letter-spacing:1px;margin-bottom:8px">MLB AVG → ${MLB_PIT.era.toFixed(2)} ERA / ${MLB_PIT.whip.toFixed(2)} WHIP / ${MLB_PIT.k9.toFixed(1)} K/9 ${MLB_PIT._live?'<span style="color:var(--green)">● LIVE</span>':''}</div>
      <div class="plist">${d.pitchers.map(p=>`<div class="prow"><div class="ptop"><div class="prn">${pcEsc(p.name)}</div><span class="prp ${pcEsc(p.pos).toLowerCase()}">${pcEsc(p.pos)}</span></div><div class="prstats"><div class="pri"><div class="pril">ERA</div>${badge(p.era,MLB_PIT.era,true,v=>v.toFixed(2))}</div><div class="pri"><div class="pril">WHIP</div>${badge(p.whip,MLB_PIT.whip,true,v=>v.toFixed(2))}</div><div class="pri"><div class="pril">K/9</div>${badge(p.k9,MLB_PIT.k9,false,v=>v.toFixed(1))}</div><div class="pri"><div class="pril">BB/9</div>${badge(p.bb9,MLB_PIT.bb9,true,v=>v.toFixed(1))}</div><div class="pri"><div class="pril">FIP</div>${badge(p.fip,MLB_PIT.fip,true,v=>v.toFixed(2))}</div><div class="pri"><div class="pril">${p.pos==='RP'?'SV':'W'}</div><span class="badge bg">${p.pos==='RP'?p.sv:p.w}</span></div></div></div>`).join('')}</div>
    </div>`:''}
    ${il.length?`<div class="card" style="border-color:#facc1533">
      <div class="ct" style="color:var(--yellow)">🩹 INJURED / INACTIVE <span style="font-size:9px;color:var(--dim);font-weight:400;letter-spacing:0;text-transform:none">· on the 40-man, not on the active roster</span></div>
      <div class="il-grid">${il.map(p=>`
        <div class="il-item" title="${pcEsc(p.status)}">
          <span class="il-pos">${pcEsc(p.pos)}</span>
          <span class="il-name">${pcEsc(p.name)}</span>
        </div>`).join('')}</div>
    </div>`:''}`;
}

// Shared search input used by the Stats and Cards tabs.
function searchBoxHtml(countLabel){
  return`<div class="psearch">
      <span class="ps-ico">🔍</span>
      <input id="player-search" type="search" placeholder="Search players…" value="${pcEsc(playerQuery)}" autocomplete="off" spellcheck="false"/>
      ${playerQuery?`<button class="ps-clr" data-act="clear-search" title="Clear">×</button>`:''}
    </div>
    ${countLabel?`<div class="ps-count">${countLabel}</div>`:''}`;
}

// ── STANDINGS ──
function renderStandings(d){
  const nle=d.nle||[];
  const top=nle[0]||{w:0,l:0};
  const mlbTop=[...(d.mlbTop||[])].sort((a,b)=>(b.w/(b.w+b.l))-(a.w/(a.w+a.l)));
  const divisions=d.divisions||[];

  const divTable=(div)=>{
    const leader=div.teams[0]||{w:0,l:0};
    return`<div class="card" style="margin-bottom:12px">
      <div class="ct" style="color:${div.league==='NL'?'var(--green)':'#60a5fa'}">${div.name}</div>
      <table class="stbl">
        <thead><tr><th>TEAM</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead>
        <tbody>${div.teams.map((t,i)=>`<tr class="${t.abbr==='ATL'?'me':''}"><td>${i===0?'🥇 ':''}${t.abbr==='ATL'?`<strong>${pcEsc(t.name)}</strong>`:pcEsc(t.name)}</td><td style="color:var(--green)">${t.w}</td><td style="color:var(--crimson)">${t.l}</td><td>${pct(t.w,t.l)}</td><td style="color:var(--muted)">${gb(leader.w,leader.l,t.w,t.l)}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
  };

  // Find ATL within the MLB top list to show position
  const atlMlbIdx=mlbTop.findIndex(t=>t.abbr==='ATL');
  const atlMlbRank=atlMlbIdx>=0?atlMlbIdx+1:null;

  const wc=d.wildcard||[];
  const wcHtml=wc.length?`
    <div class="card" style="border-color:#facc1533">
      <div class="ct" style="color:var(--yellow)">🎟️ NL WILD CARD RACE</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px">Top 3 claim a wild card berth · dashed line is the cut</div>
      ${wc.map(t=>`
        <div class="wc-row${t.seed===3?' cut':''}">
          <span class="wc-seed">${t.inSpot?t.seed:'—'}</span>
          <span class="wc-name" style="${t.abbr==='ATL'?'color:var(--green);font-weight:700':''}">${t.abbr==='ATL'?'🪓 ':''}${pcEsc(t.name)}</span>
          <span class="wc-rec">${t.w}-${t.l}</span>
          <span class="wc-gb" style="color:${t.inSpot?'var(--green)':'var(--muted)'}">${t.inSpot?'+':''}${pcEsc(String(t.gb))}</span>
        </div>`).join('')}
    </div>`:'';

  const mn=d.record.magicNumber;
  const magicHtml=(mn!=null)?`<span class="magic">${mn===0?'✅ CLINCHED':`MAGIC # ${mn}`}</span>`:'';

  document.getElementById('content').innerHTML=`
    <div class="card">
      <div class="ct" style="color:var(--green)">🏆 NL EAST · LIVE STANDINGS${magicHtml}</div>
      <div style="font-size:10px;color:var(--dim);letter-spacing:1px;margin-bottom:10px">Refreshes every 2 min · last sync ${stamp()}</div>
      <table class="stbl">
        <thead><tr><th>TEAM</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead>
        <tbody>${nle.map((t,i)=>`<tr class="${t.abbr==='ATL'?'me':''}"><td>${i===0?'🥇 ':''}${t.abbr==='ATL'?`<strong>${pcEsc(t.name)}</strong>`:pcEsc(t.name)}</td><td style="color:var(--green)">${t.w}</td><td style="color:var(--crimson)">${t.l}</td><td>${pct(t.w,t.l)}</td><td style="color:var(--muted)">${gb(top.w,top.l,t.w,t.l)}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    ${wcHtml}
    <div class="card" style="border-color:#60a5fa33">
      <div class="ct" style="color:#60a5fa">📊 MLB TOP TEAMS · WIN %</div>
      ${atlMlbRank?`<div style="font-size:11px;color:var(--muted);margin-bottom:8px">🪓 Braves rank <strong style="color:var(--green)">#${atlMlbRank}</strong> in MLB</div>`:''}
      ${mlbTop.map((t,i)=>{const p=t.w/(t.w+t.l);return`<div class="rbrow"><span class="rbn">#${i+1}</span><span class="rbnm" style="${t.abbr==='ATL'?'color:var(--green);font-weight:700':''}">${t.abbr==='ATL'?'🪓 ':''}${pcEsc(t.name)} <span style="color:var(--dim);font-family:JetBrains Mono,monospace;font-size:11px">(${t.w}-${t.l})</span></span><div class="rbw"><div class="rbb" style="width:${p*100}%;background:${t.abbr==='ATL'?'var(--green)':'#60a5fa'}"></div></div><span class="rbp" style="${t.abbr==='ATL'?'color:var(--green)':''}">${pct(t.w,t.l)}</span></div>`}).join('')}
    </div>
    ${divisions.length?`<div class="card" style="border-color:#facc1533">
      <div class="ct" style="color:var(--yellow)">🗺️ EVERY DIVISION</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px">All six divisions · live from MLB statsapi · auto-refresh every 2 min</div>
      ${divisions.filter(div=>div.id!==NLE_DIV).map(divTable).join('')}
    </div>`:''}
  `;
}

// ════════════════════════════════════════
// CHART HELPERS — inline SVG, no deps
// ════════════════════════════════════════
function chBox(title,color,body,sub){
  return`<div class="card chart-card"><div class="ct" style="color:${color||'var(--green)'}">${title}</div>${sub?`<div style="font-size:10px;color:var(--dim);margin-bottom:8px;letter-spacing:1px;text-transform:none">${sub}</div>`:''}${body}</div>`;
}

// Multi-series line chart. series:[{points:[{x,y}], color, fill, label}]
function chMultiLine(series,opts){
  const{w=320,h=160,yMin,yMax,refLines=[],showDots=false,yFmt}=opts||{};
  if(!series.length||!series[0].points.length)return`<div style="color:var(--dim);text-align:center;padding:20px;font-size:12px">No data yet</div>`;
  const allY=series.flatMap(s=>s.points.map(p=>p.y)).concat(refLines.map(r=>r.y));
  const allX=series.flatMap(s=>s.points.map(p=>p.x));
  const xMin=Math.min(...allX),xMax=Math.max(...allX);
  const ymin=yMin!=null?yMin:Math.min(...allY);
  const ymax=yMax!=null?yMax:Math.max(...allY);
  const padL=34,padR=12,padT=10,padB=22;
  const innerW=w-padL-padR,innerH=h-padT-padB;
  const sx=x=>padL+(xMax===xMin?innerW/2:((x-xMin)/(xMax-xMin))*innerW);
  const sy=y=>padT+(ymax===ymin?innerH/2:innerH-((y-ymin)/(ymax-ymin))*innerH);
  const fmt=v=>yFmt?yFmt(v):(Math.abs(v)<1?v.toFixed(3):v.toFixed(0));
  const yt=[ymin,(ymin+ymax)/2,ymax];
  const yTicks=yt.map(y=>`<text x="${padL-4}" y="${sy(y)+3}" text-anchor="end" font-size="9" fill="#5a7a62" font-family="JetBrains Mono,monospace">${fmt(y)}</text>`).join('');
  const yGrid=yt.map(y=>`<line x1="${padL}" x2="${w-padR}" y1="${sy(y).toFixed(1)}" y2="${sy(y).toFixed(1)}" stroke="#1e3a26" stroke-width="0.5"/>`).join('');
  const refHtml=refLines.map(r=>`<line x1="${padL}" x2="${w-padR}" y1="${sy(r.y).toFixed(1)}" y2="${sy(r.y).toFixed(1)}" stroke="${r.color||'#facc15'}" stroke-dasharray="3,3" stroke-width="1"/>${r.label?`<text x="${w-padR-2}" y="${sy(r.y)-3}" text-anchor="end" font-size="8" fill="${r.color||'#facc15'}">${r.label}</text>`:''}`).join('');
  let body='';
  series.forEach(s=>{
    const linePath=s.points.map((p,i)=>`${i?'L':'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
    if(s.fill){
      const areaPath=`${linePath}L${sx(s.points[s.points.length-1].x).toFixed(1)},${sy(ymin).toFixed(1)}L${sx(s.points[0].x).toFixed(1)},${sy(ymin).toFixed(1)}Z`;
      body+=`<path d="${areaPath}" fill="${s.fill}"/>`;
    }
    body+=`<path d="${linePath}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    if(showDots)body+=s.points.map(p=>`<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="2" fill="${s.color}"/>`).join('');
  });
  const fx=series[0].points[0],lx=series[0].points[series[0].points.length-1];
  const xAx=`<text x="${padL}" y="${h-6}" font-size="9" fill="#5a7a62">G${fx.x}</text><text x="${w-padR}" y="${h-6}" text-anchor="end" font-size="9" fill="#5a7a62">G${lx.x}</text>`;
  return`<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block;max-height:240px">${yGrid}${refHtml}${body}${yTicks}${xAx}</svg>`;
}

// Horizontal bars with optional reference line. items:[{label, value, fmt?}]
function chBars(items,opts){
  const{w=320,h,max,refValue,refLabel='MLB AVG',lowerIsBetter=false,goodColor='#22c55e',badColor='#ef4444',neutralColor='#facc15'}=opts||{};
  if(!items.length)return'';
  const padL=88,padR=46,padT=10,padB=8;
  const calcH=h||(padT+padB+items.length*22);
  const innerW=w-padL-padR;
  const rowH=(calcH-padT-padB)/items.length;
  const barH=Math.min(rowH*0.62,15);
  const mx=max!=null?max:Math.max(...items.map(i=>i.value),refValue||0)*1.1;
  const sx=v=>padL+Math.max(0,v/mx)*innerW;
  let svg='';
  if(refValue!=null){
    svg+=`<line x1="${sx(refValue).toFixed(1)}" x2="${sx(refValue).toFixed(1)}" y1="${padT-2}" y2="${calcH-padB+2}" stroke="#facc15" stroke-dasharray="3,3" stroke-width="1"/>`;
    svg+=`<text x="${(sx(refValue)+3).toFixed(1)}" y="${padT+8}" font-size="8" fill="#facc15">${refLabel}</text>`;
  }
  items.forEach((it,i)=>{
    const cy=padT+i*rowH+rowH/2;
    const barY=cy-barH/2;
    let color=it.color;
    if(!color){
      if(refValue==null)color=neutralColor;
      else{
        const better=lowerIsBetter?it.value<refValue:it.value>refValue;
        const within5=Math.abs(it.value-refValue)/refValue<0.05;
        color=within5?neutralColor:(better?goodColor:badColor);
      }
    }
    svg+=`<text x="${padL-6}" y="${cy+3.5}" text-anchor="end" font-size="10" fill="#e8ede9" font-family="DM Sans,sans-serif">${it.label}</text>`;
    svg+=`<rect x="${padL}" y="${barY.toFixed(1)}" width="${Math.max(0,sx(it.value)-padL).toFixed(1)}" height="${barH.toFixed(1)}" rx="3" fill="${color}" opacity="0.88"/>`;
    const fmt=it.fmt?it.fmt(it.value):(it.value<1?it.value.toFixed(3):it.value.toFixed(2));
    svg+=`<text x="${(sx(it.value)+4).toFixed(1)}" y="${cy+3.5}" font-size="10" fill="#e8ede9" font-family="JetBrains Mono,monospace" font-weight="700">${fmt}</text>`;
  });
  return`<svg viewBox="0 0 ${w} ${calcH}" style="width:100%;height:auto;display:block;max-height:${calcH}px">${svg}</svg>`;
}

// Run-diff bars by game. games:[{diff, opp, won}]
function chDiffBars(games,opts){
  const{w=320,h=140}=opts||{};
  if(!games.length)return`<div style="color:var(--dim);text-align:center;padding:20px;font-size:12px">No data yet</div>`;
  const padL=10,padR=10,padT=10,padB=26;
  const innerW=w-padL-padR,innerH=h-padT-padB;
  const maxAbs=Math.max(1,...games.map(g=>Math.abs(g.diff)));
  const slot=innerW/games.length;
  const barW=Math.max(2,slot-1);
  const zeroY=padT+innerH/2;
  const scale=(innerH/2)/maxAbs;
  let svg=`<line x1="${padL}" x2="${w-padR}" y1="${zeroY}" y2="${zeroY}" stroke="#5a7a62" stroke-width="0.5"/>`;
  games.forEach((g,i)=>{
    const x=padL+i*slot+(slot-barW)/2;
    const barH=Math.abs(g.diff)*scale;
    const y=g.diff>=0?zeroY-barH:zeroY;
    const col=g.diff>0?'#22c55e':(g.diff<0?'#ef4444':'#5a7a62');
    svg+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(barH,1).toFixed(1)}" rx="1.5" fill="${col}" opacity="0.9"/>`;
    if(games.length<=20){
      svg+=`<text x="${(x+barW/2).toFixed(1)}" y="${h-padB+9}" text-anchor="middle" font-size="7" fill="#5a7a62" font-family="JetBrains Mono,monospace">${g.opp||''}</text>`;
      svg+=`<text x="${(x+barW/2).toFixed(1)}" y="${h-padB+18}" text-anchor="middle" font-size="7" fill="${col}" font-family="JetBrains Mono,monospace" font-weight="700">${g.diff>0?'+':''}${g.diff}</text>`;
    }
  });
  svg+=`<text x="${padL+2}" y="${padT+8}" font-size="8" fill="#22c55e">+${maxAbs}</text>`;
  svg+=`<text x="${padL+2}" y="${h-padB-2}" font-size="8" fill="#ef4444">-${maxAbs}</text>`;
  return`<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block;max-height:180px">${svg}</svg>`;
}

// Last-N form grid: most-recent on the right
function chFormGrid(games){
  if(!games.length)return`<div style="color:var(--dim);text-align:center;padding:20px;font-size:12px">No completed games yet</div>`;
  return`<div style="display:flex;flex-wrap:wrap;gap:5px">${games.map(g=>`<div title="${g.opp} ${g.score}" style="width:30px;height:30px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-family:'Anton',sans-serif;font-size:13px;background:${g.res==='W'?'#22c55e22':'#ef444422'};border:1px solid ${g.res==='W'?'#22c55e66':'#ef444466'};color:${g.res==='W'?'var(--green)':'var(--crimson)'};cursor:default">${g.res}</div>`).join('')}</div>`;
}

// ════════════════════════════════════════
// TRENDS TAB — many in-depth graphs
// ════════════════════════════════════════
function renderTrends(d){
  const traj=d.trajectory||[];
  const out=[];

  // 1. Season W-L Trajectory
  if(traj.length){
    const winPts=traj.map(g=>({x:g.gameNo,y:g.cumW}));
    const lossPts=traj.map(g=>({x:g.gameNo,y:g.cumL}));
    const ymax=Math.max(traj[traj.length-1].cumW,traj[traj.length-1].cumL)+2;
    out.push(chBox('📈 SEASON TRAJECTORY','var(--green)',
      chMultiLine([
        {points:winPts,color:'#22c55e',fill:'#22c55e15'},
        {points:lossPts,color:'#ef4444',fill:'#ef444415'},
      ],{yMin:0,yMax:ymax,h:170,yFmt:v=>v.toFixed(0)})
      +`<div class="leg" style="margin-top:8px"><span><span class="dot" style="background:var(--green)"></span>Cumulative Wins</span><span><span class="dot" style="background:var(--crimson)"></span>Cumulative Losses</span></div>`,
      `${traj.length} games played · separation is the story`));
  }

  // 2. Cumulative Run Differential
  if(traj.length){
    const pts=traj.map(g=>({x:g.gameNo,y:g.cumDiff}));
    const maxD=Math.max(...pts.map(p=>p.y),0)+5;
    const minD=Math.min(...pts.map(p=>p.y),0)-5;
    const col=traj[traj.length-1].cumDiff>=0?'#22c55e':'#ef4444';
    out.push(chBox('🔥 CUMULATIVE RUN DIFFERENTIAL','#38bdf8',
      chMultiLine([{points:pts,color:col,fill:col+'22'}],
        {yMin:minD,yMax:maxD,h:160,refLines:[{y:0,color:'#5a7a62',label:'Even'}],yFmt:v=>(v>0?'+':'')+v.toFixed(0)}),
      `Runs scored minus runs allowed, building game by game`));
  }

  // 3. Rolling 10-game Win %
  if(traj.length>=5){
    const win=traj.length<10?5:10;
    const roll=[];
    for(let i=win-1;i<traj.length;i++){
      const slice=traj.slice(i-win+1,i+1);
      const w=slice.filter(g=>g.won).length;
      roll.push({x:traj[i].gameNo,y:w/win});
    }
    out.push(chBox(`📊 ROLLING ${win}-GAME WIN %`,'var(--yellow)',
      chMultiLine([{points:roll,color:'#facc15',fill:'#facc1522'}],
        {yMin:0,yMax:1,h:160,refLines:[{y:0.5,color:'#5a7a62',label:'.500'},{y:0.6,color:'#22c55e44',label:'.600'}],yFmt:v=>v.toFixed(3).replace('0.','.')}),
      `Hot streaks and cold spells, smoothed over a rolling window`));
  }

  // 4. Recent Form (last 20)
  const recentForm=traj.slice(-20).map(g=>({res:g.won?'W':'L',opp:g.opp,score:`${g.rs}-${g.ra}`}));
  if(recentForm.length){
    const recW=recentForm.filter(g=>g.res==='W').length;
    out.push(chBox(`✅ LAST ${recentForm.length} GAMES · ${recW}-${recentForm.length-recW}`,'var(--muted)',
      chFormGrid(recentForm),'Most recent on the right · hover for opponent + score'));
  }

  // 5. Run Differential per Game (last 25)
  const recentDiff=traj.slice(-25).map(g=>({diff:g.diff,opp:g.opp,won:g.won}));
  if(recentDiff.length){
    out.push(chBox('⚾ RUN DIFFERENTIAL — LAST 25','var(--green)',
      chDiffBars(recentDiff,{h:160}),
      `Margin of victory/defeat by game`));
  }

  // 6. Top Batter OPS vs MLB
  if(d.batters?.length){
    const top=[...d.batters].sort((a,b)=>b.ops-a.ops).slice(0,8)
      .map(b=>({label:b.name.split(' ').slice(-1)[0].slice(0,10),value:b.ops,fmt:v=>v.toFixed(3)}));
    out.push(chBox('🏏 TOP BATTERS — OPS','var(--green)',
      chBars(top,{refValue:MLB_BAT.ops,refLabel:'MLB AVG',lowerIsBetter:false,max:Math.max(...top.map(t=>t.value),MLB_BAT.ops)*1.15}),
      `Higher is better · MLB average ${MLB_BAT.ops.toFixed(3)}`));
  }

  // 7. Starters ERA vs MLB
  if(d.pitchers?.length){
    const sp=d.pitchers.filter(p=>p.pos==='SP').slice(0,8)
      .map(p=>({label:p.name.split(' ').slice(-1)[0].slice(0,10),value:p.era,fmt:v=>v.toFixed(2)}));
    if(sp.length)out.push(chBox('🎯 STARTERS — ERA','var(--red)',
      chBars(sp,{refValue:MLB_PIT.era,refLabel:'MLB AVG',lowerIsBetter:true,max:Math.max(...sp.map(t=>t.value),MLB_PIT.era)*1.15}),
      `Lower is better · MLB average ${MLB_PIT.era.toFixed(2)}`));
  }

  // 8. Bullpen ERA vs MLB
  if(d.pitchers?.length){
    const rp=d.pitchers.filter(p=>p.pos==='RP').slice(0,8)
      .map(p=>({label:p.name.split(' ').slice(-1)[0].slice(0,10),value:p.era,fmt:v=>v.toFixed(2)}));
    if(rp.length)out.push(chBox('🔒 BULLPEN — ERA','var(--red)',
      chBars(rp,{refValue:MLB_PIT.era,refLabel:'MLB AVG',lowerIsBetter:true,max:Math.max(...rp.map(t=>t.value),MLB_PIT.era)*1.15}),
      `Lower is better · MLB average ${MLB_PIT.era.toFixed(2)}`));
  }

  // 9. Bullpen K/9
  if(d.pitchers?.length){
    const rp=d.pitchers.filter(p=>p.pos==='RP').slice(0,8)
      .map(p=>({label:p.name.split(' ').slice(-1)[0].slice(0,10),value:p.k9,fmt:v=>v.toFixed(1)}));
    if(rp.length)out.push(chBox('💨 BULLPEN — STRIKEOUTS PER 9','#38bdf8',
      chBars(rp,{refValue:MLB_PIT.k9,refLabel:'MLB AVG',lowerIsBetter:false,max:Math.max(...rp.map(t=>t.value),MLB_PIT.k9)*1.15}),
      `Higher is better · MLB average ${MLB_PIT.k9.toFixed(1)}`));
  }

  // 10. NL East gap (current standings)
  if(d.nle?.length){
    const top=d.nle[0];
    const items=d.nle.map(t=>({label:t.abbr,value:t.w/(t.w+t.l),color:t.abbr==='ATL'?'#22c55e':'#38bdf8',fmt:v=>v.toFixed(3).replace('0.','.')}));
    out.push(chBox('🏆 NL EAST — WIN %','var(--green)',
      chBars(items,{max:Math.max(...items.map(i=>i.value))*1.1,refValue:0.500,refLabel:'.500'}),
      `Atlanta leads by ${gb(top.w,top.l,d.nle[1]?.w||0,d.nle[1]?.l||0)} games over ${d.nle[1]?.abbr||'2nd'}`));
  }

  // 11. Home / Away / L10 splits
  const splits=[
    {label:'Home',rec:d.record.home},
    {label:'Away',rec:d.record.away},
    {label:'Last 10',rec:d.record.last10},
  ].map(s=>{
    const[w,l]=String(s.rec||'0-0').split('-').map(Number);
    return{label:s.label,value:(w+l)?w/(w+l):0,fmt:v=>v.toFixed(3).replace('0.','.'),rec:s.rec};
  });
  out.push(chBox('🏟️ SPLITS — WIN %','var(--muted)',
    chBars(splits.map(s=>({label:`${s.label} ${s.rec}`,value:s.value,fmt:s.fmt})),
      {refValue:0.500,refLabel:'.500',max:1.0,lowerIsBetter:false}),
    `How the Braves perform at home, on the road, and recently`));

  // 12. Run-scoring distribution (avg runs scored / allowed)
  if(traj.length){
    const games=traj.length;
    const totalRS=traj.reduce((a,g)=>a+g.rs,0);
    const totalRA=traj.reduce((a,g)=>a+g.ra,0);
    const avgRS=totalRS/games,avgRA=totalRA/games;
    const items=[
      {label:'Runs / Game',value:+avgRS.toFixed(2),fmt:v=>v.toFixed(2),color:'#22c55e'},
      {label:'Runs Allowed',value:+avgRA.toFixed(2),fmt:v=>v.toFixed(2),color:'#ef4444'},
    ];
    out.push(chBox('📊 OFFENSE vs DEFENSE — RUNS PER GAME','#38bdf8',
      chBars(items,{max:Math.max(avgRS,avgRA)*1.25,refValue:4.5,refLabel:'MLB ~4.5'}),
      `Season averages over ${games} games · MLB-wide is ≈ 4.5 RPG`));
  }

  document.getElementById('content').innerHTML=out.join('');
}

// ════════════════════════════════════════
// PLAYER CARDS TAB — Braves-themed flippable cards
// ════════════════════════════════════════
function pcardPhoto(id){
  return id?`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_480,q_auto:best/v1/people/${id}/headshot/67/current`:'';
}

function pcStatRow(label,value,avg,lowerBetter){
  let display=value,numeric=value;
  if(typeof value==='number'){
    if(value<1&&value>0)display=value.toFixed(3);
    else if(label==='ERA'||label==='WHIP'||label==='FIP'||label==='K/9'||label==='BB/9'||label==='K/BB')display=value.toFixed(2);
    else display=String(Math.round(value*100)/100);
    numeric=value;
  }else{
    numeric=parseFloat(value)||0;
  }
  const color=avg!=null?sc(numeric,avg,lowerBetter):'var(--text)';
  const avgDisplay=avg==null?'':(avg<1?avg.toFixed(3):avg.toFixed(2));
  return`<div class="pcard-stat-row"><span class="pcard-stat-l">${label}</span><span class="pcard-stat-v" style="color:${color}">${display}</span><span class="pcard-stat-avg">${avgDisplay}</span></div>`;
}

function pcBatterStats(b){
  const ops_plus=Math.round((b.ops/MLB_BAT.ops)*100);
  const iso=b.slg-b.avg;
  return`
    <div class="pcard-stat-section">SLASH LINE</div>
    ${pcStatRow('AVG',b.avg,MLB_BAT.avg,false)}
    ${pcStatRow('OBP',b.obp,MLB_BAT.obp,false)}
    ${pcStatRow('SLG',b.slg,MLB_BAT.slg,false)}
    ${pcStatRow('OPS',b.ops,MLB_BAT.ops,false)}
    <div class="pcard-stat-section">POWER &amp; SPEED</div>
    ${pcStatRow('HR',b.hr,MLB_BAT.hr,false)}
    ${pcStatRow('RBI',b.rbi,MLB_BAT.rbi,false)}
    ${pcStatRow('SB',b.sb,MLB_BAT.sb,false)}
    ${b.doubles!=null?pcStatRow('2B',b.doubles,null,false):''}
    ${b.triples!=null?pcStatRow('3B',b.triples,null,false):''}
    <div class="pcard-stat-section">ADVANCED</div>
    ${pcStatRow('OPS+',ops_plus,100,false)}
    ${pcStatRow('ISO',iso,MLB_BAT.slg-MLB_BAT.avg,false)}
    ${b.ab!=null?pcStatRow('AB',b.ab,null,false):''}
    ${b.h!=null?pcStatRow('H',b.h,null,false):''}
    ${b.r!=null?pcStatRow('R',b.r,null,false):''}
    ${b.bb!=null?pcStatRow('BB',b.bb,null,false):''}
    ${b.so!=null?pcStatRow('SO',b.so,null,true):''}
    ${b.pa!=null?pcStatRow('PA',b.pa,null,false):''}`;
}

function pcPitcherStats(p){
  const kbb=p.bb9>0?(p.k9/p.bb9):p.k9;
  return`
    <div class="pcard-stat-section">RUN PREVENTION</div>
    ${pcStatRow('ERA',p.era,MLB_PIT.era,true)}
    ${pcStatRow('WHIP',p.whip,MLB_PIT.whip,true)}
    ${pcStatRow('FIP',p.fip,MLB_PIT.fip,true)}
    <div class="pcard-stat-section">STUFF</div>
    ${pcStatRow('K/9',p.k9,MLB_PIT.k9,false)}
    ${pcStatRow('BB/9',p.bb9,MLB_PIT.bb9,true)}
    ${pcStatRow('K/BB',kbb,2.75,false)}
    <div class="pcard-stat-section">RESULTS</div>
    ${pcStatRow('W',p.w,null,false)}
    ${p.l!=null?pcStatRow('L',p.l,null,true):''}
    ${p.pos==='RP'?pcStatRow('SV',p.sv,null,false):''}
    ${p.ip?pcStatRow('IP',p.ip,null,false):''}
    ${p.k!=null?pcStatRow('K',p.k,null,false):''}
    ${p.bbTotal!=null?pcStatRow('BB',p.bbTotal,null,true):''}
    ${p.hrAllowed!=null?pcStatRow('HR',p.hrAllowed,null,true):''}
    ${p.gp?pcStatRow('G',p.gp,null,false):''}
    ${p.gs?pcStatRow('GS',p.gs,null,false):''}`;
}

function pcEsc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

function pcCardHtml(p,type){
  const isB=type==='b';
  const photo=pcardPhoto(p.id);
  const stats=isB?pcBatterStats(p):pcPitcherStats(p);
  const badgeColor=isB?'var(--green)':(p.pos==='RP'?'#f87171':'#60a5fa');
  const safeName=pcEsc(p.name);
  return`
    <div class="pcard" data-act="flip">
      <div class="pcard-inner">
        <div class="pcard-face">
          <div class="pcard-strip">
            <span class="pcard-team">ATLANTA BRAVES</span>
            ${p.jersey?`<span class="pcard-jersey">#${pcEsc(p.jersey)}</span>`:''}
          </div>
          <div class="pcard-flip-hint-front">↻</div>
          <div class="pcard-photo${photo?'':' no-photo'}">${photo?`<img src="${photo}" alt="${safeName}" loading="lazy">`:''}</div>
          <div class="pcard-name-block">
            <span class="pcard-pos-badge" style="background:${badgeColor}">${pcEsc(p.pos)}</span>
            <div class="pcard-name">${safeName}</div>
          </div>
        </div>
        <div class="pcard-back">
          <div class="pcard-back-strip">
            <div class="pcard-back-name">${safeName}</div>
            <div class="pcard-back-meta"><span class="pcard-live-pulse"></span>LIVE · ${pcEsc(p.pos)}${p.jersey?` · #${pcEsc(p.jersey)}`:''}</div>
          </div>
          <div class="pcard-back-scroll" data-noflip="1">${stats}</div>
          <div class="pcard-flip-hint">TAP TO FLIP BACK</div>
        </div>
      </div>
    </div>`;
}

function renderCards(d){
  const q=playerQuery.trim().toLowerCase();
  const match=p=>!q||String(p.name).toLowerCase().includes(q);
  // When searching, show every match; otherwise show the leaders.
  const allB=(d.batters||[]).filter(match);
  const allSP=(d.pitchers||[]).filter(p=>p.pos==='SP').filter(match);
  const allRP=(d.pitchers||[]).filter(p=>p.pos==='RP').filter(match);
  const batters=q?allB:allB.slice(0,10);
  const starters=q?allSP:allSP.slice(0,6);
  const bullpen=q?allRP:allRP.slice(0,6);
  const total=batters.length+starters.length+bullpen.length;
  const lastSync=stamp();

  const section=(title,color,emoji,players,type)=>
    players.length?`
      <div class="card" style="margin-bottom:14px">
        <div class="ct" style="color:${color}">${emoji} ${title}</div>
        <div style="font-size:10px;color:var(--dim);letter-spacing:1px;margin-bottom:10px">Tap a card to flip · stats refresh every 2 min · last sync ${lastSync}</div>
        <div class="cards-grid">${players.map(p=>pcCardHtml(p,type)).join('')}</div>
      </div>`:'';

  document.getElementById('content').innerHTML=`
    <div class="card" style="background:linear-gradient(135deg,#0d1a0f,#0a1628);border-color:#22c55e44">
      <div class="ct" style="color:var(--green)">🎴 PLAYER CARDS</div>
      <div class="cards-intro">Original Braves trading-card design. Photos via MLB's public headshot CDN. <strong>Tap any card to flip</strong> and see live stats — colors compare each stat to the MLB average (green = better, yellow = near average, red = below).</div>
    </div>
    ${searchBoxHtml(q?`${total} player${total===1?'':'s'} match “${pcEsc(playerQuery.trim())}”`:'')}
    ${q&&!total?`<div class="empty-msg">No players match “${pcEsc(playerQuery.trim())}” ⚾</div>`:''}
    ${section(q?'BATTERS':'TOP BATTERS · OPS LEADERS','var(--green)','🏏',batters,'b')}
    ${section('STARTING ROTATION','#60a5fa','🎯',starters,'p')}
    ${section('BULLPEN','#f87171','🔒',bullpen,'p')}
  `;
}

// ── HEALTH DASHBOARD UI ──
function showHealth(){
  if(document.getElementById('h-ov'))return;
  const s=HEALTH.getSt();
  const log=HEALTH.getLog();
  const statusColor={green:'var(--green)',yellow:'var(--yellow)',red:'var(--crimson)'}[s.status]||'var(--green)';
  const statusLabel={green:'All Systems Operational',yellow:'Some Issues Detected',red:'Errors Detected'}[s.status]||'OK';
  const lastSyncAgo=s.lastSync?Math.round((Date.now()-s.lastSync)/1000)+'s ago':'Never';

  const systems=[
    {name:'Live Scores & Standings',dot:s.errs===0?'var(--green)':'var(--crimson)',status:s.errs===0?'Syncing normally':'Errors detected'},
    {name:'Player Stats (Batting)',dot:s.lastSyncPlayers>0?'var(--green)':'var(--yellow)',status:s.lastSyncPlayers>0?`${s.lastSyncPlayers} players loaded`:'Using seed data'},
    {name:'Live Weather',dot:'var(--green)',status:'Open-Meteo · 5-day forecast'},
    {name:'Auto-refresh Timer',dot:refreshTimer?'var(--green)':'var(--crimson)',status:refreshTimer?'Running every 2 min':'Stopped'},
    {name:'Network',dot:'var(--green)',status:navigator.onLine?'Online':'Offline'},
    {name:'Last Sync',dot:'var(--green)',status:lastSyncAgo},
  ];

  const logHtml=log.length===0
    ?`<div class="h-empty">No events yet — all clear 🪓</div>`
    :log.map(e=>`
      <div class="h-ev">
        <div class="h-ei">${e.icon}</div>
        <div>
          <div class="h-em" style="color:${e.type==='fix'?'var(--green)':e.type==='err'?'var(--crimson)':e.type==='warn'?'var(--yellow)':e.type==='ok'?'var(--green)':'var(--text)'}">${e.msg}</div>
          <div class="h-et">${e.t}</div>
        </div>
      </div>`).join('');

  const ov=document.createElement('div');
  ov.id='h-ov';ov.className='h-ov';
  ov.innerHTML=`
    <div class="h-hdr">
      <div>
        <div class="h-ttl">SYSTEM HEALTH</div>
        <div style="font-size:10px;color:${statusColor};margin-top:2px;letter-spacing:1px">${statusLabel}</div>
      </div>
      <button class="h-cls" data-act="health-close">×</button>
    </div>
    <div class="h-body">
      <div class="h-sg">
        <div class="h-s"><div class="h-sv">${HEALTH.uptime()}</div><div class="h-sl">Uptime</div></div>
        <div class="h-s"><div class="h-sv" style="color:var(--green)">${s.fixes}</div><div class="h-sl">Auto-Fixes</div></div>
        <div class="h-s"><div class="h-sv" style="color:${s.errs>0?'var(--crimson)':'var(--green)'}">${s.errs}</div><div class="h-sl">Errors</div></div>
        <div class="h-s"><div class="h-sv">${s.calls}</div><div class="h-sl">API Calls</div></div>
        <div class="h-s"><div class="h-sv" style="color:var(--yellow)">${s.warns}</div><div class="h-sl">Warnings</div></div>
        <div class="h-s"><div class="h-sv">${log.filter(e=>e.type==='ok').length}</div><div class="h-sl">Good Syncs</div></div>
      </div>
      <div class="card" style="margin-bottom:12px">
        <div class="ct" style="color:var(--muted)">SYSTEMS</div>
        ${systems.map(s=>`<div class="h-sys"><div class="h-sdot" style="background:${s.dot}"></div><div class="h-sn">${s.name}</div><div class="h-ss">${s.status}</div></div>`).join('')}
      </div>
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div class="ct" style="color:var(--muted);margin-bottom:0">FIX LOG (${log.length})</div>
          <button data-act="health-clear" style="font-size:11px;color:var(--dim);background:none;border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-family:'DM Sans',sans-serif">Clear</button>
        </div>
        ${logHtml}
      </div>
    </div>`;
  document.getElementById('app').appendChild(ov);
}

function closeHealth(){const o=document.getElementById('h-ov');if(o)o.remove();}

// ── NETWORK MONITOR ──
window.addEventListener('offline',()=>{
  HEALTH.warn('Network went offline — pausing auto-refresh');
  clearTimeout(refreshTimer);refreshTimer=null;
  const lbl=document.getElementById('refresh-label');
  if(lbl)lbl.textContent='Offline — waiting for connection';
});
window.addEventListener('online',()=>{
  HEALTH.fix('Network restored — resuming live updates');
  refreshAll();
});

// ── VISIBILITY WATCHDOG ── (recover when user returns to tab)
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible')return;
  const s=HEALTH.getSt();
  const stale=!s.lastSync||(Date.now()-s.lastSync)>5*60*1000;
  if(stale){
    HEALTH.fix('App resumed from background with stale data — refreshing');
    refreshAll();
  }
});

// ── STALENESS & DOM WATCHDOG ── (runs every 60s)
setInterval(()=>{
  if(!navigator.onLine)return;
  const s=HEALTH.getSt();
  // restart dead timer
  if(!refreshTimer){
    HEALTH.fix('Refresh timer was stopped — restarting auto-refresh');
    refreshAll();return;
  }
  // force refresh if data is stale
  if(s.lastSync&&(Date.now()-s.lastSync)>5*60*1000){
    HEALTH.fix('Data stale >5 min — forcing emergency refresh');
    refreshAll();return;
  }
  // DOM integrity: re-render if content area went blank after a successful render
  const c=document.getElementById('content');
  if(c&&lastRenderTime>0&&!c.innerHTML.trim()){
    HEALTH.fix('Content area found empty — re-rendering current tab');
    renderTab(currentTab);
  }
},60*1000);

// ══════════════════════════════════════════
// EVENT DELEGATION
// One document-level listener replaces every inline on* handler, which lets
// the CSP drop 'unsafe-inline' from script-src.
// ══════════════════════════════════════════
document.addEventListener('click',e=>{
  // Bottom nav
  const nav=e.target.closest('.nbtn[data-tab]');
  if(nav){showTab(nav.dataset.tab);return;}

  // Analyst feed article -> open in a new tab
  const art=e.target.closest('.social-item[data-url]');
  if(art){
    const u=art.dataset.url;
    if(/^https?:\/\//i.test(u))window.open(u,'_blank','noopener,noreferrer');
    return;
  }

  // Player card flip (ignore clicks inside the scrollable back face)
  const card=e.target.closest('.pcard[data-act="flip"]');
  if(card){
    if(e.target.closest('[data-noflip]'))return;
    card.classList.toggle('flipped');
    return;
  }

  const act=e.target.closest('[data-act]');
  if(!act)return;
  switch(act.dataset.act){
    case 'refresh':      refreshAll(); break;
    case 'reload-tab':   renderTab(currentTab); break;
    case 'health-open':  showHealth(); break;
    case 'health-close': closeHealth(); break;
    case 'health-clear': HEALTH.clearLog();closeHealth();showHealth(); break;
    case 'clear-search': playerQuery='';renderTab(currentTab); break;
  }
});

// Player search — debounced so typing does not re-render on every keystroke.
let _searchDebounce=null;
document.addEventListener('input',e=>{
  if(e.target.id!=='player-search')return;
  const v=e.target.value;
  clearTimeout(_searchDebounce);
  _searchDebounce=setTimeout(()=>{
    playerQuery=v;
    renderTab(currentTab);
  },160);
});

// Hash routing — back/forward buttons and direct links both land correctly.
window.addEventListener('hashchange',()=>applyTab(_tabFromHash()));

// ── BOOT ──
HEALTH.info('Dashboard initialised — beginning first sync');
DATA=SEED;
currentTab=_tabFromHash();
updateHdrContext(DATA);
applyTab(currentTab);
refreshAll();
