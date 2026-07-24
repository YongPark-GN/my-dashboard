// components/SnippetWidget.jsx — 자주 쓰는 텍스트·명령어를 눌러서 바로 복사.
import { useState } from 'react';
import { Plus, X, Check, Copy } from 'lucide-react';
import { useWidgetDoc, newId } from '../hooks/useWidgetDoc';
import { toast } from './Toast';
import { widgetRoot, scrollArea, iconBtn, iconBtnActive, field } from '../styles/widgetUI';
import { WidgetHeader, Empty, Row } from './widgetKit';

const DEFAULTS = { items: [] };

// navigator.clipboard 는 보안 컨텍스트에서만 동작한다 → 실패하면 안내
const copy = async (text, label) => {
  try {
    await navigator.clipboard.writeText(text);
    toast(`'${label}' 복사했습니다.`);
  } catch {
    toast('복사에 실패했습니다. 직접 선택해 복사해 주세요.');
  }
};

export default function SnippetWidget({ userId }) {
  const [data, update] = useWidgetDoc(userId, 'snippetWidget', DEFAULTS, '스니펫');
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');

  const items = Array.isArray(data.items) ? data.items : [];

  const add = () => {
    const t = text.trim();
    if (!t) return;
    update(d => ({ items: [...(d.items || []), { id: newId(), label: label.trim() || t.slice(0, 20), text: t }] }));
    setLabel(''); setText(''); setAdding(false);
  };
  const remove = (id) => update(d => ({ items: d.items.filter(i => i.id !== id) }));

  return (
    <div style={widgetRoot}>
      <WidgetHeader
        title="스니펫"
        sub="눌러서 클립보드에 복사"
        right={<button onClick={() => setAdding(!adding)} title="추가" style={adding ? iconBtnActive : iconBtn}><Plus size={16} strokeWidth={2.2} /></button>}
      />

      {adding && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="이름(선택)" style={field} />
          <div style={{ display: 'flex', gap: '6px' }}>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="복사할 내용"
                      style={{ ...field, flex: 1, height: '58px', resize: 'none', lineHeight: 1.5 }} />
            <button onClick={add} style={iconBtn} title="저장"><Check size={16} strokeWidth={2.2} /></button>
          </div>
        </div>
      )}

      <div style={scrollArea}>
        {items.length === 0 ? (
          <Empty>스니펫이 없습니다.<br />자주 쓰는 문구를 등록하세요.</Empty>
        ) : items.map(item => (
          <Row key={item.id} onClick={() => copy(item.text, item.label)}>
            <Copy size={14} strokeWidth={1.8} style={{ color: 'var(--txt-faint)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--txt-faint)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.text}
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); remove(item.id); }} title="삭제"
                    style={{ background: 'none', border: 'none', color: 'var(--txt-faint)', cursor: 'pointer', display: 'flex', padding: '2px' }}>
              <X size={13} strokeWidth={2.2} />
            </button>
          </Row>
        ))}
      </div>
    </div>
  );
}
