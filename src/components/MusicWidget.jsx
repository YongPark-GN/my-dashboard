// components/MusicWidget.jsx — 유튜브 뮤직.
// YouTube Music 은 공개 API 가 없어서, 저장해 둔 재생목록/곡을 YouTube 임베드 플레이어로 재생한다.
// (music.youtube.com 의 list=/v= 값은 임베드 플레이어에서 그대로 동작한다.
//  단 '좋아요 표시한 음악'(LM)이나 자동 생성 라디오(RD...)는 임베드가 막혀 있다 → 원본 열기로 안내)
import { useState } from 'react';
import { Plus, X, Check, Play, ExternalLink, Music } from 'lucide-react';
import { useWidgetDoc, newId } from '../hooks/useWidgetDoc';
import { toast } from './Toast';
import { widgetRoot, scrollArea, iconBtn, iconBtnActive, field } from '../styles/widgetUI';
import { WidgetHeader, Empty, Row } from './widgetKit';

const DEFAULTS = { tracks: [], lastId: '' };

// 임베드가 불가능한 목록 종류 (개인 라이브러리 / 자동 생성 라디오)
const NOT_EMBEDDABLE = /^(LM|RD|LL)/;

/** YouTube / YouTube Music 주소에서 재생목록 id 또는 영상 id 를 뽑는다. */
function parseYouTube(input) {
  const raw = (input || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, '');
    if (!/(^|\.)youtube\.com$|^music\.youtube\.com$|^youtu\.be$/.test(host)) return null;

    const list = url.searchParams.get('list');
    if (list) return { kind: 'playlist', key: list };

    const v = url.searchParams.get('v');
    if (v) return { kind: 'video', key: v };

    if (host === 'youtu.be') {
      const id = url.pathname.slice(1);
      if (id) return { kind: 'video', key: id };
    }
    return null;
  } catch {
    return null;
  }
}

const embedSrc = (t) => (t.kind === 'playlist'
  ? `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(t.key)}&rel=0`
  : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(t.key)}?rel=0`);

const musicUrl = (t) => (t.kind === 'playlist'
  ? `https://music.youtube.com/playlist?list=${encodeURIComponent(t.key)}`
  : `https://music.youtube.com/watch?v=${encodeURIComponent(t.key)}`);

export default function MusicWidget({ userId }) {
  const [data, update] = useWidgetDoc(userId, 'musicWidget', DEFAULTS, '음악');
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  // 재생은 사용자가 누를 때만 시작한다 (위젯이 뜨자마자 소리가 나면 안 되므로)
  const [playingId, setPlayingId] = useState(null);

  const tracks = Array.isArray(data.tracks) ? data.tracks : [];
  const playing = tracks.find(t => t.id === playingId) || null;

  const add = () => {
    const parsed = parseYouTube(url);
    if (!parsed) { toast('유튜브 뮤직 / 유튜브 주소만 추가할 수 있습니다.'); return; }
    const track = { id: newId(), title: title.trim() || (parsed.kind === 'playlist' ? '재생목록' : '곡'), ...parsed };
    update(d => ({ tracks: [...(d.tracks || []), track] }));
    setTitle(''); setUrl(''); setAdding(false);
  };

  const remove = (id) => {
    if (playingId === id) setPlayingId(null);
    update(d => ({ tracks: d.tracks.filter(t => t.id !== id) }));
  };

  const play = (t) => {
    if (NOT_EMBEDDABLE.test(t.key)) {
      toast('개인 라이브러리·자동 재생목록은 임베드할 수 없습니다. 원본 열기로 이용하세요.');
      return;
    }
    setPlayingId(t.id);
    update({ lastId: t.id });
  };

  return (
    <div style={widgetRoot}>
      <WidgetHeader
        title="유튜브 뮤직"
        sub={playing ? playing.title : `저장한 목록 ${tracks.length}개`}
        right={<>
          {playing && (
            <button onClick={() => setPlayingId(null)} title="플레이어 닫기" style={iconBtn}><X size={15} strokeWidth={2.2} /></button>
          )}
          <button onClick={() => setAdding(!adding)} title="추가" style={adding ? iconBtnActive : iconBtn}><Plus size={16} strokeWidth={2.2} /></button>
        </>}
      />

      {adding && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="이름(선택)" style={field} />
          <div style={{ display: 'flex', gap: '6px' }}>
            <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
                   placeholder="music.youtube.com 주소 붙여넣기" style={{ ...field, flex: 1 }} />
            <button onClick={add} style={iconBtn} title="저장"><Check size={16} strokeWidth={2.2} /></button>
          </div>
        </div>
      )}

      {playing && (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--field-border)', background: '#000', marginBottom: '10px', flexShrink: 0 }}>
          <iframe
            key={playing.id}
            src={`${embedSrc(playing)}&autoplay=1`}
            title={playing.title}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      <div style={scrollArea}>
        {tracks.length === 0 ? (
          <Empty>재생목록이 없습니다.<br />유튜브 뮤직에서 주소를 복사해 + 로 추가하세요.</Empty>
        ) : tracks.map(t => (
          <Row key={t.id} onClick={() => play(t)} style={{ background: playingId === t.id ? 'var(--chip-bg)' : 'transparent', borderRadius: playingId === t.id ? '10px' : 0, paddingLeft: '6px', paddingRight: '6px' }}>
            {playingId === t.id
              ? <Music size={14} strokeWidth={2} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
              : <Play size={14} strokeWidth={2} style={{ color: 'var(--txt-faint)', flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--txt-faint)' }}>{t.kind === 'playlist' ? '재생목록' : '단일 곡'}</div>
            </div>
            <a href={musicUrl(t)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="유튜브 뮤직에서 열기"
               style={{ color: 'var(--txt-faint)', display: 'flex', padding: '2px' }}>
              <ExternalLink size={13} strokeWidth={2} />
            </a>
            <button onClick={(e) => { e.stopPropagation(); remove(t.id); }} title="삭제"
                    style={{ background: 'none', border: 'none', color: 'var(--txt-faint)', cursor: 'pointer', display: 'flex', padding: '2px' }}>
              <X size={13} strokeWidth={2.2} />
            </button>
          </Row>
        ))}
      </div>
    </div>
  );
}
