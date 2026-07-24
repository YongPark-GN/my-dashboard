// components/widgetKit.jsx — 위젯들이 공유하는 자잘한 JSX 조각.
// 스타일 상수는 styles/widgetUI.js 에 있다.
// 색은 반드시 CSS 토큰만 쓴다 (라이트/다크가 함께 바뀌어야 하므로).

/** 위젯 상단 제목 줄. right 에 버튼 등을 넣는다. */
export function WidgetHeader({ title, sub, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        {sub && <div style={{ fontSize: '0.74rem', color: 'var(--txt-faint)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>
      {right && <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

/** 비어 있거나 불러오는 중일 때의 안내 문구 */
export function Empty({ children }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '12px', color: 'var(--txt-faint)', fontSize: '0.85rem', lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

/** 목록 한 줄. 액션 버튼은 항상 보이게 둔다 (터치 환경에는 hover 가 없다). */
export function Row({ children, onClick, style }) {
  return (
    <div onClick={onClick}
         style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 2px', borderBottom: '1px solid var(--divider)', cursor: onClick ? 'pointer' : 'default', ...style }}>
      {children}
    </div>
  );
}
