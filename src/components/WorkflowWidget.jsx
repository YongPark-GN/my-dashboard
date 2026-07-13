import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

const STAGES = [
  { id: 'plan', label: '기획' },
  { id: 'design', label: '설계' },
  { id: 'simulation', label: '해석' },
  { id: 'done', label: '완료' }
];

export default function WorkflowWidget() {
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
    if (!db) return;
    const unsubscribe = onSnapshot(doc(db, "dashboard", "taskData"), (docSnap) => {
      if (docSnap.exists() && docSnap.data()?.list) setTasks(docSnap.data().list);
    });
    return () => unsubscribe();
  }, []);

  const saveTasks = async (list) => {
    await setDoc(doc(db, "dashboard", "taskData"), { list });
  };

  const moveTaskStage = (taskId, currentStage) => {
    const stageOrder = ['plan', 'design', 'simulation', 'done'];
    const nextIdx = stageOrder.indexOf(currentStage) + 1;
    if (nextIdx >= stageOrder.length) return;
    const updated = tasks.map(t => t.id === taskId ? { ...t, stage: stageOrder[nextIdx], progress: nextIdx === 3 ? 100 : Math.min(90, t.progress + 25) } : t);
    setTasks(updated);
    saveTasks(updated);
  };

  const addTask = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const updated = [...tasks, { id: 't_' + Date.now(), title: newTaskTitle, stage: 'plan', progress: 0 }];
    setTasks(updated);
    saveTasks(updated);
    setNewTaskTitle('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>공정 파이프라인</span>
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
              {tasks.filter(t => t.stage === stage.id).map(task => (
                <div key={task.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '8px', fontSize: '0.7rem' }}>
                  <div>{task.title}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                    <span style={{ color: '#34c759' }}>{task.progress}%</span>
                    {stage.id !== 'done' && <button onClick={() => moveTaskStage(task.id, task.stage)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer' }}>➔</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}