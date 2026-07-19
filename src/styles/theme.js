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
  .ios-resize-trigger { 
    position: absolute; right: 0px; bottom: 0px; 
    width: 44px; height: 44px; /* 모바일을 위한 넓은 터치 영역 유지 */
    cursor: se-resize; z-index: 15; background: transparent !important; 
  }
`;

export const iosLiquidGlassWidget = {
  background: 'linear-gradient(135deg, rgba(32, 32, 36, 0.7) 0%, rgba(16, 16, 18, 0.75) 100%)',
  backdropFilter: 'blur(40px) saturate(200%)',
  borderRadius: '32px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)', color: '#ffffff', display: 'flex', flexDirection: 'column',
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
    background: linear-gradient(135deg, rgba(40, 40, 45, 0.6) 0%, rgba(20, 20, 25, 0.8) 100%);
    backdrop-filter: blur(40px) saturate(200%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 32px;
    padding: 12px 24px;
    display: flex;
    gap: 16px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    z-index: 1000;
  }
  .ios-dock-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 50px;
    height: 50px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid transparent;
    color: #fff;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1);
    font-size: 1.2rem;
  }
  .ios-dock-item:hover {
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    transform: translateY(-8px) scale(1.1); /* 👈 마우스 오버 시 부드럽게 커지는 효과 */
  }
  .ios-dock-item.active {
    background: rgba(0, 122, 255, 0.3);
    border: 1px solid rgba(0, 122, 255, 0.5);
  }
  .ios-dock-item span {
    font-size: 0.65rem;
    margin-top: 4px;
    opacity: 0.8;
  }
`;

// 기존 스타일에 Dock 스타일 주입되도록 수정 (App.jsx에서 호출될 때 같이 렌더링됨)
if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.innerHTML = iosDockTheme;
  document.head.appendChild(styleTag);
}