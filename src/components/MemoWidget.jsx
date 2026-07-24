// components/MemoWidget.jsx — 탭 + 마크다운 메모. 보기 좋게 렌더링, 체크리스트 클릭 토글 지원.
import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from './Toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Plus, X, Pencil, Check, CheckSquare, Bold, Minus } from 'lucide-react';

// 메모 본문 마크다운 렌더 스타일 (한 번만 주입)
const MEMO_STYLE = `
  .memo-md { font-size: 0.92rem; line-height: 1.65; color: var(--txt); word-break: break-word; }
  .memo-md h1,.memo-md h2,.memo-md h3 { margin: 4px 0 8px; line-height: 1.3; }
  .memo-md h1 { font-size: 1.25rem; } .memo-md h2 { font-size: 1.1rem; } .memo-md h3 { font-size: 1rem; }
  .memo-md p { margin: 6px 0; }
  .memo-md ul,.memo-md ol { margin: 6px 0; padding-left: 20px; }
  .memo-md li { margin: 3px 0; }
  .memo-md li.task-list-item { list-style: none; margin-left: -20px; display: flex; align-items: flex-start; gap: 8px; }
  .memo-md a { color: var(--accent-text); }
  .memo-md code { background: var(--chip-strong); padding: 1px 5px; border-radius: 5px; font-size: 0.85em; }
  .memo-md hr { border: none; border-top: 1px solid var(--divider); margin: 12px 0; }
  .memo-md blockquote { border-left: 3px solid var(--accent); margin: 8px 0; padding: 2px 0 2px 12px; color: var(--txt-dim); }
  .memo-md input[type="checkbox"] { width: 16px; height: 16px; margin-top: 2px; accent-color: var(--accent); cursor: pointer; flex-shrink: 0; }
`;
if (typeof document !== 'undefined' && !document.getElementById('memo-md-style')) {
  const s = document.createElement('style');
  s.id = 'memo-md-style';
  s.innerHTML = MEMO_STYLE;
  document.head.appendChild(s);
}

