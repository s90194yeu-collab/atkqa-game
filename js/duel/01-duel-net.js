/* 【duel/01-duel-net.js】雙人對戰：連線層
   ── Firebase 只負責同步（房間、倒數、雙方送出的資料）；判定與計分都在 Apps Script 的 Duel.gs。
   ── Firebase 程式庫放在本儲存庫 vendor/firebase/，只有按下「雙人對戰」才下載，不影響單人遊戲。
   ── 網頁金鑰 apiKey 本來就是公開資訊；它在 Google Cloud 已限制只能用在登入相關服務。 */
const DUEL_FB = {
  apiKey: 'AIzaSyC98MvZBeKNU9bVs10RfdEKaYw_epXDHnU',
  authDomain: 'gen-lang-client-0273895085.firebaseapp.com',
  databaseURL: 'https://gen-lang-client-0273895085-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'gen-lang-client-0273895085',
  appId: '1:612923879683:web:bc8722b95a4eca81a97936'
};
const DUEL_SDK = '13.1.0';

/* 對戰的所有狀態都放這裡，與單人遊戲的 S 完全分開 */
const DU = {
  app: null, db: null, offset: 0, connected: false,
  info: null, uid: '', chars: null,
  mid: null, side: null, pub: null, priv: null,
  flags: { sub: {}, acted: {}, ready: {} },
  subs: [], matchSubs: [], timers: {}, retries: 0, lastStep: -1
};

/* google.script.run 包成 Promise */
function duelGas(fn){
  const args = Array.prototype.slice.call(arguments, 1);
  return new Promise(function(resolve, reject){
    if(!inGAS) return reject(new Error('雙人對戰只能在正式網址使用（需要學校帳號登入）。'));
    const runner = google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler(function(e){ reject(e instanceof Error ? e : new Error((e && e.message) || String(e))); });
    runner[fn].apply(runner, args);
  });
}

function duelLoadJs(src){
  return new Promise(function(resolve, reject){
    const s = document.createElement('script');
    s.src = src; s.async = false;
    s.onload = resolve;
    s.onerror = function(){ reject(new Error('無法下載對戰程式庫，請檢查網路。')); };
    document.head.appendChild(s);
  });
}
function duelLoadSdk(){
  if(window.firebase && window.firebase.database && window.firebase.auth) return Promise.resolve();
  const base = (window.ATKQA_SITE || '') + 'vendor/firebase/' + DUEL_SDK + '/';
  return ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-database-compat.js']
    .reduce(function(p, f){ return p.then(function(){ return duelLoadJs(base + f + '?v=' + DUEL_SDK); }); }, Promise.resolve());
}

/* 對戰用的角色清單與數值：與 Apps Script 裁判讀的是同一份檔案 */
function duelLoadChars(){
  if(DU.chars) return Promise.resolve(DU.chars);
  return fetch((window.ATKQA_SITE || '') + 'assets/duel/chars.json?t=' + Math.floor(Date.now() / 600000))
    .then(function(r){ if(!r.ok) throw new Error('讀不到對戰角色資料（' + r.status + '）'); return r.json(); })
    .then(function(d){ DU.chars = d; d.byId = {}; d.chars.forEach(function(c){ d.byId[c.id] = c; }); return d; });
}

async function duelConnect(token){
  if(!DU.app) DU.app = firebase.initializeApp(DUEL_FB, 'atkqa-duel');
  const auth = DU.app.auth();
  try{ await auth.setPersistence(firebase.auth.Auth.Persistence.NONE); }catch(e){}
  await auth.signInWithCustomToken(token);
  if(!DU.db){
    DU.db = DU.app.database();
    DU.db.ref('.info/serverTimeOffset').on('value', function(s){ DU.offset = Number(s.val()) || 0; });
    DU.db.ref('.info/connected').on('value', function(s){
      DU.connected = !!s.val();
      const n = $('duel-net');
      if(n){ n.textContent = DU.connected ? '● 已連線' : '● 連線中斷，重新連線中⋯⋯'; n.classList.toggle('off', !DU.connected); }
      if(DU.connected) duelMarkOnline();
    });
  }
}

