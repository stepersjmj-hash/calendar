/* 달력 데이터: 공휴일(대체공휴일 포함), 명절·세시풍속, 기념일, 음력, 24절기 결합.
 * 전역 CalData 로 노출. KoreanLunarCalendar, SolarTerms 가 먼저 로드되어 있어야 함. */
(function (root) {
  'use strict';
  var KLC = root.KoreanLunarCalendar;
  var klc = new KLC();

  function key(y, m, d) { return y + '-' + m + '-' + d; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
  function dow(y, m, d) { return new Date(y, m - 1, d).getDay(); }
  function addDays(y, m, d, n) { var t = new Date(y, m - 1, d); t.setDate(t.getDate() + n); return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }; }

  function toLunar(y, m, d) {
    if (!klc.setSolarDate(y, m, d)) return null;
    var l = klc.getLunarCalendar();
    return { y: l.year, m: l.month, d: l.day, leap: !!l.intercalation };
  }
  function toSolar(ly, lm, ld, leap) {
    if (!klc.setLunarDate(ly, lm, ld, !!leap)) {
      // 30일이 없는 달이면 29일로 대체
      if (!(ld === 30 && klc.setLunarDate(ly, lm, 29, !!leap))) return null;
    }
    var s = klc.getSolarCalendar();
    return { y: s.year, m: s.month, d: s.day };
  }
  function dayGanji(y, m, d) { // '경오일' 등
    if (!klc.setSolarDate(y, m, d)) return '';
    return klc.getKoreanGapja().day || '';
  }
  function yearGanji(y, m, d) {
    if (!klc.setSolarDate(y, m, d)) return '';
    return klc.getKoreanGapja().year || '';
  }

  // ---------- 공휴일 ----------
  // 해당 연도의 법정 공휴일 (대체공휴일 포함). 반환: { 'y-m-d': [이름,...] }
  var holidayCache = {};
  function holidaysForYear(y) {
    if (holidayCache[y]) return holidayCache[y];
    var map = {};
    function add(yy, mm, dd, name) { if (yy !== y) return; var k = key(yy, mm, dd); (map[k] = map[k] || []).push(name); }

    add(y, 1, 1, '신정');
    add(y, 3, 1, '삼일절');
    add(y, 5, 5, '어린이날');
    add(y, 6, 6, '현충일');
    add(y, 8, 15, '광복절');
    add(y, 10, 3, '개천절');
    add(y, 10, 9, '한글날');
    add(y, 12, 25, '성탄절');

    // 설날 연휴 (음 12/말일, 1/1, 1/2)
    var seol = toSolar(y, 1, 1, false);
    var seolDays = [];
    if (seol) {
      var prev = addDays(seol.y, seol.m, seol.d, -1);
      var next = addDays(seol.y, seol.m, seol.d, 1);
      seolDays = [prev, seol, next];
      add(prev.y, prev.m, prev.d, '설날연휴');
      add(seol.y, seol.m, seol.d, '설날');
      add(next.y, next.m, next.d, '설날연휴');
    }
    // 추석 연휴 (음 8/14, 8/15, 8/16)
    var chu = toSolar(y, 8, 15, false);
    var chuDays = [];
    if (chu) {
      var cp = addDays(chu.y, chu.m, chu.d, -1), cn = addDays(chu.y, chu.m, chu.d, 1);
      chuDays = [cp, chu, cn];
      add(cp.y, cp.m, cp.d, '추석연휴');
      add(chu.y, chu.m, chu.d, '추석');
      add(cn.y, cn.m, cn.d, '추석연휴');
    }
    // 부처님오신날 (음 4/8)
    var bud = toSolar(y, 4, 8, false);
    if (bud) add(bud.y, bud.m, bud.d, '부처님오신날');

    // 선거일 (법정 임시 공휴일, 확정된 것만)
    var elections = { 2026: [[6, 3, '지방선거']], 2028: [[4, 12, '국회의원선거']], 2030: [[6, 5, '지방선거']], 2032: [[3, 3, '대통령선거'], [4, 14, '국회의원선거']] };
    (elections[y] || []).forEach(function (e) { add(y, e[0], e[1], e[2]); });

    // ---- 대체공휴일 ----
    function isHoliday(yy, mm, dd) { return !!map[key(yy, mm, dd)]; }
    function nextWorkday(from) {
      var t = from;
      for (var i = 0; i < 10; i++) {
        t = addDays(t.y, t.m, t.d, 1);
        var w = dow(t.y, t.m, t.d);
        if (w !== 0 && w !== 6 && !isHoliday(t.y, t.m, t.d)) return t;
      }
      return null;
    }
    // 설날·추석: 일요일 또는 다른 공휴일과 겹치면 연휴 다음 첫 평일
    [seolDays, chuDays].forEach(function (days) {
      if (!days.length) return;
      if (days[0].y !== y && days[2].y !== y) return;
      var need = 0;
      days.forEach(function (t) {
        var w = dow(t.y, t.m, t.d);
        var others = (map[key(t.y, t.m, t.d)] || []).filter(function (n) { return !/설날|추석/.test(n); });
        if (w === 0 || others.length) need++;
      });
      var cur = days[2];
      for (var i = 0; i < need; i++) {
        var nx = nextWorkday(cur);
        if (!nx) break;
        cur = nx;
        if (nx.y === y) map[key(nx.y, nx.m, nx.d)] = ['대체공휴일'];
      }
    });
    // 토·일요일 또는 다른 공휴일과 겹치면 대체: 어린이날, 삼일절, 광복절, 개천절, 한글날, 부처님오신날, 성탄절
    var satSunList = [[3, 1], [5, 5], [8, 15], [10, 3], [10, 9], [12, 25]];
    if (bud && bud.y === y) satSunList.push([bud.m, bud.d]);
    var triggered = {}; // 같은 날짜에 두 공휴일이 겹쳐도 대체공휴일은 하루만
    satSunList.forEach(function (md) {
      var k = key(y, md[0], md[1]);
      if (triggered[k]) return;
      var w = dow(y, md[0], md[1]);
      var names = map[k] || [];
      var overlap = names.length > 1; // 다른 공휴일과 겹침
      if (w === 0 || w === 6 || overlap) {
        triggered[k] = true;
        var nx = nextWorkday({ y: y, m: md[0], d: md[1] });
        if (nx && nx.y === y) map[key(nx.y, nx.m, nx.d)] = ['대체공휴일'];
      }
    });
    holidayCache[y] = map;
    return map;
  }

  // ---------- 명절·세시풍속 (빨간색 아님) ----------
  var festivalCache = {};
  function festivalsForYear(y) {
    if (festivalCache[y]) return festivalCache[y];
    var map = {};
    function add(t, name) { if (!t || t.y !== y) return; var k = key(t.y, t.m, t.d); (map[k] = map[k] || []).push(name); }
    add(toSolar(y, 1, 15, false), '정월대보름');
    add(toSolar(y, 3, 3, false), '삼짇날');
    add(toSolar(y, 5, 5, false), '단오');
    add(toSolar(y, 7, 7, false), '칠석');
    add(toSolar(y, 7, 15, false), '백중');
    add(toSolar(y, 9, 9, false), '중양절');
    // 섣달그믐: 다음 해 설날 전날
    var seolNext = toSolar(y + 1, 1, 1, false);
    if (seolNext) { var g = addDays(seolNext.y, seolNext.m, seolNext.d, -1); add(g, '섣달그믐'); }
    // 한식: 전년도 동지로부터 105일째
    var dongji = SolarTerms.find(y - 1, '동지');
    if (dongji) add(addDays(dongji.y, dongji.m, dongji.d, 105), '한식');
    // 삼복: 하지 후 세 번째 경일(초복), 네 번째 경일(중복), 입추 후 첫 경일(말복)
    function nthGyeong(from, n) {
      var t = from, cnt = 0;
      for (var i = 0; i < 60; i++) {
        if (dayGanji(t.y, t.m, t.d).charAt(0) === '경') { cnt++; if (cnt === n) return t; }
        t = addDays(t.y, t.m, t.d, 1);
      }
      return null;
    }
    var haji = SolarTerms.find(y, '하지'), ipchu = SolarTerms.find(y, '입추');
    if (haji) { add(nthGyeong(haji, 3), '초복'); add(nthGyeong(haji, 4), '중복'); }
    if (ipchu) add(nthGyeong(ipchu, 1), '말복');
    festivalCache[y] = map;
    return map;
  }

  // ---------- 기념일 (국가기념일·일반 기념일, 검정) ----------
  var MEMORIALS = [
    [2, 14, '발렌타인데이'], [3, 14, '화이트데이'], [4, 5, '식목일'], [4, 19, '4·19혁명기념일'],
    [5, 1, '근로자의날'], [5, 8, '어버이날'], [5, 15, '스승의날'], [5, 18, '5·18민주화운동기념일'],
    [6, 25, '6·25전쟁일'], [7, 17, '제헌절'], [10, 1, '국군의날'], [10, 2, '노인의날'],
    [10, 21, '경찰의날'], [11, 3, '학생독립운동기념일'], [11, 11, '농업인의날'], [11, 17, '순국선열의날'], [12, 24, '크리스마스이브']
  ];
  function memorialsForYear(y) {
    var map = {};
    MEMORIALS.forEach(function (e) { var k = key(y, e[0], e[1]); (map[k] = map[k] || []).push(e[2]); });
    // 성년의날: 5월 셋째 월요일
    var first = dow(y, 5, 1);
    var firstMon = first <= 1 ? 1 + (1 - first) : 1 + (8 - first);
    var mon3 = firstMon + 14; var k3 = key(y, 5, mon3); (map[k3] = map[k3] || []).push('성년의날');
    return map;
  }

  // ---------- 월별 데이터 조립 ----------
  // opts: {terms, lunar:'none'|'all'|'1,15'|'1', festivals, holidays, memorials, custom:[{name,kind,m,d,red}]}
  function monthData(y, m, opts) {
    opts = opts || {};
    var n = daysInMonth(y, m), days = [];
    var hol = opts.holidays !== false ? holidaysForYear(y) : {};
    var fes = opts.festivals ? festivalsForYear(y) : {};
    var mem = opts.memorials ? memorialsForYear(y) : {};
    var terms = opts.terms !== false ? SolarTerms.mapForYear(y) : {};
    var customMap = {};
    (opts.custom || []).forEach(function (c) {
      if (!c || !c.name) return;
      if (c.kind === 'lunar') {
        // 이번 달 양력 범위 안에 떨어지는 음력일: 작년·올해 음력 연도 모두 검사
        [y - 1, y].forEach(function (ly) {
          var s = toSolar(ly, +c.m, +c.d, false);
          if (s && s.y === y && s.m === m) { var k = key(s.y, s.m, s.d); (customMap[k] = customMap[k] || []).push(c); }
        });
      } else if (+c.m === m) {
        var k2 = key(y, m, +c.d); (customMap[k2] = customMap[k2] || []).push(c);
      }
    });
    for (var d = 1; d <= n; d++) {
      var k = key(y, m, d), w = dow(y, m, d);
      var lunar = toLunar(y, m, d);
      var events = [];
      var red = w === 0;
      (hol[k] || []).forEach(function (nm) { events.push({ name: nm, type: 'holiday' }); red = true; });
      (customMap[k] || []).forEach(function (c) { events.push({ name: c.name, type: 'custom' }); if (c.red) red = true; });
      if (terms[k]) events.push({ name: terms[k], type: 'term' });
      (fes[k] || []).forEach(function (nm) { events.push({ name: nm, type: 'festival' }); });
      (mem[k] || []).forEach(function (nm) { events.push({ name: nm, type: 'memorial' }); });
      var lunarText = '';
      if (lunar) {
        var mode = opts.lunar || 'none';
        var show = mode === 'all' || (mode === '1,15' && (lunar.d === 1 || lunar.d === 15)) || (mode === '1' && lunar.d === 1);
        if (show) lunarText = (lunar.leap ? '윤' : '음') + ' ' + lunar.m + '.' + lunar.d;
      }
      days.push({ y: y, m: m, d: d, dow: w, lunar: lunar, lunarText: lunarText, events: events, red: red, sat: w === 6 });
    }
    return { y: y, m: m, days: days, firstDow: dow(y, m, 1), count: n, ganji: yearGanji(y, m, 1) };
  }

  root.CalData = {
    monthData: monthData, holidaysForYear: holidaysForYear, festivalsForYear: festivalsForYear,
    memorialsForYear: memorialsForYear, toLunar: toLunar, toSolar: toSolar, daysInMonth: daysInMonth, pad2: pad2
  };
})(typeof window !== 'undefined' ? window : globalThis);
