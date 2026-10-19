/* 캔버스 렌더러: 페이지 스펙(mm 단위)을 받아 지정 배율(px/mm)로 그린다. 전역 Renderer 로 노출. */
(function (root) {
  'use strict';
  var MONTH_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  var WD_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var WD_KO = ['일', '월', '화', '수', '목', '금', '토'];

  function font(weight, size, family) { return weight + ' ' + size.toFixed(3) + 'px "' + family + '", "Noto Sans KR", sans-serif'; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r || 0, w / 2, h / 2);
    ctx.beginPath();
    if (r <= 0) { ctx.rect(x, y, w, h); return; }
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // 폭에 맞게 글자 크기를 줄이고(최소 비율) 그래도 넘치면 말줄임
  function drawFit(ctx, text, x, y, maxW, weight, size, family, minRatio) {
    var s = size;
    ctx.font = font(weight, s, family);
    var w = ctx.measureText(text).width;
    if (w > maxW) {
      s = Math.max(size * (minRatio || 0.7), size * maxW / w);
      ctx.font = font(weight, s, family);
      w = ctx.measureText(text).width;
      while (w > maxW && text.length > 1) { text = text.slice(0, -1); w = ctx.measureText(text + '…').width; if (w <= maxW) { text += '…'; break; } }
    }
    ctx.fillText(text, x, y);
    return s;
  }

  function spaced(ctx, text, x, y, spacingPx, align) {
    // 자간 적용 텍스트 (letterSpacing 미지원 브라우저 대비 수동 처리)
    var chars = text.split(''), total = 0, widths = chars.map(function (c) { var w = ctx.measureText(c).width; total += w; return w; });
    total += spacingPx * (chars.length - 1);
    var cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    var prev = ctx.textAlign; ctx.textAlign = 'left';
    chars.forEach(function (c, i) { ctx.fillText(c, cx, y); cx += widths[i] + spacingPx; });
    ctx.textAlign = prev;
  }

  // ---------- 사진 ----------
  function drawPhotos(ctx, rect, page, st, t, preview, out) {
    if (!page || page.layout === 'none' || rect.w <= 0 || rect.h <= 0) return;
    var rects = Templates.slotRects(page.layout, rect, st.photoGap || 0);
    var radius = (st.photoRadius != null ? st.photoRadius : (t.radius || 0));
    rects.forEach(function (r, i) {
      var slot = page.slots && page.slots[i];
      var img = slot && slot.img;
      ctx.save();
      roundRect(ctx, r.x, r.y, r.w, r.h, radius); ctx.clip();
      var info = { rect: r, index: i, extraX: 0, extraY: 0 };
      if (img && img.complete && img.naturalWidth) {
        var iw = img.naturalWidth, ih = img.naturalHeight;
        var base = Math.max(r.w / iw, r.h / ih) * (slot.scale || 1);
        var dw = iw * base, dh = ih * base;
        var ex = dw - r.w, ey = dh - r.h;
        var x = r.x - ex / 2 - (slot.ox || 0) * ex / 2;
        var y = r.y - ey / 2 - (slot.oy || 0) * ey / 2;
        ctx.drawImage(img, x, y, dw, dh);
        info.extraX = ex; info.extraY = ey;
      } else if (preview) {
        ctx.fillStyle = t.overlay ? '#3a3a3a' : (t.bg === '#141414' ? '#2a2a2a' : '#eceae6');
        ctx.fill();
        ctx.fillStyle = t.overlay ? '#888' : '#9a9a9a';
        var fs = Math.min(r.w, r.h) * 0.12;
        ctx.font = font('400', fs, 'Noto Sans KR');
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('+ 사진 ' + (i + 1), r.x + r.w / 2, r.y + r.h / 2);
      }
      ctx.restore();
      if (out) out.push(info);
    });
  }

  // ---------- 월 헤더 ----------
  function drawHeader(ctx, r, info, st, t) {
    var f = st.fonts, ko = st.monthLabel === 'ko';
    var big = String(info.m);
    var small1 = ko ? info.y + '년 ' + info.m + '월' : MONTH_EN[info.m - 1];
    var small2 = ko ? (info.ganji || '') : String(info.y);
    ctx.textBaseline = 'alphabetic';
    if (t.header === 'band') {
      var bh = r.h * 0.62, by = r.y + (r.h - bh) / 2;
      ctx.fillStyle = t.accent; roundRect(ctx, r.x, by, r.w, bh, bh * 0.15); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left';
      var s1 = bh * 0.55;
      ctx.font = font('700', s1, f.title);
      var label = ko ? info.m + '월' : big;
      ctx.fillText(label, r.x + bh * 0.4, by + bh * 0.72);
      var lw = ctx.measureText(label).width;
      ctx.font = font('400', bh * 0.28, f.small);
      ctx.fillText(ko ? info.y + '년 ' + (info.ganji || '') : MONTH_EN[info.m - 1] + ' ' + info.y, r.x + bh * 0.4 + lw + bh * 0.3, by + bh * 0.7);
      return;
    }
    if (t.header === 'centered') {
      ctx.textAlign = 'center';
      ctx.fillStyle = t.fg;
      var s = r.h * 0.5;
      ctx.font = font('700', s, f.title);
      var main = ko ? info.m + '월' : info.y + '. ' + pad2(info.m);
      ctx.fillText(main, r.x + r.w / 2, r.y + r.h * 0.55);
      ctx.fillStyle = t.sub;
      ctx.font = font('400', r.h * 0.17, f.small);
      spaced(ctx, ko ? info.y + '년 ' + (info.ganji || '') : MONTH_EN[info.m - 1], r.x + r.w / 2, r.y + r.h * 0.85, r.h * 0.04, 'center');
      return;
    }
    // bignum / side
    ctx.textAlign = 'left';
    ctx.fillStyle = t.fg;
    var bs = r.h * 0.92;
    ctx.font = font('700', bs, f.title);
    var baseY = r.y + r.h * 0.86;
    ctx.fillText(big, r.x, baseY);
    var bw = ctx.measureText(big).width;
    var sx = r.x + bw + r.h * 0.12;
    ctx.fillStyle = t.fg;
    ctx.font = font('700', r.h * 0.2, f.small);
    spaced(ctx, small1, sx, baseY - r.h * 0.42, r.h * 0.03, 'left');
    ctx.fillStyle = t.sub;
    ctx.font = font('400', r.h * 0.17, f.small);
    ctx.fillText(small2, sx, baseY - r.h * 0.17);
  }

  // ---------- 날짜 그리드 ----------
  function drawGrid(ctx, g, info, st, t) {
    var f = st.fonts;
    var ws = st.weekStart || 0;
    var offset = (info.firstDow - ws + 7) % 7;
    var rows = Math.ceil((offset + info.count) / 7);
    var fixedRows = st.fixedRows ? 6 : rows;
    var cellW = g.w / 7;
    var wdH = Math.min(g.h * 0.1, cellW * 0.5);
    var cellH = (g.h - wdH) / fixedRows;
    var boxes = t.grid === 'boxes';
    var labels = t.weekday === 'ko' ? WD_KO : WD_EN;
    var u = Math.min(cellW, cellH);

    // 요일
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    ctx.font = font('700', Math.min(cellW * 0.2, wdH * 0.55), f.small);
    for (var c = 0; c < 7; c++) {
      var wd = (ws + c) % 7;
      ctx.fillStyle = wd === 0 ? t.sun : (wd === 6 && st.satBlue ? t.sat : t.sub);
      ctx.fillText(labels[wd], g.x + c * cellW + cellW / 2, g.y + wdH * 0.72);
    }
    // 선
    ctx.strokeStyle = t.line; ctx.lineWidth = Math.max(0.15, u * 0.012);
    if (t.grid === 'hlines') {
      for (var r = 0; r <= fixedRows; r++) { var yy = g.y + wdH + r * cellH; ctx.beginPath(); ctx.moveTo(g.x, yy); ctx.lineTo(g.x + g.w, yy); ctx.stroke(); }
    } else if (boxes) {
      for (var r2 = 0; r2 <= fixedRows; r2++) { var y2 = g.y + wdH + r2 * cellH; ctx.beginPath(); ctx.moveTo(g.x, y2); ctx.lineTo(g.x + g.w, y2); ctx.stroke(); }
      for (var c2 = 0; c2 <= 7; c2++) { var x2 = g.x + c2 * cellW; ctx.beginPath(); ctx.moveTo(x2, g.y + wdH); ctx.lineTo(x2, g.y + wdH + fixedRows * cellH); ctx.stroke(); }
    }
    // 날짜
    var numSize = boxes ? Math.min(u * 0.3, cellW * 0.22) : Math.min(u * 0.46, cellW * 0.3);
    var smallSize = Math.min(cellW * 0.13, Math.max(u * 0.2, Math.min(cellW, 20) * 0.1));
    var pad = u * 0.08;
    info.days.forEach(function (d, i) {
      var idx = offset + i, col = idx % 7, row = Math.floor(idx / 7);
      var x = g.x + col * cellW, y = g.y + wdH + row * cellH;
      var color = d.red ? t.sun : (d.sat && st.satBlue ? t.sat : t.fg);
      ctx.fillStyle = color;
      ctx.font = font(boxes ? '700' : '500', numSize, f.num);
      var cx, textY;
      if (t.numAlign === 'left') {
        ctx.textAlign = 'left'; cx = x + pad; textY = y + pad + numSize * 0.95;
        ctx.fillText(String(d.d), cx, textY);
      } else {
        ctx.textAlign = 'center'; cx = x + cellW / 2; textY = y + numSize * 1.1;
        ctx.fillText(String(d.d), cx, textY);
      }
      var lineY = textY + smallSize * 1.2;
      var maxW = boxes ? cellW - pad * 2 : cellW * 0.96;
      var ax = t.numAlign === 'left' ? x + pad : cx;
      var limitY = y + cellH + smallSize * 0.05;
      // 공휴일·기념일 이름을 먼저, 자리가 남으면 음력 표기
      var maxLines = boxes ? 3 : 2, shown = 0;
      for (var e = 0; e < d.events.length && shown < maxLines; e++) {
        var ev = d.events[e];
        if (lineY > limitY) break;
        var ecol = ev.type === 'holiday' ? t.sun : ev.type === 'custom' ? (d.red ? t.sun : t.accent) : t.sub;
        ctx.fillStyle = ecol;
        drawFit(ctx, ev.name, ax, lineY, maxW, ev.type === 'holiday' || ev.type === 'custom' ? '500' : '400', smallSize, f.small, 0.72);
        lineY += smallSize * 1.15; shown++;
      }
      if (d.lunarText && lineY <= limitY) {
        ctx.fillStyle = t.sub;
        drawFit(ctx, d.lunarText, ax, lineY, maxW, '400', smallSize, f.small, 0.75);
      }
    });
  }

  function drawLogo(ctx, st, x, y, hMm, align) {
    var img = st.logoImg;
    if (!img || !img.complete || !img.naturalWidth) return 0;
    var w = hMm * img.naturalWidth / img.naturalHeight;
    var lx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    ctx.drawImage(img, lx, y, w, hMm);
    return w;
  }

  function applyAccent(t, accent) {
    if (!accent) return t;
    var c = {}; for (var k in t) c[k] = t[k];
    c.accent = accent;
    if (t.header === 'band') c.accent = accent;
    return c;
  }

  // ---------- 페이지 렌더 ----------
  // spec: {kind:'month'|'cover', W,H,bleed,topMargin, template, state, info, page, preview}
  function render(canvas, spec, scale) {
    var W = spec.W, H = spec.H, bleed = spec.bleed || 0;
    canvas.width = Math.max(1, Math.round(W * scale));
    canvas.height = Math.max(1, Math.round(H * scale));
    var ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    var st = spec.state, t = applyAccent(spec.template, st.accent);
    var out = { slots: [] };
    ctx.fillStyle = t.bg; ctx.fillRect(0, 0, W, H);

    var m = Math.min(W, H) * 0.06;
    var content = { x: bleed + m, y: bleed + m + (spec.topMargin || 0), w: W - 2 * bleed - 2 * m, h: H - 2 * bleed - 2 * m - (spec.topMargin || 0) };

    if (spec.kind === 'cover') { renderCover(ctx, spec, t, content, out); drawTrim(ctx, spec); return out; }

    var page = spec.page || { layout: 'single', slots: [] };
    var hasPhoto = t.mode !== 'none' && page.layout !== 'none';
    var logoH = st.logoImg ? 6 * (st.logoScale || 1) * (Math.min(W, H) / 150) : 0;
    var captionH = page.caption ? Math.min(W, H) * 0.03 : 0;
    var bottomH = (logoH || captionH) ? logoH + captionH + m * 0.4 : 0;
    var gap = m * 0.7;
    var photoRect, headerRect, gridRect;

    if (t.mode === 'full') {
      photoRect = { x: 0, y: 0, w: W, h: H };
      if (hasPhoto) drawPhotos(ctx, photoRect, page, st, t, spec.preview, out.slots);
      // 하단 오버레이
      var gy = H * 0.42;
      var grad = ctx.createLinearGradient(0, gy - H * 0.15, 0, H);
      grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(0.35, 'rgba(0,0,0,0.55)'); grad.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = grad; ctx.fillRect(0, gy - H * 0.15, W, H - gy + H * 0.15);
      var areaY = gy, areaH = H - bleed - m - gy - bottomH;
      headerRect = { x: content.x, y: areaY, w: content.w, h: areaH * 0.2 };
      gridRect = { x: content.x, y: areaY + areaH * 0.22, w: content.w, h: areaH * 0.78 };
    } else if (t.mode === 'left') {
      var pw = hasPhoto ? content.w * t.photoFrac - gap / 2 : 0;
      photoRect = { x: content.x, y: content.y, w: pw, h: content.h - bottomH };
      if (hasPhoto) drawPhotos(ctx, photoRect, page, st, t, spec.preview, out.slots);
      var rx = hasPhoto ? content.x + pw + gap : content.x, rw = hasPhoto ? content.w - pw - gap : content.w;
      var rh = content.h - bottomH;
      headerRect = { x: rx, y: content.y, w: rw, h: rh * 0.16 };
      gridRect = { x: rx, y: content.y + rh * 0.2, w: rw, h: rh * 0.8 };
    } else {
      var ph = hasPhoto ? content.h * (st.photoFrac != null ? st.photoFrac : t.photoFrac) : 0;
      photoRect = { x: content.x, y: content.y, w: content.w, h: ph };
      if (hasPhoto) drawPhotos(ctx, photoRect, page, st, t, spec.preview, out.slots);
      var rest = content.h - ph - (hasPhoto ? gap : 0) - bottomH;
      var ry = content.y + ph + (hasPhoto ? gap : 0);
      var hh = Math.min(rest * (t.header === 'band' ? 0.14 : 0.18), content.w * 0.16);
      headerRect = { x: content.x, y: ry, w: content.w, h: hh };
      gridRect = { x: content.x, y: ry + hh + gap * 0.6, w: content.w, h: rest - hh - gap * 0.6 };
    }
    drawHeader(ctx, headerRect, spec.info, st, t);
    drawGrid(ctx, gridRect, spec.info, st, t);

    // 하단: 설명 + 로고
    var by = H - bleed - m - bottomH + m * 0.4;
    if (page.caption) {
      ctx.fillStyle = t.sub; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      drawFit(ctx, page.caption, W / 2, by + captionH * 0.8, content.w, '400', captionH * 0.7, st.fonts.small, 0.6);
      by += captionH;
    }
    if (logoH) drawLogo(ctx, st, W / 2, by + m * 0.1, logoH, 'center');
    drawTrim(ctx, spec);
    return out;
  }

  function renderCover(ctx, spec, t, content, out) {
    var W = spec.W, H = spec.H, st = spec.state, page = spec.page || { layout: 'single', slots: [] };
    var hasPhoto = page.layout !== 'none' && page.slots && page.slots.some(function (s) { return s && s.img; });
    var photoRect = { x: 0, y: 0, w: W, h: H };
    if (st.coverStyle === 'inset') photoRect = { x: content.x, y: content.y, w: content.w, h: content.h * 0.72 };
    drawPhotos(ctx, photoRect, page, st, t, spec.preview, out.slots);
    var title = st.coverTitle || String(st.startYear);
    var sub = st.coverSub || 'CALENDAR';
    var onPhoto = st.coverStyle !== 'inset' && hasPhoto;
    if (onPhoto) {
      var grad = ctx.createLinearGradient(0, H * 0.55, 0, H);
      grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = grad; ctx.fillRect(0, H * 0.55, W, H * 0.45);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = onPhoto ? '#ffffff' : t.fg;
    var ts = Math.min(W * 0.22, H * 0.12);
    ctx.font = font('700', ts, st.fonts.title);
    var ty = st.coverStyle === 'inset' ? content.y + content.h * 0.72 + content.h * 0.16 : H * 0.84;
    drawFit(ctx, title, W / 2, ty, content.w, '700', ts, st.fonts.title, 0.5);
    ctx.fillStyle = onPhoto ? 'rgba(255,255,255,0.85)' : t.sub;
    ctx.font = font('400', ts * 0.22, st.fonts.small);
    spaced(ctx, sub, W / 2, ty + ts * 0.42, ts * 0.06, 'center');
    if (st.logoImg) {
      var lh = 6 * (st.logoScale || 1) * (Math.min(W, H) / 150);
      drawLogo(ctx, st, W / 2, H - spec.bleed - Math.min(W, H) * 0.05 - lh, lh, 'center');
    }
  }

  function drawTrim(ctx, spec) {
    if (!spec.preview || !spec.bleed) return;
    var b = spec.bleed;
    ctx.save(); ctx.setLineDash([1.5, 1.5]); ctx.strokeStyle = 'rgba(255,0,0,0.6)'; ctx.lineWidth = 0.3;
    ctx.strokeRect(b, b, spec.W - 2 * b, spec.H - 2 * b); ctx.restore();
  }

  root.Renderer = { render: render, MONTH_EN: MONTH_EN };
})(window);
