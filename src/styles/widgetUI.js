// styles/widgetUI.js — 위젯들이 공유하는 스타일 토막과 작은 헬퍼.
// (JSX 조각은 components/widgetKit.jsx 에 따로 둔다 — 한 파일에서 컴포넌트와
//  상수를 함께 내보내면 Fast Refresh 가 동작하지 않는다)

export const widgetRoot = {
  display: 'flex', flexDirection: 'column', height: '100%', width: '100%',
  minHeight: 0, boxSizing: 'border-box', color: 'var(--txt)'
};

export const scrollArea = { flex: 1, overflowY: 'auto', minHeight: 0 };

export const iconBtn = {
  background: 'var(--chip-strong)', border: '1px solid var(--field-border)', borderRadius: '9px',
  width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--txt)', cursor: 'pointer', flexShrink: 0, padding: 0
};

export const iconBtnActive = { ...iconBtn, background: 'var(--accent)', color: '#fff', borderColor: 'transparent' };

export const field = {
  background: 'var(--field-bg)', border: '1px solid var(--field-border)', borderRadius: '10px',
  padding: '7px 10px', color: 'var(--txt)', fontSize: '0.85rem', outline: 'none',
  fontFamily: 'inherit', minWidth: 0, boxSizing: 'border-box'
};

export const panel = {
  background: 'var(--chip-bg)', border: '1px solid var(--field-border)',
  borderRadius: '14px', padding: '10px 12px'
};

export const chip = (active) => ({
  padding: '4px 11px', borderRadius: '11px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
  fontSize: '0.78rem', fontWeight: active ? '700' : '500',
  background: active ? 'var(--accent)' : 'var(--chip-bg)',
  color: active ? '#fff' : 'var(--txt-dim)',
  border: `1px solid ${active ? 'transparent' : 'var(--field-border)'}`
});

/** 로컬 시간대 기준 YYYY-MM-DD. toISOString 은 UTC 라 날짜가 밀릴 수 있어 쓰지 않는다. */
export const todayKey = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
