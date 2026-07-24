// components/PagePopup.jsx
import React, { useState } from 'react';
import { Check, Copy, Pencil, Plus, Trash2, X } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { MAX_PAGES } from '../hooks/useWidgetLayout';

const popupStyle = {
  position: 'fixed', bottom: '104px', left: '50%', transform: 'translateX(-50%)',
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  padding: '16px', borderRadius: '24px', zIndex: 999,
  border: '1px solid var(--glass-border)',
  boxShadow: '0 16px 40px var(--glass-shadow), inset 0 1px 1px var(--glass-highlight)',
  display: 'flex', flexDirection: 'column', gap: '8px',
  width: '320px', maxWidth: '90vw', maxHeight: '52vh', overflowY: 'auto'
};

const inputStyle = {
  flex: 1, minWidth: 0, background: 'var(--field-bg)', border: '1px solid var(--field-border)',
  borderRadius: '10px', padding: '8px 10px', color: 'var(--txt)', outline: 'none',
  fontSize: '0.88rem', fontFamily: 'inherit'
};

const iconBtnStyle = {
  background: 'transparent', border: 'none', color: 'var(--txt-dim)',
  cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '8px'
};

// 페이지(위젯 배치 한 벌) 목록. 회사/집처럼 상황별 배치를 만들고 전환한다.
export default function PagePopup({ layout }) {
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const startRename = (page) => { setEditingId(page.id); setEditText(page.name); setIsCreating(false); };
  const commitRename = () => {
    if (editingId) layout.renamePage(editingId, editText);
    setEditingId(null); setEditText('');
  };

  const commitCreate = () => {
    layout.createPage(newName);
    setIsCreating(false); setNewName('');
  };

  const isFull = layout.pages.length >= MAX_PAGES;

  return (
    <>
      <div style={popupStyle}>
        <div style={{ fontSize: '0.72rem', color: 'var(--txt-faint)', fontWeight: '600', padding: '0 4px' }}>
          페이지마다 위젯 배치가 따로 저장됩니다
        </div>

        {layout.pages.map((page) => {
          const isActive = page.id === layout.activePageId;
          const isEditing = editingId === page.id;

          return (
            <div key={page.id}
                 style={{
                   display: 'flex', alignItems: 'center', gap: '6px',
                   padding: '8px 10px', borderRadius: '14px',
                   background: isActive ? 'var(--accent)' : 'var(--chip-strong)',
                   border: '1px solid var(--glass-border)'
                 }}>
              {isEditing ? (
                <>
                  <input value={editText} autoFocus
                         onChange={(e) => setEditText(e.target.value)}
                         onKeyDown={(e) => {
                           if (e.key === 'Enter') commitRename();
                           if (e.key === 'Escape') { setEditingId(null); setEditText(''); }
                         }}
                         style={inputStyle} />
                  <button onClick={commitRename} title="저장" style={{ ...iconBtnStyle, color: 'var(--txt)' }}>
                    <Check size={16} strokeWidth={2} />
                  </button>
                  <button onClick={() => { setEditingId(null); setEditText(''); }} title="취소" style={iconBtnStyle}>
                    <X size={16} strokeWidth={2} />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => layout.switchPage(page.id)}
                          style={{
                            flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 'none',
                            color: isActive ? '#fff' : 'var(--txt)', cursor: 'pointer',
                            fontSize: '0.9rem', fontWeight: isActive ? '700' : '600',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}>
                    {page.name}
                  </button>
                  <button onClick={() => startRename(page)} title="이름 변경"
                          style={{ ...iconBtnStyle, color: isActive ? 'rgba(255,255,255,0.85)' : 'var(--txt-dim)' }}>
                    <Pencil size={15} strokeWidth={1.8} />
                  </button>
                  <button onClick={() => layout.duplicatePage(page.id)} title="복제"
                          disabled={isFull}
                          style={{ ...iconBtnStyle, color: isActive ? 'rgba(255,255,255,0.85)' : 'var(--txt-dim)', opacity: isFull ? 0.35 : 1, cursor: isFull ? 'not-allowed' : 'pointer' }}>
                    <Copy size={15} strokeWidth={1.8} />
                  </button>
                  <button onClick={() => setPendingDelete(page)} title="삭제"
                          disabled={layout.pages.length <= 1}
                          style={{ ...iconBtnStyle, color: 'var(--danger)', opacity: layout.pages.length <= 1 ? 0.35 : 1, cursor: layout.pages.length <= 1 ? 'not-allowed' : 'pointer' }}>
                    <Trash2 size={15} strokeWidth={1.8} />
                  </button>
                </>
              )}
            </div>
          );
        })}

        {isCreating ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '14px', background: 'var(--chip-bg)', border: '1px solid var(--glass-border)' }}>
            <input value={newName} autoFocus placeholder="예: 회사, 집"
                   onChange={(e) => setNewName(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') commitCreate();
                     if (e.key === 'Escape') { setIsCreating(false); setNewName(''); }
                   }}
                   style={inputStyle} />
            <button onClick={commitCreate} title="만들기" style={{ ...iconBtnStyle, color: 'var(--txt)' }}>
              <Check size={16} strokeWidth={2} />
            </button>
            <button onClick={() => { setIsCreating(false); setNewName(''); }} title="취소" style={iconBtnStyle}>
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <button onClick={() => { setIsCreating(true); setEditingId(null); }}
                  disabled={isFull}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '9px', borderRadius: '14px', background: 'var(--chip-bg)',
                    border: '1px dashed var(--glass-border)', color: 'var(--txt-dim)',
                    fontSize: '0.85rem', fontWeight: '600',
                    cursor: isFull ? 'not-allowed' : 'pointer', opacity: isFull ? 0.4 : 1
                  }}>
            <Plus size={15} strokeWidth={2} /> {isFull ? `최대 ${MAX_PAGES}개` : '새 페이지'}
          </button>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!pendingDelete}
        message={`'${pendingDelete?.name}' 페이지를 삭제할까요?\n이 페이지의 위젯 배치만 사라지고 메모·마인드맵 내용은 그대로 남습니다.`}
        confirmLabel="삭제"
        onConfirm={() => { layout.deletePage(pendingDelete.id); setPendingDelete(null); }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
