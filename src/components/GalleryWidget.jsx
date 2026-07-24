// components/GalleryWidget.jsx — 좋아하는 사진 슬라이드쇼.
// 이미지 자체는 저장하지 않고 주소만 보관한다 (Storage 를 쓰지 않는 구성이라).
import { useState, useEffect } from 'react';
import { Plus, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useWidgetDoc, newId } from '../hooks/useWidgetDoc';
import { toast } from './Toast';
import { widgetRoot, iconBtn, iconBtnActive, field } from '../styles/widgetUI';
import { WidgetHeader, Empty } from './widgetKit';

const DEFAULTS = { images: [], intervalSec: 8 };

export default function GalleryWidget({ userId }) {
  const [data, update] = useWidgetDoc(userId, 'galleryWidget', DEFAULTS, '사진');
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [index, setIndex] = useState(0);
  // 깨진 주소는 id 로 기억해 둔다 (사진이 바뀔 때마다 상태를 되돌릴 필요가 없도록)
  const [brokenIds, setBrokenIds] = useState([]);

  const images = Array.isArray(data.images) ? data.images : [];
  const current = images[index % Math.max(images.length, 1)] || null;
  const failed = current ? brokenIds.includes(current.id) : false;

  // 자동 넘김
  useEffect(() => {
    if (images.length < 2) return;
    const sec = Number(data.intervalSec) || 8;
    const t = setInterval(() => setIndex(i => (i + 1) % images.length), sec * 1000);
    return () => clearInterval(t);
  }, [images.length, data.intervalSec]);

  const add = () => {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) { toast('http(s)로 시작하는 이미지 주소를 입력해 주세요.'); return; }
    update(d => ({ images: [...(d.images || []), { id: newId(), url: u, caption: caption.trim() }] }));
    setUrl(''); setCaption(''); setAdding(false);
  };

  const remove = () => {
    if (!current) return;
    update(d => ({ images: d.images.filter(i => i.id !== current.id) }));
    setIndex(0);
  };

  const step = (n) => setIndex(i => (i + n + images.length) % images.length);

  return (
    <div style={widgetRoot}>
      <WidgetHeader
        title="사진"
        sub={images.length ? `${index + 1} / ${images.length}` : '등록된 사진 없음'}
        right={<>
          {current && <button onClick={remove} title="이 사진 삭제" style={iconBtn}><X size={15} strokeWidth={2.2} /></button>}
          <button onClick={() => setAdding(!adding)} title="사진 추가" style={adding ? iconBtnActive : iconBtn}><Plus size={16} strokeWidth={2.2} /></button>
        </>}
      />

      {adding && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
                 placeholder="이미지 주소(https://...)" style={{ ...field, flex: 1 }} />
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="설명(선택)" style={{ ...field, width: '96px' }} />
          <button onClick={add} style={iconBtn} title="저장"><Check size={16} strokeWidth={2.2} /></button>
        </div>
      )}

      {!current ? (
        <Empty>사진이 없습니다.<br />이미지 주소를 + 로 추가하세요.</Empty>
      ) : (
        <div style={{ position: 'relative', flex: 1, minHeight: 0, borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--field-border)', background: 'var(--chip-bg)' }}>
          {failed ? (
            <Empty>이미지를 불러올 수 없습니다.<br />주소를 확인해 주세요.</Empty>
          ) : (
            <img src={current.url} alt={current.caption || ''}
                 onError={() => setBrokenIds(prev => (prev.includes(current.id) ? prev : [...prev, current.id]))}
                 style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}

          {current.caption && !failed && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '18px 12px 10px', color: '#fff', fontSize: '0.8rem', background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}>
              {current.caption}
            </div>
          )}

          {images.length > 1 && (
            <>
              <button onClick={() => step(-1)} title="이전" style={navBtn('left')}><ChevronLeft size={16} strokeWidth={2} /></button>
              <button onClick={() => step(1)} title="다음" style={navBtn('right')}><ChevronRight size={16} strokeWidth={2} /></button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const navBtn = (side) => ({
  position: 'absolute', top: '50%', transform: 'translateY(-50%)', [side]: '8px',
  width: '28px', height: '28px', borderRadius: '50%', border: 'none', cursor: 'pointer',
  background: 'rgba(0,0,0,0.4)', color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
});
