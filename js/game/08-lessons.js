/* 【08-lessons.js】課程選單、本機示範題庫
   遊戲程式依檔名編號依序載入（見 src/game.html），彼此共用全域變數；請勿更改編號順序。 */
/* ============================================================================
   課程選單：由試算表「課程」工作表提供，可切換不同題庫
   ========================================================================== */
let LESSONS = [], currentLesson = null;

function loadLessons(){
  if(!inGAS) return renderLessons([]);
  if(window.__watch) window.__watch('getLessons');
  google.script.run
    .withSuccessHandler(function(rows){
      if(window.__done) window.__done('getLessons');
      LESSONS = Array.isArray(rows) ? rows : []; renderLessons(LESSONS);
    })
    .withFailureHandler(function(e){
      if(window.__done) window.__done('getLessons');
      if(window.__bootErr) window.__bootErr('getLessons 失敗：', (e && e.message) || String(e));
      renderLessons([]);
    })
    .getLessons();
}

function renderLessons(list){
  const grid = $('lesson-grid');
  const info = $('lesson-info');
  const box = $('lesson-list'); box.innerHTML = '';

  if(!list.length){
    currentLesson = null;
    grid.hidden = true; info.hidden = true;
    const d = document.createElement('div'); d.className = 'lesson-empty';
    d.textContent = '目前使用預設題庫。老師可在試算表新增「課程」工作表，各課次就會出現在這個選單裡。';
    box.appendChild(d);
    $('lesson-hint').textContent = '';
    $('lesson-tag').textContent = '';
    loadRaid();
    return;
  }

  grid.hidden = false; info.hidden = false;
  $('lesson-hint').textContent = '共 ' + list.length + ' 課';
  grid.innerHTML = '';
  let idx = 0;
  list.forEach(function(L, i){
    const b = document.createElement('button');
    b.className = 'lg' + (i === 0 ? ' on' : '');
    b.dataset.i = String(i);
    const t = document.createElement('b'); t.textContent = L.name || L.id;
    const c = document.createElement('span'); c.textContent = (L.count || 0) + ' 題';
    b.append(t, c);
    const done = SEMESTER && SEMESTER.lessons &&
                 SEMESTER.lessons.filter(function(x){ return x.id === L.id; })[0];
    if(done){
      const m = document.createElement('i'); m.textContent = '最佳 ' + done.best;
      b.appendChild(m);
    }
    b.onclick = function(){
      grid.querySelectorAll('.lg').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on'); idx = i; pick(); sfx('select');
    };
    grid.appendChild(b);
  });

  const pick = function(){
    currentLesson = list[idx] || list[0];
    const L = currentLesson;
    info.innerHTML = '';
    if(L.desc){
      const d = document.createElement('div');
      d.textContent = L.desc;
      info.appendChild(d);
    }
    const d2 = document.createElement('div');
    const per = L.count ? Math.max(1, Math.ceil(L.count / CONFIG.rounds)) : 0;
    d2.innerHTML = L.count
      ? ('題庫 <b>' + L.count + '</b> 題　·　每回合 <b>' + per + '</b> 題　·　共 <b>' +
         CONFIG.rounds + '</b> 回合')
      : '這一課的題庫是空的，請老師確認試算表。';
    info.appendChild(d2);
    // 已完成的最佳成績
    if(SEMESTER && SEMESTER.lessons){
      const done = SEMESTER.lessons.filter(function(x){ return x.id === L.id; })[0];
      const d3 = document.createElement('div');
      d3.textContent = done
        ? ('你在這一課的最佳成績：' + done.best.toLocaleString() + ' 分（已挑戰 ' + done.plays + ' 次）')
        : '這一課還沒有成績，第一次挑戰就會登錄。';
      info.appendChild(d3);
    }
    $('lesson-tag').textContent = L.name || '';
    paintRaid(); loadRaid();
  };
  pick();
}

/* ============================================================================
   題庫
   ── 正式使用時由 Google 試算表提供；以下為離線示範題（可留作備援）
   ── 資料格式：{q:題幹, options:[選項…], answer:[正解文字…], exp:解析}
   ========================================================================== */
