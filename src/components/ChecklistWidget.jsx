// components/ChecklistWidget.jsx — 이름만 다른 단순 체크리스트를 여러 벌 쓰기 위한 위젯.
// 장보기 목록처럼 "적어두고 → 현장에서 체크 → 비우기" 흐름에 맞춰져 있다.
// 마감일·정렬이 필요한 업무용 목록은 TodoWidget 을 쓸 것.
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useWidgetDoc, newId } from '../hooks/useWidgetDoc';
import { widgetRoot, scrollArea, iconBtn, field } from '../styles/widgetUI';
import { WidgetHeader, Empty, Row } from './widgetKit';

const DEFAULTS = { items: [] };

export default function ChecklistWidget({ userId, docId, title, placeholder = '항목 추가' }) {
  const [data, update] = useWidgetDoc(userId, docId, DEFAULTS, title);
  const [text, setText] = useState('');

  const items = Array.isArray(data.items) ? data.items : [];
  const remaining = items.filter(i => !i.done).length;

  const add = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    update(d => ({ items: [...(d.items || []), { id: newId(), text: t, done: false }] }));
    setText('');
  };
  const toggle = (id) => update(d => ({ items: d.items.map(i => (i.id === id ? { ...i, done: !i.done } : i)) }));
  const remove = (id) => update(d => ({ items: d.items.filter(i => i.id !== id) }));
  const clearDone = () => update(d => ({ items: d.items.filter(i => !i.done) }));

  return (
    <div style={widgetRoot}>
      <WidgetHeader title={title} sub={items.length ? `${remaining} / ${items.length}개 남음` : '비어 있음'} />

      <form onSubmit={add} style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} style={{ ...field, flex: 1 }} />
        <button type="submit" style={iconBtn} title="추가"><Plus size={16} strokeWidth={2.2} /></button>
      </form>

      <div style={scrollArea}>
        {items.length === 0 ? (
          <Empty>비어 있습니다.<br />위에 입력해 추가하세요.</Empty>
        ) : items.map(item => (
          <Row key={item.id}>
            <input type="checkbox" checked={!!item.done} onChange={() => toggle(item.id)}
                   style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: '0.88rem', color: item.done ? 'var(--txt-faint)' : 'var(--txt)', textDecoration: item.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.text}
            </span>
            <button onClick={() => remove(item.id)} title="삭제"
                    style={{ background: 'none', border: 'none', color: 'var(--txt-faint)', cursor: 'pointer', display: 'flex', padding: '2px' }}>
              <X size={13} strokeWidth={2.2} />
            </button>
          </Row>
        ))}
      </div>

      {items.some(i => i.done) && (
        <button onClick={clearDone}
                style={{ background: 'none', border: 'none', color: 'var(--txt-faint)', fontSize: '0.74rem', cursor: 'pointer', padding: '8px 0 0', textAlign: 'center' }}>
          담은 항목 비우기
        </button>
      )}
    </div>
  );
}
