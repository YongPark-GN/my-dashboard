import React, { useState, useEffect } from 'react';
import { toast } from './Toast';
import ConfirmDialog from './ConfirmDialog';

export default function SchedulerWidget({ isLoggedIn, login, accessToken, selectedDate }) {
  const [events, setEvents] = useState([]);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('12:00');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const fetchEvents = async () => {
    if (!accessToken) return;
    try {
      const start = new Date(selectedDate); start.setHours(0,0,0,0);
      const end = new Date(selectedDate); end.setHours(23,59,59,999);
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true&orderBy=startTime`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.items) {
        setEvents(data.items.map(i => ({ id: i.id, title: i.summary || '제목 없음', start: i.start.dateTime || i.start.date })));
      }
    } catch(e) { toast('일정을 불러오지 못했습니다.'); }
  };

  useEffect(() => { fetchEvents(); }, [accessToken, selectedDate]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newEventTitle || !accessToken) return;
    const [hh, mm] = newEventTime.split(':');
    const startDt = new Date(selectedDate); startDt.setHours(hh, mm, 0);
    const endDt = new Date(startDt); endDt.setHours(startDt.getHours() + 1);

    try {
      await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: newEventTitle,
          start: { dateTime: startDt.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
          end: { dateTime: endDt.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
        })
      });
      setNewEventTitle('');
      fetchEvents();
    } catch(e) { toast('일정 추가에 실패했습니다.'); }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      fetchEvents();
    } catch(e) { toast('일정 삭제에 실패했습니다.'); }
  };

  if (!isLoggedIn) {
    return (
      <div style={{ display:'flex', height:'100%', alignItems:'center', justifyContent:'center' }}>
        <button onClick={() => login()} style={{ padding: '12px 24px', borderRadius: '16px', background: '#007aff', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '700' }}>Google 캘린더 연동</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <input type="time" value={newEventTime} onChange={e=>setNewEventTime(e.target.value)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '12px', padding: '10px', outline: 'none' }} />
        <input type="text" placeholder="새 일정 내용..." value={newEventTitle} onChange={e=>setNewEventTitle(e.target.value)} style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '12px', padding: '10px 14px', outline: 'none' }} />
        <button type="submit" style={{ background: '#007aff', color: '#fff', border: 'none', borderRadius: '12px', padding: '0 16px', cursor: 'pointer', fontWeight: '700' }}>추가</button>
      </form>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {events.length === 0 ? <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: '30px', fontSize: '0.9rem' }}>일정이 없습니다.</div> : null}
        {events.map(ev => (
          <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>{ev.title}</span>
              <span style={{ fontSize: '0.8rem', color: '#007aff', fontWeight: '500' }}>{new Date(ev.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
            </div>
            <button onClick={() => setPendingDeleteId(ev.id)} style={{ background: 'rgba(255,59,48,0.15)', color: '#ff3b30', border: 'none', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700' }}>삭제</button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        message={'이 일정을 삭제하시겠습니까?'}
        confirmLabel="삭제"
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => { handleDelete(pendingDeleteId); setPendingDeleteId(null); }}
      />
    </div>
  );
}