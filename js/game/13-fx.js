/* 【13-fx.js】畫面特效
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ============================================================================
   畫面特效
   ========================================================================== */
const MELEE_TYPES = ['近戰','格鬥','物理','一般','岩石','地面','土'];
function fxKindOf(move){
  const t = BREATH[move.type] || move.type;
  return MELEE_TYPES.indexOf(t) >= 0 ? 'slash' : 'beam';
}
function addFx(hostId, cls, life){
  const host = $(hostId); if(!host) return;
  const el = document.createElement('div'); el.className = cls;
  host.appendChild(el); setTimeout(()=>el.remove(), life || 800);
}
function popNumber(where, n, cls){
  const host = $(where); if(!host) return;
  const el = document.createElement('div');
  el.className = 'pop' + (cls ? ' '+cls : '');
  el.textContent = (typeof n === 'number') ? '-'+n : n;
  host.appendChild(el); setTimeout(()=>el.remove(), 1000);
}
function banner(text, cyan){
  const el = document.createElement('div');
  el.className = 'banner' + (cyan ? ' cyan' : '');
  el.textContent = text; el.style.left='50%'; el.style.transform='translate(-50%,0)';
  document.body.appendChild(el); setTimeout(()=>el.remove(), 960);
}
function screenFlash(tone){
  const el = document.createElement('div');
  el.className = 'screenflash' + (tone ? ' '+tone : '');
  document.body.appendChild(el); setTimeout(()=>el.remove(), 320);
}
function shakeStage(hard){
  const s = $('stage');
  s.classList.add(hard ? 'shake-hard' : 'shake');
  setTimeout(()=>s.classList.remove('shake','shake-hard'), hard ? 520 : 360);
}
function hpFlash(side){
  const bar = $(side+'-bar'); if(!bar) return;
  bar.classList.add('flash'); setTimeout(()=>bar.classList.remove('flash'), 340);
}
function impact(side, hard){
  const host = side === 'p' ? 'f-p' : 'f-e';
  $(host).classList.add('hit'); setTimeout(()=>$(host).classList.remove('hit'), 440);
  addFx(host,'spark',430); addFx(host,'wave',580);
  hpFlash(side); shakeStage(hard);
}
function lunge(side){
  const img = $(side === 'p' ? 'p-img' : 'e-img');
  img.classList.add(side === 'p' ? 'lunge-l' : 'lunge-r');
  setTimeout(()=>img.classList.remove('lunge-l','lunge-r'), 450);
}
function attackFx(targetSide, kind){
  const host = targetSide === 'p' ? 'f-p' : 'f-e';
  if(kind === 'slash'){ addFx(host,'slashfx',420); addFx(host,'slashfx b',520); sfx('slash'); }
  else { addFx(host,'beamfx',480); sfx('beam'); }
}
function auraFx(side, cls){
  addFx(side === 'p' ? 'f-p' : 'f-e', cls || 'shieldfx', 780);
}
/* 合體時的支援角立繪 */
function showAssist(side, ally){
  const box = $(side + '-assist');
  if(!box) return;
  box.innerHTML = '';
  const im = document.createElement('img');
  im.referrerPolicy = 'no-referrer';
  im.onerror = function(){ im.onerror = null; im.src = ally.ph; };
  im.src = ally.img;
  const nm = document.createElement('span'); nm.textContent = ally.name;
  box.append(im, nm);
  box.classList.add('on');
  setTimeout(()=>box.classList.remove('on'), 2600);
}
