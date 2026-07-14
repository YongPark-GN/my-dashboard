import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

const STAGES = [
  { id: 'plan', label: '기획' }, { id: 'design', label: '설계' }, { id: 'simulation', label: '해석' }, { id: 'done', label: '완료' }
];

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
    } catch (err) { console.error("Firestore Task 저장 실패:", err); }
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