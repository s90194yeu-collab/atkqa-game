/* 【25-start.js】啟動：綁定按鈕、讀取資料（一定要最後載入）
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ============================================================================
   啟動
   ========================================================================== */
/* 橫式優先：直向時顯示轉向提示（可自行略過） */
document.body.classList.add('force-landscape');
$('rot-ignore').onclick = function(){
  document.body.classList.remove('force-landscape');
  sfx('tap');
};

/* 逐步啟動：任何一步出錯都會被記下來並顯示，但不會中斷後面的步驟。
   舊版是連續呼叫，前面一炸後面全部不執行——那正是「畫面卡住」的成因。 */
[['buildTabs', buildTabs], ['restorePreview', restorePreview],
 ['loadLessons', loadLessons], ['loadUser', loadUser],
 ['loadImageMap', loadImageMap], ['loadCharacterTable', loadCharacterTable],
 ['loadProgress', loadProgress], ['loadEvents', loadEvents], ['paintGrowth', paintGrowth]
].forEach(function(step){
  try{ step[1](); }
  catch(err){
    if(window.__bootErr) window.__bootErr('啟動步驟 ' + step[0] + ' 失敗：', err && err.message ? err.message : String(err));
    console.error('[boot] ' + step[0], err);
  }
});

document.querySelectorAll('#diff-row .optbtn').forEach(function(b){
  b.onclick = function(){
    document.querySelectorAll('#diff-row .optbtn').forEach(function(x){ x.classList.remove('on'); });
    b.classList.add('on'); S.difficulty = b.dataset.diff; sfx('select');
  };
});
document.querySelectorAll('#speed-row .optbtn').forEach(function(b){
  b.onclick = function(){
    document.querySelectorAll('#speed-row .optbtn').forEach(function(x){ x.classList.remove('on'); });
    b.classList.add('on'); SPEED = parseFloat(b.dataset.speed); sfx('select');
  };
});

$('btn-goto-select').onclick = function(){
  PENDING_MODE = 'normal';
  $('lesson-tag').textContent = currentLesson ? (currentLesson.name || '') : '';
  if(!rosterBuilt) renderRoster(UNIVERSES[0].k);   // 第一次進來才建立陣容
  show('scr-select'); sfx('tap');
};
$('btn-back-home').onclick = function(){
  PENDING_MODE = 'normal';
  $('lesson-tag').textContent = currentLesson ? (currentLesson.name || '') : '';
  show('scr-home'); sfx('tap');
};
$('btn-cards').onclick = function(){ openCards(); sfx('tap'); };
$('btn-dojo').onclick = startDojo;
$('btn-cards-back').onclick = function(){ show('scr-home'); sfx('tap'); };
$('cd-close').onclick = function(){ $('card-detail').hidden = true; };
$('btn-home-rules').onclick = function(){ $('scr-rules').classList.add('on'); };
$('btn-home-codex').onclick = function(){ openCodex(); sfx('tap'); };
/* 學生端一鍵清除：只刪自己的資料，需要連按兩次確認 */
$('btn-wipe').onclick = function(){
  if(!(ME && ME.allowed)){ alert('未以學校帳號登入，沒有可清除的紀錄。'); return; }
  if(!confirm('確定要清除你的所有紀錄嗎？\n\n包含：學期積分、各課最佳成績、作答紀錄、錯題本、存檔進度。\n這個動作無法復原。')) return;
  if(!confirm('最後確認：真的要全部清除嗎？')) return;
  if(!inGAS){ alert('本機預覽模式，沒有連線到試算表。'); return; }
  const b = $('btn-wipe');
  b.disabled = true; b.textContent = '清除中⋯⋯';
  google.script.run
    .withSuccessHandler(function(r){
      alert((r && r.msg) || '已清除。');
      location.reload();
    })
    .withFailureHandler(function(){
      b.disabled = false; b.textContent = '🗑️ 清除我的所有紀錄';
      alert('清除失敗，請稍後再試。');
    })
    .deleteMyData();
};

