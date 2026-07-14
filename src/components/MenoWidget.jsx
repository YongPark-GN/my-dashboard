import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export default function MemoWidget({ userId }) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = onSnapshot(doc(db, 'users', userId, 'dashboard', 'memo'), (docSnap) => {
      if (docSnap.exists()) setText(docSnap.data().text || '');
    });
    return () => unsubscribe();
  }, [userId]);

  const handleChange = (e) => {
    setText(e.target.value);
    setDoc(doc(db, 'users', userId, 'dashboard', 'memo'), { text: e.target.value }, { merge: true });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="빠른 메모 입력..."
        style={{
          flex: 1, width: '100%', height: '100%',
          background: '#fef1bc', color: '#333',
          border: 'none', borderRadius: '16px',
          padding: '20px', fontSize: '1rem', lineHeight: '1.5',
          fontWeight: '500', resize: 'none',
          outline: 'none', fontFamily: 'inherit',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.05)',
          boxSizing: 'border-box'
        }}
      />
    </div>
  );
}