const LOCAL_BANK = [
  {q:"〈桃花源記〉：「晉太元中，武陵人，捕魚為業……」下列敘述適當的是：",options:["寫出時間地點皆為虛構","「忘」是進入桃花源的關鍵","「緣」字意思為攀爬","「逢」暗示純屬偶然機緣"],answer:["「忘」是進入桃花源的關鍵","「逢」暗示純屬偶然機緣"],exp:"忘路之遠近，無心而得；逢，不期而遇。「緣」為沿著。開頭有明確年號地名，非全然虛構筆法。"},
  {q:"〈桃花源記〉中「黃髮垂髫」，可用以代指老年人的是：",options:["黃髮","束髮","潘鬢","皓首"],answer:["黃髮","皓首"],exp:"黃髮、皓首指老人；束髮為男子成童之年；潘鬢典出潘岳，指兩鬢斑白、年華漸老，多用於中年。"},
  {q:"關於陶淵明，下列詩文吟詠對象為他的是：",options:["自謂羲皇人","生事不曾問，肯愧家中婦","莫怪先生懶折腰","耐寒唯有東籬菊"],answer:["自謂羲皇人","生事不曾問，肯愧家中婦","莫怪先生懶折腰"],exp:"前三者分別扣合陶淵明自比上古之民、不營生計、不為五斗米折腰；末句詠菊而非詠人。"},
  {q:"〈桃花源記〉一文所描述之季節，與下列何者相同？",options:["寒梅著花未","春眠不覺曉，處處聞啼鳥","玲瓏望秋月","晚來天欲雪"],answer:["春眠不覺曉，處處聞啼鳥"],exp:"「芳草鮮美，落英繽紛」為桃花盛開之春景。"},
  {q:"下列各組「」內的字，讀音前後相同的是：",options:["吹毛求「疵」／「齜」牙咧嘴","嘆「惋」／手「腕」","落英「繽」紛／「嬪」妃","土地平「曠」／個性粗「獷」"],answer:["嘆「惋」／手「腕」"],exp:"惋、腕皆讀ㄨㄢˋ。疵ㄘ／齜ㄗ；繽ㄅㄧㄣ／嬪ㄆㄧㄣˊ；曠ㄎㄨㄤˋ／獷ㄍㄨㄤˇ。"},
  {q:"〈桃花源記〉：「此人一一為具言所聞，皆嘆惋。」意謂桃源中人：",options:["對漁人的際遇感到欣羨","感嘆世事多變、亂離久而未平","嘆息漁人未能常居此地","對自己不知世事感到羞愧"],answer:["感嘆世事多變、亂離久而未平"],exp:"聽聞秦以後朝代更迭、戰亂相尋，故為之嘆惋。"},
  {q:"下列「」內詞語，古今意義不同的是：",options:["率「妻子」邑人來此絕境","阡陌「交通」，雞犬相聞","乃不知有漢，「無論」魏晉","「芳草」鮮美，落英繽紛"],answer:["率「妻子」邑人來此絕境","阡陌「交通」，雞犬相聞","乃不知有漢，「無論」魏晉"],exp:"妻子＝妻與子女；交通＝交錯相通；無論＝更不必說。芳草古今同義。"},
  {q:"關於「便『要』還家，設酒殺雞作食」，敘述正確的是：",options:["「要」意為邀請","「要」在此讀作ㄧㄠ","「要」與「要求」之「要」同義","「要」為通同字，同「邀」"],answer:["「要」意為邀請","「要」在此讀作ㄧㄠ","「要」為通同字，同「邀」"],exp:"要通「邀」，讀ㄧㄠ，邀請之意，與「要求」（ㄧㄠˋ）不同。"},
  {q:"下列作品確為陶淵明所作的是：",options:["〈五柳先生傳〉","〈歸去來兮辭〉","〈醉翁亭記〉","〈飲酒〉詩"],answer:["〈五柳先生傳〉","〈歸去來兮辭〉","〈飲酒〉詩"],exp:"〈醉翁亭記〉為北宋歐陽脩所作。"},
  {q:"「初極狹，才通人；復行數十步，豁然開朗。」其中「豁然開朗」的意涵，敘述正確的是：",options:["由狹隘幽暗轉為開闊明亮","可引申指心中疑惑頓時明白","與「茅塞頓開」意思相近","專指道路寬廣筆直，無他義"],answer:["由狹隘幽暗轉為開闊明亮","可引申指心中疑惑頓時明白","與「茅塞頓開」意思相近"],exp:"本義寫空間由窄而寬，後可引申為心境或情勢忽然明朗。"},
  {q:"漁人「處處誌之」，其後「尋向所誌，遂迷不復得路」。此一安排的作用是：",options:["暗示桃花源乃寄託理想的虛構之境","呼應桃源人「不足為外人道也」之囑","反襯漁人背信，終不可再得","說明漁人記性不佳，做記號失敗"],answer:["暗示桃花源乃寄託理想的虛構之境","呼應桃源人「不足為外人道也」之囑","反襯漁人背信，終不可再得"],exp:"迷不復得路，使桃源由實入虛，強化理想境地不可求的意味。"},
  {q:"由「自云先世避秦時亂……乃不知有漢，無論魏晉」可推知：",options:["桃源中人於秦末避亂而入","與外界隔絕約五、六百年","曾親身經歷漢、魏、晉三朝","對朝代更迭一無所知"],answer:["桃源中人於秦末避亂而入","與外界隔絕約五、六百年","對朝代更迭一無所知"],exp:"自秦末至晉太元約五、六百年；正因隔絕，故不曾經歷漢魏晉。"},
  {q:"下列各組「」內的字，讀音前後不相同的是：",options:["便「舍」船／屋「舍」儼然","「怡」然自樂／「貽」笑大方","「豁」然開朗／「豁」出去","阡「陌」／「莫」名其妙"],answer:["便「舍」船／屋「舍」儼然","「豁」然開朗／「豁」出去"],exp:"舍ㄕㄜˇ（捨棄）／舍ㄕㄜˋ（房屋）；豁ㄏㄨㄛˋ／豁ㄏㄨㄛ。怡、貽皆ㄧˊ；陌、莫皆ㄇㄛˋ。"},
  {q:"關於〈桃花源記〉的旨趣，敘述適當的是：",options:["寄寓對亂世的批判與不滿","反映對淳樸安樂社會的嚮往","主張積極入世、建功立業","寄託作者歸隱田園的情懷"],answer:["寄寓對亂世的批判與不滿","反映對淳樸安樂社會的嚮往","寄託作者歸隱田園的情懷"],exp:"全文以理想社會對照現實亂離，與作者歸隱之志相合，非勸人求取功名。"}
];
