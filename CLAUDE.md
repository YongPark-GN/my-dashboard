# my-dashboard

iOS 리퀴드 글래스 스타일의 개인 위젯 대시보드. Vite + React 19 + Firebase.

## 스택

- **빌드**: Vite 8 (`npm run dev` / `npm run build`)
- **UI**: React 19, 인라인 스타일 + CSS 변수 토큰, `lucide-react` 아이콘
- **백엔드**: Firebase — Firestore(데이터), Auth(구글 로그인)
- **배포**: Firebase Hosting

## 구조

```
src/
  App.jsx                      인증 게이트. dev 전용 로그인 우회(import.meta.env.DEV)
  firebase.js                  Firebase 초기화 (설정값은 import.meta.env)
  components/
    DashboardContent.jsx       위젯 그리드, 배경 오로라, 테마 토글(data-theme)
    Dock.jsx                   하단 독 + 위젯 라이브러리/페이지 팝업 (한 번에 하나만 열림)
    PagePopup.jsx              페이지 목록 — 전환·생성·이름변경·복제·삭제
    widgetKit.jsx              위젯 공용 JSX 조각 (WidgetHeader / Empty / Row / DeleteBtn)
    Toast.jsx                  전역 토스트 — `toast('메시지')`
    ConfirmDialog.jsx          공용 확인 모달

    ── 위젯 ──
    ClockWidget.jsx            시계
    WeatherWidget.jsx          Open-Meteo 날씨
    AirQualityWidget.jsx       PM2.5/PM10/O₃/NO₂/자외선 (Open-Meteo Air Quality)
    SunMoonWidget.jsx          일출·일몰 + 달 위상(로컬 계산)
    QuoteWidget.jsx            잠언 (bolls.life KRV=개역한글, 런타임 fetch)
    SearchWidget.jsx           검색창 (구글/네이버/유튜브/YT뮤직)
    CalendarWidget.jsx         달력 + 구글 캘린더 일정 (통합 위젯)
    TodoWidget.jsx             마감일 있는 할 일
    DdayWidget.jsx             D-Day 카운터
    MemoWidget.jsx             탭 + 마크다운 메모, 뷰에서 체크박스 토글
    MindMapWidget.jsx          마인드맵 목록 + 전체화면 에디터(베지어 커넥터)
    HabitWidget.jsx            습관 체크 (최근 7일 + 연속 일수)
    PomodoroWidget.jsx         집중/휴식 타이머 (세션 수는 localStorage)
    WorldClockWidget.jsx       세계 시계
    BookmarkWidget.jsx         링크 바로가기 (favicon 그리드)
    SnippetWidget.jsx          클립보드 스니펫
    CurrencyWidget.jsx         환율 (frankfurter.dev, ECB 고시)
    BudgetWidget.jsx           가계부 (이번 달 카테고리별 지출)
    ChecklistWidget.jsx        범용 체크리스트 — `shopping`(장보기)이 이걸 쓴다
    MusicWidget.jsx            유튜브 뮤직 (YouTube 임베드 플레이어)
    GalleryWidget.jsx          사진 슬라이드쇼 (주소만 저장)
    SystemWidget.jsx           배터리·네트워크·창 크기
  hooks/
    useWidgetLayout.js         페이지(위젯 배치 한 벌) + 활성 페이지의 순서·크기·표시
                               `reconcileLayout()` 예전 위젯 세트를 마이그레이션
                               `reconcilePages()` 페이지 이전 구조를 '기본' 페이지로 승격
    useWidgetDoc.js            위젯 하나가 자기 Firestore 문서를 읽고 쓰는 공용 훅
    useGoogleCalendarAuth.js   구글 캘린더 OAuth 토큰
  utils/geo.js                 위치 + 역지오코딩 (날씨·대기질·해와달 공용)
  styles/
    theme.js                   CSS 토큰 테마 + 전역 스타일 + 독 스타일
    widgetUI.js                위젯 공용 스타일 상수 (widgetRoot / field / chip …)
                               + 헬퍼 todayKey / daysUntil(YYYY-MM-DD → 남은 일수)
```

### 위젯 하나 추가하는 법

1. `components/XxxWidget.jsx` — `widgetRoot`·`field` 등은 `styles/widgetUI.js`,
   `WidgetHeader`·`Empty`·`Row`·`DeleteBtn`(목록 행 삭제 버튼) 은 `components/widgetKit.jsx` 에서 가져다 쓴다.
   저장이 필요하면 `useWidgetDoc(userId, 'xxxWidget', DEFAULTS, '이름')`.
