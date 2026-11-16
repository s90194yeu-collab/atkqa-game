/* 把單人遊戲的角色資料與戰鬥常數匯出成 assets/duel/chars.json，給 Apps Script 的雙人對戰裁判使用。
   由 tools/build.py 自動呼叫；只讀 js/game/02-config.js 與 03-characters.js，不需要瀏覽器。
   這樣裁判和遊戲畫面用的是同一份角色數值與傷害常數，改角色時不必兩邊各改一次。 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const src = ['js/game/02-config.js', 'js/game/03-characters.js']
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n') +
  '\n;this.__out = {CONFIG, TYPE_CHART, ROLES, ROLE_BY_ID, ALL_CHARACTERS, accOf};';
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src, ctx, {filename: 'duel-export'});
const {CONFIG, TYPE_CHART, ROLES, ROLE_BY_ID, ALL_CHARACTERS, accOf} = ctx.__out;

const chars = ALL_CHARACTERS.map(function (c) {
  const role = ROLE_BY_ID[c.id] || 'balance';
  const r = ROLES[role] || ROLES.balance;
  return {
    id: c.id, name: c.name, u: c.universe, clan: c.clan || '',
    type: c.type, def: c.defType || c.type, role: role,
    hp: Math.round(c.hp * r.hp),
    up: c.isUpgrade ? 1 : 0, secret: c.secret ? 1 : 0,
    moves: (c.moves || []).map(function (m) {
      const o = {n: m.name, k: m.kind, t: m.type, p: m.power || 0};
      if (m.defense !== undefined) o.d = m.defense;
      let acc = (m.accFixed !== undefined) ? m.accFixed : accOf(m.power || 0);
      if (m.kind === 'aoe' && m.accFixed === undefined) acc = Math.max(35, acc - CONFIG.aoeAccPenalty);
      o.a = acc;
      return o;
    })
  };
});
const roles = {};
Object.keys(ROLES).forEach(function (k) {
  const r = ROLES[k];
  roles[k] = {name: r.name, atk: r.atk, hp: r.hp, crit: r.crit, eva: r.eva, acc: r.acc};
});
const cfg = {};
['critRate', 'critMulti', 'glanceRate', 'glanceMulti', 'counterRate', 'comboStep', 'comboMax',
 'varMin', 'varMax', 'aoeAccPenalty', 'accBase', 'accSlope', 'accFloor'].forEach(function (k) { cfg[k] = CONFIG[k]; });
const chart = {};
Object.keys(TYPE_CHART).forEach(function (k) {
  chart[k] = {good: TYPE_CHART[k].good || [], bad: TYPE_CHART[k].bad || [], none: TYPE_CHART[k].none || []};
});
const out = {v: 1, config: cfg, roles: roles, chart: chart, chars: chars};
fs.writeFileSync(path.join(ROOT, 'assets/duel/chars.json'), JSON.stringify(out));
console.log('[duel_export] ' + chars.length + ' 位角色 → assets/duel/chars.json');
