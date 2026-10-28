/* 【11-scenes.js】戰場場景 SVG 插畫
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ============================================================================
   狀態效果
   ========================================================================== */
/* ============================================================================
   戰場場景：SVG 插畫
   ── 每個場景都是程式畫出來的向量圖（遠景、中景、前景、粒子四層），
      不用外部圖片；固定亂數種子，所以每次畫出來都一樣。
   ── 不用 SVG 濾鏡（手機算模糊很吃力），光暈一律用放射漸層。
   ========================================================================== */
const SCENE = (function(){
  const W = 1600, H = 900;
  const f = n => Math.round(n * 10) / 10;
  function rng(seed){
    let a = seed >>> 0;
    return function(){
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const lin = (id, stops, x2, y2) =>
    '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 || 0) + '" y2="' + (y2 === undefined ? 1 : y2) + '">' +
    stops.map(s => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] !== undefined ? ' stop-opacity="' + s[2] + '"' : '') + '/>').join('') +
    '</linearGradient>';
  const rad = (id, stops) =>
    '<radialGradient id="' + id + '">' +
    stops.map(s => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '" stop-opacity="' + (s[2] === undefined ? 1 : s[2]) + '"/>').join('') +
    '</radialGradient>';
  const glow = (x, y, rx, ry, id) => '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + (ry || rx) + '" fill="url(#' + id + ')"/>';

  /* 平滑起伏的山丘 */
  function hills(r, y, amp, n, fill, attr){
    const p = [];
    for(let i = 0; i <= n; i++) p.push([i * W / n, y - r() * amp]);
    let d = 'M0 ' + H + 'L0 ' + f(p[0][1]);
    for(let i = 0; i < n; i++){
      const mx = (p[i][0] + p[i + 1][0]) / 2;
      d += 'C' + f(mx) + ' ' + f(p[i][1]) + ' ' + f(mx) + ' ' + f(p[i + 1][1]) + ' ' + f(p[i + 1][0]) + ' ' + f(p[i + 1][1]);
    }
    return '<path d="' + d + 'L' + W + ' ' + H + 'Z" fill="' + fill + '" ' + (attr || '') + '/>';
  }
  /* 尖峰山脈，可加雪頂 */
  function peaks(r, y, amp, n, fill, cap){
    const pts = [[0, y]];
    for(let i = 0; i < n; i++){
      const x = (i + 0.5) * W / n + (r() - 0.5) * W / n * 0.5;
      pts.push([x, y - amp * (0.55 + r() * 0.45)]);
      pts.push([(i + 1) * W / n, y - amp * r() * 0.25]);
    }
    let s = '<path d="M0 ' + H + pts.map(p => 'L' + f(p[0]) + ' ' + f(p[1])).join('') + 'L' + W + ' ' + H + 'Z" fill="' + fill + '"/>';
    if(cap){
      for(let i = 1; i < pts.length - 1; i += 2){
        const [x, py] = pts[i], [lx, ly] = pts[i - 1], [rx, ry] = pts[i + 1];
        const t = 0.28;
        const ax = x + (lx - x) * t, ay = py + (ly - py) * t, bx = x + (rx - x) * t, by = py + (ry - py) * t;
        s += '<path d="M' + f(x) + ' ' + f(py) + 'L' + f(ax) + ' ' + f(ay) + 'L' + f(ax + (x - ax) * 0.45) + ' ' + f(ay - 6) +
             'L' + f(x) + ' ' + f(ay + 8) + 'L' + f(bx - (bx - x) * 0.4) + ' ' + f(by - 4) + 'L' + f(bx) + ' ' + f(by) + 'Z" fill="' + cap + '"/>';
      }
    }
    return s;
  }
  function cloud(x, y, s, fill, op){
    const c = (cx, cy, rr) => '<circle cx="' + f(x + cx * s) + '" cy="' + f(y + cy * s) + '" r="' + f(rr * s) + '"/>';
    return '<g fill="' + fill + '" opacity="' + (op === undefined ? 1 : op) + '">' +
      '<rect x="' + f(x - 70 * s) + '" y="' + f(y - 6 * s) + '" width="' + f(150 * s) + '" height="' + f(34 * s) + '" rx="' + f(17 * s) + '"/>' +
      c(-38, 6, 30) + c(-6, -16, 40) + c(34, -2, 32) + c(62, 12, 20) + '</g>';
  }
  const sparkle = (x, y, s, fill, op) =>
    '<path d="M' + f(x) + ' ' + f(y - s) + 'Q' + f(x + s * .16) + ' ' + f(y - s * .16) + ' ' + f(x + s) + ' ' + f(y) +
    'Q' + f(x + s * .16) + ' ' + f(y + s * .16) + ' ' + f(x) + ' ' + f(y + s) + 'Q' + f(x - s * .16) + ' ' + f(y + s * .16) + ' ' +
    f(x - s) + ' ' + f(y) + 'Q' + f(x - s * .16) + ' ' + f(y - s * .16) + ' ' + f(x) + ' ' + f(y - s) + 'Z" fill="' + fill + '" opacity="' + (op || 1) + '"/>';
  function dots(r, n, x0, y0, x1, y1, r0, r1, fill, op0, op1){
    let s = '<g fill="' + fill + '">';
    for(let i = 0; i < n; i++){
      s += '<circle cx="' + f(x0 + r() * (x1 - x0)) + '" cy="' + f(y0 + r() * (y1 - y0)) + '" r="' + f(r0 + r() * (r1 - r0)) +
           '" opacity="' + f((op0 + r() * (op1 - op0)) * 100) / 100 + '"/>';
    }
    return s + '</g>';
  }
  /* 花瓣／葉片 */
  const leaf = (x, y, len, ang, fill, op) =>
    '<path transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(ang) + ')" d="M0 0C' + f(len * .3) + ' ' + f(-len * .16) + ' ' +
    f(len * .7) + ' ' + f(-len * .14) + ' ' + f(len) + ' 0C' + f(len * .7) + ' ' + f(len * .14) + ' ' + f(len * .3) + ' ' + f(len * .16) + ' 0 0Z" fill="' + fill + '"' +
    (op ? ' opacity="' + op + '"' : '') + '/>';
  const wrap = (defs, body) =>
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice"><defs>' + defs + '</defs>' + body + '</svg>';
  const bg = id => '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + ')"/>';

  /* ── 12 個場景 ─────────────────────────────────────────── */
  const ART = {};

  ART['星海戰域'] = function(){
    const r = rng(11);
    let d = lin('sk', [[0,'#a9a2ff'],[.45,'#d4c6ff'],[1,'#ffd9ec']]) +
      rad('nb1', [[0,'#ffb3dc',.7],[1,'#ffb3dc',0]]) + rad('nb2', [[0,'#9fd7ff',.65],[1,'#9fd7ff',0]]) +
      lin('pl', [[0,'#fff1b8'],[1,'#ff9fb0']], 1, 1) + lin('isl', [[0,'#b8a6f5'],[1,'#8c7ddb']]) +
      lin('cr', [[0,'#e8fbff'],[1,'#8fd3ff']], 1, 1) + lin('hz', [[0,'#fff',0],[1,'#fff',.7]]);
    let b = bg('sk') + glow(1150, 260, 520, 330, 'nb1') + glow(330, 200, 460, 300, 'nb2') + glow(760, 620, 420, 200, 'nb1');
    b += dots(r, 90, 0, 0, W, 640, 1, 2.6, '#fff', .35, .95);
    for(let i = 0; i < 12; i++) b += sparkle(r() * W, r() * 560, 6 + r() * 16, i % 3 ? '#fff' : '#fff6c8', .7 + r() * .3);
    // 帶環行星
    b += '<g transform="translate(1290 200) rotate(-18)">' +
         '<ellipse rx="180" ry="40" fill="none" stroke="#fff" stroke-width="10" opacity=".5"/>' +
         '<circle r="96" fill="url(#pl)"/>' +
         '<path d="M-90 -28 Q0 -46 90 -28" stroke="#fff" stroke-width="10" fill="none" opacity=".35"/>' +
         '<path d="M-96 10 Q0 -6 96 10" stroke="#ffd0d8" stroke-width="14" fill="none" opacity=".55"/>' +
         '<path d="M-180 0 A180 40 0 0 0 180 0" fill="none" stroke="#fff" stroke-width="10" opacity=".9"/></g>';
    b += '<circle cx="250" cy="150" r="38" fill="#fff8dc"/><circle cx="238" cy="140" r="8" fill="#f3e3b8"/><circle cx="262" cy="166" r="6" fill="#f3e3b8"/>';
    // 浮空島
    [[260, 720, 1.1], [820, 790, 1.5], [1380, 700, 1.0]].forEach(function(p){
      const [x, y, s] = p;
      b += '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
        '<path d="M-150 0 Q-110 120 -20 170 Q10 120 40 150 Q110 90 150 0Z" fill="url(#isl)"/>' +
        '<ellipse cx="0" cy="0" rx="152" ry="26" fill="#d9ccff"/><ellipse cx="0" cy="-6" rx="140" ry="18" fill="#efe8ff"/>' +
        '<path d="M-60 -6 L-44 -86 L-28 -6Z" fill="url(#cr)"/><path d="M-30 -6 L-14 -56 L0 -6Z" fill="#c4ecff"/>' +
        '<path d="M50 -6 L66 -70 L82 -6Z" fill="url(#cr)"/><path d="M-44 -86 L-38 -10 L-52 -10Z" fill="#fff" opacity=".6"/></g>';
    });
    b += '<rect y="700" width="' + W + '" height="200" fill="url(#hz)"/>';
    return wrap(d, b);
  };

  ART['熔岩火山'] = function(){
    const r = rng(23);
    let d = lin('sk', [[0,'#ffe6c8'],[.55,'#ffc9ad'],[1,'#ffb3a4']]) +
      rad('gl', [[0,'#fff1a8',.95],[.4,'#ffb25c',.55],[1,'#ff8a5c',0]]) +
      lin('vo', [[0,'#c9706e'],[1,'#a95560']]) + lin('lv', [[0,'#fff2a0'],[1,'#ff7a3a']]) +
      lin('fg', [[0,'#b45b62'],[1,'#8f4352']]);
    let b = bg('sk') + peaks(r, 640, 220, 7, '#f4b9a7') + peaks(r, 700, 150, 9, '#eaa294');
    b += glow(800, 300, 360, 260, 'gl');
    for(let i = 0; i < 7; i++) b += cloud(700 + i * 34 - r() * 40, 230 - i * 34, .8 + i * .22, i % 2 ? '#fff3ea' : '#f7d9d0', .9 - i * .06);
    b += '<path d="M260 900 C430 760 600 520 700 330 Q800 300 900 330 C1000 520 1170 760 1340 900Z" fill="url(#vo)"/>';
    b += '<path d="M800 318 Q850 322 900 330 C1000 520 1170 760 1340 900 L960 900 C900 700 860 500 800 318Z" fill="#9a4c58" opacity=".35"/>';
    b += '<path d="M700 330 Q800 300 900 330 Q800 352 700 330Z" fill="#ffe28a"/>';
    b += '<path d="M760 340 C740 460 690 560 640 700" stroke="#c96a68" stroke-width="22" fill="none" opacity=".45"/>';
    // 熔岩流
    ['M790 338 C780 470 720 560 690 700 C680 760 640 820 610 900', 'M830 338 C850 450 900 560 930 660 C950 740 1000 820 1040 900',
     'M810 340 C810 420 800 500 820 580'].forEach(function(p){
      b += '<path d="' + p + '" stroke="#ff8a3d" stroke-width="22" fill="none" stroke-linecap="round"/>' +
           '<path d="' + p + '" stroke="url(#lv)" stroke-width="9" fill="none" stroke-linecap="round"/>';
    });
    b += hills(r, 840, 70, 6, 'url(#fg)');
    for(let i = 0; i < 9; i++){
      const x = r() * W, y = 830 + r() * 50;
      b += '<path d="M' + f(x) + ' ' + f(y) + 'l' + f(20 + r() * 30) + ' ' + f(-8 + r() * 16) + 'l' + f(18 + r() * 24) + ' ' + f(6 + r() * 10) + '" stroke="#ffb35c" stroke-width="4" fill="none" stroke-linecap="round" opacity=".85"/>';
    }
    b += dots(r, 60, 300, 120, 1300, 860, 1.5, 4.5, '#ffd36b', .5, 1);
    b += dots(r, 24, 400, 200, 1200, 700, 1, 2.5, '#fff', .6, 1);
    return wrap(d, b);
  };

  ART['月下竹林'] = function(){
    const r = rng(37);
    let d = lin('sk', [[0,'#c9ece4'],[.5,'#e3f6ea'],[1,'#f3fbe9']]) +
      rad('mh', [[0,'#fffbe6',.95],[.35,'#fffbe6',.5],[1,'#fffbe6',0]]) +
      rad('ff', [[0,'#fff9b0',1],[1,'#fff9b0',0]]) + lin('mist', [[0,'#fff',0],[1,'#fff',.85]]);
    let b = bg('sk') + glow(1170, 200, 300, 300, 'mh') + '<circle cx="1170" cy="200" r="104" fill="#fffdf0"/>' +
            '<circle cx="1140" cy="180" r="14" fill="#f3efd6"/><circle cx="1200" cy="226" r="10" fill="#f3efd6"/>';
    const stalk = function(x, w, col, node, hi, lean){
      let s = '<g transform="translate(' + f(x) + ' 0) rotate(' + f(lean) + ' 0 900)">' +
              '<rect x="' + f(-w / 2) + '" y="-40" width="' + f(w) + '" height="980" rx="' + f(w / 2) + '" fill="' + col + '"/>';
      if(hi) s += '<rect x="' + f(-w / 2 + w * .18) + '" y="-40" width="' + f(w * .16) + '" height="980" fill="' + hi + '" opacity=".55"/>';
      for(let y = 60 + r() * 60; y < 900; y += 110 + r() * 40){
        s += '<rect x="' + f(-w / 2 - 1) + '" y="' + f(y) + '" width="' + f(w + 2) + '" height="' + f(Math.max(3, w * .14)) + '" rx="2" fill="' + node + '"/>';
        if(r() < .45){
          const dir = r() < .5 ? -1 : 1;
          for(let k = 0; k < 3; k++) s += leaf(dir * w / 2, y, w * 2.4 + r() * w, dir < 0 ? 180 + 20 + k * 22 : -20 - k * 22, col);
        }
      }
      return s + '</g>';
    };
    for(let i = 0; i < 16; i++) b += stalk(i * 104 + r() * 60, 14 + r() * 6, '#c4e9d2', '#a9dbbd', null, (r() - .5) * 3);
    b += '<rect y="420" width="' + W + '" height="200" fill="#fff" opacity=".25"/>';
    for(let i = 0; i < 9; i++) b += stalk(i * 190 + r() * 90, 24 + r() * 8, '#95d4ad', '#76c194', '#c5f0d5', (r() - .5) * 4);
    b += hills(r, 800, 60, 5, '#e2f5e6') + '<rect y="640" width="' + W + '" height="260" fill="url(#mist)"/>';
    [[40, 46, -2], [190, 40, 1.5], [1430, 50, 2], [1560, 42, -1.5]].forEach(function(p){
      b += stalk(p[0], p[1], '#5db887', '#469f70', '#8fe0b0', p[2]);
    });
    for(let i = 0; i < 22; i++){
      const x = 200 + r() * 1200, y = 300 + r() * 520;
      b += glow(x, y, 14, 14, 'ff') + '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="2.6" fill="#fffbd0"/>';
    }
    return wrap(d, b);
  };

  ART['冰封凍原'] = function(){
    const r = rng(41);
    let d = lin('sk', [[0,'#c6e6ff'],[.5,'#e3f4ff'],[1,'#f6fbff']]) +
      lin('au1', [[0,'#8ff0d0',0],[.5,'#8ff0d0',.75],[1,'#8ff0d0',0]], 1, 0) +
      lin('au2', [[0,'#c7b2ff',0],[.5,'#c7b2ff',.6],[1,'#c7b2ff',0]], 1, 0) +
      lin('ice', [[0,'#e9f8ff'],[1,'#8fc9ef']], 1, 1) + lin('gr', [[0,'#fff'],[1,'#e2f1ff']]);
    let b = bg('sk');
    b += '<path d="M-50 230 C250 120 520 300 820 190 C1100 90 1350 250 1650 140 L1650 220 C1350 330 1100 170 820 270 C520 380 250 200 -50 310Z" fill="url(#au1)"/>';
    b += '<path d="M-50 140 C300 60 600 210 900 120 C1200 40 1400 160 1650 80 L1650 130 C1400 210 1200 90 900 170 C600 260 300 110 -50 190Z" fill="url(#au2)"/>';
    b += dots(r, 40, 0, 0, W, 400, 1, 2, '#fff', .5, 1);
    b += peaks(r, 640, 300, 6, '#b7d5f0', '#fff') + peaks(r, 720, 200, 8, '#cfe3f7', '#fff');
    b += hills(r, 790, 50, 5, 'url(#gr)');
    // 冰晶
    [[150, 900, 1.3], [330, 900, .8], [1270, 900, 1.1], [1460, 900, 1.5], [1560, 900, .7]].forEach(function(p){
      const [x, y, s] = p;
      b += '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
        '<path d="M-70 0 L-40 -190 L-10 0Z" fill="url(#ice)"/><path d="M-30 0 L10 -280 L50 0Z" fill="url(#ice)"/>' +
        '<path d="M30 0 L70 -150 L95 0Z" fill="url(#ice)"/><path d="M10 -280 L18 -20 L-6 -20Z" fill="#fff" opacity=".7"/>' +
        '<path d="M-40 -190 L-34 -20 L-48 -20Z" fill="#fff" opacity=".6"/></g>';
    });
    for(let i = 0; i < 26; i++){
      const x = r() * W, y = r() * 860, s = 3 + r() * 6;
      b += '<g stroke="#fff" stroke-width="' + f(s / 3.5) + '" stroke-linecap="round" opacity="' + f(.55 + r() * .45) + '">' +
           [0, 60, 120].map(a => '<line transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + a + ')" x1="' + (-s) + '" x2="' + s + '"/>').join('') + '</g>';
    }
    b += dots(r, 60, 0, 0, W, H, 1.5, 3.5, '#fff', .5, .95);
    return wrap(d, b);
  };

  ART['雷雲風暴'] = function(){
    const r = rng(53);
    let d = lin('sk', [[0,'#bdb2ee'],[.55,'#d9d1fa'],[1,'#efeaff']]) +
      rad('bo', [[0,'#fffbd0',.95],[1,'#fffbd0',0]]) + lin('fg', [[0,'#a597dd'],[1,'#8a7cc9']]);
    let b = bg('sk') + peaks(r, 720, 240, 6, '#c7bdf0') + peaks(r, 780, 140, 9, '#b6aae6');
    // 雨絲
    let rain = '<g stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".35">';
    for(let i = 0; i < 90; i++){ const x = r() * 1800 - 100, y = r() * 900; rain += '<line x1="' + f(x) + '" y1="' + f(y) + '" x2="' + f(x - 26) + '" y2="' + f(y + 70) + '"/>'; }
    b += rain + '</g>';
    // 閃電
    [[420, 170, 1], [1180, 140, 1.25], [880, 210, .7]].forEach(function(p){
      const [x, y, s] = p;
      const bolt = 'M0 0 L-46 150 L-6 150 L-40 300 L60 110 L16 110 L46 0Z';
      b += glow(x, y + 160 * s, 150 * s, 200 * s, 'bo') +
        '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="' + bolt + '" fill="#fff36b" stroke="#fffbe0" stroke-width="10" stroke-linejoin="round" paint-order="stroke"/>';
    });
    // 厚雲
    for(let i = 0; i < 9; i++) b += cloud(i * 200 - 40 + r() * 60, 70 + r() * 70, 1.6 + r() * .8, i % 2 ? '#c9bff2' : '#b2a6e6', 1);
    for(let i = 0; i < 8; i++) b += cloud(i * 220 + r() * 80, 40 + r() * 40, 1.3 + r() * .6, '#e8e3ff', .95);
    b += hills(r, 830, 70, 5, 'url(#fg)');
    return wrap(d, b);
  };

  ART['黃昏廢墟'] = function(){
    const r = rng(67);
    let d = lin('sk', [[0,'#f4c3da'],[.5,'#ffd3bb'],[1,'#ffe8c4']]) +
      rad('sun', [[0,'#fff6d0',1],[.35,'#ffe4b0',.7],[1,'#ffd0b0',0]]) +
      lin('col', [[0,'#e8b7c2'],[1,'#c98d9d']], 1, 0) + lin('fg', [[0,'#e2a2a8'],[1,'#c98390']]);
    let b = bg('sk') + glow(800, 560, 520, 360, 'sun') + '<circle cx="800" cy="560" r="140" fill="#fff4cf"/>' +
      '<rect x="640" y="560" width="320" height="10" fill="#ffe0b8"/><rect x="660" y="590" width="280" height="9" fill="#ffe0b8"/>';
    b += hills(r, 700, 90, 6, '#f1b9b7') + hills(r, 760, 60, 7, '#eaa9ad');
    const column = function(x, h, broken, w){
      w = w || 60;
      let top = broken ? 'M' + f(x - w / 2) + ' ' + f(900 - h) + 'L' + f(x - w / 6) + ' ' + f(900 - h - 26) + 'L' + f(x + w / 8) + ' ' + f(900 - h - 6) + 'L' + f(x + w / 2) + ' ' + f(900 - h - 34)
                       : 'M' + f(x - w / 2) + ' ' + f(900 - h) + 'L' + f(x + w / 2) + ' ' + f(900 - h);
      let s = '<path d="' + top + 'L' + f(x + w / 2) + ' 900L' + f(x - w / 2) + ' 900Z" fill="url(#col)"/>';
      for(let k = -1; k <= 1; k++) s += '<rect x="' + f(x + k * w / 4 - 2) + '" y="' + f(900 - h + 10) + '" width="4" height="' + f(h - 10) + '" fill="#b97f90" opacity=".35"/>';
      if(!broken) s += '<rect x="' + f(x - w / 2 - 14) + '" y="' + f(900 - h - 24) + '" width="' + f(w + 28) + '" height="26" rx="4" fill="#d9a3b0"/>';
      return s;
    };
    b += column(120, 380, false) + column(240, 300, true) + column(1330, 420, false, 66) + column(1470, 260, true, 66);
    // 拱門
    b += '<path d="M480 900 L480 610 Q560 520 640 610 L640 900 L600 900 L600 625 Q560 575 520 625 L520 900Z" fill="#d79aaa"/>';
    b += '<path d="M960 900 L960 650 L1120 650 L1120 900 L1080 900 L1080 700 Q1040 660 1000 700 L1000 900Z" fill="#cf93a3"/>';
    b += hills(r, 850, 40, 6, 'url(#fg)');
    for(let i = 0; i < 26; i++){ const x = r() * W, y = 835 + r() * 50; b += leaf(x, y, 20 + r() * 16, -60 - r() * 60, '#d98e9a'); }
    for(let i = 0; i < 7; i++){ const x = 400 + r() * 800, y = 140 + r() * 220, s = 10 + r() * 8;
      b += '<path d="M' + f(x - s) + ' ' + f(y) + 'Q' + f(x - s / 2) + ' ' + f(y - s / 2) + ' ' + f(x) + ' ' + f(y) + 'Q' + f(x + s / 2) + ' ' + f(y - s / 2) + ' ' + f(x + s) + ' ' + f(y) + '" stroke="#c48298" stroke-width="3" fill="none" stroke-linecap="round"/>'; }
    return wrap(d, b);
  };

  ART['深海遺跡'] = function(){
    const r = rng(79);
    let d = lin('sk', [[0,'#c4f4f0'],[.5,'#a3dcee'],[1,'#8cc4e6']]) +
      lin('ray', [[0,'#fff',.55],[1,'#fff',0]]) + lin('pil', [[0,'#9bd3dc'],[1,'#6fb1c2']], 1, 0) + lin('sand', [[0,'#d6f0e4'],[1,'#b9e0d6']]);
    let b = bg('sk');
    for(let i = 0; i < 6; i++){ const x = 150 + i * 260 + r() * 80;
      b += '<path d="M' + f(x) + ' -20 L' + f(x + 90) + ' -20 L' + f(x + 260) + ' 900 L' + f(x + 60) + ' 900Z" fill="url(#ray)" opacity="' + f(.35 + r() * .35) + '"/>'; }
    b += hills(r, 700, 80, 6, '#9fd3e3');
    // 沉沒神殿
    b += '<g fill="url(#pil)"><rect x="560" y="430" width="480" height="40" rx="8"/><path d="M540 430 L800 330 L1060 430Z"/>';
    [600, 700, 900, 1000].forEach(function(x, i){ b += '<rect x="' + x + '" y="' + (470 + (i === 2 ? 60 : 0)) + '" width="44" height="' + (i === 2 ? 310 : 370) + '"/>'; });
    b += '</g><rect x="880" y="490" width="70" height="26" rx="6" fill="#86c3cf" transform="rotate(14 915 503)"/>';
    b += hills(r, 820, 60, 6, 'url(#sand)');
    // 海草與珊瑚
    for(let i = 0; i < 14; i++){
      const x = r() * W, h = 120 + r() * 200, col = i % 3 ? '#6cc9a4' : '#4fb592';
      let p = 'M' + f(x) + ' 900';
      for(let y = 900, k = 0; y > 900 - h; y -= 40, k++) p += 'Q' + f(x + (k % 2 ? 22 : -22)) + ' ' + f(y - 20) + ' ' + f(x) + ' ' + f(y - 40);
      b += '<path d="' + p + '" stroke="' + col + '" stroke-width="' + f(10 + r() * 6) + '" fill="none" stroke-linecap="round"/>';
    }
    [[260, 900], [1300, 900], [1460, 900]].forEach(function(p){
      const [x, y] = p;
      b += '<g stroke="#ff9fb8" stroke-width="12" stroke-linecap="round" fill="none"><path d="M' + x + ' ' + y + 'L' + x + ' ' + (y - 110) + '"/><path d="M' + x + ' ' + (y - 60) + 'Q' + (x - 40) + ' ' + (y - 80) + ' ' + (x - 46) + ' ' + (y - 130) + '"/>' +
           '<path d="M' + x + ' ' + (y - 40) + 'Q' + (x + 44) + ' ' + (y - 60) + ' ' + (x + 50) + ' ' + (y - 120) + '"/></g>';
    });
    // 魚與氣泡
    for(let i = 0; i < 7; i++){ const x = 100 + r() * 1400, y = 120 + r() * 420, s = .6 + r() * .7, dir = r() < .5 ? 1 : -1;
      b += '<path transform="translate(' + f(x) + ' ' + f(y) + ') scale(' + f(s * dir) + ' ' + f(s) + ')" d="M0 0 Q30 -22 60 0 Q30 22 0 0Z M58 0 L78 -14 L78 14Z" fill="#fff" opacity=".55"/>'; }
    for(let i = 0; i < 40; i++){ const x = r() * W, y = r() * H, rr = 3 + r() * 9;
      b += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(rr) + '" fill="#fff" fill-opacity=".18" stroke="#fff" stroke-width="2" stroke-opacity=".7"/>'; }
    return wrap(d, b);
  };

  ART['黃沙古城'] = function(){
    const r = rng(89);
    let d = lin('sk', [[0,'#ffe2a8'],[.55,'#fff0cc'],[1,'#fff6e0']]) + rad('sun', [[0,'#fffbe8',1],[1,'#fff3c4',0]]) +
      lin('wall', [[0,'#e2b37d'],[1,'#c98f5a']]);
    let b = bg('sk') + glow(1240, 200, 260, 260, 'sun') + '<circle cx="1240" cy="200" r="78" fill="#fffbea"/>';
    b += hills(r, 660, 70, 4, '#f7dca2');
    // 城牆與城樓
    let wall = '<g fill="url(#wall)"><rect x="0" y="560" width="1600" height="200"/>';
    for(let x = 0; x < 1600; x += 46) wall += '<rect x="' + x + '" y="536" width="28" height="30" rx="3"/>';
    wall += '</g><rect x="0" y="600" width="1600" height="6" fill="#c48852" opacity=".5"/><rect x="0" y="680" width="1600" height="6" fill="#c48852" opacity=".4"/>';
    b += wall;
    const tower = function(cx, s){
      return '<g transform="translate(' + cx + ' 560) scale(' + s + ')">' +
        '<rect x="-130" y="-120" width="260" height="120" fill="#d9a36c"/>' +
        '<path d="M-200 -120 Q-150 -128 -120 -170 L120 -170 Q150 -128 200 -120Z" fill="#a8604a"/>' +
        '<rect x="-100" y="-210" width="200" height="44" fill="#e3b27c"/>' +
        '<path d="M-160 -206 Q-120 -212 -100 -250 L100 -250 Q120 -212 160 -206Z" fill="#a8604a"/>' +
        '<rect x="-60" y="-110" width="24" height="40" fill="#b97a4c"/><rect x="36" y="-110" width="24" height="40" fill="#b97a4c"/>' +
        '<path d="M-60 200 L-60 70 Q0 10 60 70 L60 200Z" fill="#9b5e3c"/></g>';
    };
    b += tower(800, 1);
    [[560, '#ef6a5a'], [1040, '#ef6a5a'], [300, '#f0a03c'], [1300, '#f0a03c']].forEach(function(p){
      b += '<line x1="' + p[0] + '" y1="410" x2="' + p[0] + '" y2="560" stroke="#8f5a3a" stroke-width="5"/>' +
           '<path d="M' + p[0] + ' 414 Q' + (p[0] + 40) + ' 424 ' + (p[0] + 70) + ' 414 L' + (p[0] + 70) + ' 470 Q' + (p[0] + 40) + ' 480 ' + p[0] + ' 470Z" fill="' + p[1] + '"/>';
    });
    b += hills(r, 790, 60, 4, '#f3cd85') + hills(r, 860, 50, 3, '#ecbd6c');
    for(let i = 0; i < 5; i++){ const x = 200 + r() * 1200, y = 100 + r() * 200, s = 9 + r() * 6;
      b += '<path d="M' + f(x - s) + ' ' + f(y) + 'Q' + f(x - s / 2) + ' ' + f(y - s / 2) + ' ' + f(x) + ' ' + f(y) + 'Q' + f(x + s / 2) + ' ' + f(y - s / 2) + ' ' + f(x + s) + ' ' + f(y) + '" stroke="#c99a5a" stroke-width="3" fill="none" stroke-linecap="round"/>'; }
    b += dots(r, 50, 0, 600, W, H, 1, 2.6, '#fff4d6', .5, .9);
    return wrap(d, b);
  };

  ART['櫻花庭園'] = function(){
    const r = rng(97);
    let d = lin('sk', [[0,'#ffdcec'],[.55,'#ffeef5'],[1,'#fff7f0']]) + lin('pond', [[0,'#d9f0fb'],[1,'#bfe3f5']]) +
      lin('tr', [[0,'#c79595'],[1,'#a87777']], 1, 0);
    let b = bg('sk');
    b += '<path d="M380 600 L760 260 Q800 236 840 260 L1220 600Z" fill="#f2d3e6"/><path d="M718 298 L760 260 Q800 236 840 260 L882 298 Q850 316 820 300 Q800 318 780 300 Q750 316 718 298Z" fill="#fff"/>';
    b += hills(r, 640, 50, 5, '#f7dce8') + hills(r, 720, 40, 6, '#f4cfdf');
    // 鳥居
    b += '<g fill="#ff6f61"><rect x="1120" y="420" width="26" height="330"/><rect x="1294" y="420" width="26" height="330"/>' +
         '<rect x="1100" y="440" width="240" height="20"/><path d="M1060 392 Q1220 410 1380 392 L1376 418 Q1220 432 1064 418Z"/></g>' +
         '<path d="M1056 386 Q1220 404 1384 386 L1380 396 Q1220 414 1060 396Z" fill="#4a3a52"/>';
    // 池塘
    b += '<ellipse cx="620" cy="800" rx="300" ry="54" fill="url(#pond)"/><ellipse cx="560" cy="792" rx="80" ry="6" fill="#fff" opacity=".7"/><ellipse cx="700" cy="812" rx="50" ry="4" fill="#fff" opacity=".6"/>';
    // 石燈籠
    b += '<g fill="#d8c6cf"><rect x="250" y="760" width="70" height="20" rx="4"/><rect x="272" y="680" width="26" height="82"/><rect x="242" y="640" width="86" height="44" rx="6"/>' +
         '<path d="M226 646 Q285 600 344 646Z"/></g><rect x="268" y="652" width="34" height="22" rx="4" fill="#fff6c8"/>';
    // 櫻花樹
    const tree = function(x, y, s, flip){
      let t = '<g transform="translate(' + x + ' ' + y + ') scale(' + (flip ? -s : s) + ' ' + s + ')">' +
        '<path d="M-14 0 C-10 -80 -30 -150 -80 -210 L-60 -220 C-20 -170 0 -130 6 -90 C20 -150 60 -190 120 -210 L126 -194 C70 -170 30 -120 18 -60 C16 -30 16 -10 14 0Z" fill="url(#tr)"/>';
      for(let i = 0; i < 26; i++){
        const cx = -110 + r() * 260, cy = -330 + r() * 160, rr = 30 + r() * 30;
        t += '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(rr) + '" fill="' + ['#ffc6dc', '#ffd9e8', '#ffb3cf', '#ffe6ef'][i % 4] + '"/>';
      }
      return t + '</g>';
    };
    b += tree(150, 900, 1.25, false) + tree(1520, 900, 1.15, true) + tree(880, 740, .55, false);
    b += hills(r, 860, 30, 6, '#f6d6e2');
    for(let i = 0; i < 46; i++) b += leaf(r() * W, r() * 880, 10 + r() * 10, r() * 360, ['#ffb3cf', '#ffc6dc', '#ff9fc0'][i % 3], .9);
    return wrap(d, b);
  };

  ART['軌道要塞'] = function(){
    const r = rng(103);
    let d = lin('sk', [[0,'#d9e4fa'],[.55,'#ecf1fb'],[1,'#f6f8fd']]) + lin('pl', [[0,'#bfe0ff'],[1,'#7fb4ef']]) +
      rad('atm', [[.82,'#ffffff',0],[.9,'#ffffff',.85],[1,'#ffffff',0]]) + lin('hull', [[0,'#eef3fb'],[1,'#b8c6e3']]);
    let b = bg('sk');
    let grid = '<g stroke="#c4d2ee" stroke-width="1.5" opacity=".6">';
    for(let x = 0; x <= W; x += 80) grid += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="900"/>';
    for(let y = 0; y <= H; y += 80) grid += '<line x1="0" y1="' + y + '" x2="1600" y2="' + y + '"/>';
    b += grid + '</g>' + dots(r, 50, 0, 0, W, 520, 1, 2.2, '#fff', .6, 1);
    // 行星弧面
    b += glow(800, 1820, 1240, 1240, 'atm') + '<circle cx="800" cy="1820" r="1120" fill="url(#pl)"/>';
    for(let i = 0; i < 8; i++) b += '<ellipse cx="' + f(150 + r() * 1300) + '" cy="' + f(760 + r() * 120) + '" rx="' + f(80 + r() * 140) + '" ry="' + f(10 + r() * 12) + '" fill="#fff" opacity=".55"/>';
    // 太空站
    b += '<g transform="translate(800 300)">' +
      '<ellipse rx="330" ry="70" fill="none" stroke="#c8d4ee" stroke-width="26"/><ellipse rx="330" ry="70" fill="none" stroke="#fff" stroke-width="8"/>' +
      '<rect x="-470" y="-22" width="940" height="44" rx="22" fill="url(#hull)"/>' +
      '<g fill="#8fb0ea" stroke="#fff" stroke-width="3">' +
      [-600, -520, 440, 520].map(x => '<rect x="' + x + '" y="-90" width="80" height="180" rx="6"/>').join('') + '</g>' +
      '<circle r="96" fill="url(#hull)"/><circle r="62" fill="#dbe6fb"/><circle r="30" fill="#fff3a6"/>';
    for(let i = 0; i < 10; i++) b += '<circle cx="' + (-430 + i * 96) + '" cy="0" r="6" fill="#fff3a6"/>';
    b += '</g>';
    // 浮動平台
    [[230, 560, .9], [1390, 520, 1.1]].forEach(function(p){
      b += '<g transform="translate(' + p[0] + ' ' + p[1] + ') scale(' + p[2] + ')"><path d="M-80 0 L-40 -40 L40 -40 L80 0 L40 40 L-40 40Z" fill="url(#hull)"/>' +
           '<path d="M-80 0 L80 0" stroke="#fff" stroke-width="4"/><circle r="10" fill="#9fd0ff"/></g>';
    });
    return wrap(d, b);
  };

  ART['血月鬼域'] = function(){
    const r = rng(113);
    let d = lin('sk', [[0,'#e2b9d6'],[.55,'#efd0e3'],[1,'#f7e4ee']]) + rad('mh', [[0,'#ffb3c4',.8],[1,'#ffb3c4',0]]) +
      rad('wisp', [[0,'#e6f8ff',1],[.45,'#a8e1ff',.8],[1,'#a8e1ff',0]]);
    let b = bg('sk') + glow(800, 280, 420, 380, 'mh') + '<circle cx="800" cy="280" r="170" fill="#ff9db2"/>' +
      '<circle cx="760" cy="250" r="160" fill="#ffb6c6"/>' +
      '<circle cx="720" cy="220" r="26" fill="#ff9db2" opacity=".7"/><circle cx="830" cy="320" r="34" fill="#ff9db2" opacity=".6"/><circle cx="700" cy="330" r="16" fill="#ff9db2" opacity=".6"/>';
    b += hills(r, 700, 70, 6, '#e3bfd6') + hills(r, 780, 50, 7, '#d8aecb');
    const tree = function(x, s, flip){
      return '<g transform="translate(' + x + ' 900) scale(' + (flip ? -s : s) + ' ' + s + ')" fill="#a77d9c">' +
        '<path d="M-20 0 C-14 -120 -30 -220 -16 -330 C-60 -380 -110 -390 -150 -440 L-140 -452 C-100 -410 -60 -400 -14 -360 C-6 -420 20 -460 70 -500 L78 -488 C34 -450 10 -400 8 -340 C40 -360 90 -370 130 -400 L136 -388 C96 -356 50 -340 10 -310 C16 -200 22 -100 22 0Z"/></g>';
    };
    b += tree(120, 1.35, false) + tree(1490, 1.25, true) + tree(1330, .7, false);
    // 墓碑與鳥居
    [[420, 800], [520, 820], [1080, 810], [1180, 790]].forEach(function(p){
      b += '<path d="M' + (p[0] - 30) + ' ' + (p[1] + 60) + 'L' + (p[0] - 30) + ' ' + p[1] + 'Q' + p[0] + ' ' + (p[1] - 40) + ' ' + (p[0] + 30) + ' ' + p[1] + 'L' + (p[0] + 30) + ' ' + (p[1] + 60) + 'Z" fill="#c69cbb"/>';
    });
    b += '<g fill="#b98aad"><rect x="700" y="600" width="18" height="230"/><rect x="882" y="600" width="18" height="230"/><rect x="684" y="620" width="232" height="14"/><path d="M660 580 Q800 594 940 580 L936 602 Q800 614 664 602Z"/></g>';
    b += hills(r, 860, 30, 6, '#cfa3c2');
    // 鬼火
    for(let i = 0; i < 9; i++){ const x = 200 + r() * 1200, y = 380 + r() * 380, s = .7 + r() * .7;
      b += glow(x, y, 40 * s, 40 * s, 'wisp') + '<path transform="translate(' + f(x) + ' ' + f(y) + ') scale(' + f(s) + ')" d="M0 16 C-16 16 -18 0 -8 -10 C-8 -20 -2 -30 -6 -44 C8 -34 18 -20 16 -2 C22 -10 22 -18 20 -24 C28 -12 26 16 0 16Z" fill="#d6f2ff"/>' +
             '<ellipse cx="' + f(x) + '" cy="' + f(y + 4 * s) + '" rx="' + f(5 * s) + '" ry="' + f(7 * s) + '" fill="#fff"/>'; }
    for(let i = 0; i < 6; i++){ const x = 300 + r() * 1000, y = 90 + r() * 220, s = .6 + r() * .5;
      b += '<path transform="translate(' + f(x) + ' ' + f(y) + ') scale(' + f(s) + ')" d="M0 0 Q-14 -12 -30 -6 Q-22 0 -26 8 Q-12 2 0 10 Q12 2 26 8 Q22 0 30 -6 Q14 -12 0 0Z" fill="#9b6f90"/>'; }
    return wrap(d, b);
  };

  ART['翠綠平原'] = function(){
    const r = rng(127);
    let d = lin('sk', [[0,'#b8e2ff'],[.55,'#dcf1ff'],[1,'#f2fbff']]) + rad('sun', [[0,'#fffbe0',1],[1,'#fff6c8',0]]) +
      lin('path', [[0,'#fff3d6'],[1,'#f3dfb4']]);
    let b = bg('sk') + glow(260, 150, 230, 230, 'sun') + '<circle cx="260" cy="150" r="70" fill="#fffbe6"/>';
    [[520, 150, 1.4], [980, 110, 1.1], [1340, 190, 1.6], [180, 330, .9], [760, 300, .8]].forEach(p => { b += cloud(p[0], p[1], p[2], '#fff', .95); });
    b += hills(r, 620, 120, 4, '#c4ebc6') + hills(r, 700, 90, 5, '#a6e0a8');
    // 風車
    b += '<g transform="translate(1190 560)"><path d="M-26 0 L-16 -150 L16 -150 L26 0Z" fill="#f2dcc0" stroke="#d9bd9a" stroke-width="3"/><rect x="-8" y="-40" width="16" height="26" rx="8" fill="#c9a27a"/><path d="M-24 -150 L0 -186 L24 -150Z" fill="#f08a7a"/>' +
         '<g transform="translate(0 -158) rotate(18)" fill="#fffdf6">' + [0, 90, 180, 270].map(a => '<rect transform="rotate(' + a + ')" x="-11" y="-130" width="22" height="120" rx="4" stroke="#d9bd9a" stroke-width="3"/>').join('') +
         '</g><circle cy="-158" r="10" fill="#f08a7a"/></g>';
    b += hills(r, 790, 80, 5, '#86d38c');
    b += '<path d="M640 900 C700 820 860 790 880 740 C900 700 840 690 860 660 L900 660 C900 700 980 720 960 760 C930 820 820 860 820 900Z" fill="url(#path)"/>';
    // 圓樹
    [[180, 760, 1.2], [320, 790, .9], [1420, 770, 1.3], [1540, 800, 1]].forEach(function(p){
      b += '<g transform="translate(' + p[0] + ' ' + p[1] + ') scale(' + p[2] + ')"><rect x="-8" y="-20" width="16" height="70" rx="6" fill="#b48a6a"/>' +
           '<circle cy="-60" r="58" fill="#5fbf6e"/><circle cx="-26" cy="-80" r="30" fill="#7ad08a"/></g>';
    });
    b += hills(r, 870, 30, 6, '#74c97c');
    b += dots(r, 40, 0, 760, W, 900, 3, 6, '#fff7a8', .8, 1) + dots(r, 30, 0, 760, W, 900, 3, 6, '#ffc2d9', .8, 1) + dots(r, 20, 0, 760, W, 900, 3, 5, '#ffffff', .8, 1);
    return wrap(d, b);
  };

  /* 細紙紋：小張的雜訊圖鋪滿，讓平塗色塊有一點手感 */
  function grainTile(){
    const r = rng(7);
    let s = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">';
    for(let i = 0; i < 260; i++){
      s += '<rect x="' + f(r() * 180) + '" y="' + f(r() * 180) + '" width="' + f(1 + r() * 1.6) + '" height="' + f(1 + r() * 1.6) + '" fill="' +
           (r() < .5 ? '#ffffff' : '#5c5590') + '" opacity="' + f((r() < .5 ? .25 : .07) * 100) / 100 + '"/>';
    }
    return s + '</svg>';
  }
  const toUrl = svg => 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
  const CACHE = {};
  let GRAIN = null;
  return {
    names: Object.keys(ART),
    svg: name => ART[name] ? ART[name]() : '',
    /* 戰場背景：紙紋疊在插畫上 */
    image: function(name){
      if(!ART[name]) return '';
      if(!GRAIN) GRAIN = toUrl(grainTile());
      if(!CACHE[name]) CACHE[name] = toUrl(ART[name]());
      return GRAIN + ',' + CACHE[name];
    }
  };
})();
