// styles/theme.js

// 💡 핵심 요약: 앱 전체에 적용될 전역 스타일과 위젯의 공통 스타일을 정의합니다.
export const iosLiquidGlassTheme = `
  * { margin: 0 !important; box-sizing: border-box !important; }
  body, html, #root { 
    margin: 0 !important; padding: 0 !important; background-color: #000000; color: #ffffff; 
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    width: 100vw !important; max-width: 100vw !important; overflow-x: hidden;
  }
  .react-calendar { background: transparent !important; color: #ffffff !important; border: none !important; width: 100% !important; }
  .react-calendar abbr { text-decoration: none !important; border-bottom: none !important; }
  .react-calendar__navigation button { color: #ffffff !important; background: none; }
  .react-calendar__tile { color: #ffffff !important; background: none; border: none; padding: 12px 0; position: relative; font-size: 0.9rem; }
  .react-calendar__tile--now { background: rgba(255,255,255,0.1) !important; border-radius: 12px; }
  .react-calendar__tile--active { background: #007aff !important; color: white !important; border-radius: 12px !important; font-weight: bold; }
  .sat-tile { color: #30a9ff !important; }
  .sun-tile { color: #ff3b30 !important; }
  .ios-resize-trigger {
    position: absolute; right: 0px; bottom: 0px;
    width: 44px; height: 44px; /* 👈 터치 영역을 2배로 확장 */
    cursor: se-resize; z-index: 15; background: transparent !important;
  }

  /* 💧 리퀴드 글래스: 상단 가장자리 스페큘러 라인 (콘텐츠를 가리지 않음) */
  .lg-widget::before {
    content: '';
    position: absolute; top: 0; left: 12%; right: 12%; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
    pointer-events: none; z-index: 3;
  }

  /* 배경 오로라 블롭 (유리가 굴절할 컬러 소스) */
  .lg-blob { position: fixed; border-radius: 50%; filter: blur(90px); pointer-events: none; z-index: 0; opacity: 0.55; }
`;

export const iosLiquidGlassWidget = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  borderRadius: '28px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.18)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.37), inset 0 1px 1px rgba(255,255,255,0.28), inset 0 -1px 1px rgba(255,255,255,0.05)',
  color: '#ffffff', display: 'flex', flexDirection: 'column',
  boxSizing: 'border-box', overflow: 'hidden', position: 'relative'
};

// styles/theme.js (기존 코드 아래에 추가)

// 👈 핵심 요약: 애플 macOS/iOS 스타일의 하단 Dock 디자인 속성입니다.
export const iosDockTheme = `
  .ios-dock-container {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%);
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 28px;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255,255,255,0.3);
    z-index: 1000;
  }
  .ios-dock-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 54px;
    height: 54px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid transparent;
    color: #fff;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.25, 1, 0.5, 1);
    font-size: 1.2rem;
  }
  .ios-dock-item:hover {
    background: rgba(255, 255, 255, 0.16);
    border: 1px solid rgba(255, 255, 255, 0.22);
    transform: translateY(-10px) scale(1.08);
    box-shadow: 0 10px 24px rgba(0,0,0,0.4);
  }
  .ios-dock-item.active {
    background: rgba(0, 122, 255, 0.32);
    border: 1px solid rgba(0, 122, 255, 0.55);
    box-shadow: 0 0 16px rgba(0,122,255,0.4);
  }
  .ios-dock-item span {
    font-size: 0.62rem;
    margin-top: 3px;
    opacity: 0.85;
    font-weight: 500;
  }
`;