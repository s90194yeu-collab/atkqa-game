/* 【20-battle-forms.js】戰鬥：換乘條件與形態切換
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ── 換乘條件：每位角色依自身特質決定何時覺醒 ──
   hp    ：體力低於某比例（絕境爆發型）
   combo ：連續全對達到指定次數（實力碾壓型）
   turn  ：撐過指定題數（後期強化型）
   hpHigh：體力仍高於某比例時（狀態極佳才變身）
   damage：單場累積受創達最大體力的某倍數（越打越強）  */
const AWAKEN_RULE = {
  /* 神域 */
  my_zeus               :{type:'combo', v:3, desc:'連續 3 題全對'},
  my_athena             :{type:'hpHigh', v:0.55, desc:'狀態極佳時'},
  my_fenrir             :{type:'damage', v:0.55, desc:'掙脫格萊普尼爾'},
  my_seraph             :{type:'combo', v:3, desc:'連續 3 題全對'},
  /* 誓約 */
  oa_arthur             :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  oa_arthur_2           :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  oa_curie              :{type:'turn', v:4, desc:'第 4 題後'},
  /* 亂世 */
  sg_nobunaga           :{type:'damage', v:0.55, desc:'受創後化身第六天魔王'},
  sg_hideyoshi          :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  sg_hideyoshi_2        :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  sg_ieyasu             :{type:'turn', v:4, desc:'第 4 題後'},
  /* 逐鹿 */
  zl_zhangyi            :{type:'turn', v:3, desc:'第 3 題後'},
  zl_jingke             :{type:'hp', v:0.40, desc:'圖已到盡頭'},
  zl_xiangyu            :{type:'damage', v:0.60, desc:'承受足夠傷害後'},
  zl_hanxin             :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  zl_hanxin_2           :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  zl_zhangliang         :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  zl_zhangliang_2       :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  zl_liubang            :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  zl_liubang_2          :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  zl_lvbu               :{type:'turn', v:3, desc:'第 3 題後'},
  zl_guanyu             :{type:'combo', v:3, desc:'連續 3 題全對'},
  zl_zhugeliang         :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  zl_zhugeliang_2       :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  /* 梁山 */
  sh_lin                :{type:'hp', v:0.40, desc:'風雪山神廟，退無可退'},
  sh_wu                 :{type:'combo', v:3, desc:'連續 3 題全對'},
  sh_li                 :{type:'damage', v:0.60, desc:'承受足夠傷害後'},
  sh_song               :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  sh_song_rain          :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  /* 學府 */
  mj_moyan              :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  mj_moyan_2            :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  mj_aili               :{type:'combo', v:3, desc:'連續 3 題全對'},
  mj_lvming             :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  mj_lvming_2           :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  mj_ama                :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  mj_ama_2              :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  mj_gangchi            :{type:'damage', v:0.55, desc:'承受足夠傷害後'},
  mj_renxin             :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  mj_renxin_2           :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  /* 淺山 */
  wd_leopard            :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  wd_leopard_2          :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  wd_cat                :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  wd_cat_2              :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  wd_salmon             :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  wd_salmon_2           :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  wd_magpie             :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  wd_magpie_2           :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  wd_bear               :{type:'turn', v:6, desc:'第 6 題後蛻變'},
  wd_bear_2             :{type:'combo', v:3, since:true, desc:'蛻變後再連對 3 題'},
  wd_pangolin           :{type:'damage', v:0.55, desc:'承受足夠傷害後'},
  wd_owl                :{type:'turn', v:4, desc:'第 4 題後'},
  wd_squirrel           :{type:'combo', v:3, desc:'連續 3 題全對'},
};
function awakenReady(ch, st){
  const rule = AWAKEN_RULE[ch.id] || {type:'hp', v:CONFIG.upgradeAt};
  switch(rule.type){
    case 'combo' : return (rule.since ? S.sinceBest : S.bestCombo) >= rule.v;
    case 'turn'  : return S.totalAnswered >= rule.v;
    case 'hpHigh': return ch.hp >= ch.maxHp * rule.v && S.totalAnswered >= 2;
    case 'damage': return (st.taken || 0) >= ch.maxHp * rule.v;
    default      : return ch.hp <= ch.maxHp * rule.v;
  }
}
function awakenText(c){
  const rule = AWAKEN_RULE[c.id];
  return rule ? rule.desc : ('體力低於 ' + Math.round(CONFIG.upgradeAt*100) + '% 時換乘');
}

/* ---------- 換裝／換乘 ---------- */
/* 把角色換成另一個形態；keepRatio 為真時保留體力百分比（形態切換用） */
function applyForm(ch, up, keepRatio){
  const ratio = ch.maxHp ? ch.hp / ch.maxHp : 1;
  ch.id = up.id; ch.name = up.name; ch.img = up.img; ch.ph = up.ph;
  ch.ability = up.ability; ch.role = up.role; ch.type = up.type;
  ch.defType = up.defType; ch.atkImg = up.atkImg;
  ch.moves = clone(up.moves); ch.maxHp = up.hp;
  ch.upgradeTo = up.upgradeTo;
  if(keepRatio) ch.hp = Math.max(1, Math.round(ch.maxHp * ratio));
}

