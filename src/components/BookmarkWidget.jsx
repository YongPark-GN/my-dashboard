// components/BookmarkWidget.jsx — 자주 쓰는 링크 바로가기. 페이지별로 회사/집 링크를 나눠 쓰기 좋다.
import { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { useWidgetDoc, newId } from '../hooks/useWidgetDoc';
import { widgetRoot, scrollArea, iconBtn, iconBtnActive, field } from '../styles/widgetUI';
import { WidgetHeader, Empty } from './widgetKit';

const DEFAULTS = { links: [] };

const withScheme = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);
const hostOf = (url) => { try { return new URL(withScheme(url)).hostname; } catch { return ''; } };
const faviconOf = (url) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(url))}&sz=64`;

export default function BookmarkWidget({ userId }) {
  const [data, update] = useWidgetDoc(userId, 'bookmarkWidget', DEFAULTS, '북마크');
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [editing, setEditing] = useState(false);

  const links = Array.isArray(data.links) ? data.links : [];

  const add = () => {
    const u = url.trim();
    if (!u) return;
    update(d => ({ links: [...(d.links || []), { id: newId(), title: title.trim() || hostOf(u), url: withScheme(u) }] }));
    setTitle(''); setUrl(''); setAdding(false);
  };
  const remove = (id) => update(d => ({ links: d.links.filter(l => l.id !== id) }));

  return (
    <div style={widgetRoot}>
      <WidgetHeader
        title="바로가기"
        sub={`${links.length}개`}
        right={<>
          {links.length > 0 && (
            <button onClick={() => setEditing(!editing)} title="편집" style={editing ? iconBtnActive : iconBtn}>
              <X size={15} strokeWidth={2.2} />
            </button>
          )}
          <button onClick={() => setAdding(!adding)} title="링크 추가" style={adding ? iconBtnActive : iconBtn}>
            <Plus size={16} strokeWidth={2.2} />
          </button>
        </>}
      />

      {adding && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="이름(선택)" style={{ ...field, width: '96px' }} />
          <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="주소" style={{ ...field, flex: 1 }} />
          <button onClick={add} style={iconBtn} title="저장"><Check size={16} strokeWidth={2.2} /></button>
        </div>
      )}

      <div style={scrollArea}>
        {links.length === 0 ? (
          <Empty>링크가 없습니다.<br />+ 버튼으로 추가하세요.</Empty>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: '10px' }}>
            {links.map(l => (
              <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                 style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textDecoration: 'none', color: 'var(--txt)' }}>
                <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: 'var(--chip-strong)', border: '1px solid var(--field-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <img src={faviconOf(l.url)} alt="" width="24" height="24" style={{ borderRadius: '5px' }}
                       onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--txt-dim)', textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.title}
                </span>
                {editing && (
                  <button onClick={(e) => { e.preventDefault(); remove(l.id); }} title="삭제"
                          style={{ position: 'absolute', top: '-4px', right: '4px', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--danger)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <X size={11} strokeWidth={3} />
                  </button>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
