/* 【06-spirits.js】精神指令
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ============================================================================
   精神指令（參考超級機器人大戰）
   ── SP 由答題取得：全對 +3、部分正確 +1、答錯 +0
   ── 每題行動前可花 SP 發動一道，效果立即生效
   ========================================================================== */
const SPIRITS = {
  focus  : {name:'集中', sp:2, icon:'🎯', desc:'2 回合內命中 +25、閃避 +15'},
  hit    : {name:'必中', sp:3, icon:'✔️', desc:'下一擊必定命中，無視閃避'},
  dodge  : {name:'必閃', sp:3, icon:'💨', desc:'下一次被攻擊必定閃過，無視對手命中率'},
  accel  : {name:'加速', sp:2, icon:'⚡', desc:'本回合必定搶得先攻'},
  hotblood:{name:'熱血', sp:5, icon:'🔥', desc:'本次攻擊傷害 ×2（可與「魂」疊加）'},
  soul   : {name:'魂',   sp:8, icon:'💥', desc:'本次攻擊傷害 ×2.5 且必定會心（可與「熱血」疊加成 ×3.5）'},
  iron   : {name:'鐵壁', sp:4, icon:'🛡️', desc:'本回合受到的傷害 ×0.25'},
  guts   : {name:'根性', sp:4, icon:'❤️', desc:'立刻回復 35% 體力'},
  luck   : {name:'幸運', sp:4, icon:'🍀', desc:'本題的戰鬥分數 ×2（擊破、擋下、反擊）'},
  bless  : {name:'祝福', sp:4, icon:'🌟', desc:'本題的答題分數 ×2'},
  friend : {name:'友情', sp:3, icon:'🤝', desc:'本次行動必定發動合體支援'},
  awaken : {name:'覺醒', sp:9, icon:'🌀', desc:'本題可以再行動一次'}
};
/* 每個定位能用的指令不同，形成各自的玩法 */
const ROLE_SPIRITS = {
  attacker: ['hotblood','hit','soul','luck','accel'],
  guard   : ['iron','bless','guts','focus','friend'],
  tank    : ['guts','iron','bless','hotblood','friend'],
  lucky   : ['luck','dodge','focus','soul','bless'],
  swift   : ['accel','hit','focus','awaken','luck'],
  balance : ['focus','bless','hotblood','guts','friend']
};
function spiritsOf(c){ return ROLE_SPIRITS[(c && c.role) || 'balance'] || ROLE_SPIRITS.balance; }

function renderSpirits(){
  const box = $('sp-list');
  if(!box || !S.player) return;
  $('sp-now').textContent = S.sp;
  box.innerHTML = '';
  spiritsOf(S.player).forEach(function(key){
    const sp = SPIRITS[key];
    const b = document.createElement('button');
    const used = S.spiritUsed[key];
    const afford = S.sp >= sp.sp && !used && !S.busy && !S.resolved;
    b.className = 'spirit' + (afford ? '' : ' off') + (used ? ' used' : '');
    b.disabled = !afford;
    const t = document.createElement('b'); t.textContent = sp.icon + ' ' + sp.name;
    const c = document.createElement('em'); c.textContent = used ? '已用' : sp.sp + ' SP';
    const d = document.createElement('span'); d.textContent = sp.desc;
    b.append(t, c, d);
    b.onclick = function(){ castSpirit(key); };
    box.appendChild(b);
  });
}

function castSpirit(key){
  const sp = SPIRITS[key];
  if(!sp || S.sp < sp.sp || S.spiritUsed[key] || S.busy || S.resolved) return;
  S.sp -= sp.sp;
  S.spiritUsed[key] = true;
  S.spiritCasts++;
  switch(key){
    case 'focus'   : S.pSt.spFocus = 2; break;
    case 'hit'     : S.pSt.spHit = 1; break;
    case 'dodge'   : S.pSt.spDodge = 1; break;
    case 'accel'   : S.pSt.spAccel = 1; break;
    /* 熱血與魂改成「加成疊加」而非互相覆蓋：
       單用熱血 ×2.0、單用魂 ×2.5、兩個都用 ×3.5（1 ＋1.0 ＋1.5）。
       原本兩者共用 spDmg，先魂後熱血還會被降級成 ×2.0。 */
    case 'hotblood': S.pSt.spDmg = (S.pSt.spDmg > 1 ? S.pSt.spDmg : 1) + 1.0; break;
    case 'soul'    : S.pSt.spDmg = (S.pSt.spDmg > 1 ? S.pSt.spDmg : 1) + 1.5;
                     S.pSt.spCrit = 1; break;
    case 'iron'    : S.pSt.spIron = 1; break;
    case 'guts'    : { const h = Math.round(S.player.maxHp*0.35);
                       S.player.hp = Math.min(S.player.maxHp, S.player.hp + h);
                       popNumber('f-p','+'+h,'heal'); sfx('heal'); break; }
    case 'luck'    : S.pSt.spLuck = 1; break;
    case 'bless'   : S.pSt.spBless = 1; break;
    case 'friend'  : S.pSt.spFriend = 1; break;
    case 'awaken'  : S.pSt.spAwaken = 1; break;
  }
  auraFx('p'); sfx('buff');
  banner(sp.name + '！', true);
  S.quizPts += CONFIG.spiritPts;
  log('🌀 精神指令【' + sp.name + '】發動：' + sp.desc +
      '（＋' + CONFIG.spiritPts + ' 分）', 'var(--ion)');
  paintHUD(); renderSpirits();
  /* 招式面板要一起重繪：有些指令會改變狀態，
     而且發動權 0 的那一題，主按鈕的「放棄行動」出路必須保留住。 */
  if(!S.resolved && !S.busy && S.current) refreshTacticsButton();
}

/* 依目前發動權重設主按鈕。發動權 0 時一定留一條路可以走。 */
function refreshTacticsButton(){
  const btn = $('main-btn'); if(!btn) return;
  if(S.charge <= 0){
    S.move = null;
    btn.disabled = false;
    btn.textContent = CONFIG.zeroChargeSafe ? '➡️ 看解析，進入下一題'
                                            : '➡️ 這題放棄行動，進入下一題';
    btn.onclick = skipTurn;
  }else if(!S.move){
    btn.textContent = '請選擇一招'; btn.disabled = true;
  }
}
