// components/TodoWidget.jsx — 마감일 있는 할 일. 메모 위젯과 달리 완료/기한 개념이 있다.
import { useState } from 'react';
import { Plus, Calendar as CalIcon } from 'lucide-react';
import { useWidgetDoc, newId } from '../hooks/useWidgetDoc';
import { widgetRoot, scrollArea, iconBtn, field, chip, daysUntil } from '../styles/widgetUI';
import { WidgetHeader, Empty, Row, DeleteBtn } from './widgetKit';

const DEFAULTS = { items: [] };

// 마감일까지 남은 일수 → 라벨 + 색
const dueInfo = (due) => {
  if (!due) return null;
  const diff = daysUntil(due);
  if (diff < 0) return { text: `${-diff}일 지남`, color: 'var(--danger)' };
  if (diff === 0) return { text: '오늘', color: 'var(--danger)' };
  if (diff === 1) return { text: '내일', color: '#ff9500' };
  return { text: `${diff}일 남음`, color: 'var(--txt-faint)' };
};

export default function TodoWidget({ userId }) {
  const [data, update] = useWidgetDoc(userId, 'todoWidget', DEFAULTS, '할 일');
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const [showDone, setShowDone] = useState(false);

  const items = Array.isArray(data.items) ? data.items : [];
  const remaining = items.filter(i => !i.done).length;

  const add = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    update(d => ({ items: [...(d.items || []), { id: newId(), text: t, due: due || '', done: false }] }));
    setText(''); setDue('');
  };

  const toggle = (id) => update(d => ({ items: d.items.map(i => (i.id === id ? { ...i, done: !i.done } : i)) }));
  const remove = (id) => update(d => ({ items: d.items.filter(i => i.id !== id) }));
  const clearDone = () => update(d => ({ items: d.items.filter(i => !i.done) }));

  // 미완료 먼저, 그 안에서는 마감일 빠른 순
  const visible = items
    .filter(i => showDone || !i.done)
    .sort((a, b) => (a.done - b.done) || ((a.due || '9999').localeCompare(b.due || '9999')));

  return (
    <div style={widgetRoot}>
      <WidgetHeader
        title="할 일"
        sub={remaining > 0 ? `남은 항목 ${remaining}개` : '모두 끝냈습니다'}
        right={<>
          <div onClick={() => setShowDone(!showDone)} style={chip(showDone)}>완료 표시</div>
        </>}
      />

      <form onSubmit={add} style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="할 일 추가" style={{ ...field, flex: 1 }} />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} title="마감일" style={{ ...field, width: '132px', colorScheme: 'inherit' }} />
        <button type="submit" style={iconBtn} title="추가"><Plus size={16} strokeWidth={2.2} /></button>
      </form>

      <div style={scrollArea}>
        {visible.length === 0 ? (
          <Empty>할 일이 없습니다.<br />위에 입력해 추가하세요.</Empty>
        ) : visible.map(item => {
          const d = dueInfo(item.due);
          return (
            <Row key={item.id}>
              <input type="checkbox" checked={!!item.done} onChange={() => toggle(item.id)}
                     style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: '0.88rem', color: item.done ? 'var(--txt-faint)' : 'var(--txt)', textDecoration: item.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.text}
              </span>
              {d && !item.done && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', color: d.color, flexShrink: 0 }}>
                  <CalIcon size={11} strokeWidth={2} />{d.text}
                </span>
              )}
              <DeleteBtn onClick={() => remove(item.id)} />
            </Row>
          );
        })}
      </div>

      {items.some(i => i.done) && (
        <button onClick={clearDone}
                style={{ background: 'none', border: 'none', color: 'var(--txt-faint)', fontSize: '0.74rem', cursor: 'pointer', padding: '8px 0 0', textAlign: 'center' }}>
          완료한 항목 지우기
        </button>
      )}
    </div>
  );
}
