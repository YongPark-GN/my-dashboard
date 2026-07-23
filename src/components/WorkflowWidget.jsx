import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { toast } from './Toast';

const STAGES = [
  { id: 'plan', label: '기획' }, { id: 'design', label: '설계' }, { id: 'simulation', label: '해석' }, { id: 'done', label: '완료' }
];
const STAGE_ORDER = STAGES.map(s => s.id);
const STAGE_PROGRESS = { plan: 10, design: 40, simulation: 75, done: 100 };

export default function WorkflowWidget({ userId }) {
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem(`tasks_${userId}`);
    return saved ? JSON.parse(saved) : [
      { id: 't1', title: '527mm Enclosure 구조해석 및 압력 검토', stage: 'simulation', progress: 75 },
      { id: 't2', title: '10-BAY GIS 가스 계통도 CAD 도면 설계', stage: 'design', progress: 40 },
      { id: 't3', title: 'M30 앵커 볼트 전단 강도 스펙 수립', stage: 'plan', progress: 10 }
    ];
  });
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    if (!db || !userId) return;
    
    // 핵심 로직: 로그아웃 또는 캘린더 연동 세션 전환 시 크래시를 유발하던 리스너 무제한 오류 차단 추가
    const unsubscribe = onSnapshot(doc(db, "users", userId, "dashboard", "taskData"), (docSnap) => {
      if (docSnap.exists() && docSnap.data()?.list) {
        setTasks(docSnap.data().list);
        localStorage.setItem(`tasks_${userId}`, JSON.stringify(docSnap.data().list));
      }
    }, (err) => {
      console.warn("워크플로우 스냅샷 토큰 유예 수신 가드 활성화:", err.message);
    });
    return () => unsubscribe();
  }, [userId]);

  const saveTasks = async (list) => {
    if (!userId) return;
    localStorage.setItem(`tasks_${userId}`, JSON.stringify(list));
    try {
      if (!db) return;
      await setDoc(doc(db, "users", userId, "dashboard", "taskData"), { list });
    } catch (err) { toast('과제 저장에 실패했습니다. 인터넷 연결을 확인해 주세요.'); }
  };

  const moveTask = (taskId, currentStage, direction) => {
    const targetIdx = STAGE_ORDER.indexOf(currentStage) + direction;
    if (targetIdx < 0 || targetIdx >= STAGE_ORDER.length) return;
    const targetStage = STAGE_ORDER[targetIdx];
    const updated = tasks.map(t => t.id === taskId ? { ...t, stage: targetStage, progress: STAGE_PROGRESS[targetStage] } : t);
    setTasks(updated);
    saveTasks(updated);
  };

  const deleteTask = (taskId) => {
    const updated = tasks.filter(t => t.id !== taskId);
    setTasks(updated);
    saveTasks(updated);
  };

  const startEdit = (task) => { setEditingId(task.id); setEditingText(task.title); };

  const commitEdit = () => {
    if (!editingId) return;
    const trimmed = editingText.trim();
    if (trimmed) {
      const updated = tasks.map(t => t.id === editingId ? { ...t, title: trimmed } : t);
      setTasks(updated);
      saveTasks(updated);
    }
    setEditingId(null);
    setEditingText('');
  };

  const addTask = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !userId) return;
    const updated = [...tasks, { id: 't_' + Date.now(), title: newTaskTitle, stage: 'plan', progress: 0 }];
    setTasks(updated);
    saveTasks(updated);
    setNewTaskTitle('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <form onSubmit={addTask} style={{ display: 'flex', gap: '6px' }}>
          <input type="text" placeholder="새 과제" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '3px 8px', fontSize: '0.75rem', color: '#fff', outline: 'none' }} />
          <button type="submit" style={{ background: '#007aff', color: '#fff', border: 'none', borderRadius: '6px', padding: '3px 8px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}>+ 추가</button>
        </form>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', flex: 1, overflowY: 'auto' }}>
        {STAGES.map(stage => (
          <div key={stage.id} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '14px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>{stage.label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1 }}>
              {tasks.filter(t => t.stage === stage.id).map(task => {
                const stageIdx = STAGE_ORDER.indexOf(stage.id);
                return (
                <div key={task.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '8px', fontSize: '0.7rem' }}>
                  {editingId === task.id ? (
                    <input
                      type="text" value={editingText} autoFocus
                      onChange={(e) => setEditingText(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingId(null); setEditingText(''); } }}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid #007aff', borderRadius: '6px', padding: '3px 5px', fontSize: '0.7rem', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
                    />
                  ) : (
                    <div onDoubleClick={() => startEdit(task)} title="더블클릭하여 수정" style={{ cursor: 'text', wordBreak: 'break-word' }}>{task.title}</div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', gap: '4px' }}>
                    <span style={{ color: '#34c759', flexShrink: 0 }}>{task.progress}%</span>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                      {stageIdx > 0 && <button onClick={() => moveTask(task.id, task.stage, -1)} title="이전 단계" style={ctrlBtn}>←</button>}
                      {stageIdx < STAGE_ORDER.length - 1 && <button onClick={() => moveTask(task.id, task.stage, 1)} title="다음 단계" style={ctrlBtn}>→</button>}
                      <button onClick={() => deleteTask(task.id)} title="삭제" style={{ ...ctrlBtn, color: '#ff453a' }}>×</button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ctrlBtn = {
  background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer',
  borderRadius: '5px', width: '20px', height: '20px', fontSize: '0.85rem', lineHeight: '1',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0
};