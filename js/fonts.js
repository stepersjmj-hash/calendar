/* 폰트 목록(Google Fonts 한글) 및 로딩. 전역 Fonts 로 노출. */
(function (root) {
  'use strict';
  var LIST = [
    { family: 'Noto Sans KR', label: '노토 산스 (본고딕)', cat: '고딕' },
    { family: 'Noto Serif KR', label: '노토 세리프 (본명조)', cat: '명조' },
    { family: 'Nanum Gothic', label: '나눔고딕', cat: '고딕' },
    { family: 'Nanum Myeongjo', label: '나눔명조', cat: '명조' },
    { family: 'Gothic A1', label: '고딕 A1', cat: '고딕' },
    { family: 'IBM Plex Sans KR', label: 'IBM 플렉스 산스', cat: '고딕' },
    { family: 'Gowun Dodum', label: '고운돋움', cat: '고딕' },
    { family: 'Gowun Batang', label: '고운바탕', cat: '명조' },
    { family: 'Hahmlet', label: '함렛', cat: '명조' },
    { family: 'Song Myung', label: '송명', cat: '명조' },
    { family: 'Black Han Sans', label: '검은고딕', cat: '제목' },
    { family: 'Do Hyeon', label: '도현', cat: '제목' },
    { family: 'Jua', label: '주아', cat: '제목' },
    { family: 'Sunflower', label: '해바라기', cat: '제목' },
    { family: 'Nanum Pen Script', label: '나눔손글씨 펜', cat: '손글씨' },
    { family: 'Nanum Brush Script', label: '나눔손글씨 붓', cat: '손글씨' },
    { family: 'Gaegu', label: '개구', cat: '손글씨' },
    { family: 'Hi Melody', label: '하이멜로디', cat: '손글씨' },
    { family: 'Poor Story', label: '푸어스토리', cat: '손글씨' },
    { family: 'Gamja Flower', label: '감자꽃', cat: '손글씨' },
    { family: 'Dongle', label: '동글', cat: '손글씨' },
    { family: 'Cute Font', label: '귀여운 폰트', cat: '손글씨' },
    { family: 'East Sea Dokdo', label: '동해독도', cat: '손글씨' },
    { family: 'Yeon Sung', label: '연성', cat: '손글씨' },
    { family: 'Stylish', label: '스타일리시', cat: '손글씨' }
  ];
  var loaded = {};
  var pending = {};

  function linkFor(family) {
    var id = 'gf-' + family.replace(/\s+/g, '-');
    if (document.getElementById(id)) return;
    var l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(family).replace(/%20/g, '+') + ':wght@400;700&display=swap';
    document.head.appendChild(l);
  }

  // 지정 폰트들이 캔버스에서 사용 가능해질 때까지 대기 (최대 ~6초)
  function ensure(families) {
    var uniq = families.filter(function (f, i, a) { return f && a.indexOf(f) === i; });
    return Promise.all(uniq.map(function (f) {
      if (loaded[f]) return Promise.resolve();
      if (pending[f]) return pending[f];
      linkFor(f);
      var p = Promise.race([
        Promise.all([document.fonts.load('400 16px "' + f + '"'), document.fonts.load('700 16px "' + f + '"')]),
        new Promise(function (res) { setTimeout(res, 6000); })
      ]).then(function () { loaded[f] = true; delete pending[f]; });
      pending[f] = p;
      return p;
    }));
  }

  root.Fonts = { LIST: LIST, ensure: ensure };
})(window);
