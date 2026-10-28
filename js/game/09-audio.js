/* 【09-audio.js】小工具、音效引擎
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ============================================================================
   小工具
   ========================================================================== */
const $  = id => document.getElementById(id);
const clone = o => JSON.parse(JSON.stringify(o));
let SPEED = 1;                                   // 1＝一般，0.45＝快速模式
const wait = ms => new Promise(r=>setTimeout(r, Math.round(ms * SPEED)));
const paceMs = ms => Math.round(ms * SPEED);     // 給動畫用的時間換算
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
/* 安全捲動：舊瀏覽器或內嵌環境若沒有 scrollIntoView，不該讓整段流程中斷 */
function scrollTo_(el, opt){
  try{ if(el && typeof el.scrollIntoView === 'function') el.scrollIntoView(opt); }catch(e){}
}
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
const inGAS = typeof google !== 'undefined' && google.script && google.script.run;

/* ============================================================================
   音效引擎
   ========================================================================== */
const SFX = (function(){
  let ctx = null, muted = false;
  function get(){
    if(!ctx){ try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; } }
    if(ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function env(g,t,dur,vol){
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(vol,t+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  }
  function tone(f1,f2,dur,type,vol,delay){
    const c=get(); if(!c) return;
    const t=c.currentTime+(delay||0), o=c.createOscillator(), g=c.createGain();
    o.type=type||'square'; o.frequency.setValueAtTime(f1,t);
    if(f2) o.frequency.exponentialRampToValueAtTime(Math.max(20,f2),t+dur);
    env(g,t,dur,vol||0.11); o.connect(g).connect(c.destination); o.start(t); o.stop(t+dur+0.05);
  }
  function noise(dur,f1,f2,vol,delay,q){
    const c=get(); if(!c) return;
    const t=c.currentTime+(delay||0), n=Math.max(1,Math.floor(c.sampleRate*dur));
    const buf=c.createBuffer(1,n,c.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    const src=c.createBufferSource(); src.buffer=buf;
    const flt=c.createBiquadFilter(); flt.type='bandpass'; flt.Q.value=q||1.1;
    flt.frequency.setValueAtTime(f1,t);
    if(f2) flt.frequency.exponentialRampToValueAtTime(Math.max(60,f2),t+dur);
    const g=c.createGain(); env(g,t,dur,vol||0.14);
    src.connect(flt).connect(g).connect(c.destination); src.start(t); src.stop(t+dur+0.05);
  }
  const BANK = {
    tap    : ()=>{ tone(620,760,.05,'square',.08); },
    select : ()=>{ tone(520,0,.05,'square',.09); tone(780,0,.07,'square',.08,.05); },
    charge : ()=>{ tone(440,0,.09,'triangle',.10); tone(660,0,.09,'triangle',.10,.08); tone(880,0,.14,'triangle',.11,.16); },
    perfect: ()=>{ [523,659,784,1047].forEach((f,i)=>tone(f,0,.16,'triangle',.11,i*.07)); noise(.25,3000,900,.05,.28,2); },
    fail   : ()=>{ tone(300,150,.24,'sawtooth',.09); },
    swing  : ()=>{ noise(.16,1800,320,.13,0,.8); },
    slash  : ()=>{ noise(.14,2600,500,.15,0,.9); tone(1400,300,.1,'square',.06,.02); },
    beam   : ()=>{ tone(1500,220,.3,'sawtooth',.09); noise(.3,2400,500,.09,0,1.6); },
    impact : ()=>{ noise(.2,900,120,.2,0,.7); tone(150,52,.22,'sine',.16); },
    crit   : ()=>{ noise(.34,1600,90,.24,0,.6); tone(200,45,.36,'sawtooth',.17);
                   tone(1200,2400,.14,'square',.10,.02); [784,1047,1319].forEach((f,i)=>tone(f,0,.2,'triangle',.09,.12+i*.05)); },
    glance : ()=>{ noise(.1,1400,700,.09,0,2); tone(420,300,.08,'square',.05); },
    guard  : ()=>{ tone(880,760,.1,'square',.11); tone(1320,1180,.12,'square',.08,.01); noise(.12,3200,1400,.09,0,3); },
    counter: ()=>{ tone(1046,0,.07,'square',.11); tone(1568,0,.1,'square',.10,.07); noise(.14,2200,600,.11,.06,1.2); },
    miss   : ()=>{ noise(.12,900,1600,.07,0,1.4); },
    buff   : ()=>{ [523,698,880].forEach((f,i)=>tone(f,0,.18,'triangle',.10,i*.06)); },
    debuff : ()=>{ [660,520,392].forEach((f,i)=>tone(f,0,.18,'sawtooth',.08,i*.06)); },
    heal   : ()=>{ [784,988,1175].forEach((f,i)=>tone(f,0,.22,'sine',.11,i*.07)); },
    assist : ()=>{ [659,880,1175,1568].forEach((f,i)=>tone(f,0,.16,'square',.10,i*.05)); noise(.3,1800,600,.1,.1,1); },
    awaken : ()=>{ tone(220,880,.5,'sawtooth',.10); noise(.5,400,3000,.08,0,1.2);
                   [523,659,784,1047,1319].forEach((f,i)=>tone(f,0,.3,'triangle',.09,.2+i*.06)); },
    ko     : ()=>{ noise(.6,1200,60,.24,0,.5); tone(180,40,.7,'sawtooth',.18); },
    round  : ()=>{ [392,523,659,784].forEach((f,i)=>tone(f,0,.24,'triangle',.11,i*.09)); },
    win    : ()=>{ [523,659,784,1047,1319,1568].forEach((f,i)=>tone(f,0,.22,'triangle',.12,i*.1)); },
    lose   : ()=>{ [440,392,330,262].forEach((f,i)=>tone(f,0,.3,'triangle',.11,i*.16)); }
  };
  return { play(n){ if(muted) return; (BANK[n]||BANK.tap)(); },
           toggle(){ muted=!muted; if(!muted) BANK.tap(); return muted; },
           isMuted(){ return muted; } };
})();
const sfx = n => SFX.play(n);