const DEFAULT_MEMO = {
  id: 'default', title: '메모',
  text: '- [ ] 할 일을 적어보세요\n- [x] 완료한 항목\n\n**굵게**, *기울임*, `코드` 등 마크다운을 지원합니다.',
};
const firstLine = (t) => {
  const line = (t || '').split('\n').find(l => l.trim());
  return line ? line.replace(/^[#\-*\s[\]xX]+/, '').trim().slice(0, 20) || '메모' : '메모';
};

export default function MemoWidget({ userId }) {
  const [memos, setMemos] = useState([DEFAULT_MEMO]);
  const [activeId, setActiveId] = useState('default');
  const [editing, setEditing] = useState(false);
  const lastLocalEdit = useRef(0);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!db || !userId) return;
    const ref = doc(db, 'users', userId, 'dashboard', 'memoWidget');
    const unsub = onSnapshot(ref, (snap) => {
      if (Date.now() - lastLocalEdit.current < 2000) return;
      if (!snap.exists()) return;
      const data = snap.data();
      let list = null;
      if (Array.isArray(data.memos) && data.memos.length) {
        list = data.memos.map(m => ({ id: String(m.id ?? Date.now()), title: m.title || firstLine(m.text), text: m.text || '' }));
      } else if (Array.isArray(data.notes) && data.notes.length) {
        // 포스트잇(notes) 데이터 → 마크다운 메모로 마이그레이션
        list = data.notes.map((n, i) => ({ id: String(n.id ?? `${Date.now()}_${i}`), title: firstLine(n.text), text: n.text || '' }));
      }
      if (list && list.length) {
        setMemos(list);
        setActiveId(prev => (list.find(m => m.id === prev) ? prev : list[0].id));
      }
    });
    return () => unsub();
  }, [userId]);

  const save = async (list) => {
    if (!userId) return;
    try {
      await setDoc(doc(db, 'users', userId, 'dashboard', 'memoWidget'), { memos: list, updatedAt: new Date().toISOString() }, { merge: true });
    } catch { toast('메모 저장에 실패했습니다.'); }
  };

  const active = memos.find(m => m.id === activeId) || memos[0];

  const patchActive = (patch, debounce = false) => {
    lastLocalEdit.current = Date.now();
    setMemos(prev => {
      const next = prev.map(m => m.id === active.id ? { ...m, ...patch } : m);
      clearTimeout(saveTimer.current);
      if (debounce) saveTimer.current = setTimeout(() => save(next), 700);
      else save(next);
      return next;
    });
  };

  const addMemo = () => {
    lastLocalEdit.current = Date.now();
    const m = { id: Date.now().toString(), title: '새 메모', text: '' };
    const next = [...memos, m];
    setMemos(next); setActiveId(m.id); setEditing(true); save(next);
  };

  const deleteMemo = (id, e) => {
    e.stopPropagation();
    if (memos.length === 1) return;
    // eslint-disable-next-line react-hooks/purity -- 이벤트 핸들러(렌더 아님)에서의 타임스탬프 기록
    lastLocalEdit.current = Date.now();
    const next = memos.filter(m => m.id !== id);
    setMemos(next);
    if (activeId === id) setActiveId(next[0].id);
    save(next);
  };

  // 뷰 모드 체크박스 클릭 → 원문 토글
  const toggleChecklistItem = (index) => {
    let count = -1;
    const updated = (active.text || '').split('\n').map(line => {
      const m = line.match(/^(\s*[-*]\s+)\[([ xX])\](\s+.*)$/);
      if (m) {
        count++;
        if (count === index) {
          const checked = m[2].toLowerCase() === 'x';
          return `${m[1]}[${checked ? ' ' : 'x'}]${m[3]}`;
        }
      }
      return line;
    }).join('\n');
    patchActive({ text: updated });
  };

  const insertMd = (prefix, suffix = '') => {
    const ta = document.getElementById('memo-textarea');
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const t = active.text || '';
    const sel = t.substring(start, end) || '텍스트';
    patchActive({ text: t.substring(0, start) + prefix + sel + suffix + t.substring(end) }, true);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + prefix.length, start + prefix.length + sel.length); }, 0);
  };

  // 렌더 시 체크박스 인덱스 카운터 (렌더 순서대로 증가)
  let cbIndex = 0;
  const mdComponents = {
    input: ({ type, checked }) => {
      if (type === 'checkbox') {
        const idx = cbIndex++;
        return <input type="checkbox" checked={!!checked} onChange={() => toggleChecklistItem(idx)} />;
      }
      return null;
    },
  };

  const iconBtn = { background: 'var(--chip-strong)', border: '1px solid var(--field-border)', borderRadius: '9px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt)', cursor: 'pointer', flexShrink: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minHeight: 0 }}>
      {/* 헤더: 제목 + 편집/추가 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        {editing ? (
          <input value={active.title} onChange={(e) => patchActive({ title: e.target.value }, true)} placeholder="제목"
                 style={{ flex: 1, minWidth: 0, background: 'var(--field-bg)', border: '1px solid var(--field-border)', borderRadius: '9px', padding: '6px 10px', color: 'var(--txt)', fontSize: '0.95rem', fontWeight: '700', outline: 'none' }} />
        ) : (
          <span style={{ flex: 1, minWidth: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.title}</span>
        )}
        <button onClick={() => setEditing(!editing)} title={editing ? '완료' : '편집'} style={{ ...iconBtn, ...(editing ? { background: 'var(--accent)', color: '#fff', borderColor: 'transparent' } : {}) }}>
          {editing ? <Check size={16} strokeWidth={2.2} /> : <Pencil size={15} strokeWidth={2} />}
        </button>
        <button onClick={addMemo} title="새 메모" style={iconBtn}><Plus size={16} strokeWidth={2.2} /></button>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, marginBottom: '10px' }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" onClick={() => insertMd('- [ ] ')} title="할 일" style={iconBtn}><CheckSquare size={15} /></button>
              <button type="button" onClick={() => insertMd('**', '**')} title="굵게" style={iconBtn}><Bold size={15} /></button>
              <button type="button" onClick={() => insertMd('\n---\n')} title="구분선" style={iconBtn}><Minus size={15} /></button>
            </div>
            <textarea id="memo-textarea" value={active.text} onChange={(e) => patchActive({ text: e.target.value }, true)}
                      placeholder="마크다운으로 자유롭게 작성하세요"
                      style={{ flex: 1, width: '100%', background: 'var(--field-bg)', border: '1px solid var(--field-border)', borderRadius: '12px', padding: '12px', color: 'var(--txt)', fontSize: '0.9rem', lineHeight: '1.6', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
        ) : (
          <div className="memo-md">
            {active.text?.trim()
              ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{active.text}</ReactMarkdown>
              : <span style={{ color: 'var(--txt-faint)', fontSize: '0.9rem' }}>내용이 없습니다. 연필 아이콘으로 작성하세요.</span>}
          </div>
        )}
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
        {memos.map(m => (
          <div key={m.id} onClick={() => { setActiveId(m.id); setEditing(false); }}
               style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '11px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                        background: activeId === m.id ? 'var(--accent)' : 'var(--chip-bg)',
                        color: activeId === m.id ? '#fff' : 'var(--txt-dim)',
                        fontSize: '0.8rem', fontWeight: activeId === m.id ? '700' : '500',
                        border: `1px solid ${activeId === m.id ? 'transparent' : 'var(--field-border)'}` }}>
            {m.title || '메모'}
            {memos.length > 1 && (
              <span onClick={(e) => deleteMemo(m.id, e)} style={{ display: 'flex', opacity: 0.7 }}><X size={12} strokeWidth={2.5} /></span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
