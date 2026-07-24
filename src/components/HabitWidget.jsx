// components/HabitWidget.jsx — 습관 체크. 최근 7일을 한눈에 보고 그 자리에서 토글한다.
import { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { useWidgetDoc, newId } from '../hooks/useWidgetDoc';
import { widgetRoot, scrollArea, iconBtn, iconBtnActive, field, todayKey } from '../styles/widgetUI';
import { WidgetHeader, Empty } from './widgetKit';

const DEFAULTS = { habits: [] };

// 오늘을 마지막 칸으로 하는 최근 7일
const recentDays = () => Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (6 - i));
  return { key: todayKey(d), label: d.toLocaleDateString('ko-KR', { weekday: 'narrow' }) };
});

// 오늘부터 거꾸로 연속 체크한 일수
const streakOf = (days) => {
  let n = 0;
  const d = new Date();
  while (days?.[todayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
};

export default function HabitWidget({ userId }) {
  const [data, update] = useWidgetDoc(userId, 'habitWidget', DEFAULTS, '습관');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const habits = Array.isArray(data.habits) ? data.habits : [];
  const week = recentDays();

  const add = () => {
    const n = name.trim();
    if (!n) return;
    update(d => ({ habits: [...(d.habits || []), { id: newId(), name: n, days: {} }] }));
    setName(''); setAdding(false);
  };
  const remove = (id) => update(d => ({ habits: d.habits.filter(h => h.id !== id) }));

  const toggle = (id, dayKey) => update(d => ({
    habits: d.habits.map(h => {
      if (h.id !== id) return h;
      const days = { ...(h.days || {}) };
      if (days[dayKey]) delete days[dayKey]; else days[dayKey] = true;
      return { ...h, days };
    })
  }));

  return (
    <div style={widgetRoot}>
      <WidgetHeader
        title="습관"
        sub="최근 7일 · 칸을 눌러 체크"
        right={<button onClick={() => setAdding(!adding)} title="습관 추가" style={adding ? iconBtnActive : iconBtn}><Plus size={16} strokeWidth={2.2} /></button>}
      />

      {adding && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
                 placeholder="예: 운동, 독서, 물 2L" style={{ ...field, flex: 1 }} />
          <button onClick={add} style={iconBtn} title="저장"><Check size={16} strokeWidth={2.2} /></button>
        </div>
      )}

      <div style={scrollArea}>
        {habits.length === 0 ? (
          <Empty>습관이 없습니다.<br />+ 버튼으로 추가하세요.</Empty>
        ) : habits.map(h => {
          const streak = streakOf(h.days);
          return (
            <div key={h.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--divider)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                {streak > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--accent-text)', fontWeight: '700', flexShrink: 0 }}>{streak}일 연속</span>}
                <button onClick={() => remove(h.id)} title="삭제"
                        style={{ background: 'none', border: 'none', color: 'var(--txt-faint)', cursor: 'pointer', display: 'flex', padding: '2px' }}>
                  <X size={13} strokeWidth={2.2} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {week.map(day => {
                  const on = !!h.days?.[day.key];
                  const isToday = day.key === todayKey();
                  return (
                    <div key={day.key} onClick={() => toggle(h.id, day.key)} title={day.key}
                         style={{
                           flex: 1, height: '26px', borderRadius: '8px', cursor: 'pointer',
                           display: 'flex', alignItems: 'center', justifyContent: 'center',
                           fontSize: '0.62rem', fontWeight: '600',
                           background: on ? 'var(--accent)' : 'var(--chip-bg)',
                           color: on ? '#fff' : 'var(--txt-faint)',
                           border: `1px solid ${isToday ? 'var(--accent-text)' : 'var(--field-border)'}`,
                           transition: 'background 0.15s'
                         }}>
                      {day.label}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
