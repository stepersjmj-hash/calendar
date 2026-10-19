# calendar — 주문제작 달력 메이커 (작업 메모)

한국 주문제작 달력(탁상·벽걸이) 이미지를 브라우저에서 만드는 정적 웹앱.
사이즈·디자인·추가 옵션(24절기, 음력, 명절, 공휴일, 기념일)·폰트·사진 레이아웃을 정해
표지 + 월별 페이지를 PNG/JPG(개별 또는 ZIP)로 내보낸다. 서버·빌드 없음.
참고 사이트: https://create.symentor.co.kr/calendar/embed/sero.php

## 파일 구성

```
index.html            화면(UI) — 왼쪽 설정 패널 + 오른쪽 미리보기/페이지 스트립
css/style.css         스타일
js/solarterms.js      24절기 계산 (Meeus 태양 황경, KST) — 전역 SolarTerms
js/caldata.js         공휴일(대체공휴일 규칙 포함)·명절/세시풍속·기념일·음력 결합 — 전역 CalData
js/fonts.js           Google Fonts 한글 목록 + 로딩 대기 — 전역 Fonts
js/templates.js       디자인 템플릿 / 사이즈 프리셋 / 사진 레이아웃(정렬 가이드) — 전역 Templates
js/render.js          캔버스 렌더러(mm 단위 좌표, 배율 px/mm) — 전역 Renderer
js/app.js             상태·UI 바인딩·드래그·내보내기·프로젝트 저장/불러오기
js/vendor/            korean-lunar-calendar(MIT, KASI 기준 음력 1000~2050), jszip
.claude/launch.json   미리보기용 정적 서버 (npx http-server, 5173 포트)
```

ES 모듈이 아닌 전역 스크립트 방식이라 `index.html`을 더블클릭해도 동작한다
(폰트는 Google Fonts에서 받으므로 인터넷 필요).

## 핵심 설계

- 모든 그리기 좌표는 **mm 단위**. `Renderer.render(canvas, spec, pxPerMm)` 에서
  `ctx.setTransform(scale…)` 로 배율만 바꿔 미리보기(저해상도)와 출력(300dpi)을 같은 코드로 그린다.
  출력 px = (mm + 재단여백×2) × dpi / 25.4.
- 페이지 키: `'cover'` 또는 `'YYYY-MM'`. `state.pages[key] = {layout, slots:[{src,img,scale,ox,oy}], caption}`.
  `ox/oy`는 -1~1 (사진이 슬롯보다 큰 여분 범위 안의 위치), `scale`은 cover-fit 기준 배율.
- 템플릿은 코드가 아니라 설정 객체(`mode`: top/left/full/none, `header`, `grid`, 색상…)로 정의.
  새 디자인은 `templates.js`의 TEMPLATES 배열에 객체 하나 추가하면 된다.
- 사진 레이아웃(정렬 가이드)은 `LAYOUTS`의 비율 배열 `[x,y,w,h]` 로 정의. 슬롯 수가 곧 사진 수.
- 상태는 localStorage(`mj-calendar-state-v1`)에 자동 저장하되 **사진 dataURL은 제외**.
  사진까지 보관하려면 "프로젝트 저장"(`*.mjcal.json`, dataURL 포함)을 쓴다.
- 업로드 사진은 긴 변 3200px로 축소해 메모리/속도를 맞춘다 (`MAX_IMG`).
- 프리셋: localStorage(`mj-calendar-presets-v1`)에 `[{name, savedAt, state}]` 배열. `state`는 `serialize(true)`에서
  `pages`만 뺀 것(로고 dataURL 포함, 사진 제외). 불러올 때 `applySettings(snap, keepPages=true)`로 현재 사진을 유지한다.
  프로젝트 파일 열기도 같은 `applySettings`(keepPages=false)를 쓴다. 파일 내보내기/가져오기는 `{app:'mj-calendar', type:'presets', presets:[…]}`.

## 날짜 데이터 규칙 (caldata.js)

- 공휴일: 고정일 + 설날(음 12/말일~1/2)·추석(음 8/14~16)·부처님오신날(음 4/8) + 확정된 선거일(2026, 2028, 2030, 2032).
- 대체공휴일: 설·추석은 일요일/다른 공휴일과 겹칠 때, 어린이날·삼일절·광복절·개천절·한글날·부처님오신날·성탄절은
  토·일/다른 공휴일과 겹칠 때 다음 첫 평일. 같은 날 두 공휴일이 겹치면 대체는 하루만(2025-05-05 사례).
  신정·현충일은 대체 없음. 임시공휴일은 반영하지 않으므로 필요하면 사용자 정의 기념일(빨강)로 추가.
- 명절·세시풍속(검정): 정월대보름·삼짇날·단오·칠석·백중·중양절·섣달그믐, 한식(전년 동지+105일),
  삼복(하지 후 3·4번째 경일, 입추 후 첫 경일 — 간지는 음력 라이브러리의 getKoreanGapja 사용).
- 24절기는 계산값. 2024~2026년 KASI 발표와 대조해 일치 확인함(자정 근처 절기도 KST 기준으로 맞음).

## 반복 작업 절차

- **미리보기**: 데스크톱 앱 Browser 패널에서 `.claude/launch.json`의 `calendar` 서버 실행 (`npx -y http-server -p 5173 -c-1 .`).
- **날짜 로직 테스트(node)**: 전역을 흉내 내서 로드한다.
  ```js
  globalThis.window = globalThis; window.KoreanLunarCalendar = require('./js/vendor/korean-lunar-calendar.min.js');
  require('./js/solarterms.js'); require('./js/caldata.js');
  console.log(CalData.holidaysForYear(2027));
  ```
- **배포**: `main` 브랜치 루트를 GitHub Pages 로 서비스. 커밋·푸시하면 1~2분 뒤 반영.
  주소: https://stepersjmj-hash.github.io/calendar/
- 배포 후 Obsidian 일지 갱신: `pwsh -File "\\mjj\기타\Obsidian\MJ\프로젝트\_generate.ps1"` 및 `프로젝트/calendar 스펙.md` 수동 갱신.

## 관례

- 코드: ES5 스타일 전역 IIFE, 2칸 들여쓰기, 한국어 주석. 외부 라이브러리는 `js/vendor/`에 복사(오프라인 보장).
- 커밋 메시지: 한국어 한 줄 요약 (예: `사진 레이아웃 3분할 추가`).
- 공개 저장소이므로 개인 사진·프로젝트 파일(`*.mjcal.json`)은 커밋하지 않는다 (.gitignore).

## 함정·해결

- Bash 툴의 heredoc 으로 큰 JS 파일을 쓰면 따옴표 때문에 파싱이 깨질 수 있다 → Write 툴 사용.
- Google Fonts 는 `document.fonts.load()` 가 끝나기 전엔 캔버스가 기본 글꼴로 그린다 → `Fonts.ensure()` 후 렌더.
  내보내기 직전에도 다시 `ensure` 한다.
- 캔버스 `letterSpacing` 은 브라우저별 지원이 달라 `spaced()` 로 글자를 하나씩 찍는다.
- 셀이 좁을 때 공휴일 이름이 음력 표기에 밀려 사라지지 않도록 이벤트를 먼저, 음력을 나중에 그린다.
- Browser 패널 스크린샷은 해상도가 낮아 세부 확인이 어렵다 → 페이지 안에서 `Renderer.render` 로 PNG 를 만들고
  로컬 업로드 서버(스크래치패드의 upload.js)로 받아 Read 툴로 보는 방법이 빠르다.
