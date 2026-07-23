// components/MemoWidget.jsx — 포스트잇 스타일의 단순 메모 패드
import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from './Toast';
import { Plus, X } from 'lucide-react';

const NOTE_COLORS = ['#fff4a3', '#ffb3ba', '#bae1ff', '#baffc9'];

export default function MemoWidget({ userId }) {
  const [notes, setNotes] = useState([]);
  const lastLocalEdit = useRef(0);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!db || !userId) return;
    const ref = doc(db, 'users', userId, 'dashboard', 'memoWidget');
    const unsub = onSnapshot(ref, (snap) => {
      // 방금 로컬에서 수정 중이면 원격 에코로 덮어쓰지 않음(타이핑 레이스 방지)
      if (Date.now() - lastLocalEdit.current < 2000) return;
      if (!snap.exists()) return;
      const data = snap.data();
      if (Array.isArray(data.notes)) {
        setNotes(data.notes);
      } else if (Array.isArray(data.memos)) {
        // 이전 메모(탭/마크다운) 데이터를 포스트잇으로 1회 마이그레이션
        setNotes(data.memos.map((m, i) => ({
          id: m.id || `${Date.now()}_${i}`,
          text: [m.title, m.text].filter(Boolean).join('\n'),
          color: NOTE_COLORS[i % NOTE_COLORS.length],
        })));
      }
    });
    return () => unsub();
  }, [userId]);

  const save = async (next) => {
    if (!userId) return;
    try {
      await setDoc(doc(db, 'users', userId, 'dashboard', 'memoWidget'),
        { notes: next, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) { toast('메모 저장에 실패했습니다.'); }
  };

  const addNote = () => {
    lastLocalEdit.current = Date.now();
    const next = [...notes, { id: Date.now().toString(), text: '', color: NOTE_COLORS[notes.length % NOTE_COLORS.length] }];
    setNotes(next); save(next);
  };

  const updateText = (id, text) => {
    lastLocalEdit.current = Date.now();
    setNotes(prev => {
      const next = prev.map(n => n.id === id ? { ...n, text } : n);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => save(next), 700);
      return next;
    });
  };

  const changeColor = (id, color) => {
    lastLocalEdit.current = Date.now();
    const next = notes.map(n => n.id === id ? { ...n, color } : n);
    setNotes(next); save(next);
  };

  const deleteNote = (id) => {
    lastLocalEdit.current = Date.now();
    const next = notes.filter(n => n.id !== id);
    setNotes(next); save(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: '700', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>메모</span>
        <button onClick={addNote} title="새 메모" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
          <Plus size={16} strokeWidth={2.2} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', alignContent: 'start' }}>
        {notes.length === 0 && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '80px', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
            + 버튼으로 메모를 추가하세요
          </div>
        )}
        {notes.map(note => (
          <div key={note.id} style={{ background: note.color, borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column', minHeight: '118px', boxShadow: '0 4px 14px rgba(0,0,0,0.28)' }}>
            <textarea
              value={note.text}
              onChange={(e) => updateText(note.id, e.target.value)}
              placeholder="메모..."
              style={{ flex: 1, background: 'transparent', border: 'none', resize: 'none', outline: 'none', color: '#3a3a3a', fontSize: '0.82rem', lineHeight: '1.45', fontWeight: '500', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <div style={{ display: 'flex', gap: '5px' }}>
                {NOTE_COLORS.map(c => (
                  <button key={c} onClick={() => changeColor(note.id, c)} title="색상"
                    style={{ width: '13px', height: '13px', borderRadius: '50%', background: c, border: note.color === c ? '1.5px solid #3a3a3a' : '1px solid rgba(0,0,0,0.15)', cursor: 'pointer', padding: 0 }} />
                ))}
              </div>
              <button onClick={() => deleteNote(note.id)} title="삭제" style={{ background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.45)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}>
                <X size={14} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