/* 以伺服器時間為準的「現在」 */
function dnow(){ return Date.now() + DU.offset; }
function dref(p){ return DU.db.ref(p); }
const DTS = function(){ return firebase.database.ServerValue.TIMESTAMP; };

/* 訂閱一個路徑；group = 'lobby' 或 'match'，離開時一次取消 */
function dsub(path, cb, group){
  const r = dref(path);
  const h = function(s){ cb(s.val()); };
  r.on('value', h);
  const off = function(){ r.off('value', h); };
  (group === 'match' ? DU.matchSubs : DU.subs).push(off);
  return off;
}
function dunsub(group){
  const list = group === 'match' ? DU.matchSubs : DU.subs;
  while(list.length){ try{ list.pop()(); }catch(e){} }
}

/* 對戰中：上線就標記，斷線時由 Firebase 自動標記離線（裁判據此判斷斷線） */
function duelMarkOnline(){
  if(!DU.mid || !DU.db || !DU.uid) return;
  const r = dref('matches/' + DU.mid + '/ping/' + DU.uid);
  r.onDisconnect().set({ on: false, t: DTS() });
  r.set({ on: true, t: DTS() });
}

/* 請裁判推進一步。同一步驟由 p1 先送、p2 晚 2.5 秒補送；伺服器保證只執行一次 */
function duelSchedule(){
  clearTimeout(DU.timers.tick);
  const p = DU.pub;
  if(!p || !DU.mid || p.phase === 'end' || p.phase === 'void') return;
  let due = Number(p.deadline || 0);
  if(p.phase === 'init') due = Number(p.created || 0) + 31000;
  if(duelEarlyDone(p)) due = Math.min(due, dnow());
  if(p.phase === 'show') due = Math.max(due, Number(p.minShow || 0));
  if(p.phase === 'show' && duelEarlyDone(p)) due = Math.max(dnow(), Number(p.minShow || 0));
  const jitter = DU.side === 'p2' ? 2500 : 250;
  DU.timers.tick = setTimeout(duelDoTick, Math.max(0, due - dnow()) + jitter);
}
function duelEarlyDone(p){
  const q = String(p.q || 0), u = p.players || {};
  const both = function(map){ map = map || {}; return !!(u.p1 && u.p2 && map[u.p1.uid] && map[u.p2.uid]); };
  if(p.phase === 'team') return !!(p.teamReady && p.teamReady.p1 && p.teamReady.p2);
  if(p.phase === 'answer') return both(DU.flags.sub[q]);
  if(p.phase === 'action'){
    const ch = p.charge || {}, acted = DU.flags.acted[q] || {};
    const need = function(s){ return Number(ch[s] || 0) > 0 && duelSideAlive(p, s); };
    return (!need('p1') || !!acted[u.p1.uid]) && (!need('p2') || !!acted[u.p2.uid]);
  }
  if(p.phase === 'show') return both(DU.flags.ready[q]);
  return false;
}
function duelSideAlive(p, s){
  const f = (p.sides && p.sides[s] && p.sides[s].field) || [];
  return [0, 1, 2].some(function(k){ return f[k] && f[k].hp > 0; });
}
async function duelDoTick(){
  if(!DU.mid) return;
  const step = DU.pub ? DU.pub.step : -1, mid = DU.mid;
  try{ await duelGas('duelTick', mid); }
  catch(e){ duelLog('⚠️ 裁判回應失敗：' + e.message, 'var(--ember)'); }
  clearTimeout(DU.timers.retry);
  DU.timers.retry = setTimeout(function(){
    if(DU.mid !== mid || !DU.pub || DU.pub.step !== step || DU.pub.phase === 'end' || DU.pub.phase === 'void') return;
    DU.retries++;
    if(DU.retries <= 4){ duelDoTick(); return; }
    duelLog('⚠️ 伺服器忙碌，正在重試⋯⋯', 'var(--ember)');
    DU.retries = 2; duelDoTick();
  }, 6000);
}
