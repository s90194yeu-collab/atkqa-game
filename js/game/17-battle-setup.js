/* 【17-battle-setup.js】戰鬥：開局、個體差異、生成敵人、血條
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ============================================================================
   戰鬥流程
   ========================================================================== */
function show(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on'));
  $(id).classList.add('on'); window.scrollTo(0,0);
  BGM.auto(id);
}
function log(msg, color){
  const t = $('ticker');
  const p = document.createElement('p');
  p.textContent = msg; if(color) p.style.color = color;
  t.appendChild(p); t.scrollTop = t.scrollHeight;
  while(t.children.length > 60) t.removeChild(t.firstChild);
}

/* 個體差異：每次上場時「每一項」各自擲一次（預設 ±20%），
   所以同一角色可能今天血厚但手軟、明天招式兇猛卻很脆 */
function rollIndividual(ch){
  // 隱藏角色不擲骰，各項固定加成，狀態永遠最好
  const boost = ch.secret ? (1 + CONFIG.secretBoost) : 0;
  const jitter = boost
    ? function(){ return boost; }
    : function(){ return 1 + (Math.random()*2 - 1) * CONFIG.rollVar; };
  const rec = {hp:0, power:0, guard:0, acc:0};
  const jHp = jitter();
  ch.hp = Math.round(ch.hp * jHp); ch.maxHp = ch.hp; rec.hp = jHp - 1;

  let pn = 0, an = 0, gn = 0;
  ch.moves.forEach(function(m){
    if(m.power > 0){
      const j = jitter();
      m.power = Math.max(1, Math.round(m.power * j));
      rec.power += j - 1; pn++;
    }
    if(m.defense !== undefined){
      const j = jitter();
      m.defense = clamp(m.defense / j, 0.08, 0.85);   // 除法：數值越小越硬
      rec.guard += j - 1; gn++;
    }
    const ja = jitter();
    m.acc = clamp(Math.round((m.acc || 100) * ja), 35, 100);
    rec.acc += ja - 1; an++;
  });
  if(pn) rec.power /= pn;
  if(an) rec.acc /= an;
  if(gn) rec.guard /= gn; else rec.guard = 0;
  ch.cond = rec;
  ch.rolled = true;
  return ch;
}

/* 把個體差異翻成一句人話 */
function conditionReport(ch){
  const c = ch.cond;
  if(!c) return null;
  const items = [{k:'體力', v:c.hp}, {k:'威力', v:c.power}, {k:'命中', v:c.acc}];
  if(c.guard !== 0) items.push({k:'防禦', v:c.guard});
  const lv = function(v){
    if(v >=  0.10) return {t:'大幅提升', c:'var(--jade)'};
    if(v >=  0.04) return {t:'略為提升', c:'#5fae1a'};
    if(v <= -0.10) return {t:'明顯低落', c:'var(--ember)'};
    if(v <= -0.04) return {t:'略為低落', c:'var(--gold)'};
    return {t:'一如往常', c:'var(--dim)'};
  };
  const vs = items.map(function(x){ return x.v; });
  const avg = vs.reduce(function(a,b){ return a+b; }, 0) / vs.length;
  const spread = Math.max.apply(null, vs) - Math.min.apply(null, vs);
  let head, color;
  if(spread >= 0.24){ head = '各有所長的一天'; color = 'var(--gold)'; }
  else if(avg >= 0.08){ head = '狀態絕佳！'; color = 'var(--jade)'; }
  else if(avg <= -0.08){ head = '狀態不太好⋯⋯'; color = 'var(--ember)'; }
  else { head = '狀態平穩'; color = 'var(--dim)'; }
  return {head:head, color:color, items:items.map(function(x){
    const l = lv(x.v);
    return {k:x.k, t:l.t, c:l.c, pct:(x.v >= 0 ? '+' : '') + Math.round(x.v*100) + '%'};
  })};
}