/* 學生自由切換合體形態，體力比例保留，不消耗回合 */
function switchForm(id){
  if(S.busy || S.resolved || !S.player.formList) return;
  if(S.player.id === id) return;
  const up = ALL_CHARACTERS.filter(c=>c.id===id)[0];
  if(!up) return;
  applyForm(S.player, up, true);
  LAST_IMG.p = null;
  log('🔄 合體變形：' + S.player.name + '！', 'var(--gold)');
  auraFx('p'); sfx('awaken'); banner(S.player.name, true);
  paintHUD(); renderForms(); refreshAbilityBtn();
  if(S.answered) buildTactics();
}

function renderForms(){
  // 尚未換乘、但有換乘條件的角色：在戰術面板顯示達成條件
  const hint = $('t-evo');
  if(hint){
    const canEvo = S.player && !S.pSt.upgraded && (S.player.upgradeTo || S.player.forms);
    if(canEvo){
      hint.hidden = false;
      hint.textContent = '✦ 換乘條件：' + awakenText(S.player);
    }else hint.hidden = true;
  }
  const box = $('t-forms');
  if(!S.player || !S.player.formList){ box.hidden = true; return; }
  box.hidden = false;
  const grid = $('forms-grid'); grid.innerHTML = '';
  S.player.formList.forEach(function(id){
    const f = ALL_CHARACTERS.filter(c=>c.id===id)[0];
    if(!f) return;
    const b = document.createElement('button');
    b.className = 'form-btn' + (S.player.id === id ? ' on' : '');
    const n = document.createElement('b'); n.textContent = f.name;
    const t = document.createElement('span');
    t.textContent = roleOf(f).name + '　威力 ' + (mainAtk(f).power || 0);
    b.append(n, t);
    b.onclick = function(){ switchForm(id); sfx('select'); };
    grid.appendChild(b);
  });
}

function awaken(ch, st, side){
  if(side === 'x'){                      // 非畫面上的目標：只換資料，不播特效
    const l2 = ch.forms || (ch.upgradeTo ? [ch.upgradeTo] : null);
    if(st.upgraded || !l2 || ch.hp <= 0 || !awakenReady(ch, st)) return;
    const u2 = ALL_CHARACTERS.filter(function(c){ return c.id === l2[0]; })[0];
    if(!u2) return;
    st.upgraded = true;
    const carry2 = ch.hp;
    applyForm(ch, u2, false);
    ch.hp = Math.min(ch.maxHp, carry2 + CONFIG.upgradeHeal);
    if(ch.upgradeTo) st.upgraded = false;
    log('⚠️ ' + ch.name + ' 換乘了！', 'var(--gold)');
    return;
  }
  const list = ch.forms || (ch.upgradeTo ? [ch.upgradeTo] : null);
  if(st.upgraded || !list || ch.hp<=0) return;
  if(!awakenReady(ch, st)) return;
  const up = ALL_CHARACTERS.filter(c=>c.id===list[0])[0];
  if(!up) return;
  st.upgraded = true;
  const carry = ch.hp;
  const baseId = ch.id;              // applyForm 會覆蓋 ch.id，先留住觸發者
  /* 下一段的連擊從這一刻重新起算，換乘前累積的不算數 */
  if(side === 'p'){ S.sinceRun = 0; S.sinceBest = 0; S.awakened = true; }
  applyForm(ch, up, false);
  ch.hp = Math.min(ch.maxHp, carry + CONFIG.upgradeHeal);
  if(ch.forms){ ch.formList = ch.forms; ch.forms = null; }   // 之後可自由切換
  if(ch.upgradeTo) st.upgraded = false;                      // 還有下一階段就能再進化
  /* 換乘文案依觸發條件分兩種語氣：正向成長 vs 逆境爆發 */
  const _r = AWAKEN_RULE[baseId] || {};
  const _positive = (_r.type === 'combo' || _r.type === 'turn' || _r.type === 'hpHigh');
  log((_positive
        ? '🌟 ' + (_r.desc || '時機成熟') + '──蛻變完成！　✨ '
        : '⚠️ ' + (_r.desc || '瀕臨極限') + '──潛能爆發！　✨ ') + ch.name + '，登場！',
      _positive ? 'var(--jade)' : 'var(--gold)');
  screenFlash('cyan'); banner('AWAKEN!', true);
  popNumber(side==='p'?'f-p':'f-e', '+'+CONFIG.upgradeHeal, 'heal');
  auraFx(side);
  $(side+'-img').classList.add('glow');
  setTimeout(()=>$(side+'-img').classList.remove('glow'), 900);
  sfx('awaken'); paintHUD();
  if(side==='p'){ renderForms(); refreshAbilityBtn(); }
  if(side==='p' && S.answered && !S.resolved) buildTactics();
}
