// components/DdayWidget.jsx — 마감·릴리스·기념일까지 남은 일수.
import { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { useWidgetDoc, newId } from '../hooks/useWidgetDoc';
import { widgetRoot, scrollArea, iconBtn, iconBtnActive, field, todayKey } from '../styles/widgetUI';
import { WidgetHeader, Empty, Row } from './widgetKit';

const DEFAULTS = { items: [] };

const diffDays = (date) => Math.round((new Date(`${date}T00:00:00`) - new Date(`${todayKey()}T00:00:00`)) / 86400000);

// D-3 / D-DAY / D+12
const ddayLabel = (n) => (n === 0 ? 'D-DAY' : n > 0 ? `D-${n}` : `D+${-n}`);
const ddayColor = (n) => (n < 0 ? 'var(--txt-faint)' : n === 0 ? 'var(--danger)' : n <= 7 ? '#ff9500' : 'var(--accent-text)');

export default function DdayWidget({ userId }) {
  const [data, update] = useWidgetDoc(userId, 'ddayWidget', DEFAULTS, 'D-Day');
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayKey());

  const items = Array.isArray(data.items) ? data.items : [];

  const add = () => {
    const t = title.trim();
    if (!t || !date) return;
    update(d => ({ items: [...(d.items || []), { id: newId(), title: t, date }] }));
    setTitle(''); setDate(todayKey()); setAdding(false);
  };
  const remove = (id) => update(d => ({ items: d.items.filter(i => i.id !== id) }));

  // 지난 것은 아래로, 남은 것은 가까운 순
  const sorted = [...items].sort((a, b) => {
    const da = diffDays(a.date), dbb = diffDays(b.date);
    if ((da < 0) !== (dbb < 0)) return da < 0 ? 1 : -1;
    return da < 0 ? dbb - da : da - dbb;
  });

  return (
    <div style={widgetRoot}>
      <WidgetHeader
        title="D-Day"
        sub={`${items.length}개 기록 중`}
        right={<button onClick={() => setAdding(!adding)} title="추가" style={adding ? iconBtnActive : iconBtn}><Plus size={16} strokeWidth={2.2} /></button>}
      />

      {adding && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="이름" style={{ ...field, flex: 1 }} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...field, width: '132px' }} />
          <button onClick={add} style={iconBtn} title="저장"><Check size={16} strokeWidth={2.2} /></button>
        </div>
      )}

      <div style={scrollArea}>
        {sorted.length === 0 ? (
          <Empty>등록된 날짜가 없습니다.<br />+ 버튼으로 추가하세요.</Empty>
        ) : sorted.map(item => {
          const n = diffDays(item.date);
          return (
            <Row key={item.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--txt-faint)' }}>
                  {new Date(`${item.date}T00:00:00`).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                </div>
              </div>
              <span style={{ fontSize: '1.05rem', fontWeight: '700', color: ddayColor(n), fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {ddayLabel(n)}
              </span>
              <button onClick={() => remove(item.id)} title="삭제"
                      style={{ background: 'none', border: 'none', color: 'var(--txt-faint)', cursor: 'pointer', display: 'flex', padding: '2px' }}>
                <X size={13} strokeWidth={2.2} />
              </button>
            </Row>
          );
        })}
      </div>
    </div>
  );
}
