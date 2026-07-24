// styles/theme.js

// 💡 라이트/다크 테마 토큰 + 전역 스타일 + 위젯 공통 스타일.
// 색상은 CSS 변수(토큰)로 정의하고, :root[data-theme] 로 라이트/다크를 전환한다.
export const iosLiquidGlassTheme = `
  /* === 테마 토큰 (기본 = 다크) === */
  :root, :root[data-theme="dark"] {
    --txt: #ffffff;
    --txt-dim: rgba(255,255,255,0.62);
    --txt-faint: rgba(255,255,255,0.4);
    --glass-bg: linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%);
    --glass-border: rgba(255,255,255,0.18);
    --glass-highlight: rgba(255,255,255,0.28);
    --glass-shadow: rgba(0,0,0,0.37);
    --spec-line: rgba(255,255,255,0.5);
    --field-bg: rgba(255,255,255,0.08);
    --field-border: rgba(255,255,255,0.15);
    --chip-bg: rgba(255,255,255,0.06);
    --chip-strong: rgba(255,255,255,0.12);
    --accent: #007aff;
    --accent-text: #4da3ff;
    --danger: #ff453a;
    --divider: rgba(255,255,255,0.2);
    --editor-bg: #16161c;
    --node-bg: linear-gradient(135deg, rgba(44,44,48,0.95) 0%, rgba(28,28,30,0.98) 100%);
  }
  :root[data-theme="light"] {
    --txt: #1c1c1e;
    --txt-dim: rgba(0,0,0,0.55);
    --txt-faint: rgba(0,0,0,0.38);
    --glass-bg: linear-gradient(135deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.45) 100%);
    --glass-border: rgba(255,255,255,0.7);
    --glass-highlight: rgba(255,255,255,0.9);
    --glass-shadow: rgba(60,70,120,0.18);
    --spec-line: rgba(255,255,255,0.95);
    --field-bg: rgba(0,0,0,0.05);
    --field-border: rgba(0,0,0,0.12);
    --chip-bg: rgba(0,0,0,0.045);
    --chip-strong: rgba(0,0,0,0.09);
    --accent: #007aff;
    --accent-text: #0060df;
    --danger: #ff3b30;
    --divider: rgba(0,0,0,0.15);
    --editor-bg: #eef1f8;
    --node-bg: linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(244,246,252,0.96) 100%);
  }

  * { margin: 0 !important; box-sizing: border-box !important; }
  body, html, #root {
    margin: 0 !important; padding: 0 !important; background-color: #000000; color: var(--txt);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    width: 100vw !important; max-width: 100vw !important; overflow-x: hidden;
  }

  .react-calendar { background: transparent !important; color: var(--txt) !important; border: none !important; width: 100% !important; font-family: inherit; }
  .react-calendar abbr { text-decoration: none !important; border-bottom: none !important; }
  .react-calendar__navigation { margin-bottom: 8px; }
  .react-calendar__navigation button { color: var(--txt) !important; background: none; min-width: 36px; font-size: 0.95rem; }
  .react-calendar__navigation button:enabled:hover, .react-calendar__navigation button:enabled:focus { background: var(--chip-bg) !important; border-radius: 10px; }
  .react-calendar__month-view__weekdays { color: var(--txt-dim); font-size: 0.72rem; }
  .react-calendar__tile { color: var(--txt) !important; background: none; border: none; padding: 10px 0; position: relative; font-size: 0.88rem; border-radius: 12px; }
  .react-calendar__tile:enabled:hover, .react-calendar__tile:enabled:focus { background: var(--chip-strong) !important; }
  .react-calendar__month-view__days__day--neighboringMonth { color: var(--txt-faint) !important; }
  .react-calendar__tile--now { background: var(--chip-strong) !important; border-radius: 12px; }
  .react-calendar__tile--active { background: var(--accent) !important; color: #ffffff !important; border-radius: 12px !important; font-weight: bold; }
  .react-calendar__tile--active abbr { color: #ffffff !important; }
  .sat-tile { color: #30a9ff !important; }
  .sun-tile { color: #ff3b30 !important; }

  .ios-resize-trigger {
    position: absolute; right: 0px; bottom: 0px;
    width: 44px; height: 44px; /* 터치 영역 확장 */
    cursor: se-resize; z-index: 15; background: transparent !important;
  }

  /* 💧 리퀴드 글래스: 상단 가장자리 스페큘러 라인 (콘텐츠를 가리지 않음) */
  .lg-widget::before {
    content: '';
    position: absolute; top: 0; left: 12%; right: 12%; height: 1px;
    background: linear-gradient(90deg, transparent, var(--spec-line), transparent);
    pointer-events: none; z-index: 3;
  }

  /* 배경 오로라 블롭 (유리가 굴절할 컬러 소스) */
  .lg-blob { position: fixed; border-radius: 50%; filter: blur(90px); pointer-events: none; z-index: 0; opacity: 0.55; }

  /* 커스텀 스크롤바 */
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { background: var(--chip-strong); border-radius: 8px; }
`;

