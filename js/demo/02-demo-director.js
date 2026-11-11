/* 【demo/02-demo-director.js】展示模式：電腦自動操作整場對戰
   只有 demo.html 會載入這個檔案；它不修改任何遊戲檔，只在遊戲載入完之後：
     ① 換成展示題庫（國小程度，15 題＝3 回合 × 5 題）
     ② 把確認視窗、演出時間調短
     ③ 像真人一樣用虛擬游標「點」按鈕：選角 → 作答 → 精神指令／特色能力 → 出招 → 看解析
     ④ 在關鍵時刻跳出「亮點」字幕
   所有操作都走遊戲原本的按鈕與流程，所以看到的就是真實的遊戲畫面。
   網址加上 ?auto=1 可以略過開場畫面直接開始（瀏覽器可能因此無法自動播放音樂）。 */
(function(){
'use strict';

/* ───────── 設定 ───────── */
const QS   = new URLSearchParams(location.search);
const K    = Math.max(0.05, parseFloat(QS.get('k')) || 1);   // 時間倍率（只給測試用：0.1＝十倍速）
const TOTAL = DEMO_BANK.length;
const HERO  = 'my_zeus';                                      // 展示角色：眾神之王・宙斯（連對 3 題會換乘）
const STOP  = {stop:true};
const D = {paused:false, stopped:false, shown:{}, ended:false};
window.DEMO = D;

CONFIG.confirmAnswer = false;                 // 展示不跳「確定送出？」
CONFIG.cutInAnim = Math.round(4200 * K);      // 特色能力的全畫面動畫：只播前 4 秒
CONFIG.cutInHold = Math.round(1600 * K);
SPEED = 0.6 * K;                              // 戰鬥演出加快，操作間隔不會太久

/* 換成展示題庫；也不要把臨時存檔寫進瀏覽器 */
fetchQuestions = function(){ return Promise.resolve(DEMO_BANK); };
saveLocalSnap  = function(){};

/* ───────── 小工具 ───────── */
const raw = ms => new Promise(r => setTimeout(r, Math.max(8, ms)));
async function gate(){
  while(D.paused && !D.stopped) await raw(120);
  if(D.stopped) throw STOP;
}
async function sleep(ms){ await gate(); await raw(ms * K); await gate(); }
async function until(fn, max){
  const t0 = Date.now();
  while(!fn()){
    await sleep(100);
    if(Date.now() - t0 > (max || 15000)) return false;
  }
  return true;
}
const scr = () => { const e = document.querySelector('.screen.on'); return e ? e.id : ''; };
const $q  = (s, r) => (r || document).querySelector(s);
const $$q = (s, r) => Array.from((r || document).querySelectorAll(s));

/* ───────── 畫面元件：游標、字幕、進度、開場／結束 ───────── */
let cur, cap, capTimer = null;
function build(){
  const box = document.createElement('div');
  box.innerHTML =
    '<div id="demo-shield"></div>' +
    '<div id="demo-cursor"><i></i><svg viewBox="0 0 34 34" aria-hidden="true">' +
      '<path d="M4 3 L4 26 L10 20.5 L14.5 30 L19 28 L14.6 18.8 L23 18.5 Z" fill="#fff" stroke="#3b3366" stroke-width="2.2" stroke-linejoin="round"/></svg></div>' +
    '<div id="demo-cap" role="status"></div>' +
    '<div id="demo-bar"><span id="demo-tag">展示模式</span><div id="demo-prog"><i></i></div>' +
      '<span id="demo-prog-txt">準備中</span>' +
      '<button class="demo-btn" id="demo-pause" type="button">⏸ 暫停</button>' +
      '<button class="demo-btn" id="demo-exit" type="button">✕ 離開</button></div>' +
    '<div class="demo-veil on" id="demo-intro"><div class="demo-card">' +
      '<p class="sub" style="margin:0">南山高中國文科</p>' +
      '<h2>關於答對率等於攻擊力這件事</h2>' +
      '<p class="sub">展示模式：電腦自動打一場完整的對戰（困難模式・3 回合 × 每回合 5 題）</p>' +
      '<ul>' +
        '<li><b>答對率＝攻擊力</b>　答對幾成，招式就有幾成威力</li>' +
        '<li><b>困難模式</b>　三名敵人同場，可以全體攻擊</li>' +
        '<li><b>連擊與會心</b>　連續全對，傷害一層層疊加</li>' +
        '<li><b>精神指令</b>　花 SP 強化一擊（熱血、魂⋯⋯）</li>' +
        '<li><b>特色能力</b>　一場一次的全畫面演出</li>' +
        '<li><b>換乘變身</b>　條件達成，角色進化成新型態</li>' +
        '<li><b>防禦與反擊</b>　擋下傷害，伺機反擊</li>' +
        '<li><b>結算計分</b>　答題、連擊、擊破、體力都算分</li>' +
      '</ul>' +
      '<button class="demo-go" id="demo-start" type="button">▶ 開始自動展示</button>' +
      '<p class="demo-note">全程由電腦自動操作，約 3～4 分鐘。展示題庫為國小程度的國文常識，不會留下任何紀錄。<br>建議開啟聲音，音樂與音效會一起播放。</p>' +
    '</div></div>' +
    '<div class="demo-veil" id="demo-end"><div class="demo-card">' +
      '<h2>展示結束</h2>' +
      '<p class="sub">正式遊戲裡，題目來自老師的課文題庫，成績會登錄在學期積分，錯題還會進入「錯題道場」。</p>' +
      '<button class="demo-go" id="demo-again" type="button">↻ 再看一次</button>' +
      '<button class="demo-go alt" id="demo-leave" type="button">離開展示</button>' +
    '</div></div>';
  while(box.firstChild) document.body.appendChild(box.firstChild);
  cur = $('demo-cursor'); cap = $('demo-cap');
  $('demo-pause').onclick = function(){
    D.paused = !D.paused;
    this.textContent = D.paused ? '▶ 繼續' : '⏸ 暫停';
  };
  $('demo-exit').onclick = leave;
  $('demo-leave').onclick = leave;
  $('demo-again').onclick = function(){ location.reload(); };
  $('demo-start').onclick = function(){ start(); };
}
function leave(){
  D.stopped = true;
  try{ window.close(); }catch(e){}
  setTimeout(function(){ location.href = window.ATKQA_SITE || './'; }, 150);
}

/* 亮點字幕：同一個亮點只講一次（once 給代號），每則停留約 3 秒 */
function say_(html, once, ms){
  if(once){ if(D.shown[once]) return; D.shown[once] = 1; }
  if(!cap) return;
  cap.innerHTML = '<b>亮點</b>' + html;
  cap.classList.add('on');
  clearTimeout(capTimer);
  capTimer = setTimeout(function(){ cap.classList.remove('on'); }, (ms || 3200) * Math.max(K, 0.3));
}

/* 游標：移動到按鈕上、按下、真的點下去 */
function xy(x, y){ cur.style.transform = 'translate(' + (x - 4) + 'px,' + (y - 3) + 'px)'; }
async function settleScroll(){
  let last = -1, n = 0;
  for(let i = 0; i < 25 && n < 2; i++){
    const y = Math.round(window.scrollY);
    n = (y === last) ? n + 1 : 0; last = y;
    await raw(70);
  }
}
async function pointAt(el){
  if(!el) return;
  await settleScroll();
  let r = el.getBoundingClientRect();
  if(r.top < 64 || r.bottom > innerHeight - 24){
    try{ el.scrollIntoView({block:'center'}); }catch(e){}
    await settleScroll();
    r = el.getBoundingClientRect();
  }
  cur.classList.add('on');
  xy(r.left + Math.min(r.width * 0.5, 200), r.top + r.height / 2);
  await sleep(560);
}
async function tap(el){
  if(!el) return false;
  await pointAt(el);
  cur.classList.add('press');
  await sleep(140);
  let ok = false;
  if(!el.disabled){ el.click(); ok = true; }
  await sleep(130);
  cur.classList.remove('press');
  return ok;
}

/* ───────── 亮點字幕的觸發點（包住遊戲原本的函式，不改動遊戲檔） ───────── */
const _banner = banner;
banner = function(text, cyan){
  try{
    const t = String(text || '');
    if(/^CRITICAL/.test(t))       say_('<span>會心一擊！傷害 ×1.85</span>', 'crit', 2600);
    else if(/COMBO/.test(t))      say_('連擊 ' + t.replace(/\D+/g, '') + ' 層：連續全對，每層 +8% 傷害', 'combo', 3000);
    else if(/^WAVE CLEAR/.test(t))say_('全數擊破！回復體力、加分，下一批敵人登場', 'wave', 3000);
    else if(t === '先制攻擊！')   say_('敵方速度較快，搶先出手——先看清楚對手的威脅再出招', 'first', 3000);
    else if(/^ROUND 2/.test(t))   say_('第 2 回合：上一回合的體力會補給一部分', 'r2', 2800);
    else if(/^ROUND 3/.test(t))   say_('最後一回合：音樂換成頭目曲！', 'r3', 3000);
  }catch(e){}
  return _banner.apply(this, arguments);
};
const _applyForm = applyForm;
applyForm = function(ch, up){
  try{
    if(S.player && ch === S.player && up && up.id !== ch.id)
      say_('連續答對 3 題 → <span>換乘變身！</span>「' + ch.name + '」進化成「' + up.name + '」', 'awaken', 4000);
  }catch(e){}
  return _applyForm.apply(this, arguments);
};
const _assist = assistCutIn;
assistCutIn = function(ally, label){
  try{ say_('同系列夥伴機率出手：<span>' + label + '</span>', 'assist', 3000); }catch(e){}
  return _assist.apply(this, arguments);
};
const _vic = victoryThisQuestion;
victoryThisQuestion = function(){
  try{ say_('全數擊破！回復體力、加分，下一批敵人登場', 'wave', 3000); }catch(e){}
  return _vic.apply(this, arguments);
};

/* 進度列 */
function paintProgress(){
  const f = $q('#demo-prog i'), t = $('demo-prog-txt');
  if(!f || !t) return;
  const done = (typeof S !== 'undefined' && S.player) ? S.totalAnswered : 0;
  f.style.width = Math.min(100, Math.round(done / TOTAL * 100)) + '%';
  if(D.ended) t.textContent = '完成';
  else if(S.player && scr() !== 'scr-select') t.textContent = '第 ' + S.round + ' 回合・已答 ' + done + ' / ' + TOTAL + ' 題';
  else t.textContent = '選角中';
}

/* ───────── 流程 ───────── */
async function selectPhase(){
  PENDING_MODE = 'normal';
  $q('#diff-row [data-diff="hard"]').click();               // 預設困難模式（S.difficulty = 'hard'）
  if(!rosterBuilt) renderRoster(UNIVERSES[0].k);
  show('scr-select');
  say_('選角：8 個陣營、近百位角色，各有定位、招式與特色能力', 'sel', 3400);
  await sleep(1400);
  for(const u of ['shuihu', 'zhulu']){                      // 逛一下別的陣營
    await tap($q('.tab[data-u="' + u + '"]'));
    await sleep(900);
  }
  await tap($q('.tab[data-u="myth"]'));
  await sleep(700);
  await tap($q('.pick[data-id="' + HERO + '"]'));
  say_('出戰：眾神之王・宙斯（攻擊型）．預設「困難模式」三敵同場、分數 ×1.3', 'hero', 3800);
  await sleep(2200);
  await tap($('btn-start'));
}

async function answerQuestion(){
  const q = S.current, multi = q.type === 'multi';
  await sleep(multi ? 1200 : 900);                          // 給觀眾一點讀題時間
  if(multi) say_('多選題：全選對才拿滿分，只對一部分就只有部分發動權', 'multi', 3400);
  const btns = $$q('#q-opts .opt');
  for(let i = 0; i < q.options.length; i++){
    if(q.options[i].correct){ await tap(btns[i]); await sleep(120); }
  }
  await sleep(250);
  await tap($('main-btn'));                                 // 送出答案
  await sleep(500);
  if(S.charge >= 1) say_('全對！發動權 100%——<span>答對率，就是攻擊力</span>', 'full', 3400);
  await sleep(500);
}

/* 精神指令：SP 夠就用，魂最大、熱血次之 */
function pickSpirit(){
  const ks = spiritsOf(S.player);
  if(ks.indexOf('soul') >= 0   && !S.spiritUsed.soul     && S.sp >= SPIRITS.soul.sp)     return 'soul';
  if(ks.indexOf('hotblood') >= 0 && !S.spiritUsed.hotblood && S.sp >= SPIRITS.hotblood.sp) return 'hotblood';
  return null;
}
const SPIRIT_CAP = {
  hotblood:'精神指令「熱血」：花 5 SP，這一擊傷害 ×2（SP 靠答對題目累積）',
  soul:'精神指令「魂」：花 8 SP，傷害 ×2.5 且必定會心；和熱血疊加更猛'
};

function chooseMove(){
  const P = S.player, mv = P.moves, n = aliveFoes().length;
  const guard = mv.filter(m => m.kind === 'guard')[0];
  const aoe   = mv.filter(m => m.kind === 'aoe')[0];
  const atks  = mv.filter(m => m.kind === 'attack').sort((a, b) => b.power - a.power);
  const low   = P.hp < P.maxHp * 0.38;
  if(guard && (low || (!D.shown.guardDemo && S.totalAnswered >= 5 && P.hp < P.maxHp * 0.85))){
    D.shown.guardDemo = 1; return guard;
  }
  if(aoe && n >= 2) return aoe;
  return atks[0] || aoe || mv[0];
}

async function fight(){
  await sleep(700);
  const P0 = S.player;

  /* 特色能力：宙斯第 3 題用「弒父之雷」；換乘後的「神王震怒」播放專屬動畫 */
  const ab = $('t-ability');
  if(!ab.hidden && !S.pSt.abilitySealed &&
     ((P0.id === HERO && S.totalAnswered === 2) || P0.id === 'my_zeus_bolt')){
    say_('<span>特色能力</span>：一場一次，發動時全畫面演出', 'ability', 3600);
    await tap(ab);
    await until(function(){ return !$q('.cutin'); }, 14000);
    await sleep(500);
  }

  /* 精神指令（最多連用兩道） */
  for(let c = 0; c < 2; c++){
    const key = pickSpirit();
    if(!key) break;
    const idx = spiritsOf(S.player).indexOf(key);
    const b = $$q('#sp-list .spirit')[idx];
    if(!b || b.disabled) break;
    say_(SPIRIT_CAP[key], 'sp_' + key, 3600);
    await tap(b);
    await sleep(450);
  }

  /* 出招 */
  const mv = chooseMove();
  const btn = $$q('#t-moves .move')[S.player.moves.indexOf(mv)];
  if(mv.kind === 'aoe')   say_('<span>全體攻擊</span>：一次打到三名敵人（對每個目標傷害 ×0.72）', 'aoe', 3400);
  if(mv.kind === 'guard') say_('<span>防禦姿態</span>：減少受到的傷害，還有機會反擊', 'guard', 3400);
  await tap(btn);
  await sleep(350);
  await tap($('main-btn'));                                 // 執行攻擊（交給遊戲演出）
}

async function reviveChoice(){
  say_('倒下後可以花分數復活、換角色，或硬撐下去', 'down', 3000);
  await sleep(1400);
  const b = $$q('#rv-list .rv-opt:not(.off)')[0];
  await tap(b);
}

async function mainLoop(){
  while(true){
    await gate();
    paintProgress();
    const s = scr();
    if(s === 'scr-result'){
      D.ended = true; paintProgress();
      say_('結算：答題、連擊、擊破、剩餘體力⋯⋯全部換算成分數', 'result', 4500);
      await sleep(6500);
      document.body.classList.remove('demo-run');
      $('demo-end').classList.add('on');
      return;
    }
    if(s === 'scr-round'){
      await sleep(2400);
      say_('每個回合結束會結算一次，再進入下一回合', 'round', 2800);
      await tap($('rd-next')); await sleep(700); continue;
    }
    if(s === 'scr-explain'){
      say_('每題都有解析：答完立刻看懂為什麼', 'explain', 2800);
      await sleep(1700);
      await tap($('ex-next')); await sleep(500); continue;
    }
    if(s === 'scr-battle'){
      if(!$('cond-box').hidden){
        say_('每次上場，體力、威力、命中都會隨機浮動——今天是什麼狀態？', 'cond', 3600);
        await sleep(3000);
        await tap($('cond-go')); await sleep(600); continue;
      }
      if(!$('rv-box').hidden){ await reviveChoice(); await sleep(600); continue; }
      if(!S.busy && S.current && !S.answered && !S.finished &&
         $('q-text').textContent === S.current.q && $('q-opts').children.length > 0){
        await answerQuestion(); continue;
      }
      if(!S.busy && S.answered && !S.resolved && !$('t-body').hidden && S.player.hp > 0){
        await fight(); continue;
      }
    }
    await raw(140);
  }
}

async function start(){
  $('demo-intro').classList.remove('on');
  document.body.classList.add('demo-run');
  try{
    show('scr-select');                                     // 點擊動作順便啟動音樂與音效
    await sleep(500);
    await selectPhase();
    await mainLoop();
  }catch(e){
    if(e !== STOP) console.error('[demo]', e);
  }
}

/* 展示中擋掉鍵盤（遊戲的 1～6、Enter 快捷鍵會干擾自動操作） */
window.addEventListener('keydown', function(e){
  if($('demo-intro') && $('demo-intro').classList.contains('on')) return;
  if(/^[1-6]$/.test(e.key) || e.key === 'Enter'){ e.stopImmediatePropagation(); e.preventDefault(); }
}, true);

build();
setInterval(paintProgress, 500);
/* 展示頁不需要首頁，直接顯示選角背景當開場底圖 */
try{ if(!rosterBuilt) renderRoster(UNIVERSES[0].k); show('scr-select'); }catch(e){}
if(QS.get('auto') === '1') start();
})();
