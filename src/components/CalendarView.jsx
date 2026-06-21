import React, { useMemo, useState } from 'react';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const CalendarView = ({ markedDates = [], onDateClick }) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const normalizedMarks = useMemo(
    () => markedDates.map((mark) => ({
      ...mark,
      dateObj: mark.date instanceof Date ? mark.date : new Date(mark.date)
    })),
    [markedDates]
  );

  const days = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const cells = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [currentMonth]);

  const isSameDate = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const getMarkers = (date) => normalizedMarks.filter((mark) => isSameDate(mark.dateObj, date));

  return (
    <div className="rounded-[2rem] border border-[#E9E3F4] bg-white p-5 shadow-soft font-sans">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          className="rounded-3xl border border-[#E9E3F4] bg-[#F8F7FF] px-4 py-2 text-sm text-[#7F77DD]"
        >
          ←
        </button>
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-[#7F77DD]">{monthNames[currentMonth.getMonth()]}</p>
          <p className="text-xl font-semibold text-[#2C2C2A]">{currentMonth.getFullYear()}</p>
        </div>
        <button
          type="button"
          onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          className="rounded-3xl border border-[#E9E3F4] bg-[#F8F7FF] px-4 py-2 text-sm text-[#7F77DD]"
        >
          →
        </button>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs font-semibold text-[#6D6B6F]">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
          <div key={label} className="py-2">{label}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2 text-sm">
        {days.map((date, index) => {
          const markers = date ? getMarkers(date) : [];
          const isToday = date && isSameDate(date, today);
          return (
            <button
              key={index}
              type="button"
              disabled={!date}
              onClick={() => date && onDateClick?.(date)}
              className={`min-h-[80px] rounded-3xl border px-2 py-3 text-left transition ${date ? 'bg-white border-[#E9E3F4] hover:border-[#7F77DD] hover:bg-[#F8F7FF]' : 'bg-transparent border-transparent'} ${isToday ? 'ring-2 ring-[#7F77DD] ring-opacity-25' : ''}`}
            >
              <div className={`w-8 rounded-full px-1 text-center text-sm ${isToday ? 'bg-[#EEF2FF] text-[#2C2C2A]' : 'text-[#6D6B6F]'}`}>{date?.getDate() ?? ''}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {markers.slice(0, 2).map((marker) => (
                  <span key={marker.label} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: marker.color }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarView;