export const iosLiquidGlassWidget = {
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  borderRadius: '28px', padding: '24px', border: '1px solid var(--glass-border)',
  boxShadow: '0 8px 32px var(--glass-shadow), inset 0 1px 1px var(--glass-highlight), inset 0 -1px 1px rgba(255,255,255,0.05)',
  color: 'var(--txt)', display: 'flex', flexDirection: 'column',
  boxSizing: 'border-box', overflow: 'hidden', position: 'relative'
};

// 하단 Dock 스타일.
// 아이콘만 두는 미니멀 구성 — 라벨은 title 툴팁으로 대신하고, 활성 표시는
// 파란 발광 대신 아이콘 색 + 아래 점 하나로 조용히 나타낸다.
export const iosDockTheme = `
  .ios-dock-container {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--glass-bg);
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border: 1px solid var(--glass-border);
    border-radius: 22px;
    padding: 7px 9px;
    display: flex;
    align-items: center;
    gap: 2px;
    box-shadow: 0 16px 40px var(--glass-shadow), inset 0 1px 1px var(--glass-highlight);
    z-index: 1000;
  }
  .ios-dock-item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 13px;
    background: transparent;
    border: none;
    padding: 0;
    color: var(--txt-dim);
    cursor: pointer;
    transition: color 0.18s ease, background 0.18s ease, transform 0.18s ease;
  }
  .ios-dock-item:hover {
    background: var(--chip-bg);
    color: var(--txt);
    transform: translateY(-2px);
  }
  .ios-dock-item.active {
    color: var(--accent-text);
    background: var(--chip-bg);
  }
  /* 활성 표시 — 아이콘 아래 작은 점 */
  .ios-dock-item.active::after {
    content: '';
    position: absolute;
    bottom: 4px;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: currentColor;
  }
  .ios-dock-item.danger { color: var(--danger); opacity: 0.75; }
  .ios-dock-item.danger:hover { opacity: 1; background: var(--chip-bg); }

  .ios-dock-divider {
    width: 1px;
    height: 20px;
    background: var(--divider);
    margin: 0 5px;
    flex-shrink: 0;
  }

  /* 독 위로 뜨는 팝업(위젯 라이브러리 / 페이지 목록) 공통 껍데기 */
  .ios-dock-popup {
    position: fixed;
    bottom: 90px; /* 독(24 + 54) 위로 살짝 띄운다 */
    left: 50%;
    transform: translateX(-50%);
    background: var(--glass-bg);
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border: 1px solid var(--glass-border);
    border-radius: 22px;
    padding: 16px;
    z-index: 999;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 420px;
    max-width: 92vw;
    box-shadow: 0 16px 40px var(--glass-shadow), inset 0 1px 1px var(--glass-highlight);
  }
`;
