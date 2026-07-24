// components/SearchWidget.jsx — 대시보드를 시작 페이지로 쓸 때의 검색창.
// 마지막에 고른 엔진은 기기별 값이라 localStorage 에 둔다.
import { useState } from 'react';
import { Search } from 'lucide-react';
import { widgetRoot, field, chip } from '../styles/widgetUI';

const ENGINES = [
  { key: 'google', label: '구글', url: (q) => `https://www.google.com/search?q=${q}` },
  { key: 'naver', label: '네이버', url: (q) => `https://search.naver.com/search.naver?query=${q}` },
  { key: 'youtube', label: '유튜브', url: (q) => `https://www.youtube.com/results?search_query=${q}` },
  { key: 'ytmusic', label: '유튜브 뮤직', url: (q) => `https://music.youtube.com/search?q=${q}` }
];

export default function SearchWidget() {
  const [engine, setEngine] = useState(() => localStorage.getItem('search_engine') || 'google');
  const [q, setQ] = useState('');

  const pick = (key) => { setEngine(key); localStorage.setItem('search_engine', key); };

  const submit = (e) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    const target = ENGINES.find(en => en.key === engine) || ENGINES[0];
    window.open(target.url(encodeURIComponent(query)), '_blank', 'noopener,noreferrer');
    setQ('');
  };

  return (
    <div style={{ ...widgetRoot, justifyContent: 'center', gap: '12px' }}>
      <form onSubmit={submit} style={{ display: 'flex', gap: '8px' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="검색어를 입력하세요"
               style={{ ...field, flex: 1, padding: '11px 14px', fontSize: '0.95rem', borderRadius: '14px' }} />
        <button type="submit" title="검색"
                style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Search size={18} strokeWidth={2} />
        </button>
      </form>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {ENGINES.map(en => (
          <div key={en.key} onClick={() => pick(en.key)} style={chip(engine === en.key)}>{en.label}</div>
        ))}
      </div>
    </div>
  );
}
