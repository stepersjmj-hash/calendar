/* 앱 상태·UI·내보내기 */
(function () {
  'use strict';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var LS_KEY = 'mj-calendar-state-v1';
  var MAX_IMG = 3200; // 업로드 사진 최대 변 길이(px) — 메모리·속도 절충

  var now = new Date();
  var DEFAULT = {
    sizeId: 'desk-v', w: 150, h: 210, bleed: 3, dpi: 300, topMargin: 0, format: 'png',
    startYear: now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear(), startMonth: 1, months: 12, cover: true,
    weekStart: 0, fixedRows: false,
    templateId: 'classic', accent: '', monthLabel: 'en', satBlue: true, photoFrac: null,
    options: { terms: true, lunar: '1,15', festivals: true, holidays: true, memorials: false },
    custom: [], fonts: { title: 'Noto Sans KR', num: 'Noto Sans KR', small: 'Noto Sans KR' },
    photoGap: 2, photoRadius: null, coverTitle: '', coverSub: 'CALENDAR', coverStyle: 'full',
    logoSrc: null, logoScale: 1, pages: {}
  };
  var state = loadState();
  var current = state.cover ? 'cover' : monthKey(state.startYear, state.startMonth);
  var selectedSlot = 0;
  var lastRender = null;
  var thumbTimer = null, saveTimer = null;

  // ---------- 상태 ----------
  function deepMerge(base, over) {
    var out = JSON.parse(JSON.stringify(base));
    if (!over) return out;
    Object.keys(over).forEach(function (k) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = deepMerge(out[k], over[k]);
      else out[k] = over[k];
    });
    return out;
  }
  function loadState() {
    try { var raw = localStorage.getItem(LS_KEY); if (raw) return deepMerge(DEFAULT, JSON.parse(raw)); } catch (e) { }
    return deepMerge(DEFAULT, null);
  }
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(LS_KEY, JSON.stringify(serialize(false))); } catch (e) { }
    }, 400);
  }
  // withImages=true 면 사진 dataURL 포함(프로젝트 파일), false 면 제외(localStorage)
  function serialize(withImages) {
    var s = JSON.parse(JSON.stringify(state, function (k, v) { return k === 'img' || k === 'logoImg' ? undefined : v; }));
    if (!withImages) {
      Object.keys(s.pages).forEach(function (k) { (s.pages[k].slots || []).forEach(function (sl) { if (sl) delete sl.src; }); });
      delete s.logoSrc;
    }
    return s;
  }
  function monthKey(y, m) { return y + '-' + CalData.pad2(m); }
  function pageKeys() {
    var keys = [];
    if (state.cover) keys.push('cover');
    var y = +state.startYear, m = +state.startMonth;
    for (var i = 0; i < +state.months; i++) { keys.push(monthKey(y, m)); m++; if (m > 12) { m = 1; y++; } }
    return keys;
  }
  function getPage(key) {
    if (!state.pages[key]) state.pages[key] = { layout: 'single', slots: [], caption: '' };
    var p = state.pages[key];
    if (!p.slots) p.slots = [];
    return p;
  }
  function parseKey(key) { var a = key.split('-'); return { y: +a[0], m: +a[1] }; }
  function fontsList() { return [state.fonts.title, state.fonts.num, state.fonts.small]; }

  // ---------- 이미지 ----------
  function loadImage(src) {
    return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = src; });
  }
  // 파일 -> 축소된 dataURL
  function fileToDataURL(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () {
        loadImage(fr.result).then(function (im) {
          var w = im.naturalWidth, h = im.naturalHeight, mx = Math.max(w, h);
          if (mx <= MAX_IMG && file.size < 4 * 1024 * 1024) return res(fr.result);
          var k = Math.min(1, MAX_IMG / mx);
          var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          var isPng = /png/i.test(file.type);
          res(isPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.92));
        }).catch(rej);
      };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }
  function setSlotImage(key, index, src) {
    var p = getPage(key);
    return loadImage(src).then(function (im) {
      p.slots[index] = { src: src, img: im, scale: 1, ox: 0, oy: 0 };
      return im;
    });
  }
  function restoreImages() {
    var jobs = [];
    Object.keys(state.pages).forEach(function (k) {
      (state.pages[k].slots || []).forEach(function (sl, i) {
        if (sl && sl.src && !sl.img) jobs.push(loadImage(sl.src).then(function (im) { sl.img = im; }).catch(function () { }));
      });
    });
    if (state.logoSrc) jobs.push(loadImage(state.logoSrc).then(function (im) { state.logoImg = im; }).catch(function () { }));
    return Promise.all(jobs);
  }

  // ---------- 스펙 ----------
  function buildSpec(key, preview) {
    var t = Templates.template(state.templateId);
    var bleed = +state.bleed || 0;
    var spec = { W: +state.w + 2 * bleed, H: +state.h + 2 * bleed, bleed: bleed, topMargin: +state.topMargin || 0, template: t, state: state, page: getPage(key), preview: !!preview };
    if (key === 'cover') { spec.kind = 'cover'; return spec; }
    var ym = parseKey(key);
    spec.kind = 'month';
    spec.info = CalData.monthData(ym.y, ym.m, {
      terms: state.options.terms, lunar: state.options.lunar, festivals: state.options.festivals,
      holidays: state.options.holidays, memorials: state.options.memorials, custom: state.custom
    });
    return spec;
  }

  // ---------- 렌더 ----------
  var mainCanvas = $('#preview');
  function renderMain() {
    var wrap = $('#previewWrap');
    var spec = buildSpec(current, true);
    var availW = wrap.clientWidth - 32, availH = wrap.clientHeight - 32;
    var cssScale = Math.min(availW / spec.W, availH / spec.H);
    var dpr = window.devicePixelRatio || 1;
    lastRender = Renderer.render(mainCanvas, spec, cssScale * dpr);
    lastRender.cssScale = cssScale; lastRender.spec = spec;
    mainCanvas.style.width = (spec.W * cssScale) + 'px';
    mainCanvas.style.height = (spec.H * cssScale) + 'px';
    $('#pageTitle').textContent = current === 'cover' ? '표지' : parseKey(current).y + '년 ' + parseKey(current).m + '월';
  }
  function renderThumbs() {
    var strip = $('#strip');
    var keys = pageKeys();
    // DOM 동기화
    var existing = {};
    $$('.thumb', strip).forEach(function (el) { existing[el.dataset.key] = el; });
    strip.innerHTML = '';
    keys.forEach(function (k) {
      var el = existing[k];
      if (!el) {
        el = document.createElement('div'); el.className = 'thumb'; el.dataset.key = k;
        el.innerHTML = '<canvas></canvas><div class="thumb-label"></div>';
        el.addEventListener('click', function () { selectPage(k); });
      }
      el.classList.toggle('active', k === current);
      $('.thumb-label', el).textContent = k === 'cover' ? '표지' : parseKey(k).m + '월';
      strip.appendChild(el);
      var spec = buildSpec(k, true);
      var c = $('canvas', el);
      var scale = 110 / spec.H;
      Renderer.render(c, spec, scale * (window.devicePixelRatio || 1));
      c.style.width = (spec.W * scale) + 'px'; c.style.height = '110px';
    });
  }
  function scheduleThumbs() { clearTimeout(thumbTimer); thumbTimer = setTimeout(renderThumbs, 250); }
  function refresh(opts) {
    opts = opts || {};
    renderMain();
    if (!opts.mainOnly) scheduleThumbs();
    persist();
  }
  function selectPage(k) { current = k; selectedSlot = 0; renderMain(); $$('.thumb').forEach(function (el) { el.classList.toggle('active', el.dataset.key === k); }); buildPagePanel(); }

  // ---------- UI 구성 ----------
  function opt(v, label, sel) { var o = document.createElement('option'); o.value = v; o.textContent = label; if (sel) o.selected = true; return o; }
  function fillSelect(sel, items, value) { sel.innerHTML = ''; items.forEach(function (it) { sel.appendChild(opt(it[0], it[1], String(it[0]) === String(value))); }); }

  function buildStatic() {
    // 사이즈
    fillSelect($('#sizeId'), Templates.SIZES.map(function (s) { return [s.id, s.name]; }), state.sizeId);
    $('#w').value = state.w; $('#h').value = state.h; $('#bleed').value = state.bleed; $('#dpi').value = state.dpi; $('#topMargin').value = state.topMargin; $('#format').value = state.format;
    // 기간
    var years = []; for (var y = now.getFullYear() - 1; y <= now.getFullYear() + 5; y++) years.push([y, y + '년']);
    fillSelect($('#startYear'), years, state.startYear);
    var months = []; for (var m = 1; m <= 12; m++) months.push([m, m + '월']);
    fillSelect($('#startMonth'), months, state.startMonth);
    $('#months').value = state.months; $('#cover').checked = state.cover; $('#weekStart').value = state.weekStart; $('#fixedRows').checked = state.fixedRows;
    // 디자인
    var tg = $('#templates'); tg.innerHTML = '';
    Templates.TEMPLATES.forEach(function (t) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'tpl' + (t.id === state.templateId ? ' active' : ''); b.dataset.id = t.id;
      b.innerHTML = '<span class="tpl-swatch" style="background:' + t.bg + ';border-color:' + t.line + '"><i style="background:' + t.accent + '"></i></span><b>' + t.name + '</b><small>' + t.desc + '</small>';
      b.addEventListener('click', function () { state.templateId = t.id; $$('.tpl', tg).forEach(function (x) { x.classList.toggle('active', x === b); }); refresh(); });
      tg.appendChild(b);
    });
    $('#accent').value = state.accent || Templates.template(state.templateId).accent; $('#accentUse').checked = !!state.accent;
    $('#monthLabel').value = state.monthLabel; $('#satBlue').checked = state.satBlue;
    $('#photoFrac').value = state.photoFrac != null ? state.photoFrac : ''; $('#photoGap').value = state.photoGap; $('#photoRadius').value = state.photoRadius != null ? state.photoRadius : '';
    // 옵션
    $('#optTerms').checked = state.options.terms; $('#optLunar').value = state.options.lunar; $('#optFestivals').checked = state.options.festivals;
    $('#optHolidays').checked = state.options.holidays; $('#optMemorials').checked = state.options.memorials;
    fillSelect($('#cMonth'), months, 1);
    var days = []; for (var d = 1; d <= 31; d++) days.push([d, d + '일']);
    fillSelect($('#cDay'), days, 1);
    renderCustomList();
    // 폰트
    var fl = Fonts.LIST.map(function (f) { return [f.family, f.label + ' (' + f.cat + ')']; });
    fillSelect($('#fontTitle'), fl, state.fonts.title); fillSelect($('#fontNum'), fl, state.fonts.num); fillSelect($('#fontSmall'), fl, state.fonts.small);
    // 표지
    $('#coverTitle').value = state.coverTitle; $('#coverSub').value = state.coverSub; $('#coverStyle').value = state.coverStyle;
    $('#logoScale').value = state.logoScale;
    updateLogoUI();
  }

  function renderCustomList() {
    var ul = $('#customList'); ul.innerHTML = '';
    state.custom.forEach(function (c, i) {
      var li = document.createElement('li');
      li.innerHTML = '<span>' + (c.kind === 'lunar' ? '음' : '양') + ' ' + c.m + '/' + c.d + ' <b' + (c.red ? ' class="red"' : '') + '>' + escapeHtml(c.name) + '</b></span><button type="button" title="삭제">✕</button>';
      $('button', li).addEventListener('click', function () { state.custom.splice(i, 1); renderCustomList(); refresh(); });
      ul.appendChild(li);
    });
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function updateLogoUI() {
    $('#logoPreview').innerHTML = state.logoImg ? '<img src="' + state.logoSrc + '" alt="logo">' : '<span>로고 없음</span>';
  }

  // 현재 페이지 패널 (레이아웃·슬롯·설명)
  function buildPagePanel() {
    var panel = $('#pagePanel');
    var page = getPage(current);
    var isCover = current === 'cover';
    var t = Templates.template(state.templateId);
    var noPhotoTpl = t.mode === 'none' && !isCover;
    var html = '<h3>' + (isCover ? '표지' : parseKey(current).y + '년 ' + parseKey(current).m + '월') + ' 사진</h3>';
    if (noPhotoTpl) {
      html += '<p class="hint">현재 디자인은 사진 영역이 없습니다.</p>';
    } else {
      html += '<div class="layouts">';
      Object.keys(Templates.LAYOUTS).forEach(function (id) {
        var L = Templates.LAYOUTS[id];
        var icon = '<span class="lay-icon">' + L.icon.map(function (f) { return '<i style="left:' + f[0] * 100 + '%;top:' + f[1] * 100 + '%;width:' + f[2] * 100 + '%;height:' + f[3] * 100 + '%"></i>'; }).join('') + '</span>';
        html += '<button type="button" class="lay' + (page.layout === id ? ' active' : '') + '" data-id="' + id + '" title="' + L.name + '">' + icon + '<small>' + L.name + '</small></button>';
      });
      html += '</div>';
      var L = Templates.LAYOUTS[page.layout] || Templates.LAYOUTS.single;
      html += '<div class="slots">';
      for (var i = 0; i < L.count; i++) {
        var sl = page.slots[i];
        html += '<div class="slot' + (i === selectedSlot ? ' active' : '') + '" data-i="' + i + '">' +
          '<div class="slot-thumb">' + (sl && sl.src ? '<img src="' + sl.src + '">' : '<span>' + (i + 1) + '</span>') + '</div>' +
          '<div class="slot-ctl"><label class="btn small">사진 선택<input type="file" accept="image/*" data-i="' + i + '" hidden></label>' +
          (sl && sl.src ? '<button type="button" class="btn small ghost rm" data-i="' + i + '">제거</button>' : '') + '</div></div>';
      }
      html += '</div>';
      if (L.count > 0) {
        var cur = page.slots[selectedSlot];
        html += '<div class="slot-adjust"><label>확대 <input type="range" id="slotScale" min="1" max="3" step="0.02" value="' + (cur && cur.scale || 1) + '"' + (cur && cur.img ? '' : ' disabled') + '></label>' +
          '<button type="button" class="btn small ghost" id="slotReset"' + (cur && cur.img ? '' : ' disabled') + '>위치 초기화</button>' +
          '<p class="hint">미리보기에서 사진을 드래그하면 위치를 옮길 수 있습니다.</p></div>';
      }
    }
    if (isCover) {
      html += '<p class="hint">표지 제목·부제는 "표지·로고" 섹션에서 바꿉니다.</p>';
    } else {
      html += '<label class="field">설명 문구 <input type="text" id="caption" maxlength="60" placeholder="달력 아래 작게 들어갈 문구 (선택)" value="' + escapeHtml(page.caption || '') + '"></label>';
    }
    panel.innerHTML = html;

    $$('.lay', panel).forEach(function (b) {
      b.addEventListener('click', function () { page.layout = b.dataset.id; selectedSlot = 0; buildPagePanel(); refresh(); });
    });
    $$('.slot', panel).forEach(function (s) {
      s.addEventListener('click', function () { selectedSlot = +s.dataset.i; $$('.slot', panel).forEach(function (x) { x.classList.toggle('active', x === s); }); buildPagePanel(); });
    });
    $$('input[type=file]', panel).forEach(function (inp) {
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0]; if (!f) return;
        var i = +inp.dataset.i;
        busy(true, '사진 불러오는 중…');
        fileToDataURL(f).then(function (src) { return setSlotImage(current, i, src); })
          .then(function () { selectedSlot = i; buildPagePanel(); refresh(); })
          .catch(function () { alert('사진을 불러오지 못했습니다.'); })
          .then(function () { busy(false); });
      });
    });
    $$('.rm', panel).forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); page.slots[+b.dataset.i] = null; buildPagePanel(); refresh(); });
    });
    var sc = $('#slotScale', panel);
    if (sc) sc.addEventListener('input', function () { var sl = page.slots[selectedSlot]; if (sl) { sl.scale = +sc.value; refresh({ mainOnly: true }); scheduleThumbs(); } });
    var rs = $('#slotReset', panel);
    if (rs) rs.addEventListener('click', function () { var sl = page.slots[selectedSlot]; if (sl) { sl.scale = 1; sl.ox = 0; sl.oy = 0; buildPagePanel(); refresh(); } });
    var cap = $('#caption', panel);
    if (cap) cap.addEventListener('input', function () { page.caption = cap.value; refresh(); });
  }

  // ---------- 드래그로 사진 위치 이동 ----------
  (function () {
    var drag = null;
    function toMm(e) {
      var r = mainCanvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / lastRender.cssScale, y: (e.clientY - r.top) / lastRender.cssScale };
    }
    mainCanvas.addEventListener('pointerdown', function (e) {
      if (!lastRender) return;
      var p = toMm(e);
      var hit = null;
      lastRender.slots.forEach(function (s) { var r = s.rect; if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) hit = s; });
      if (!hit) return;
      var page = getPage(current), sl = page.slots[hit.index];
      if (!sl || !sl.img) return;
      if (selectedSlot !== hit.index) { selectedSlot = hit.index; buildPagePanel(); }
      drag = { slot: sl, info: hit, last: p };
      mainCanvas.setPointerCapture(e.pointerId);
      mainCanvas.style.cursor = 'grabbing';
    });
    mainCanvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var p = toMm(e);
      var dx = p.x - drag.last.x, dy = p.y - drag.last.y; drag.last = p;
      if (drag.info.extraX > 0) drag.slot.ox = Math.max(-1, Math.min(1, drag.slot.ox - dx / (drag.info.extraX / 2)));
      if (drag.info.extraY > 0) drag.slot.oy = Math.max(-1, Math.min(1, drag.slot.oy - dy / (drag.info.extraY / 2)));
      renderMain();
      // 렌더 후 갱신된 슬롯 정보 유지
      var upd = lastRender.slots[drag.info.index]; if (upd) drag.info = upd;
    });
    function end(e) { if (!drag) return; drag = null; mainCanvas.style.cursor = 'grab'; scheduleThumbs(); persist(); }
    mainCanvas.addEventListener('pointerup', end); mainCanvas.addEventListener('pointercancel', end);
    mainCanvas.addEventListener('wheel', function (e) {
      if (!lastRender) return;
      var page = getPage(current), sl = page.slots[selectedSlot];
      if (!sl || !sl.img) return;
      var p = toMm(e), s = lastRender.slots[selectedSlot];
      if (!s) return; var r = s.rect;
      if (!(p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)) return;
      e.preventDefault();
      sl.scale = Math.max(1, Math.min(3, (sl.scale || 1) * (e.deltaY < 0 ? 1.05 : 0.95)));
      var rng = $('#slotScale'); if (rng) rng.value = sl.scale;
      renderMain(); scheduleThumbs(); persist();
    }, { passive: false });
  })();

  // ---------- 이벤트 바인딩 ----------
  function bind() {
    $('#sizeId').addEventListener('change', function () {
      state.sizeId = this.value; var s = Templates.size(state.sizeId);
      if (s.w) { state.w = s.w; state.h = s.h; $('#w').value = s.w; $('#h').value = s.h; }
      $('#w').disabled = $('#h').disabled = state.sizeId !== 'custom';
      refresh();
    });
    $('#w').disabled = $('#h').disabled = state.sizeId !== 'custom';
    ['w', 'h', 'bleed', 'topMargin'].forEach(function (id) {
      $('#' + id).addEventListener('change', function () { var v = parseFloat(this.value); if (isNaN(v) || v < 0) return; if ((id === 'w' || id === 'h') && v < 50) return; state[id] = v; refresh(); });
    });
    $('#swap').addEventListener('click', function () { var w = state.w; state.w = state.h; state.h = w; $('#w').value = state.w; $('#h').value = state.h; state.sizeId = 'custom'; $('#sizeId').value = 'custom'; $('#w').disabled = $('#h').disabled = false; refresh(); });
    $('#dpi').addEventListener('change', function () { state.dpi = +this.value; persist(); updateOutputInfo(); });
    $('#format').addEventListener('change', function () { state.format = this.value; persist(); });

    $('#startYear').addEventListener('change', function () { state.startYear = +this.value; afterPeriodChange(); });
    $('#startMonth').addEventListener('change', function () { state.startMonth = +this.value; afterPeriodChange(); });
    $('#months').addEventListener('change', function () { state.months = Math.max(1, Math.min(36, +this.value || 12)); this.value = state.months; afterPeriodChange(); });
    $('#cover').addEventListener('change', function () { state.cover = this.checked; afterPeriodChange(); });
    $('#weekStart').addEventListener('change', function () { state.weekStart = +this.value; refresh(); });
    $('#fixedRows').addEventListener('change', function () { state.fixedRows = this.checked; refresh(); });

    $('#accent').addEventListener('input', function () { if ($('#accentUse').checked) { state.accent = this.value; refresh(); } });
    $('#accentUse').addEventListener('change', function () { state.accent = this.checked ? $('#accent').value : ''; refresh(); });
    $('#monthLabel').addEventListener('change', function () { state.monthLabel = this.value; refresh(); });
    $('#satBlue').addEventListener('change', function () { state.satBlue = this.checked; refresh(); });
    $('#photoFrac').addEventListener('change', function () { var v = parseFloat(this.value); state.photoFrac = isNaN(v) ? null : Math.max(0.1, Math.min(0.8, v)); this.value = state.photoFrac == null ? '' : state.photoFrac; refresh(); });
    $('#photoGap').addEventListener('change', function () { state.photoGap = Math.max(0, parseFloat(this.value) || 0); refresh(); });
    $('#photoRadius').addEventListener('change', function () { var v = parseFloat(this.value); state.photoRadius = isNaN(v) ? null : Math.max(0, v); refresh(); });

    $('#optTerms').addEventListener('change', function () { state.options.terms = this.checked; refresh(); });
    $('#optLunar').addEventListener('change', function () { state.options.lunar = this.value; refresh(); });
    $('#optFestivals').addEventListener('change', function () { state.options.festivals = this.checked; refresh(); });
    $('#optHolidays').addEventListener('change', function () { state.options.holidays = this.checked; refresh(); });
    $('#optMemorials').addEventListener('change', function () { state.options.memorials = this.checked; refresh(); });
    $('#cAdd').addEventListener('click', function () {
      var name = $('#cName').value.trim(); if (!name) { $('#cName').focus(); return; }
      state.custom.push({ name: name.slice(0, 12), kind: $('#cKind').value, m: +$('#cMonth').value, d: +$('#cDay').value, red: $('#cRed').checked });
      $('#cName').value = ''; renderCustomList(); refresh();
    });
    $('#cName').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#cAdd').click(); });

    ['Title', 'Num', 'Small'].forEach(function (k) {
      $('#font' + k).addEventListener('change', function () {
        state.fonts[k.toLowerCase()] = this.value;
        busy(true, '폰트 불러오는 중…');
        Fonts.ensure(fontsList()).then(function () { busy(false); refresh(); });
      });
    });

    $('#coverTitle').addEventListener('input', function () { state.coverTitle = this.value; refresh(); });
    $('#coverSub').addEventListener('input', function () { state.coverSub = this.value; refresh(); });
    $('#coverStyle').addEventListener('change', function () { state.coverStyle = this.value; refresh(); });
    $('#logoFile').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      fileToDataURL(f).then(function (src) { return loadImage(src).then(function (im) { state.logoSrc = src; state.logoImg = im; updateLogoUI(); refresh(); }); });
      this.value = '';
    });
    $('#logoRemove').addEventListener('click', function () { state.logoSrc = null; state.logoImg = null; updateLogoUI(); refresh(); });
    $('#logoScale').addEventListener('input', function () { state.logoScale = +this.value; refresh(); });

    // 대량 업로드
    $('#bulkFiles').addEventListener('change', function () {
      var files = Array.prototype.slice.call(this.files || []); this.value = '';
      if (!files.length) return;
      files.sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); });
      var keys = pageKeys().filter(function (k) { return $('#bulkCover').checked || k !== 'cover'; });
      var n = Math.min(files.length, keys.length), i = 0;
      busy(true, '사진 배치 중… 0/' + n);
      (function next() {
        if (i >= n) { busy(false); buildPagePanel(); refresh(); return; }
        var k = keys[i], f = files[i]; i++;
        var page = getPage(k); if (page.layout === 'none') page.layout = 'single';
        fileToDataURL(f).then(function (src) { return setSlotImage(k, 0, src); }).catch(function () { })
          .then(function () { busy(true, '사진 배치 중… ' + i + '/' + n); next(); });
      })();
    });

    // 내보내기·프로젝트
    $('#exportOne').addEventListener('click', function () { exportPages([current]); });
    $('#exportAll').addEventListener('click', function () { exportPages(pageKeys()); });
    $('#saveProject').addEventListener('click', saveProject);
    $('#loadProject').addEventListener('change', function () { var f = this.files && this.files[0]; this.value = ''; if (f) loadProject(f); });
    $('#reset').addEventListener('click', function () {
      if (!confirm('모든 설정과 사진을 지우고 처음부터 시작할까요?')) return;
      localStorage.removeItem(LS_KEY); location.reload();
    });

    // 프리셋
    renderPresetSelect();
    $('#presetSave').addEventListener('click', savePreset);
    $('#presetName').addEventListener('keydown', function (e) { if (e.key === 'Enter') savePreset(); });
    $('#presetSelect').addEventListener('change', function () { $('#presetName').value = this.value; });
    $('#presetLoad').addEventListener('click', loadPreset);
    $('#presetDelete').addEventListener('click', deletePreset);
    $('#presetExport').addEventListener('click', exportPresets);
    $('#presetImport').addEventListener('change', function () { var f = this.files && this.files[0]; this.value = ''; if (f) importPresets(f); });

    // 사이드바 접기(모바일)
    $('#toggleSide').addEventListener('click', function () { document.body.classList.toggle('side-open'); });
    window.addEventListener('resize', function () { renderMain(); });
    // 키보드 좌우로 페이지 이동
    document.addEventListener('keydown', function (e) {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      var keys = pageKeys(), i = keys.indexOf(current);
      if (e.key === 'ArrowRight' && i < keys.length - 1) selectPage(keys[i + 1]);
      if (e.key === 'ArrowLeft' && i > 0) selectPage(keys[i - 1]);
    });
  }
  function afterPeriodChange() {
    var keys = pageKeys();
    if (keys.indexOf(current) < 0) current = keys[0];
    buildPagePanel(); refresh();
  }
  function updateOutputInfo() {
    var bleed = +state.bleed || 0, k = state.dpi / 25.4;
    var W = Math.round((+state.w + 2 * bleed) * k), H = Math.round((+state.h + 2 * bleed) * k);
    $('#outputInfo').textContent = '출력 크기: ' + W + ' × ' + H + ' px (' + (+state.w + 2 * bleed) + ' × ' + (+state.h + 2 * bleed) + ' mm, ' + state.dpi + 'dpi)';
  }

  // ---------- 내보내기 ----------
  function busy(on, msg) { var el = $('#busy'); el.classList.toggle('on', !!on); if (msg) $('span', el).textContent = msg; }
  function canvasToBlob(c, format) {
    return new Promise(function (res) {
      if (format === 'jpg') c.toBlob(res, 'image/jpeg', 0.93); else c.toBlob(res, 'image/png');
    });
  }
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function fileName(key) {
    var ext = state.format === 'jpg' ? 'jpg' : 'png';
    return key === 'cover' ? 'calendar_' + state.startYear + '_cover.' + ext : 'calendar_' + key + '.' + ext;
  }
  function exportPages(keys) {
    var fmt = state.format, c = document.createElement('canvas'), i = 0, zip = keys.length > 1 ? new JSZip() : null;
    busy(true, '폰트 확인 중…');
    Fonts.ensure(fontsList()).then(function step() {
      if (i >= keys.length) {
        if (zip) { busy(true, 'ZIP 압축 중…'); return zip.generateAsync({ type: 'blob' }).then(function (b) { download(b, 'calendar_' + state.startYear + '_' + state.startMonth + '.zip'); }); }
        return;
      }
      var k = keys[i++];
      busy(true, '이미지 생성 중… ' + i + '/' + keys.length);
      return new Promise(function (r) { setTimeout(r, 30); }).then(function () {
        Renderer.render(c, buildSpec(k, false), state.dpi / 25.4);
        return canvasToBlob(c, fmt);
      }).then(function (blob) {
        if (zip) zip.file(fileName(k), blob); else download(blob, fileName(k));
      }).then(step);
    }).catch(function (e) { console.error(e); alert('내보내기 중 오류가 났습니다: ' + e.message); })
      .then(function () { busy(false); c.width = c.height = 1; });
  }

  // ---------- 프리셋 (설정 저장·불러오기, 사진 제외) ----------
  var LS_PRESETS = 'mj-calendar-presets-v1';
  function loadPresets() { try { var a = JSON.parse(localStorage.getItem(LS_PRESETS) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function storePresets(list) {
    try { localStorage.setItem(LS_PRESETS, JSON.stringify(list)); return true; }
    catch (e) { alert('브라우저 저장 공간이 부족해 프리셋을 저장하지 못했습니다. 로고 이미지가 크면 줄여 보세요.'); return false; }
  }
  function settingsSnapshot() {
    var s = serialize(true);
    delete s.pages;            // 사진·페이지별 레이아웃은 제외
    return s;
  }
  function renderPresetSelect(selectedName) {
    var sel = $('#presetSelect'), list = loadPresets();
    sel.innerHTML = '';
    if (!list.length) { sel.appendChild(opt('', '저장된 프리셋 없음')); sel.disabled = true; $('#presetLoad').disabled = $('#presetDelete').disabled = true; return; }
    sel.disabled = false; $('#presetLoad').disabled = $('#presetDelete').disabled = false;
    list.forEach(function (p) { sel.appendChild(opt(p.name, p.name + '  (' + (p.savedAt || '').slice(0, 10) + ')', p.name === selectedName)); });
  }
  function savePreset() {
    var name = $('#presetName').value.trim() || $('#presetSelect').value;
    if (!name) { $('#presetName').focus(); alert('프리셋 이름을 입력하세요.'); return; }
    var list = loadPresets(), idx = -1;
    list.forEach(function (p, i) { if (p.name === name) idx = i; });
    if (idx >= 0 && !confirm('"' + name + '" 프리셋이 이미 있습니다. 현재 설정으로 덮어쓸까요?')) return;
    var item = { name: name, savedAt: new Date().toISOString(), state: settingsSnapshot() };
    if (idx >= 0) list[idx] = item; else list.push(item);
    if (storePresets(list)) { renderPresetSelect(name); $('#presetName').value = ''; toast('프리셋 "' + name + '" 저장됨'); }
  }
  function applySettings(snap, keepPages) {
    var pages = keepPages ? state.pages : {};
    var next = deepMerge(DEFAULT, snap);
    next.pages = pages;
    state = next;
    busy(true, '설정 적용 중…');
    return restoreImages().then(function () { return Fonts.ensure(fontsList()); }).then(function () {
      var keys = pageKeys();
      if (keys.indexOf(current) < 0) current = keys[0];
      selectedSlot = 0;
      buildStatic(); buildPagePanel(); updateOutputInfo(); renderMain(); renderThumbs(); persist(); busy(false);
    });
  }
  function loadPreset() {
    var name = $('#presetSelect').value, p = null;
    loadPresets().forEach(function (x) { if (x.name === name) p = x; });
    if (!p) return;
    applySettings(p.state, true).then(function () { toast('프리셋 "' + name + '" 적용됨 (사진은 그대로)'); });
  }
  function deletePreset() {
    var name = $('#presetSelect').value;
    if (!name || !confirm('"' + name + '" 프리셋을 삭제할까요?')) return;
    storePresets(loadPresets().filter(function (p) { return p.name !== name; }));
    renderPresetSelect();
  }
  function exportPresets() {
    var list = loadPresets();
    if (!list.length) { alert('내보낼 프리셋이 없습니다.'); return; }
    var blob = new Blob([JSON.stringify({ app: 'mj-calendar', type: 'presets', version: 1, presets: list })], { type: 'application/json' });
    download(blob, 'calendar_presets.json');
  }
  function importPresets(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var data = JSON.parse(fr.result);
        if (!data || data.app !== 'mj-calendar' || !Array.isArray(data.presets)) throw new Error('프리셋 파일이 아닙니다');
        var list = loadPresets(), added = 0, replaced = 0;
        data.presets.forEach(function (p) {
          if (!p || !p.name || !p.state) return;
          var idx = -1; list.forEach(function (x, i) { if (x.name === p.name) idx = i; });
          if (idx >= 0) { list[idx] = p; replaced++; } else { list.push(p); added++; }
        });
        if (storePresets(list)) { renderPresetSelect(); toast('프리셋 가져오기: 추가 ' + added + '개, 덮어씀 ' + replaced + '개'); }
      } catch (e) { alert('프리셋 파일을 읽을 수 없습니다: ' + e.message); }
    };
    fr.readAsText(file);
  }
  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast'); el.textContent = msg; el.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('on'); }, 2500);
  }

  function saveProject() {
    var data = { app: 'mj-calendar', version: 1, state: serialize(true) };
    var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    download(blob, 'calendar_project_' + state.startYear + '.mjcal.json');
  }
  function loadProject(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var data = JSON.parse(fr.result);
        if (!data || data.app !== 'mj-calendar' || !data.state) throw new Error('형식이 다릅니다');
        current = 'cover';
        applySettings(data.state, false);
      } catch (e) { alert('프로젝트 파일을 읽을 수 없습니다: ' + e.message); }
    };
    fr.readAsText(file);
  }

  // ---------- 시작 ----------
  buildStatic(); bind(); updateOutputInfo();
  busy(true, '준비 중…');
  Fonts.ensure(fontsList()).then(function () {
    busy(false);
    if (pageKeys().indexOf(current) < 0) current = pageKeys()[0];
    buildPagePanel(); renderMain(); renderThumbs();
  });
})();
