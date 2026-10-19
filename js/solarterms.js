/* 24절기 계산 (Meeus, Astronomical Algorithms ch.25 기반 태양 황경 + 보정)
 * 결과는 한국표준시(KST, UTC+9) 기준 날짜. 전역 SolarTerms 로 노출. */
(function (root) {
  'use strict';
  var NAMES = ['춘분','청명','곡우','입하','소만','망종','하지','소서','대서','입추','처서','백로',
               '추분','한로','상강','입동','소설','대설','동지','소한','대한','입춘','우수','경칩'];
  var D2R = Math.PI / 180;

  function norm(d) { d = d % 360; return d < 0 ? d + 360 : d; }

  // 태양 시황경(apparent longitude), JD는 지구시(TT)
  function sunLongitude(jd) {
    var T = (jd - 2451545.0) / 36525;
    var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    var M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * D2R;
    var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
          + 0.000289 * Math.sin(3 * M);
    var omega = (125.04 - 1934.136 * T) * D2R;
    // 추가 섭동 (달, 금성, 목성에 의한 주요 항) — 수십 초 정도 정확도 향상
    var A = (153.23 + 22518.7541 * T) * D2R;   // 금성
    var B = (216.57 + 45037.5082 * T) * D2R;   // 금성
    var Cj = (312.69 + 32964.3577 * T) * D2R;  // 목성
    var Dm = (350.74 + 445267.1142 * T - 0.00144 * T * T) * D2R; // 달
    var E = (231.19 + 20.20 * T) * D2R;
    var pert = 0.00134 * Math.cos(A) + 0.00154 * Math.cos(B) + 0.002 * Math.cos(Cj)
             + 0.00179 * Math.sin(Dm) + 0.00178 * Math.sin(E);
    var lon = L0 + C + pert - 0.00569 - 0.00478 * Math.sin(omega);
    return norm(lon);
  }

  function deltaTSeconds(year) { // 대략적 ΔT (TT - UT)
    var t = year - 2000;
    if (year < 2005) return 63.86 + 0.3345 * t;
    if (year < 2050) return 62.92 + 0.32217 * t + 0.005589 * t * t;
    return 62.92 + 0.32217 * t + 0.005589 * t * t;
  }

  function jdFromUTC(y, m, d, h) {
    h = h || 0;
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5 + h / 24;
  }

  function dateFromJD(jd) { // UT JD -> {y,m,d,h}
    jd += 0.5;
    var Z = Math.floor(jd), F = jd - Z, A = Z;
    if (Z >= 2299161) { var a = Math.floor((Z - 1867216.25) / 36524.25); A = Z + 1 + a - Math.floor(a / 4); }
    var B = A + 1524, C = Math.floor((B - 122.1) / 365.25), D = Math.floor(365.25 * C), E = Math.floor((B - D) / 30.6001);
    var day = B - D - Math.floor(30.6001 * E);
    var month = E < 14 ? E - 1 : E - 13;
    var year = month > 2 ? C - 4716 : C - 4715;
    return { y: year, m: month, d: day, h: F * 24 };
  }

  // 황경 target(도)에 도달하는 시각(TT JD)을 initial 근처에서 뉴턴 반복으로 탐색
  function findTime(target, jdGuess) {
    var jd = jdGuess;
    for (var i = 0; i < 20; i++) {
      var lon = sunLongitude(jd);
      var diff = target - lon;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      var step = diff / 360 * 365.2422;
      jd += step;
      if (Math.abs(step) < 1e-6) break;
    }
    return jd;
  }

  // 해당 연도(양력)의 24절기 목록: [{name, lonDeg, y, m, d, time}] KST 기준
  function forYear(year) {
    var out = [];
    for (var k = 0; k < 24; k++) {
      var lon = k * 15; // 0=춘분
      // 해당 황경을 지나는 대략적 날짜: 춘분(3/21) 기준 +k*15.2일
      var approx = jdFromUTC(year, 3, 21) + k * 15.2184;
      var jdTT = findTime(lon, approx);
      var jdUT = jdTT - deltaTSeconds(year) / 86400;
      var kst = dateFromJD(jdUT + 9 / 24);
      if (kst.y !== year) { // 연말/연초에 걸친 경우 보정 (동지 이후 소한·대한·입춘·우수·경칩은 다음 해 초)
        var alt = findTime(lon, approx - 365.2422);
        var altKst = dateFromJD(alt - deltaTSeconds(year) / 86400 + 9 / 24);
        if (altKst.y === year) kst = altKst; else {
          alt = findTime(lon, approx + 365.2422);
          altKst = dateFromJD(alt - deltaTSeconds(year) / 86400 + 9 / 24);
          if (altKst.y === year) kst = altKst;
        }
      }
      out.push({ name: NAMES[k], lon: lon, y: kst.y, m: kst.m, d: kst.d, hour: kst.h });
    }
    out.sort(function (a, b) { return a.m - b.m || a.d - b.d; });
    return out;
  }

  // "y-m-d" -> 이름 맵
  var cache = {};
  function mapForYear(year) {
    if (cache[year]) return cache[year];
    var map = {};
    forYear(year).forEach(function (t) { map[t.y + '-' + t.m + '-' + t.d] = t.name; });
    cache[year] = map;
    return map;
  }

  function find(year, name) {
    var arr = forYear(year);
    for (var i = 0; i < arr.length; i++) if (arr[i].name === name) return arr[i];
    return null;
  }

  root.SolarTerms = { NAMES: NAMES, forYear: forYear, mapForYear: mapForYear, find: find, jdFromUTC: jdFromUTC, dateFromJD: dateFromJD };
})(typeof window !== 'undefined' ? window : globalThis);
