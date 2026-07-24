// components/BudgetWidget.jsx — 이번 달 지출 요약. 카테고리별 비중을 막대로 보여준다.
import { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { useWidgetDoc, newId } from '../hooks/useWidgetDoc';
import { widgetRoot, scrollArea, iconBtn, iconBtnActive, field, todayKey } from '../styles/widgetUI';
import { WidgetHeader, Empty } from './widgetKit';

const DEFAULTS = { entries: [], monthlyLimit: 0 };

const CATEGORIES = [
  { key: 'food', label: '식비', color: '#ff9500' },
  { key: 'cafe', label: '카페/간식', color: '#ffcc00' },
  { key: 'transport', label: '교통', color: '#34c759' },
  { key: 'living', label: '생활', color: '#5ac8fa' },
  { key: 'culture', label: '문화', color: '#5e5ce6' },
  { key: 'etc', label: '기타', color: '#8e8e93' }
];
const catOf = (key) => CATEGORIES.find(c => c.key === key) || CATEGORIES[CATEGORIES.length - 1];

const won = (n) => n.toLocaleString('ko-KR');
const monthPrefix = () => todayKey().slice(0, 7); // YYYY-MM

export default function BudgetWidget({ userId }) {
  const [data, update] = useWidgetDoc(userId, 'budgetWidget', DEFAULTS, '가계부');
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [memo, setMemo] = useState('');

  const entries = Array.isArray(data.entries) ? data.entries : [];
  const thisMonth = entries.filter(e => (e.date || '').startsWith(monthPrefix()));
  const total = thisMonth.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const byCategory = CATEGORIES
    .map(c => ({ ...c, sum: thisMonth.filter(e => e.category === c.key).reduce((s, e) => s + (Number(e.amount) || 0), 0) }))
    .filter(c => c.sum > 0)
    .sort((a, b) => b.sum - a.sum);

  const add = () => {
    const value = Number(String(amount).replace(/[^\d.-]/g, ''));
    if (!value || value <= 0) return;
    update(d => ({ entries: [...(d.entries || []), { id: newId(), date: todayKey(), amount: value, category, memo: memo.trim() }] }));
    setAmount(''); setMemo(''); setAdding(false);
  };
  const remove = (id) => update(d => ({ entries: d.entries.filter(e => e.id !== id) }));

  const recent = [...thisMonth].reverse().slice(0, 30);

  return (
    <div style={widgetRoot}>
      <WidgetHeader
        title="가계부"
        sub={`${new Date().getMonth() + 1}월 지출 ${won(total)}원`}
        right={<button onClick={() => setAdding(!adding)} title="지출 추가" style={adding ? iconBtnActive : iconBtn}><Plus size={16} strokeWidth={2.2} /></button>}
      />

      {adding && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
                 inputMode="numeric" placeholder="금액" style={{ ...field, width: '84px' }} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...field, width: '96px' }}>
            {CATEGORIES.map(c => <option key={c.key} value={c.key} style={{ background: 'var(--editor-bg)' }}>{c.label}</option>)}
          </select>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
                 placeholder="메모(선택)" style={{ ...field, flex: 1 }} />
          <button onClick={add} style={iconBtn} title="저장"><Check size={16} strokeWidth={2.2} /></button>
        </div>
      )}

      {byCategory.length > 0 && (
        <>
          <div style={{ display: 'flex', height: '8px', borderRadius: '5px', overflow: 'hidden', marginBottom: '8px', background: 'var(--chip-bg)' }}>
            {byCategory.map(c => <div key={c.key} style={{ width: `${(c.sum / total) * 100}%`, background: c.color }} />)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: '10px' }}>
            {byCategory.map(c => (
              <span key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: 'var(--txt-dim)' }}>
                <i style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.color, display: 'inline-block' }} />
                {c.label} {won(c.sum)}
              </span>
            ))}
          </div>
        </>
      )}

      <div style={scrollArea}>
        {recent.length === 0 ? (
          <Empty>이번 달 기록이 없습니다.<br />+ 버튼으로 지출을 남기세요.</Empty>
        ) : recent.map(e => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--divider)' }}>
            <i style={{ width: '7px', height: '7px', borderRadius: '50%', background: catOf(e.category).color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.memo || catOf(e.category).label}
              </div>
              <div style={{ fontSize: '0.66rem', color: 'var(--txt-faint)' }}>{e.date?.slice(5)} · {catOf(e.category).label}</div>
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{won(Number(e.amount) || 0)}원</span>
            <button onClick={() => remove(e.id)} title="삭제"
                    style={{ background: 'none', border: 'none', color: 'var(--txt-faint)', cursor: 'pointer', display: 'flex', padding: '2px' }}>
              <X size={13} strokeWidth={2.2} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
