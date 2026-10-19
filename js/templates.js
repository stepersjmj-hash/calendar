/* 디자인 템플릿, 사이즈 프리셋, 사진 레이아웃 정의. 전역 Templates 로 노출. */
(function (root) {
  'use strict';

  // mode: top(상단 사진) | left(좌측 사진, 가로형) | full(사진 전면 + 오버레이) | none(사진 없음)
  // header: bignum(큰 숫자) | centered(가운데) | band(컬러 밴드) | side(좌측 세로)
  // grid: none | hlines(가로줄) | boxes(박스)
  var TEMPLATES = [
    { id: 'classic', name: '클래식 화이트', desc: '큰 월 숫자 + 깔끔한 날짜', mode: 'top', photoFrac: 0.55,
      bg: '#ffffff', fg: '#1e1e1e', sub: '#8a8a8a', sun: '#e23b2e', sat: '#2b63c9', accent: '#1e1e1e', line: '#e6e6e6',
      grid: 'none', header: 'bignum', weekday: 'en', numAlign: 'center' },
    { id: 'minimal', name: '미니멀 라인', desc: '가는 줄과 세리프 감성', mode: 'top', photoFrac: 0.5,
      bg: '#fdfcfa', fg: '#2b2b2b', sub: '#9a9a9a', sun: '#c9463d', sat: '#2b2b2b', accent: '#2b2b2b', line: '#dcdcdc',
      grid: 'hlines', header: 'centered', weekday: 'en', numAlign: 'center' },
    { id: 'modern', name: '모던 컬러 밴드', desc: '포인트 컬러 띠와 한글 요일', mode: 'top', photoFrac: 0.5,
      bg: '#ffffff', fg: '#222222', sub: '#8a8a8a', sun: '#e23b2e', sat: '#2b63c9', accent: '#2f5bea', line: '#eeeeee',
      grid: 'none', header: 'band', weekday: 'ko', numAlign: 'center' },
    { id: 'fullbleed', name: '사진 풀블리드', desc: '사진 전면 + 하단 오버레이 날짜', mode: 'full', photoFrac: 1,
      bg: '#1a1a1a', fg: '#ffffff', sub: 'rgba(255,255,255,0.8)', sun: '#ff7a6e', sat: '#9dc0ff', accent: '#ffffff', line: 'rgba(255,255,255,0.3)',
      grid: 'none', header: 'bignum', weekday: 'en', numAlign: 'center', overlay: true },
    { id: 'split', name: '좌우 분할', desc: '왼쪽 사진, 오른쪽 날짜 (가로형 추천)', mode: 'left', photoFrac: 0.5,
      bg: '#ffffff', fg: '#222222', sub: '#8a8a8a', sun: '#e23b2e', sat: '#2b63c9', accent: '#222222', line: '#e6e6e6',
      grid: 'none', header: 'side', weekday: 'en', numAlign: 'center' },
    { id: 'memo', name: '메모 박스', desc: '작은 사진 + 메모 칸이 있는 박스 그리드', mode: 'top', photoFrac: 0.32,
      bg: '#ffffff', fg: '#222222', sub: '#8a8a8a', sun: '#e23b2e', sat: '#2b63c9', accent: '#3a7d5c', line: '#cfcfcf',
      grid: 'boxes', header: 'band', weekday: 'ko', numAlign: 'left' },
    { id: 'dark', name: '다크', desc: '검정 배경, 흰 글씨', mode: 'top', photoFrac: 0.5,
      bg: '#141414', fg: '#f4f4f4', sub: '#9a9a9a', sun: '#ff6b5e', sat: '#8ab4ff', accent: '#f4f4f4', line: '#333333',
      grid: 'hlines', header: 'bignum', weekday: 'en', numAlign: 'center' },
    { id: 'pastel', name: '파스텔', desc: '부드러운 배경색과 둥근 사진', mode: 'top', photoFrac: 0.5,
      bg: '#f6f1ea', fg: '#4a4038', sub: '#9c8f84', sun: '#d9634f', sat: '#5a7fb5', accent: '#c47a5a', line: '#e8dfd5',
      grid: 'none', header: 'centered', weekday: 'ko', numAlign: 'center', radius: 4 },
    { id: 'nophoto', name: '사진 없음 (대형 그리드)', desc: '사진 없이 메모 칸을 크게', mode: 'none', photoFrac: 0,
      bg: '#ffffff', fg: '#222222', sub: '#8a8a8a', sun: '#e23b2e', sat: '#2b63c9', accent: '#222222', line: '#cfcfcf',
      grid: 'boxes', header: 'centered', weekday: 'ko', numAlign: 'left' }
  ];

  // 사이즈 프리셋 (mm)
  var SIZES = [
    { id: 'desk-v', name: '탁상 세로 (150×210)', w: 150, h: 210 },
    { id: 'desk-h', name: '탁상 가로 (210×150)', w: 210, h: 150 },
    { id: 'desk-s', name: '탁상 소형 (130×180)', w: 130, h: 180 },
    { id: 'square', name: '정사각 (200×200)', w: 200, h: 200 },
    { id: 'a4-v', name: 'A4 세로 (210×297)', w: 210, h: 297 },
    { id: 'a4-h', name: 'A4 가로 (297×210)', w: 297, h: 210 },
    { id: 'b5-v', name: 'B5 세로 (182×257)', w: 182, h: 257 },
    { id: 'a3-v', name: 'A3 세로 (297×420)', w: 297, h: 420 },
    { id: 'wall-v', name: '벽걸이 세로 (320×470)', w: 320, h: 470 },
    { id: 'custom', name: '직접 입력', w: 0, h: 0 }
  ];

  // 사진 정렬 가이드 (레이아웃). rect(x,y,w,h), gap(mm) -> 슬롯 사각형 배열
  var LAYOUTS = {
    single: { name: '1장 전체', count: 1, icon: [[0, 0, 1, 1]] },
    h2: { name: '좌우 2분할', count: 2, icon: [[0, 0, .5, 1], [.5, 0, .5, 1]] },
    v2: { name: '상하 2분할', count: 2, icon: [[0, 0, 1, .5], [0, .5, 1, .5]] },
    big2: { name: '큰 1장 + 작은 2장', count: 3, icon: [[0, 0, .62, 1], [.62, 0, .38, .5], [.62, .5, .38, .5]] },
    grid4: { name: '4분할', count: 4, icon: [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]] },
    none: { name: '사진 없음', count: 0, icon: [] }
  };

  function slotRects(layoutId, r, gap) {
    var L = LAYOUTS[layoutId] || LAYOUTS.single;
    var g = gap || 0;
    return L.icon.map(function (f) {
      // f: [fx, fy, fw, fh] 비율. 간격은 인접 슬롯 사이에만 적용
      var x = r.x + f[0] * r.w + (f[0] > 0 ? g / 2 : 0);
      var y = r.y + f[1] * r.h + (f[1] > 0 ? g / 2 : 0);
      var w = f[2] * r.w - (f[0] > 0 ? g / 2 : 0) - (f[0] + f[2] < 0.999 ? g / 2 : 0);
      var h = f[3] * r.h - (f[1] > 0 ? g / 2 : 0) - (f[1] + f[3] < 0.999 ? g / 2 : 0);
      return { x: x, y: y, w: w, h: h };
    });
  }

  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return list[0]; }

  root.Templates = { TEMPLATES: TEMPLATES, SIZES: SIZES, LAYOUTS: LAYOUTS, slotRects: slotRects, template: function (id) { return byId(TEMPLATES, id); }, size: function (id) { return byId(SIZES, id); } };
})(window);