function showCondition(){
  const rp = conditionReport(S.player);
  if(!rp) return;
  $('cond-name').textContent = S.player.name;
  $('cond-head').textContent = rp.head;
  $('cond-head').style.color = rp.color;
  const box = $('cond-list'); box.innerHTML = '';
  rp.items.forEach(function(x){
    const d = document.createElement('div'); d.className = 'cond-row';
    const a = document.createElement('span'); a.textContent = x.k;
    const b = document.createElement('b'); b.textContent = x.t; b.style.color = x.c;
    const c = document.createElement('em'); c.textContent = x.pct; c.style.color = x.c;
    d.append(a, b, c); box.appendChild(d);
  });
  paintLore(S.player);
  /* 每次進來都從頭看起，免得殘留上一次的捲動位置 */
  const _cc = document.querySelector('.cond-card');
  if(_cc) _cc.scrollTop = 0;
  log('📋 今日狀態：' + rp.head + '　' +
      rp.items.map(function(x){ return x.k + ' ' + x.pct; }).join('　'), 'var(--gold)');
  const box2 = $('cond-box');
  box2.hidden = false;
  box2.style.display = 'flex';
  $('cond-go').onclick = function(){
    box2.hidden = true;
    box2.style.display = 'none';     // 雙保險，確保一定關得掉
    sfx('tap');
    banner('ROUND ' + S.round); sfx('round');
  };
}

async function startBattle(){
  if(!selected) return;
  // 中途換角色：不重跑題庫，直接換人接著打
  if(S.swapMode){
    S.swapMode = false;
    const keepSp = S.sp;
    S.player = rollIndividual(clone(selected));
    S.player.baseId = selected.id;
    S.pSt = newStatus();
    applyClanPassive(S.player, S.pSt, true, 'init');
    warmAnims();   // 換角色後立刻開始抓新角色的演出影片
    S.sp = keepSp;
    LAST_IMG.p = null;
    $('btn-start').textContent = '出戰！';
    show('scr-battle');
    paintHUD(true); renderSpirits(); refreshAbilityBtn();
    banner(S.player.name + ' 參戰！', true); sfx('awaken');
    log('🔄 ' + S.player.name + ' 接替上場，滿血再戰！', 'var(--gold)');
    showCondition();
    finishQuestion();
    return;
  }
  sfx('charge');
  S.player = rollIndividual(clone(selected));
  S.player.baseId = selected.id;      // 進化後 id 會被覆蓋，先留住原始角色
  S.pSt = newStatus(); S.eSt = newStatus();
  applyClanPassive(S.player, S.pSt, true, 'init');
  warmAnims();   // 開場就開始抓演出影片，不要等到出招才下載
  S.combo = 0; S.bestCombo = 0; S.sinceRun = 0; S.sinceBest = 0;
  S.catSolveUsed = false;   // 集滿七貓的「直接解題」每場重置
  S.finished = false; S.busy = false;
  if(!RESUME){ S.round = 1; S.quizPts = 0; S.used = []; S.totalAnswered = 0; }
  S.waves = 0; S.kos = 0;
  S.sp = 0; S.spiritUsed = {}; S.spiritCasts = 0;
  if(selected && selected.secret) S.sp = CONFIG.secretSp;
  S.blocked = 0; S.counters = 0; S.skillUses = 0;
  S.mode = PENDING_MODE || 'normal';
  if(S.mode === 'dojo') S.difficulty = 'easy';      // 道場固定一對一
  S.streak = 0; S.maxStreak = 0; S.roundFull = 0; S.perfectRounds = 0; S.awakened = false;
  S.lvUps = []; S.dojoFixed = 0; S.raidDmg = 0;
  $('btn-qsave').hidden = (S.mode === 'dojo');      // 道場不存進度
  $('ticker').innerHTML = '';
  applyStartBonuses();

  show('scr-battle');
  $('q-text').textContent = '題庫連線中…';
  $('q-opts').innerHTML = '';
  await preparePool();

  if(RESUME && RESUME.hpPct) S.player.hp = Math.max(60, Math.round(S.player.maxHp * RESUME.hpPct));
  if(S.round > CONFIG.rounds){ S.round = 1; S.used = []; await preparePool(); }
  RESUME = null;
  startRound();
}