$('pw-ok').onclick = submitPw;
$('pw-cancel').onclick = closePw;
$('pw-input').addEventListener('keydown', function(e){
  if(e.key === 'Enter') submitPw();
  if(e.key === 'Escape') closePw();
});

$('btn-styles').onclick = function(){ openStyles(); sfx('tap'); };
/* 學習分析改成獨立網頁，用超連結另開視窗（避免主程式過大） */
$('btn-stats').onclick = function(){
  sfx('tap');
  const base = (ME && ME.analysisUrl) ? ME.analysisUrl : '';
  if(!base){ alert('請先部署網頁應用程式，學習分析才有網址可以開啟。'); return; }
  window.open(base, '_blank');
};
$('btn-teacher').onclick = function(){
  sfx('tap');
  /* 教師後臺與遊戲共用同一個網址，用 ?page=teacher 分流。
     真正的把關在後臺頁面本身（要輸入密碼），這個按鈕只是入口。 */
  /* gameUrl 由 getUserInfo() 提供。若那支呼叫還沒回來（或失敗），
     就退回用目前的網址推導——Apps Script 網頁跑在 iframe 裡，
     真正的外層網址在 referrer 或 ancestorOrigins，都拿不到時才提示。 */
  let base = (ME && ME.gameUrl) ? ME.gameUrl : '';
  if(!base){
    try{
      const ref = document.referrer || '';
      if(ref.indexOf('/macros/') >= 0) base = ref.split('?')[0];
    }catch(e){}
  }
  if(!base){
    alert('還在取得網址，請稍等一兩秒再按一次。\n\n'
        + '如果一直不行，代表網頁應用程式尚未部署，\n'
        + '或者可以直接在網址列的部署網址後面加上　?page=teacher');
    return;
  }
  window.open(base + '?page=teacher', '_blank');
};
$('btn-styles-back').onclick = function(){ show('scr-home'); sfx('tap'); };
$('btn-login').onclick = function(){
  /* 在原頁面直接換到 Google 帳號選擇頁，選好帳號後自動回到遊戲（不開新分頁）。
     Apps Script 網頁跑在 iframe 裡，必須用 target="_top" 讓「整個頁面」跳轉；
     回來的網址（continue）一定要帶，否則 Google 會把人留在 Google 首頁。 */
  let back = (ME && ME.gameUrl) ? ME.gameUrl : '';
  if(!back){
    try{
      const ref = document.referrer || '';
      if(ref.indexOf('/macros/') >= 0) back = ref.split('?')[0].split('#')[0];
    }catch(e){}
  }
  if(!back){
    alert('還在取得遊戲網址，請稍等一兩秒再按一次「用學校帳號登入」。');
    return;
  }
  const u = 'https://accounts.google.com/AccountChooser?continue=' + encodeURIComponent(back);
  /* 提示文字裡附一個備用連結：萬一瀏覽器擋下整頁跳轉，學生可以自己點 */
  const note = $('login-note');
  note.textContent = '正在前往 Google 登入頁，選好學校帳號後會自動回到遊戲。沒有跳轉的話請';
  const alt = document.createElement('a');
  alt.href = u; alt.target = '_blank'; alt.rel = 'noopener';
  alt.textContent = '點這裡另開登入頁';
  alt.style.cssText = 'color:var(--sakura-d,#e0559b);font-weight:700;text-decoration:underline';
  note.appendChild(alt);
  note.appendChild(document.createTextNode('（登入後回到這頁重新整理）。'));
  const a = document.createElement('a');
  a.href = u; a.target = '_top';
  document.body.appendChild(a); a.click(); a.remove();
};

$('btn-codex-back').onclick = function(){
  show(rosterBuilt ? 'scr-select' : 'scr-home'); sfx('tap');
};

