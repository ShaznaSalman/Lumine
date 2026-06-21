import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';

const sessionTypes = ['Workout', 'Yoga', 'Walk', 'Run', 'Stretching', 'Other'];
const intensityLevels = ['Easy', 'Moderate', 'Intense'];
const yogaStyles = ['Hatha', 'Vinyasa', 'Yin', 'Restorative', 'Power'];
const moodColors = {
  Workout: '#DFF5F3',
  Yoga: '#E4EEF8',
  Walk: '#FEF6DC',
  Run: '#FEF6DC',
  Stretching: '#E5F7EE',
  Other: '#FDF4E4'
};

const formatDateKey = (date) => date.toISOString().split('T')[0];
const formatFriendlyDate = (date) => date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const formatMonthDate = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const getStartOfWeek = (date) => {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const getMonthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const WorkoutYoga = () => {
  const { currentUser } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [goalSessions, setGoalSessions] = useState(4);
  const [activeTab, setActiveTab] = useState('log');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: formatDateKey(new Date()),
    type: 'Workout',
    duration: 30,
    intensity: 'Moderate',
    notes: '',
    yogaStyle: 'Hatha',
    feeling: ''
  });

  useEffect(() => {
    if (!currentUser?.uid) return;

    const loadData = async () => {
      try {
        const sessionsRef = collection(db, 'users', currentUser.uid, 'workout-yoga', 'sessions');
        const q = query(sessionsRef, orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
        setSessions(data);

        const goalRef = doc(db, 'users', currentUser.uid, 'workout-yoga', 'goals', 'weekly');
        const goalSnapshot = await getDoc(goalRef);
        if (goalSnapshot.exists()) {
          const goalData = goalSnapshot.data();
          if (goalData.targetSessions) setGoalSessions(goalData.targetSessions);
        }
      } catch (error) {
        console.error('Error loading workout sessions', error);
      }
    };

    loadData();
  }, [currentUser]);

  const weeklySessions = useMemo(() => {
    const weekStart = getStartOfWeek(new Date());
    return sessions.filter((session) => session.date?.toDate() >= weekStart);
  }, [sessions]);

  const totalMinutesMonth = useMemo(() => {
    const monthStart = getMonthStart(new Date());
    return sessions.reduce((total, session) => {
      if (session.date?.toDate() >= monthStart) {
        return total + (session.duration || 0);
      }
      return total;
    }, 0);
  }, [sessions]);

  const streakDays = useMemo(() => {
    const dateSet = new Set(sessions.map((session) => formatDateKey(session.date.toDate())));
    let streak = 0;
    let cursor = new Date();
    while (true) {
      const key = formatDateKey(cursor);
      if (dateSet.has(key)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [sessions]);

  const mostActiveDay = useMemo(() => {
    const counts = {};
    weeklySessions.forEach((session) => {
      const label = formatFriendlyDate(session.date.toDate());
      counts[label] = (counts[label] || 0) + 1;
    });
    const entries = Object.entries(counts);
    if (!entries.length) return 'No activity yet';
    const [day] = entries.sort((a, b) => b[1] - a[1]);
    return `${day[0]} (${day[1]} sessions)`;
  }, [weeklySessions]);

  const calendarMap = useMemo(() => {
    const map = {};
    sessions.forEach((session) => {
      const dateKey = formatDateKey(session.date.toDate());
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(session);
    });
    return map;
  }, [sessions]);

  const today = new Date();
  const monthStart = getMonthStart(today);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), index + 1);
    const key = formatDateKey(date);
    const sessionsForDay = calendarMap[key] || [];
    const dot = sessionsForDay.length
      ? sessionsForDay.find((session) => session.type === 'Yoga')
        ? 'blue'
        : sessionsForDay.find((session) => ['Walk', 'Run'].includes(session.type))
        ? 'orange'
        : 'green'
      : null;
    return { date, key, dot };
  });

  const sessionsThisWeek = weeklySessions.length;

  const progressPercent = Math.min(100, Math.round((sessionsThisWeek / goalSessions) * 100));

  const handleOpenDrawer = () => {
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveSession = async () => {
    if (!currentUser?.uid) return;
    setSaving(true);
    try {
      const sessionsRef = collection(db, 'users', currentUser.uid, 'workout-yoga', 'sessions');
      const newDoc = doc(sessionsRef);
      await setDoc(newDoc, {
        date: Timestamp.fromDate(new Date(`${form.date}T12:00:00`)),
        type: form.type,
        duration: Number(form.duration),
        intensity: form.intensity,
        notes: form.notes,
        yogaStyle: form.type === 'Yoga' ? form.yogaStyle : null
      });
      setSessions((prev) => [
        {
          id: newDoc.id,
          date: Timestamp.fromDate(new Date(`${form.date}T12:00:00`)),
          type: form.type,
          duration: Number(form.duration),
          intensity: form.intensity,
          notes: form.notes,
          yogaStyle: form.type === 'Yoga' ? form.yogaStyle : null
        },
        ...prev
      ]);
      setDrawerOpen(false);
      setForm((prev) => ({ ...prev, notes: '' }));
    } catch (error) {
      console.error('Error saving workout session', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EEF9F1] px-4 py-6 text-[#2C2C2A] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[2rem] border border-[#D8F0E5] bg-white p-6 shadow-soft">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.75rem] bg-[#E5F7EE] p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#3A8A68]">Streak</p>
              <p className="mt-3 text-3xl font-semibold text-[#1D4738]">{streakDays} days</p>
            </div>
            <div className="rounded-[1.75rem] bg-[#E5F7EE] p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#3A8A68]">This week</p>
              <p className="mt-3 text-3xl font-semibold text-[#1D4738]">{sessionsThisWeek}</p>
            </div>
            <div className="rounded-[1.75rem] bg-[#E5F7EE] p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#3A8A68]">Minutes this month</p>
              <p className="mt-3 text-3xl font-semibold text-[#1D4738]">{totalMinutesMonth}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-6 shadow-soft border border-[#D8F0E5]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-[#2C2C2A]">Workout & Yoga</h2>
            <div className="flex items-center gap-2 text-sm text-[#6D6B6F]">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#6FCF97]" /> workout
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#7F8CFF]" /> yoga
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#F6B46A]" /> walk/run
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2">
            {['log', 'history', 'goals'].map((tab) => (
              <button
                type="button"
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab ? 'bg-[#D8F0E5] text-[#1D4738]' : 'bg-[#F3FBF6] text-[#5E6D66]'
                }`}
              >
                {tab === 'log' ? 'Log' : tab === 'history' ? 'History' : 'Goals'}
              </button>
            ))}
          </div>

          {activeTab === 'log' && (
            <div className="space-y-6 pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#2C2C2A]">Session type</span>
                  <select
                    value={form.type}
                    onChange={(e) => handleFormChange('type', e.target.value)}
                    className="mt-2 w-full rounded-3xl border border-[#D8F0E5] bg-[#F6FBF7] px-4 py-3 text-[#2C2C2A] outline-none focus:border-[#8CDAA0] focus:ring-2 focus:ring-[#EAF9EE]"
                  >
                    {sessionTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#2C2C2A]">Date</span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => handleFormChange('date', e.target.value)}
                    className="mt-2 w-full rounded-3xl border border-[#D8F0E5] bg-[#F6FBF7] px-4 py-3 text-[#2C2C2A] outline-none focus:border-[#8CDAA0] focus:ring-2 focus:ring-[#EAF9EE]"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-semibold text-[#2C2C2A]">Duration (minutes)</span>
                  <input
                    type="number"
                    min="1"
                    value={form.duration}
                    onChange={(e) => handleFormChange('duration', e.target.value)}
                    className="mt-2 w-full rounded-3xl border border-[#D8F0E5] bg-[#F6FBF7] px-4 py-3 text-[#2C2C2A] outline-none focus:border-[#8CDAA0] focus:ring-2 focus:ring-[#EAF9EE]"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#2C2C2A]">Intensity</span>
                  <select
                    value={form.intensity}
                    onChange={(e) => handleFormChange('intensity', e.target.value)}
                    className="mt-2 w-full rounded-3xl border border-[#D8F0E5] bg-[#F6FBF7] px-4 py-3 text-[#2C2C2A] outline-none focus:border-[#8CDAA0] focus:ring-2 focus:ring-[#EAF9EE]"
                  >
                    {intensityLevels.map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </label>
                {form.type === 'Yoga' && (
                  <label className="block">
                    <span className="text-sm font-semibold text-[#2C2C2A]">Yoga style</span>
                    <select
                      value={form.yogaStyle}
                      onChange={(e) => handleFormChange('yogaStyle', e.target.value)}
                      className="mt-2 w-full rounded-3xl border border-[#D8F0E5] bg-[#F6FBF7] px-4 py-3 text-[#2C2C2A] outline-none focus:border-[#8CDAA0] focus:ring-2 focus:ring-[#EAF9EE]"
                    >
                      {yogaStyles.map((style) => (
                        <option key={style} value={style}>{style}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-[#2C2C2A]">Notes / exercises done</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  rows="4"
                  className="mt-2 w-full rounded-3xl border border-[#D8F0E5] bg-[#F6FBF7] px-4 py-3 text-[#2C2C2A] outline-none focus:border-[#8CDAA0] focus:ring-2 focus:ring-[#EAF9EE]"
                  placeholder="Example: Sun salutation, 20 min jog, stretching sequence"
                />
              </label>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveSession}
                  disabled={saving}
                  className="rounded-full bg-[#3EAD7C] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#339364] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save session'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4 pt-4">
              {sessions.length === 0 ? (
                <p className="text-sm text-[#6D6B6F]">No sessions logged yet. Use the button below to add your first session.</p>
              ) : (
                sessions.map((session) => {
                  const dateObj = session.date.toDate();
                  const color = moodColors[session.type] || '#E5F7EE';
                  return (
                    <div key={session.id} className="rounded-[1.75rem] border border-[#D8F0E5] bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-[#2C2C2A]">{session.type}</p>
                          <p className="mt-1 text-xs text-[#6D6B6F]">{formatFriendlyDate(dateObj)} • {session.intensity}</p>
                        </div>
                        <div className="rounded-full px-3 py-1 text-sm font-semibold text-white" style={{ backgroundColor: color }}>
                          {session.duration} min
                        </div>
                      </div>
                      {session.yogaStyle && <p className="mt-3 text-sm text-[#6D6B6F]">Style: {session.yogaStyle}</p>}
                      {session.notes && <p className="mt-2 text-sm text-[#6D6B6F]">{session.notes}</p>}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'goals' && (
            <div className="space-y-6 pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.75rem] bg-[#F3FBF6] p-5">
                  <p className="text-sm font-semibold text-[#2C2C2A]">Weekly goal</p>
                  <p className="mt-2 text-3xl font-semibold text-[#1D4738]">{goalSessions} sessions</p>
                </div>
                <div className="rounded-[1.75rem] bg-[#F3FBF6] p-5">
                  <p className="text-sm font-semibold text-[#2C2C2A]">Progress</p>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="relative h-24 w-24">
                      <svg className="h-24 w-24" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="44" stroke="#D8F0E5" strokeWidth="12" fill="none" />
                        <circle
                          cx="50"
                          cy="50"
                          r="44"
                          stroke="#3EAD7C"
                          strokeWidth="12"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={`${(progressPercent / 100) * 276.46} 276.46`}
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                      <div className="absolute inset-0 grid place-items-center text-center text-sm font-semibold text-[#1D4738]">
                        {progressPercent}%
                        <div className="text-xs text-[#6D6B6F]">this week</div>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-[#6D6B6F]">Sessions: {sessionsThisWeek}/{goalSessions}</p>
                      <p className="mt-2 text-sm text-[#6D6B6F]">Keep your streak alive by moving today.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-[2rem] bg-white p-6 shadow-soft border border-[#D8F0E5]">
          <h3 className="mb-4 text-lg font-semibold text-[#2C2C2A]">Monthly activity</h3>
          <div className="grid gap-2 md:grid-cols-7">
            {calendarDays.map((day) => (
              <div key={day.key} className="flex flex-col items-center gap-1 rounded-3xl border border-[#E7F2EA] bg-[#F7FCF7] p-3 text-center">
                <span className="text-sm font-semibold text-[#2C2C2A]">{day.date.getDate()}</span>
                <div className={`h-2.5 w-2.5 rounded-full ${day.dot === 'green' ? 'bg-[#3EAD7C]' : day.dot === 'blue' ? 'bg-[#7F8CFF]' : day.dot === 'orange' ? 'bg-[#F6B46A]' : 'bg-transparent'}`} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <button
        type="button"
        onClick={handleOpenDrawer}
        className="fixed bottom-6 right-6 z-30 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#3EAD7C] text-2xl text-white shadow-lg shadow-[#3EAD7C]/20 transition hover:bg-[#339364]"
        aria-label="Log Session"
      >
        +
      </button>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={handleCloseDrawer} />
      )}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 rounded-t-[2rem] bg-white p-6 shadow-2xl transition-transform duration-300 ${
          drawerOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '85vh' }}
      >
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-[#2C2C2A]">Log Session</p>
              <p className="text-sm text-[#6D6B6F]">Add your session details for today.</p>
            </div>
            <button type="button" className="text-[#6D6B6F]" onClick={handleCloseDrawer}>
              ✕
            </button>
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-[#2C2C2A]">Type</span>
              <select
                value={form.type}
                onChange={(e) => handleFormChange('type', e.target.value)}
                className="mt-2 w-full rounded-3xl border border-[#D8F0E5] bg-[#F6FBF7] px-4 py-3 text-[#2C2C2A] outline-none focus:border-[#8CDAA0] focus:ring-2 focus:ring-[#EAF9EE]"
              >
                {sessionTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[#2C2C2A]">Duration</span>
              <input
                type="number"
                min="1"
                value={form.duration}
                onChange={(e) => handleFormChange('duration', e.target.value)}
                className="mt-2 w-full rounded-3xl border border-[#D8F0E5] bg-[#F6FBF7] px-4 py-3 text-[#2C2C2A] outline-none focus:border-[#8CDAA0] focus:ring-2 focus:ring-[#EAF9EE]"
                placeholder="Minutes"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[#2C2C2A]">Intensity</span>
              <select
                value={form.intensity}
                onChange={(e) => handleFormChange('intensity', e.target.value)}
                className="mt-2 w-full rounded-3xl border border-[#D8F0E5] bg-[#F6FBF7] px-4 py-3 text-[#2C2C2A] outline-none focus:border-[#8CDAA0] focus:ring-2 focus:ring-[#EAF9EE]"
              >
                {intensityLevels.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </label>
            {form.type === 'Yoga' && (
              <label className="block">
                <span className="text-sm font-semibold text-[#2C2C2A]">How you feel after</span>
                <select
                  value={form.feeling}
                  onChange={(e) => handleFormChange('feeling', e.target.value)}
                  className="mt-2 w-full rounded-3xl border border-[#D8F0E5] bg-[#F6FBF7] px-4 py-3 text-[#2C2C2A] outline-none focus:border-[#8CDAA0] focus:ring-2 focus:ring-[#EAF9EE]"
                >
                  <option value="">Select feeling</option>
                  <option value="Energized">Energized</option>
                  <option value="Calm">Calm</option>
                  <option value="Relaxed">Relaxed</option>
                  <option value="Grounded">Grounded</option>
                </select>
              </label>
            )}
            <label className="block">
              <span className="text-sm font-semibold text-[#2C2C2A]">Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => handleFormChange('notes', e.target.value)}
                rows="4"
                className="mt-2 w-full rounded-3xl border border-[#D8F0E5] bg-[#F6FBF7] px-4 py-3 text-[#2C2C2A] outline-none focus:border-[#8CDAA0] focus:ring-2 focus:ring-[#EAF9EE]"
                placeholder="Type exercises, mood, or details here"
              />
            </label>
            <button
              type="button"
              onClick={handleSaveSession}
              disabled={saving}
              className="w-full rounded-full bg-[#3EAD7C] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#339364] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save session'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkoutYoga;