function startRound(){
  S.qInRound = 0; S.roundFull = 0;
  S.spiritUsed = {};          // 每回合各指令可再用一次
  if(S.player && S.player.secret && S.round > 1){
    S.sp += CONFIG.secretSpRound;
    log('🌀 精神力湧現：SP ＋' + CONFIG.secretSpRound + '（目前 ' + S.sp + '）', 'var(--ion)');
  }
  const back = recycleWrong();
  if(back) log('🔁 上一回合答錯的 ' + back + ' 題，這回合會再出一次。', 'var(--gold)');
  spawnEnemies();
  if(S.round > 1){
    if(S.defeated){
      S.player.hp = Math.max(1, Math.round(S.player.maxHp * CONFIG.defeatPenalty));
      S.defeated = false;
      log('🩹 上回合戰敗，本回合只能以 ' + Math.round(CONFIG.defeatPenalty*100) +
          '% 體力再戰。', 'var(--ember)');
    }else{
      const heal = Math.round(S.player.maxHp * 0.25);
      S.player.hp = Math.min(S.player.maxHp, S.player.hp + heal);
      log('🔧 回合間補給：回復 ' + heal + ' 點體力。', 'var(--jade)');
    }
  }
  rollStage();
  paintHUD(true);
  BGM.auto('scr-battle');              // 最後一回合換成頭目曲
  if(S.round === 1) showCondition();
  else { banner('ROUND ' + S.round); sfx('round'); }
  const foeNames = S.foes.map(function(e){ return e.name; }).join('、');
  log('⚡ 第 ' + S.round + ' 回合開始：' + S.player.name + '　VS　' + foeNames, 'var(--gold)');
  if(S.difficulty === 'hard' && S.foes.length > 1)
    log('⚔️ 困難模式：點右側名單可切換攻擊目標。', 'var(--dim)');
  nextQuestion();
}

/* 依難度生出一到多位敵人；S.enemy／S.eSt 永遠指向目前鎖定的目標 */
function spawnEnemies(){
  const d = S.difficulty;
  const n = CONFIG.enemyCount[d] || 1;
  const hpM = CONFIG.enemyHpMulti[d] || 1;
  const pool = ALL_CHARACTERS.filter(c=>!c.isUpgrade && !c.secret && c.id !== S.player.id);
  S.foes = []; S.foeSt = [];
  const picked = shuffle(pool).slice(0, n);
  picked.forEach(function(src){
    const e = rollIndividual(clone(src));
    e.hp = Math.max(60, Math.round(e.hp * hpM));
    if(S.mode === 'dojo'){ e.hp = Math.round(e.hp * 1.4); e.name = '【菁英】' + e.name; }   // 錯題化身的菁英怪
    e.maxHp = e.hp;
    S.foes.push(e); S.foeSt.push(newStatus());
    applyClanPassive(e, S.foeSt[S.foeSt.length - 1], false, 'init');
  });
  S.target = 0;
  syncTarget();
}

/* 讓 S.enemy／S.eSt 指向目前目標，其餘戰鬥程式碼不必改寫 */
function syncTarget(){
  if(!S.foes.length) return;
  if(S.target >= S.foes.length || S.foes[S.target].hp <= 0){
    const alive = S.foes.map(function(e,i){ return {e:e,i:i}; })
                        .filter(function(x){ return x.e.hp > 0; });
    S.target = alive.length ? alive[0].i : 0;
  }
  S.enemy = S.foes[S.target];
  S.eSt   = S.foeSt[S.target];
  LAST_IMG.e = null;
}
/* 小卡沒有主目標，索引要換算 */
function foeSlot(i){ return i > S.target ? i - 1 : i; }
function aliveFoes(){ return S.foes.filter(function(e){ return e.hp > 0; }); }
function allFoesDown(){ return S.foes.length > 0 && aliveFoes().length === 0; }