function refreshRoster(){
  if(!rosterBuilt) return;            // 還沒進選角畫面就不必重繪
  const active = document.querySelector('.tab.on');
  renderRoster(active && active.dataset.u ? active.dataset.u : UNIVERSES[0].k);
  if(selected){
    const fresh = ALL_CHARACTERS.filter(x=>x.id===selected.id)[0];
    if(fresh){ selected = fresh; selectCharacter(fresh); }
  }else restorePreview();
}

function loadImageMap(){
  if(!inGAS) return;
  google.script.run
    .withSuccessHandler(function(map){
      if(!map || typeof map !== 'object') return;
      let n = 0;
      ALL_CHARACTERS.forEach(function(c){ if(map[c.id]){ c.img = normalizeImgUrl(map[c.id]); n++; } });
      if(n) refreshRoster();
    })
    .withFailureHandler(function(){})
    .getImageMap();
}

/* 學生自創角色：試算表出現內建清單沒有的角色ID，就依該列建立新角色。
   數值一律夾在合理範圍內，避免出現一拳打死人的角色。 */
function createCharacter(r){
  if(!r.id || !r.name) return null;
  if(!/^[A-Za-z0-9_]{2,24}$/.test(r.id)) return null;      // ID 只收英數與底線
  const cl = function(v, lo, hi, d){ v = Number(v); return isNaN(v) || !v ? d : Math.max(lo, Math.min(hi, v)); };
  const ch = {
    id: r.id,
    name: String(r.name).slice(0, 12),
    universe: UNI_BY_LABEL[r.universe] || 'special',
    clan: 'custom',
    type: String(r.type || '自創角色').slice(0, 8),
    defType: '一般',
    custom: true,
    hp: cl(r.hp, 450, 1000, 720),
    ability: { name: String(r.abName || '全力以赴').slice(0, 12),
               effect: ABILITY_TEXT[r.abEff] ? r.abEff : 'overdrive' },
    moves: [
      { name: String(r.atkName || '普通攻擊').slice(0, 12),
        type: TYPE_CHART[r.atkType] ? r.atkType : '一般',
        power: cl(r.atkPower, 50, 100, 80), kind: 'attack' },
      { name: String(r.gdName || '防禦姿態').slice(0, 12),
        type: '防禦', power: 0, defense: cl(r.gdDef, 0.15, 0.70, 0.42), kind: 'guard' },
      { name: String(r.skName || '凝神').slice(0, 12),
        type: '特技', power: 0,
        effect: SKILL_MAG[r.skEff] ? r.skEff : 'focus', kind: 'skill' }
    ]
  };
  ch.role = ROLES[r.role] ? r.role : 'balance';
  ch.moves.forEach(function(m){
    m.acc = (m.accFixed !== undefined) ? m.accFixed : accOf(m.power);
    if(m.kind === 'aoe' && m.accFixed === undefined) m.acc = Math.max(35, m.acc - CONFIG.aoeAccPenalty);
  });
  ch.baseHp = ch.hp;
  ch.hp = Math.round(ch.hp * roleOf(ch).hp);
  ch.ph = placeholderImg(ch.name, ch.universe);
  ch.img = ch.ph;
  ALL_CHARACTERS.push(ch);
  return ch;
}

