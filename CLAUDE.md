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
    ClockWidget.jsx            시계
    WeatherWidget.jsx          Open-Meteo 날씨 + BigDataCloud 역지오코딩(지명)
    QuoteWidget.jsx            잠언 (bolls.life KRV=개역한글, 런타임 fetch)
    CalendarWidget.jsx         달력 + 구글 캘린더 일정 (통합 위젯)
    MemoWidget.jsx             탭 + 마크다운 메모, 뷰에서 체크박스 토글
    MindMapWidget.jsx          마인드맵 목록 + 전체화면 에디터(베지어 커넥터)
    Toast.jsx                  전역 토스트 — `toast('메시지')`
    ConfirmDialog.jsx          공용 확인 모달
  hooks/
    useWidgetLayout.js         페이지(위젯 배치 한 벌) + 활성 페이지의 순서·크기·표시
                               `reconcileLayout()` 예전 위젯 세트를 마이그레이션
                               `reconcilePages()` 페이지 이전 구조를 '기본' 페이지로 승격
    useGoogleCalendarAuth.js   구글 캘린더 OAuth 토큰
  styles/theme.js              CSS 토큰 테마 + 전역 스타일 + 독 스타일
```

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
- 위젯 추가/삭제 시 `useWidgetLayout.js`의 `DEFAULT_ORDER`, `DEFAULT_SIZES`,
  `REMOVED` 와 `Dock.jsx`의 `WIDGET_NAMES` 를 함께 갱신할 것
  (기존 사용자 레이아웃은 `reconcileLayout`이 자동 정리)

## 데이터 경로

모든 사용자 데이터는 `users/{userId}/` 아래에 격리:

- `users/{uid}/dashboard/layoutConfig` — `pages: [{ id, name, widgetOrder, widgetSizes, visibleWidgets }]`
  (예전 구조의 최상위 `widgetOrder`/`widgetSizes`/`visibleWidgets`는 승격 후 삭제된다)
- `users/{uid}/dashboard/memoWidget` — 메모 (`memos` 배열)
- `users/{uid}/dashboard/googleCalendar` — 캘린더 토큰
- `users/{uid}/mindmaps/{mapId}` — 마인드맵

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

# Compact instructions

When compacting, focus on code changes, file paths, and decisions made.
Drop exploratory tool output, build logs, and deployment logs.
