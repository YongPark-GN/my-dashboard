import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { toast } from './Toast';
import ConfirmDialog from './ConfirmDialog';

// 달력(월 뷰)과 구글 캘린더 일정(선택한 날짜의 아젠다)을 한 위젯으로 통합.
export default function CalendarWidget({ isLoggedIn, login, accessToken }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('12:00');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const fetchEvents = async () => {
    if (!accessToken) return;
    try {
      const start = new Date(selectedDate); start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate); end.setHours(23, 59, 59, 999);
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true&orderBy=startTime`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.items) {
        setEvents(data.items.map(i => ({ id: i.id, title: i.summary || '제목 없음', start: i.start.dateTime || i.start.date })));
      } else {
        setEvents([]);
      }
    } catch (e) { toast('일정을 불러오지 못했습니다.'); }
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
    } catch (e) { toast('일정 추가에 실패했습니다.'); }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      fetchEvents();
    } catch (e) { toast('일정 삭제에 실패했습니다.'); }
  };

  const dateLabel = selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  return (
    <div style={{ display: 'flex', gap: '20px', height: '100%', width: '100%', flexWrap: 'wrap' }}>
      {/* 좌: 달력 */}
      <div style={{ flex: '1 1 240px', minWidth: '220px', display: 'flex', alignItems: 'flex-start' }}>
        <Calendar
          onChange={setSelectedDate}
          value={selectedDate}
          calendarType="gregory"
          tileClassName={({ date, view }) => view === 'month' ? (date.getDay() === 6 ? 'sat-tile' : date.getDay() === 0 ? 'sun-tile' : null) : null}
          formatDay={(locale, d) => d.getDate().toString()}
        />
      </div>

      {/* 우: 선택한 날짜 일정 */}
      <div style={{ flex: '1 1 240px', minWidth: '220px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ fontSize: '1rem', fontWeight: '700', color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#007aff' }} />
          {dateLabel}
        </div>

        {!isLoggedIn ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>구글 캘린더를 연동하면<br />일정이 여기에 표시됩니다.</span>
            <button onClick={() => login()} style={{ padding: '10px 20px', borderRadius: '14px', background: '#007aff', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem' }}>캘린더 연동</button>
          </div>
        ) : (
          <>
            <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '10px', padding: '8px', outline: 'none', fontSize: '0.8rem' }} />
              <input type="text" placeholder="새 일정" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '10px', padding: '8px 10px', outline: 'none', fontSize: '0.8rem' }} />
              <button type="submit" style={{ background: '#007aff', color: '#fff', border: 'none', borderRadius: '10px', padding: '0 14px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem' }}>+</button>
            </form>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {events.length === 0 && <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: '20px', fontSize: '0.85rem' }}>일정이 없습니다.</div>}
              {events.map(ev => (
                <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.06)', padding: '10px 12px', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: '600', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                    <span style={{ fontSize: '0.72rem', color: '#4da3ff', fontWeight: '500' }}>{new Date(ev.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <button onClick={() => setPendingDeleteId(ev.id)} style={{ background: 'rgba(255,59,48,0.15)', color: '#ff453a', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '700', flexShrink: 0 }}>삭제</button>
                </div>
              ))}
            </div>
          </>
        )}
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