/* 目標選擇列：困難模式才顯示 */
function renderFoes(){
  const box = $('foe-list');
  if(!box) return;
  if(S.foes.length <= 1){ box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = '';
  S.foes.forEach(function(e, i){
    if(i === S.target) return;              // 主攻擊目標已顯示在上方大圖
    const st = S.foeSt[i];
    const b = document.createElement('button');
    const down = e.hp <= 0;
    b.className = 'foe' + (down ? ' down' : '');
    b.disabled = down;
    const im = document.createElement('img');
    im.referrerPolicy = 'no-referrer';
    im.onerror = function(){ im.onerror = null; im.src = e.ph; };
    im.src = e.img || e.ph;
    const nm = document.createElement('b'); nm.textContent = e.name;
    const bar = document.createElement('u');
    const fi = document.createElement('i');
    const pct = clamp(e.hp / e.maxHp * 100, 0, 100);
    fi.style.width = pct + '%';
    fi.style.background = pct <= 20 ? '#ff3535' : pct <= 50 ? '#ffb32b' : '#1fc478';
    bar.appendChild(fi);
    const hp = document.createElement('span');
    hp.textContent = down ? '倒下' : Math.max(0, Math.ceil(e.hp)) + ' / ' + e.maxHp;
    b.append(im, nm, bar, hp);
    if(st.upgraded || (e.upgradeTo || e.forms)){
      const tag = document.createElement('em');
      tag.textContent = st.upgraded ? '已換乘' : '可進化';
      b.appendChild(tag);
    }
    b.onclick = function(){
      if(S.busy || down) return;
      S.target = i; syncTarget(); paintHUD(); renderFoes(); sfx('select');
      if(S.answered && !S.resolved) buildTactics();   // 命中率隨目標改變，重算
      log('🎯 鎖定目標：' + S.foes[i].name, 'var(--gold)');
    };
    box.appendChild(b);
  });
}

const LAST_IMG = {p:null, e:null};
function paintHUD(init){
  const side = (k, c, st)=>{
    if(!c || !st) return;
    $(k+'-name').textContent = c.name;
    const pct = clamp(c.hp / c.maxHp * 100, 0, 100);
    const fill = $(k+'-fill');
    fill.style.width = pct + '%';
    fill.className = 'hp-fill' + (pct<=20?' low':pct<=50?' mid':'');
    if(init) $(k+'-ghost').style.width = pct + '%';
    else requestAnimationFrame(()=>{ $(k+'-ghost').style.width = pct + '%'; });
    $(k+'-hp').textContent = Math.max(0,Math.ceil(c.hp)) + ' / ' + c.maxHp;
    if(LAST_IMG[k] !== c.img){ LAST_IMG[k] = c.img; bindImg($(k+'-img'), c); }

    const chips = $(k+'-chips'); chips.innerHTML = '';
    const add=(txt,col)=>{const x=document.createElement('span');x.className='chip';x.textContent=txt;x.style.color=col;chips.appendChild(x);};
    const r = roleOf(c); add(r.icon + ' ' + r.name, r.color);
    Object.keys(STATUS_INFO).forEach(key=>{
      const v = st[key];
      if(v === true || (typeof v === 'number' && v > 0)){
        const info = STATUS_INFO[key];
        add(info.label + (typeof v === 'number' && v > 1 ? ' ' + v : ''), info.color);
      }
    });
    if(st.guard !== undefined) add('防禦姿態','var(--ion)');
    $(k+'-ammo').textContent = (k === 'e') ? threatText(c, st) : '';
  };
  side('p', S.player, S.pSt);
  side('e', S.enemy,  S.eSt);
  renderFoes();
  $('r-round').textContent = 'R' + S.round;
  $('r-now').textContent = Math.min(S.qInRound+1, S.perRound);
  $('r-max').textContent = '/ ' + S.perRound;
  $('r-score').textContent = S.quizPts;
  $('combo-box').classList.toggle('on', S.combo > 0);
  $('r-combo').textContent = '×' + (1 + S.combo*CONFIG.comboStep).toFixed(2);
}
