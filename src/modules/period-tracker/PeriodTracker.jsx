import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, getDoc, query, setDoc, where } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';

const symptomOptions = ['cramps', 'bloating', 'headache', 'fatigue', 'mood swings', 'acne', 'cravings'];
const moodOptions = ['😊', '😔', '😡', '😴', '🥰', '😰'];

const formatDateKey = (date) => date.toISOString().split('T')[0];
const parseDate = (value) => new Date(`${value}T00:00:00`);

const calculateAverageCycle = (cycles) => {
  const completed = cycles.filter((cycle) => cycle.startDate && cycle.endDate);
  if (!completed.length) return 28;
  const durations = completed.map((cycle) => {
    const start = cycle.startDate.toDate();
    const end = cycle.endDate.toDate();
    return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
  });
  return Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);
};

const getCycleDuration = (cycle) => {
  if (!cycle.startDate || !cycle.endDate) return '-';
  const start = cycle.startDate.toDate();
  const end = cycle.endDate.toDate();
  return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
};

const formatFriendlyDate = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const PeriodTracker = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('log');
  const [cycles, setCycles] = useState([]);
  const [logs, setLogs] = useState({});
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [mood, setMood] = useState('😊');
  const [flowIntensity, setFlowIntensity] = useState('medium');
  const [notes, setNotes] = useState('');
  const [todayKey] = useState(formatDateKey(new Date()));
  const [saving, setSaving] = useState(false);

  const todayLog = logs[todayKey] || { symptoms: [], mood: '😊', notes: '' };

  useEffect(() => {
    if (!currentUser?.uid) return;

    const loadData = async () => {
      try {
        const cyclesRef = collection(db, 'users', currentUser.uid, 'period-tracker', 'cycles');
        const logsRef = collection(db, 'users', currentUser.uid, 'period-tracker', 'logs');
        const [cycleSnap, logSnap] = await Promise.all([getDocs(cyclesRef), getDocs(logsRef)]);

        const loadedCycles = cycleSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const loadedLogs = logSnap.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {});

        setCycles(loadedCycles.sort((a, b) => b.startDate.toDate() - a.startDate.toDate()));
        setLogs(loadedLogs);

        const today = loadedLogs[todayKey];
        if (today) {
          setSelectedSymptoms(today.symptoms || []);
          setMood(today.mood || '😊');
          setNotes(today.notes || '');
        }
      } catch (error) {
        console.error('Error loading period tracker data', error);
      }
    };

    loadData();
  }, [currentUser, todayKey]);

  const averageCycleLength = useMemo(() => calculateAverageCycle(cycles), [cycles]);

  const nextPredictedStart = useMemo(() => {
    if (!cycles.length) return null;
    const mostRecent = cycles[0];
    if (!mostRecent.startDate) return null;
    const start = mostRecent.startDate.toDate();
    const predicted = new Date(start);
    predicted.setDate(predicted.getDate() + averageCycleLength);
    return predicted;
  }, [cycles, averageCycleLength]);

  const ovulationWindow = useMemo(() => {
    if (!nextPredictedStart) return null;
    const ovulationDate = new Date(nextPredictedStart);
    ovulationDate.setDate(ovulationDate.getDate() - 14);
    return {
      start: new Date(ovulationDate.getTime() - 2 * 24 * 60 * 60 * 1000),
      end: new Date(ovulationDate.getTime() + 2 * 24 * 60 * 60 * 1000)
    };
  }, [nextPredictedStart]);

  const stateCycle = useMemo(() => {
    if (!cycles.length) return null;
    return cycles[0];
  }, [cycles]);

  const cycleDay = useMemo(() => {
    if (!stateCycle?.startDate) return null;
    const start = stateCycle.startDate.toDate();
    const today = new Date();
    return Math.max(1, Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1);
  }, [stateCycle]);

  const cycleStatus = useMemo(() => {
    if (stateCycle?.endDate) {
      const daysUntil = nextPredictedStart ? Math.max(0, Math.ceil((nextPredictedStart - new Date()) / (1000 * 60 * 60 * 24))) : null;
      return daysUntil !== null ? `Next period in ~${daysUntil} days` : 'No active cycle';
    }
    if (cycleDay) return `Current cycle day ${cycleDay}`;
    return 'Start tracking your cycle';
  }, [cycleDay, nextPredictedStart, stateCycle]);

  const toggleSymptom = (symptom) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((item) => item !== symptom) : [...prev, symptom]
    );
  };

  const handleSave = async () => {
    if (!currentUser?.uid) return;
    setSaving(true);
    try {
      const logRef = doc(db, 'users', currentUser.uid, 'period-tracker', 'logs', todayKey);
      await setDoc(logRef, {
        symptoms: selectedSymptoms,
        mood,
        notes
      });
      setLogs((prev) => ({ ...prev, [todayKey]: { symptoms: selectedSymptoms, mood, notes } }));
    } catch (error) {
      console.error('Error saving period tracker log', error);
    } finally {
      setSaving(false);
    }
  };

  const calendarDays = useMemo(() => {
    const days = [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDay = monthStart.getDay();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let i = 0; i < startDay; i += 1) {
      days.push(null);
    }
    for (let date = 1; date <= daysInMonth; date += 1) {
      const current = new Date(now.getFullYear(), now.getMonth(), date);
      const formatted = formatDateKey(current);
      const isPeriod = cycles.some((cycle) => {
        const start = cycle.startDate?.toDate();
        const end = cycle.endDate?.toDate();
        if (!start || !end) return false;
        return current >= start && current <= end;
      });
      const isOvulation = ovulationWindow && current >= ovulationWindow.start && current <= ovulationWindow.end;
      const isPredicted = nextPredictedStart && current >= nextPredictedStart && current < new Date(nextPredictedStart.getTime() + 5 * 24 * 60 * 60 * 1000);
      days.push({ date, formatted, isPeriod, isOvulation, isPredicted });
    }
    return days;
  }, [cycles, nextPredictedStart, ovulationWindow]);

  return (
    <div className="min-h-screen bg-[#FFF7FB] px-4 py-6 text-[#2C2C2A] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[2rem] bg-white p-6 shadow-soft border border-[#F4E3EE]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[#D46E9F]">Period Tracker</p>
              <h1 className="mt-3 text-3xl font-semibold text-[#2C2C2A]">Cycle wellness</h1>
              <p className="mt-2 text-sm text-[#6D6B6F]">Log your flow, symptoms, and mood in one gentle place.</p>
            </div>
            <div className="rounded-full bg-[#FDE8F3] px-4 py-2 text-sm font-semibold text-[#B34A83] shadow-sm">
              {cycleStatus}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-6 shadow-soft border border-[#F4E3EE]">
          <h2 className="mb-4 text-lg font-semibold text-[#2C2C2A]">Cycle calendar</h2>
          <div className="grid gap-3 rounded-[2rem] border border-[#F4E3EE] bg-[#FFF0F7] p-4">
            <div className="grid grid-cols-7 gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[#7A5A76]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} className="h-14 rounded-2xl bg-[#F8F1F7]" />;
                return (
                  <div
                    key={day.formatted}
                    className={`flex h-14 items-center justify-center rounded-2xl border ${
                      day.isPeriod ? 'border-[#EFA3C0] bg-[#FDE8F3]' : day.isOvulation ? 'border-[#F0D771] bg-[#FEF6DC]' : day.isPredicted ? 'border-dashed border-[#F7D2E4] bg-[#FDE8F8]' : 'border-transparent bg-white'
                    }`}
                  >
                    <span className="text-sm font-semibold">{day.date}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-6 shadow-soft border border-[#F4E3EE]">
          <div className="mb-6 flex flex-wrap gap-3">
            {['log', 'history', 'predictions'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab ? 'bg-[#FDE8F3] text-[#B34A83]' : 'bg-[#FFF4F8] text-[#7A5A76]'
                }`}
              >
                {tab === 'log' ? 'Log Today' : tab === 'history' ? 'History' : 'Predictions'}
              </button>
            ))}
          </div>

          {activeTab === 'log' && (
            <div className="space-y-6">
              <div>
                <p className="mb-3 text-sm font-semibold text-[#2C2C2A]">Symptoms</p>
                <div className="flex flex-wrap gap-2">
                  {symptomOptions.map((symptom) => {
                    const active = selectedSymptoms.includes(symptom);
                    return (
                      <button
                        key={symptom}
                        type="button"
                        onClick={() => toggleSymptom(symptom)}
                        className={`rounded-full px-4 py-2 text-sm transition ${
                          active ? 'bg-[#FDE8F3] text-[#B34A83]' : 'bg-[#FFF4F8] text-[#7A5A76]'
                        }`}
                      >
                        {symptom}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-[#2C2C2A]">Mood</p>
                <div className="flex flex-wrap gap-3">
                  {moodOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setMood(option)}
                      className={`h-12 w-12 rounded-full text-xl transition ${
                        mood === option ? 'bg-[#FDE8F3] text-[#B34A83]' : 'bg-[#FFF4F8] text-[#7A5A76]'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-[#2C2C2A]">Flow intensity</p>
                <div className="flex flex-wrap gap-3">
                  {['light', 'medium', 'heavy'].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFlowIntensity(level)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        flowIntensity === level ? 'bg-[#FDE8F3] text-[#B34A83]' : 'bg-[#FFF4F8] text-[#7A5A76]'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-3 block text-sm font-semibold text-[#2C2C2A]">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows="4"
                  className="w-full rounded-3xl border border-[#F4E3EE] bg-[#FFF4F8] px-4 py-3 text-[#2C2C2A] outline-none transition focus:border-[#D46E9F] focus:ring-2 focus:ring-[#F9E6F1]"
                  placeholder="How are you feeling today?"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-full bg-[#D46E9F] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#B34E7F] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save entry'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              {cycles.length === 0 ? (
                <p className="text-sm text-[#6D6B6F]">No cycle history yet. Start logging your first cycle to build insights.</p>
              ) : (
                cycles.map((cycle) => (
                  <div key={cycle.id} className="rounded-[1.75rem] border border-[#F4E3EE] bg-[#FFF4F8] p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-[#2C2C2A]">{formatFriendlyDate(cycle.startDate.toDate())} – {formatFriendlyDate(cycle.endDate?.toDate() ?? new Date())}</p>
                      <span className="rounded-full bg-[#FDE8F3] px-3 py-1 text-xs font-semibold text-[#B34A83]">{getCycleDuration(cycle)} days</span>
                    </div>
                    <p className="mt-2 text-sm text-[#6D6B6F]">Flow: {cycle.flowIntensity || 'unknown'}</p>
                    {cycle.notes && <p className="mt-2 text-sm text-[#6D6B6F]">Notes: {cycle.notes}</p>}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'predictions' && (
            <div className="space-y-4">
              <div className="rounded-[1.75rem] border border-[#F4E3EE] bg-[#FFF4F8] p-5">
                <p className="text-sm font-semibold text-[#2C2C2A]">Average cycle length</p>
                <p className="mt-2 text-3xl font-bold text-[#B34A83]">{averageCycleLength} days</p>
              </div>
              <div className="rounded-[1.75rem] border border-[#F4E3EE] bg-[#FFF4F8] p-5">
                <p className="text-sm font-semibold text-[#2C2C2A]">Next period start</p>
                <p className="mt-2 text-xl font-semibold text-[#7A5A76]">{nextPredictedStart ? formatFriendlyDate(nextPredictedStart) : 'Need more data'}</p>
              </div>
              <div className="rounded-[1.75rem] border border-[#F4E3EE] bg-[#FFF4F8] p-5">
                <p className="text-sm font-semibold text-[#2C2C2A]">Ovulation window</p>
                <p className="mt-2 text-lg font-semibold text-[#7A5A76]">
                  {ovulationWindow ? `${formatFriendlyDate(ovulationWindow.start)} – ${formatFriendlyDate(ovulationWindow.end)}` : 'Need more data'}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PeriodTracker;