2. `hooks/useWidgetLayout.js` 의 `DEFAULT_ORDER` 와 `DEFAULT_SIZES` 에 id 등록.
   기본으로 켜두고 싶을 때만 `DEFAULT_VISIBLE` 에도 넣는다.
3. `components/Dock.jsx` 의 `WIDGET_GROUPS` 에 이름 등록.
4. `components/DashboardContent.jsx` 의 `renderWidgetContent` 에 `case` 추가.

기존 사용자 레이아웃은 `reconcileLayout` 이 자동 정리한다 — **새 위젯은 순서에만
끼워 넣고 켜지지는 않는다.** 여러 개를 한꺼번에 추가해도 기존 배치가 망가지지 않도록.

## 규약 (중요)

### 색상은 반드시 CSS 토큰 사용

`#fff` 같은 하드코딩 금지. 라이트/다크 모드가 함께 바뀌어야 한다.
토큰은 `src/styles/theme.js`의 `:root` / `:root[data-theme="light"]`에 정의:

`--txt`, `--txt-dim`, `--txt-faint`, `--glass-bg`, `--glass-border`,
`--glass-highlight`, `--glass-shadow`, `--field-bg`, `--field-border`,
`--chip-bg`, `--chip-strong`, `--accent`, `--accent-text`, `--danger`,
`--divider`, `--editor-bg`, `--node-bg`

```jsx
// 좋음
<span style={{ color: 'var(--txt)' }} />
// 나쁨 — 라이트 모드에서 안 보임
<span style={{ color: '#fff' }} />
```

테마는 `DashboardContent`가 `document.documentElement.dataset.theme`에 적용하므로
포털 모달·독까지 전역 반영된다.

### 컴팩트(모바일) 모드

좁은 화면·터치 기기에서 쓰는 1열 세로 스택 모드. `useWidgetLayout`이 관리한다.

- **자동 + 수동**: `matchMedia('(max-width: 820px), (pointer: coarse)')`로 자동 감지하되,
  Dock의 모바일/데스크탑 토글로 끄고 켠 값(`compact_{uid}`, 기기별 localStorage)이 우선한다.
- **스크롤 vs 드래그**: 컴팩트 모드는 기본이 `isLocked`라 위젯 카드가 `draggable`이 되지
  않는다. 이게 터치 스크롤이 위젯에 잡히던 문제의 근본 해결책이다. 잠긴 위젯엔
  `touchAction: 'pan-y'`도 준다. 정리하려면 Dock 자물쇠로 잠금을 풀면 드래그가 켜진다.
- **레이아웃**: `getResponsiveSize`가 컴팩트일 때 화면 폭과 무관하게 full-width를 돌려줘
  자연히 1열로 쌓인다. 높이는 420px 상한.
- **내부 밀림 방지**: `theme.js`에 `.lg-widget :where(...) { min-width: 0 }` — 특이도 0이라
  위젯 인라인 값은 그대로 이기면서, flex/grid 자식이 콘텐츠보다 작게 줄어들 수 있게 해
  긴 텍스트가 옆 요소를 밀지 않고 자기 자리에서 말줄임된다.

### 페이지

회사/집처럼 상황별로 위젯 배치를 나눠 두는 단위. 최대 `MAX_PAGES`(8)개.

- `useWidgetLayout`이 돌려주는 `widgetOrder`/`widgetSizes`/`visibleWidgets`는
  **활성 페이지의 값**이다. 위젯 쪽 코드는 페이지를 몰라도 된다.
- 배치를 바꾸는 코드는 `commitActivePage(page => ({ ... }))` 형태(함수 patch)를 쓸 것.
  객체를 직접 넘기면 렌더 사이에 연달아 호출될 때 앞의 변경이 덮인다.
- **활성 페이지는 기기별 localStorage** (`activePage_{uid}`)에 저장 — 회사 PC와 집 PC가
  서로 다른 페이지를 열어둘 수 있어야 하므로 Firestore에 동기화하지 않는다.
  페이지 목록 자체는 Firestore로 동기화된다.
- 위젯이 담는 내용(메모·마인드맵)은 사용자 단위라 페이지가 달라도 같은 데이터를 본다.
  페이지가 나누는 건 **배치**뿐이다.

