/* 【10-bgm.js】背景音樂
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ============================================================================
   背景音樂
   ── 三首循環曲：menu 主選單曲／battle 戰鬥曲／boss 頭目曲（最後一回合）。
      錯題道場沿用戰鬥曲，但加上低通濾波，聽起來比較安靜、適合專心訂正。
   ── 音檔放在老師的 Drive，由伺服器 getBgm() 讀出；瀏覽器會存進 IndexedDB，
      之後只有檔案更新才會重新下載。
   ── 瀏覽器規定「使用者先點一下」才能出聲，所以第一次點擊畫面後才開始播放。
   ========================================================================== */
const BGM = (function(){
  const PREF_KEY = 'atkqa_bgm_v1';
  const DB_NAME = 'atkqa_bgm', STORE = 'tracks';
  const VOL = 0.45;            // 整體音量：留空間給音效
  const DIM = 0.5;             // 錯題道場：音量再壓低一半
  const FADE = 0.9;            // 換曲時的淡入淡出（秒）
  const SILENT = 'data:audio/wav;base64,UklGRt0BAABXQVZFZm10IBAAAAABAAEAIlYAACJWAAABAAgAZGF0YbkBAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA=';
  const NAMES = ['menu', 'battle', 'boss'];
  /* iPhone／iPad 的 <audio> 不能調音量，只有那裡才改走 Web Audio；
     其他裝置直接調 <audio> 音量，最單純、最不容易出錯。 */
  const NEED_WA = (function(){
    try{ const a = new Audio(); a.volume = 0.5; return Math.abs(a.volume - 0.5) > 0.01; }catch(e){ return false; }
  })();
  let on = true;
  try{ if(localStorage.getItem(PREF_KEY) === '0') on = false; }catch(e){}
  let ctx = null, master = null, lp = null, unlocked = false;
  let want = null, wantDim = false, cur = null, chain = Promise.resolve();
  let status = '尚未開始';
  const T = {};
  NAMES.forEach(function(n){ T[n] = { name:n, el:null, gain:null, ready:false, loading:null, failed:false, err:'' }; });

  function note(msg, show){
    status = msg;
    try{ console.info('[BGM] ' + msg); }catch(e){}
    if(show) toast(msg);
    paintButtons();
  }
  let toastT = null;
  function toast(msg){
    const el = $('bgm-toast');
    if(!el) return;
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function(){ el.hidden = true; }, 4500);
  }

  /* ── IndexedDB 快取（任何一步失敗或太久沒回應，都當作沒有快取） ── */
  function withTimeout(pr, ms){
    return Promise.race([pr, new Promise(function(r){ setTimeout(function(){ r(null); }, ms); })]);
  }
  function idb(){
    return withTimeout(new Promise(function(res){
      try{
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = function(){ r.result.createObjectStore(STORE); };
        r.onsuccess = function(){ res(r.result); };
        r.onerror = function(){ res(null); };
        r.onblocked = function(){ res(null); };
      }catch(e){ res(null); }
    }), 1500);
  }
  function idbGet(k){
    return idb().then(function(db){ return withTimeout(new Promise(function(res){
      if(!db) return res(null);
      try{
        const q = db.transaction(STORE, 'readonly').objectStore(STORE).get(k);
        q.onsuccess = function(){ res(q.result || null); };
        q.onerror = function(){ res(null); };
      }catch(e){ res(null); }
    }), 1500); });
  }
  function idbPut(k, v){
    return idb().then(function(db){
      if(!db) return;
      try{ db.transaction(STORE, 'readwrite').objectStore(STORE).put(v, k); }catch(e){}
    });
  }
  function b64ToBuf(b64){
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }

  /* ── 音量：0～1 的相對值，實際音量＝相對值 × 總音量（× 道場減半） ── */
  function level(){ return on ? VOL * (wantDim ? DIM : 1) : 0; }
  function graph(){
    if(ctx) return ctx;
    try{ ctx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ ctx = null; return null; }
    master = ctx.createGain(); master.gain.value = level();
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 0.5;
    lp.connect(master); master.connect(ctx.destination);
    return ctx;
  }
  function element(t){
    if(t.el) return t.el;
    const el = new Audio(); el.loop = true; el.preload = 'auto';
    el.setAttribute('playsinline', '');
    el.addEventListener('error', function(){
      if(t.ready){ t.err = '音檔無法播放（' + ((el.error && el.error.code) || '?') + '）'; note('🎵 ' + t.err, true); }
    });
    t.el = el;
    if(NEED_WA && graph()){
      try{
        const src = ctx.createMediaElementSource(el);
        t.gain = ctx.createGain(); t.gain.gain.value = 0;
        src.connect(t.gain); t.gain.connect(lp);
      }catch(e){ t.gain = null; }
    }
    if(!t.gain) el.volume = 0;
    t.v = 0;
    return el;
  }
  function ramp(t, v, dur){
    if(!t.el) return;
    t.v = v;
    if(t.gain){
      const g = t.gain.gain, now = ctx.currentTime;
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(v, now + dur);
      return;
    }
    clearInterval(t.iv);
    const from = t.el.volume, to = v * level(), steps = 12;
    let i = 0;
    t.iv = setInterval(function(){
      i++;
      try{ t.el.volume = Math.max(0, Math.min(1, from + (to - from) * i / steps)); }catch(e){}
      if(i >= steps) clearInterval(t.iv);
    }, Math.max(10, dur * 1000 / steps));
  }
  function relevel(){                // 開關或進出道場時，把目前曲子調到新音量
    if(master){
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(level(), now + 0.4);
    }
    NAMES.forEach(function(n){ const t = T[n]; if(t.el && !t.gain && t.v) ramp(t, t.v, 0.4); });
  }
  function startPlay(t){
    if(ctx && ctx.state === 'suspended') ctx.resume();
    const p = t.el.play();
    if(p && p.then){
      p.then(function(){ note('▶ 播放中：' + t.name); })
       .catch(function(e){
         const n = e && e.name || '';
         if(n === 'NotAllowedError') note('🎵 瀏覽器擋下自動播放，點一下畫面就會開始', true);
         else if(n === 'AbortError') return;          // 換曲時中斷前一首，屬正常狀況
         else note('🎵 音樂檔無法播放（檔案讀不到或格式不支援：' + n + '）', true);
       });
    }
  }

  /* ── GitHub 版：音檔放在 GitHub 的 assets/bgm/，瀏覽器會自己快取 ── */
  function load(name){
    const t = T[name];
    if(!t || t.ready || t.failed) return Promise.resolve();
    try{
      element(t).src = (window.ATKQA_SITE || '') + 'assets/bgm/bgm_' + name + '.m4a?v=96c403b17a';
      t.ready = true;
      note('✔ ' + name + ' 已就緒');
    }catch(e){ t.failed = true; t.err = String(e && e.message || e); }
    if(t.ready && want === name) apply();
    return Promise.resolve();
  }
  /* 一首一首依序下載；第一首稍微錯開，避免全班同時向伺服器要檔案 */
  let first = true;
  function queue(name){
    const wait = first ? Math.random() * 1500 : 0;
    first = false;
    chain = chain.then(function(){
      return new Promise(function(r){ setTimeout(r, wait); });
    }).then(function(){ return load(name); });
    return chain;
  }
  function prefetch(){
    if(!on) return;
    if(want === 'menu' || !want) queue('battle');
    else queue('boss');
  }

  /* ── 切換到 want 這首 ── */
  function apply(){
    if(!unlocked || !on || document.hidden) return;
    if(lp){
      const now = ctx.currentTime;
      lp.frequency.cancelScheduledValues(now);
      lp.frequency.setTargetAtTime(wantDim ? 900 : 20000, now, 0.25);
    }
    if(cur && cur !== want && T[cur] && T[cur].el){
      const old = T[cur];
      ramp(old, 0, FADE);
      clearTimeout(old.stopT);
      old.stopT = setTimeout(function(){ if(cur !== old.name) old.el.pause(); }, FADE * 1000 + 120);
    }
    cur = want;
    const t = T[want];
    if(!t) return;
    if(t.failed){ return; }
    if(!t.ready){ queue(want); return; }      // 下載完會再呼叫 apply()
    clearTimeout(t.stopT);
    if(t.el.paused) startPlay(t);
    ramp(t, 1, FADE);
  }
  function pauseAll(){
    NAMES.forEach(function(n){
      const t = T[n];
      if(t.el && !t.el.paused){ ramp(t, 0, 0.25); setTimeout(function(){ if(!on) t.el.pause(); }, 320); }
    });
    cur = null;
  }

  /* ── 每次點擊都檢查一次：該播卻沒在播（被瀏覽器擋下）就在這次點擊裡補播 ── */
  function onGesture(){
    if(!unlocked){
      unlocked = true;
      if(NEED_WA){ const c = graph(); if(c && c.state === 'suspended') c.resume(); }
      apply();
      NAMES.forEach(function(n){                // 在手勢內先「播一下」每個 <audio>（音量 0），之後才能自由播放
        const t = T[n], el = element(t);
        if(cur === n && t.ready) return;
        if(!t.ready) el.src = SILENT;
        const p = el.play();
        if(p && p.then) p.then(function(){ if(cur !== n || !t.ready) el.pause(); }).catch(function(){});
      });
      if(on) setTimeout(prefetch, 20000 + Math.random() * 20000);
      return;
    }
    if(ctx && ctx.state === 'suspended') ctx.resume();
    if(on && cur && T[cur] && T[cur].ready && T[cur].el.paused && !document.hidden){
      startPlay(T[cur]); ramp(T[cur], 1, FADE);
    }
  }
  ['pointerdown', 'keydown', 'touchend'].forEach(function(ev){ document.addEventListener(ev, onGesture, true); });
  document.addEventListener('visibilitychange', function(){
    if(document.hidden){
      NAMES.forEach(function(n){ const t = T[n]; if(t.el && !t.el.paused) t.el.pause(); });
    }else if(cur && on){
      const t = T[cur];
      if(t && t.ready) startPlay(t);
    }
  });

  /* ── 依畫面決定曲目 ── */
  function pick(id){
    if(id === 'scr-round') return null;                     // 回合結算：沿用目前的戰鬥音樂
    if(id === 'scr-battle'){
      let dojo = false, last = false;
      try{ dojo = S.mode === 'dojo'; last = S.round >= CONFIG.rounds; }catch(e){}
      if(dojo) return { name:'battle', dim:true };
      return { name: last ? 'boss' : 'battle', dim:false };
    }
    return { name:'menu', dim:false };
  }
  let screenId = '';
  function paintButtons(id){
    if(id) screenId = id;
    const b = $('btn-bgm');
    if(b){
      b.hidden = (screenId === 'scr-battle');
      b.classList.toggle('off', !on);
      b.title = (on ? '背景音樂：開（點一下關閉）' : '背景音樂：關（點一下開啟）') + '\n狀態：' + status;
    }
    const m = $('btn-mute');
    if(m){
      const sfxOff = SFX.isMuted();
      m.textContent = (!on && sfxOff) ? '🔇' : (!on ? '🔉' : (sfxOff ? '🎵' : '🔊'));
      m.title = '聲音：' + (on ? '音樂開' : '音樂關') + '・' + (sfxOff ? '音效關' : '音效開');
    }
  }
  function auto(id){
    id = id || ((document.querySelector('.screen.on') || {}).id) || '';
    paintButtons(id);
    const r = pick(id);
    if(!r) return;
    const changed = (want !== r.name), dimChanged = (wantDim !== r.dim);
    want = r.name; wantDim = r.dim;
    if(dimChanged) relevel();
    apply();
    if(changed && unlocked && on && want !== 'menu') setTimeout(prefetch, 20000 + Math.random() * 20000);
  }
  function set(v){
    on = !!v;
    try{ localStorage.setItem(PREF_KEY, on ? '1' : '0'); }catch(e){}
    if(on){
      NAMES.forEach(function(n){ if(T[n].failed){ T[n].failed = false; T[n].err = ''; } });   // 開啟時重試失敗的曲子
      relevel(); apply();
    }else{ relevel(); pauseAll(); }
    paintButtons();
  }
  /* 🎵 鈕：音樂開著卻沒在播（下載失敗或被擋）時，按一下是「重試／開始播放」，不是關掉 */
  function button(){
    const t = T[want];
    if(on && unlocked && t && !(t.ready && t.el && !t.el.paused)){
      if(t.failed){ t.failed = false; t.err = ''; }
      note('🎵 重新嘗試播放⋯', true);
      apply();
      return;
    }
    set(!on);
    toast(on ? '🎵 背景音樂：開' : '🎵 背景音樂：關');
  }
  return { auto: auto, set: set, button: button, isOn: function(){ return on; },
           state: function(){ return { on: on, unlocked: unlocked, cur: cur, want: want, dim: wantDim,
             webAudio: !!ctx, ctx: ctx ? ctx.state : '', status: status,
             ready: NAMES.filter(function(n){ return T[n].ready; }),
             failed: NAMES.filter(function(n){ return T[n].failed; }),
             playing: NAMES.filter(function(n){ return T[n].el && !T[n].el.paused; }),
             volume: NAMES.map(function(n){ return T[n].el ? +T[n].el.volume.toFixed(2) : null; }) }; } };
})();