/* 從試算表「角色」工作表覆寫角色設定：留白的欄位就沿用內建值 */
function loadCharacterTable(){
  if(!inGAS) return;
  google.script.run
    .withSuccessHandler(function(rows){
      if(!Array.isArray(rows) || !rows.length) return;
      let n = 0;
      rows.forEach(function(r){
        let c = ALL_CHARACTERS.filter(x=>x.id === r.id)[0];
        if(!c){ c = createCharacter(r); if(!c) return; }
        n++;
        if(r.name)      c.name = r.name;
        if(r.type)      c.type = r.type;
        if(r.role && ROLES[r.role]) c.role = r.role;
        if(r.hp)        c.baseHp = r.hp;
        if(r.img)       c.img = normalizeImgUrl(r.img);
        if(r.atkImg)    c.atkImg = normalizeImgUrl(r.atkImg);
        if(r.atkName && mainAtk(c))   mainAtk(c).name = r.atkName;
        // 招式：試算表的三組欄位可整組覆寫，留白則沿用內建
        const KIND_MAP = {'攻擊':'attack','群攻':'aoe','防禦':'guard','特技':'skill'};
        if(Array.isArray(r.moves)){
          const built = [];
          r.moves.forEach(function(mm){
            if(!mm || !mm.name) return;
            const k = KIND_MAP[mm.kind] || mm.kind || 'attack';
            if(k === 'guard'){
              built.push({name:mm.name, type:'防禦', power:0,
                          defense: clamp(mm.defense || 0.45, 0.05, 0.85), kind:'guard'});
            }else if(k === 'skill'){
              built.push({name:mm.name, type:'特技', power:0,
                          effect: SKILL_MAG[mm.effect] ? mm.effect : 'focus', kind:'skill'});
            }else{
              const pw = clamp(mm.power || 80, 1, 120);
              const kk = (k === 'aoe') ? 'aoe' : 'attack';
              built.push({name:mm.name, type: TYPE_CHART[mm.type] ? mm.type : '一般',
                          power:pw,
                          acc: kk === 'aoe' ? Math.max(35, accOf(pw) - CONFIG.aoeAccPenalty) : accOf(pw),
                          kind: kk});
            }
          });
          if(built.length && built.some(function(x){ return isAtkKind(x.kind); })) c.moves = built;
        }
        if(r.abName)    c.ability.name = r.abName;
        if(r.abEff && ABILITY_TEXT[r.abEff]) c.ability.effect = r.abEff;
        c.hp = Math.round(c.baseHp * roleOf(c).hp);
        c.ph = placeholderImg(c.name, c.universe);
        if(!c.img) c.img = c.ph;
      });
      if(n) refreshRoster();
    })
    .withFailureHandler(function(){})
    .getCharacterTable();
}

$('btn-start').onclick = startBattle;
$('btn-save').onclick  = saveScore;
$('btn-again').onclick = function(){ location.reload(); };
/* 戰鬥畫面的聲音鈕：全開 → 只關音樂 → 全關 → 全開 */
$('btn-mute').onclick  = function(){
  const music = BGM.isOn(), fx = !SFX.isMuted();
  if(music && fx){ BGM.set(false); log('🔉 背景音樂關閉（音效保留）', 'var(--dim)'); }
  else if(!music && fx){ SFX.toggle(); BGM.set(false); log('🔇 音樂與音效都已關閉', 'var(--dim)'); }
  else { if(SFX.isMuted()) SFX.toggle(); BGM.set(true); log('🔊 音樂與音效已開啟', 'var(--dim)'); }
};
$('btn-bgm').onclick = function(){ BGM.button(); sfx('tap'); };
BGM.auto();                          // 開頁時先畫好按鈕狀態（真正播放要等第一次點擊）
$('rd-save').onclick   = function(){ saveNow(true); };
$('btn-qsave').onclick = openQuickSave;
$('qs-leave').onclick  = function(){ doQuickSave(true); };
$('qs-stay').onclick   = function(){ doQuickSave(false); };
$('qs-cancel').onclick = function(){ $('qs-box').hidden = true; };
$('rd-next').onclick   = continueNextRound;
$('rd-quit').onclick   = function(){ endGame('time'); };

$('btn-rules').onclick = function(){ $('scr-rules').classList.add('on'); };
$('rules-close').onclick = function(){ $('scr-rules').classList.remove('on'); };

document.addEventListener('keydown', function(e){
  if(!$('scr-battle').classList.contains('on')) return;
  if(e.target.tagName === 'INPUT') return;
  const n = parseInt(e.key,10);
  if(n>=1 && n<=6){
    const el = document.querySelectorAll('.opt')[n-1];
    if(el && !el.disabled) toggleOption(n-1, el);
  }
  if(e.key === 'Enter'){
    const btn = $('main-btn');
    if(!btn.disabled) btn.click();
  }
});