### 그 외

- 위젯 카드는 `iosLiquidGlassWidget` + `className="lg-widget"` 조합
- Firestore 저장 실패는 조용히 삼키지 말고 `toast('...실패했습니다.')`로 알린다
- 위젯 추가/삭제 절차는 위의 "위젯 하나 추가하는 법" 참고
- 독은 **아이콘만** 둔다. 뜻은 `title`/`aria-label` 로 전하고, 활성 상태는 파란 발광이
  아니라 아이콘 색 + 아래 점(`.ios-dock-item.active::after`)으로 조용히 표시한다.
  독 위로 뜨는 팝업의 껍데기는 `.ios-dock-popup` 이 맡는다 (위치를 한 곳에서 관리)

## 데이터 경로

모든 사용자 데이터는 `users/{userId}/` 아래에 격리:

- `users/{uid}/dashboard/layoutConfig` — `pages: [{ id, name, widgetOrder, widgetSizes, visibleWidgets }]`
  (예전 구조의 최상위 `widgetOrder`/`widgetSizes`/`visibleWidgets`는 승격 후 삭제된다)
- `users/{uid}/dashboard/memoWidget` — 메모 (`memos` 배열)
- `users/{uid}/dashboard/googleCalendar` — 캘린더 토큰
- `users/{uid}/mindmaps/{mapId}` — 마인드맵
- `useWidgetDoc` 를 쓰는 위젯은 각자 `users/{uid}/dashboard/{docId}` 한 장을 쓴다:
  `todoWidget`, `ddayWidget`, `habitWidget`, `budgetWidget`, `worldClockWidget`,
  `bookmarkWidget`, `snippetWidget`, `shoppingWidget`, `musicWidget`, `galleryWidget`

위젯 내용은 **사용자 단위**라 페이지가 달라도 같은 데이터를 본다 (페이지가 나누는 건 배치뿐).
회사/집에서 다른 내용을 보고 싶다면 위젯이 아니라 그 안의 탭·목록으로 나눌 것.
Firestore 규칙은 `users/{uid}/**` 를 통째로 허용하므로 문서를 늘려도 규칙 변경은 필요 없다.

## 배포

`main`에 push → GitHub Actions → **Hosting만** 자동 배포.

**Firestore 규칙은 CI에 포함되지 않는다.** 규칙 변경 시 수동 배포 필요:

```bash
npx firebase-tools deploy --only firestore:rules
```

## 환경변수

`.env`는 **커밋되어 있다** — Firebase 웹 config와 OAuth 클라이언트 ID는 브라우저로
전송되는 공개값이라 비밀이 아니며, CI 빌드에도 이 값이 필요하다.
비공개 값이 생기면 `.env.local`(gitignore됨)에 둘 것.

## 로컬 확인

`npm run dev` 후 로그인 화면에서 **"로그인 없이 미리보기 (dev 전용)"** 버튼으로
로그인 없이 대시보드를 볼 수 있다. 단 가짜 uid라 Firestore는 권한 거부되므로
데이터 저장/불러오기는 동작하지 않는다(UI·테마 확인용). 프로덕션 빌드에는 미포함.

### 저장까지 검증하려면 — 에뮬레이터

가짜 uid로는 "저장 → 스냅샷이 되돌아옴" 경로를 못 태운다. 그 경로에서만 나는 버그를
로그인 없이 잡으려면 로컬 에뮬레이터를 쓴다 (`VITE_USE_EMULATOR=1`이면 `firebase.js`가
Firestore/Auth 에뮬레이터에 붙는다 — 프로덕션 빌드엔 영향 없음):

```bash
npm run emu       # 터미널 1: Firestore(8080)+Auth(9099) 에뮬레이터
npm run dev:emu   # 터미널 2: --mode emulator 로 dev 서버
```

로그인 화면의 **"에뮬레이터로 미리보기"** 버튼이 익명 로그인(진짜 uid)으로 들어간다.
특정 문서 상태를 심으려면 `node scripts/seed-emulator.mjs <uid>`
(에뮬레이터는 `Authorization: Bearer owner` 를 관리자 접근으로 취급 → 규칙 우회).

# Compact instructions

When compacting, focus on code changes, file paths, and decisions made.
Drop exploratory tool output, build logs, and deployment logs.
