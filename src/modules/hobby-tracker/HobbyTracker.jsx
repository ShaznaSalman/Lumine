import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';

const categories = ['Creative', 'Music', 'Sports', 'Craft', 'Reading', 'Gaming', 'Cooking', 'Other'];
const skillLevels = ['Beginner', 'Developing', 'Intermediate', 'Advanced'];
const moods = ['😊', '😐', '😔'];
const colors = ['#DCFCE7', '#D9F99D', '#A7F3D0', '#C7D2FE', '#F0FDF4', '#E2E8F0', '#D8B4FE', '#E0F2FE'];

const formatDateKey = (date) => date.toISOString().split('T')[0];
const friendlyDate = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const startOfWeek = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
};

const HobbyTracker = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hobbies, setHobbies] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [logModalHobby, setLogModalHobby] = useState(null);
  const [newHobby, setNewHobby] = useState({ name: '', emoji: '🎯', category: 'Creative', weeklyGoal: 3, skillLevel: 'Beginner' });
  const [newSession, setNewSession] = useState({ hobbyId: '', date: formatDateKey(new Date()), duration: '', notes: '', mood: '😊' });

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const loadHobbyData = async () => {
      setLoading(true);
      try {
        const hobbiesRef = collection(db, 'users', currentUser.uid, 'hobby-tracker', 'hobbies');
        const hobbyQuery = query(hobbiesRef, orderBy('createdAt', 'desc'));
        const hobbySnap = await getDocs(hobbyQuery);
        const hobbyList = hobbySnap.docs.map((docSnap, index) => ({ id: docSnap.id, color: colors[index % colors.length], ...docSnap.data() }));
        setHobbies(hobbyList);

        const sessionsRef = collection(db, 'users', currentUser.uid, 'hobby-tracker', 'sessions');
        const sessionQuery = query(sessionsRef, orderBy('date', 'desc'));
        const sessionSnap = await getDocs(sessionQuery);
        setSessions(sessionSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      } catch (error) {
        console.error('Load hobby tracker error', error);
      } finally {
        setLoading(false);
      }
    };

    loadHobbyData();
  }, [currentUser]);

  const hobbyMap = useMemo(() => {
    return hobbies.reduce((map, hobby) => ({ ...map, [hobby.id]: hobby }), {});
  }, [hobbies]);

  const sessionsByHobby = useMemo(() => {
    return hobbies.reduce((map, hobby) => {
      const hobbySessions = sessions.filter((session) => session.hobbyId === hobby.id);
      return { ...map, [hobby.id]: hobbySessions };
    }, {});
  }, [hobbies, sessions]);

  const getWeekKey = (date) => {
    const start = startOfWeek(date);
    return formatDateKey(start);
  };

  const hobbyStats = useMemo(() => {
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisWeekKey = getWeekKey(now);
    return hobbies.map((hobby) => {
      const hobbySessions = sessionsByHobby[hobby.id] || [];
      const allTimeMinutes = hobbySessions.reduce((sum, session) => sum + (Number(session.duration) || 0), 0);
      const monthMinutes = hobbySessions.reduce((sum, session) => {
        const sessionMonth = `${session.date.toDate().getFullYear()}-${String(session.date.toDate().getMonth() + 1).padStart(2, '0')}`;
        return sessionMonth === thisMonthKey ? sum + (Number(session.duration) || 0) : sum;
      }, 0);
      const weeklySessions = hobbySessions.filter((session) => getWeekKey(session.date.toDate()) === thisWeekKey);
      const weeklyCount = weeklySessions.length;
      const longestSession = hobbySessions.reduce((max, session) => Math.max(max, Number(session.duration) || 0), 0);
      const weekMap = hobbySessions.reduce((map, session) => {
        const key = getWeekKey(session.date.toDate());
        const count = map[key] || 0;
        return { ...map, [key]: count + 1 };
      }, {});
      let streak = 0;
      let cursor = new Date(startOfWeek(now));
      while (true) {
        const key = formatDateKey(cursor);
        if ((weekMap[key] || 0) >= (Number(hobby.weeklyGoal) || 0) && hobby.weeklyGoal > 0) {
          streak += 1;
          cursor.setDate(cursor.getDate() - 7);
        } else {
          break;
        }
      }
      return {
        hobby,
        allTimeHours: allTimeMinutes / 60,
        monthHours: monthMinutes / 60,
        weeklyCount,
        longestSession,
        streak,
        sessionCount: hobbySessions.length,
        thisWeekMinutes: weeklySessions.reduce((sum, session) => sum + (Number(session.duration) || 0), 0)
      };
    });
  }, [hobbies, sessionsByHobby, sessions]);

  const mostActiveThisWeek = useMemo(() => {
    const stats = hobbyStats.filter((stat) => stat.thisWeekMinutes > 0);
    if (stats.length === 0) return null;
    return stats.reduce((winner, stat) => (stat.thisWeekMinutes > winner.thisWeekMinutes ? stat : winner), stats[0]);
  }, [hobbyStats]);

  const totalHoursThisMonth = hobbyStats.reduce((sum, stat) => sum + stat.monthHours, 0);

  const addHobby = async () => {
    if (!currentUser?.uid || !newHobby.name.trim()) return;
    try {
      const hobbyRef = doc(collection(db, 'users', currentUser.uid, 'hobby-tracker', 'hobbies'));
      const payload = {
        ...newHobby,
        color: newHobby.color || colors[hobbies.length % colors.length],
        createdAt: Timestamp.now()
      };
      await setDoc(hobbyRef, payload);
      setHobbies((prev) => [{ id: hobbyRef.id, ...payload }, ...prev]);
      setNewHobby({ name: '', emoji: '🎯', category: 'Creative', weeklyGoal: 3, skillLevel: 'Beginner' });
      setAddModalOpen(false);
    } catch (error) {
      console.error('Add hobby error', error);
    }
  };

  const openLogModal = (hobby) => {
    setLogModalHobby(hobby);
    setNewSession({ hobbyId: hobby.id, date: formatDateKey(new Date()), duration: '', notes: '', mood: '😊' });
  };

  const saveSession = async () => {
    if (!currentUser?.uid || !newSession.hobbyId || !newSession.duration) return;
    try {
      const sessionRef = doc(collection(db, 'users', currentUser.uid, 'hobby-tracker', 'sessions'));
      const payload = {
        hobbyId: newSession.hobbyId,
        date: Timestamp.fromDate(new Date(`${newSession.date}T12:00:00`)),
        duration: Number(newSession.duration),
        notes: newSession.notes,
        mood: newSession.mood
      };
      await setDoc(sessionRef, payload);
      setSessions((prev) => [{ id: sessionRef.id, ...payload }, ...prev]);
      setLogModalHobby(null);
    } catch (error) {
      console.error('Save hobby session error', error);
    }
  };

  const updateSkillLevel = async (hobbyId, level) => {
    if (!currentUser?.uid) return;
    try {
      const hobbyRef = doc(db, 'users', currentUser.uid, 'hobby-tracker', 'hobbies', hobbyId);
      await updateDoc(hobbyRef, { skillLevel: level });
      setHobbies((prev) => prev.map((hobby) => (hobby.id === hobbyId ? { ...hobby, skillLevel: level } : hobby)));
    } catch (error) {
      console.error('Update skill level error', error);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#ECFDF5] flex items-center justify-center text-[#166534]">Loading hobby tracker…</div>;
  }

  return (
    <div className="min-h-screen bg-[#ECFDF5] px-4 py-6 text-[#14532D] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[#BBF7D0] bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#15803D]">Hobby Tracker</p>
              <h1 className="mt-3 text-4xl font-semibold text-[#0F3D31]">Grow your hobbies with calm consistency.</h1>
              <p className="mt-2 text-sm text-[#264E38]">Track sessions, goals, streaks, and skill progress in a soft green space.</p>
            </div>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[#16A34A] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#15803d]"
            >
              + Add hobby
            </button>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[2rem] bg-white p-6 shadow-soft border border-[#BBF7D0]">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#15803D]">Active hobbies</p>
            <p className="mt-4 text-3xl font-semibold text-[#14532D]">{hobbies.length}</p>
            <p className="mt-2 text-sm text-[#264E38]">Different pathways to joy and skill.</p>
          </div>
          <div className="rounded-[2rem] bg-white p-6 shadow-soft border border-[#BBF7D0]">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#15803D]">Hours this month</p>
            <p className="mt-4 text-3xl font-semibold text-[#14532D]">{totalHoursThisMonth.toFixed(1)}</p>
            <p className="mt-2 text-sm text-[#264E38]">Across your hobby sessions this month.</p>
          </div>
          <div className="rounded-[2rem] bg-white p-6 shadow-soft border border-[#BBF7D0]">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#15803D]">Most active hobby</p>
            {mostActiveThisWeek ? (
              <div className="mt-4 space-y-2">
                <p className="text-xl font-semibold text-[#14532D]">{mostActiveThisWeek.hobby.name}</p>
                <p className="text-sm text-[#264E38]">{mostActiveThisWeek.thisWeekMinutes} min this week</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#264E38]">No sessions logged this week yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#BBF7D0] bg-white p-6 shadow-soft">
          <div className="grid gap-6 lg:grid-cols-2">
            {hobbyStats.map((stat, index) => {
              const progress = stat.hobby.weeklyGoal > 0 ? Math.min(100, Math.round((stat.weeklyCount / stat.hobby.weeklyGoal) * 100)) : 0;
              return (
                <div
                  key={stat.hobby.id}
                  className="rounded-[2rem] border border-[#D9F99D] bg-[#F0FDF4] p-5 shadow-sm"
                  style={{ backgroundColor: stat.hobby.color || colors[index % colors.length] }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#14532D]">{stat.hobby.emoji} {stat.hobby.name}</p>
                      <p className="mt-2 text-sm text-[#166534]">{stat.hobby.category} • Goal {stat.hobby.weeklyGoal} sessions/week</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openLogModal(stat.hobby)}
                      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#166534] shadow-sm"
                    >
                      Quick log
                    </button>
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between text-sm text-[#14532D]">
                      <span>This week</span>
                      <span>{stat.weeklyCount}/{stat.hobby.weeklyGoal}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white">
                      <div className="h-3 rounded-full bg-[#16A34A]" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3 text-sm text-[#14532D]">
                      <div className="rounded-3xl bg-white/80 p-3">
                        <p className="font-semibold">{stat.allTimeHours.toFixed(1)}</p>
                        <p className="text-xs text-[#14532D]">hrs all time</p>
                      </div>
                      <div className="rounded-3xl bg-white/80 p-3">
                        <p className="font-semibold">{stat.monthHours.toFixed(1)}</p>
                        <p className="text-xs text-[#14532D]">hrs month</p>
                      </div>
                      <div className="rounded-3xl bg-white/80 p-3">
                        <p className="font-semibold">{Math.round(stat.longestSession)}m</p>
                        <p className="text-xs text-[#14532D]">longest</p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-3xl bg-white/80 p-3 text-sm text-[#14532D]">
                        <p className="font-semibold">{stat.streak}</p>
                        <p className="text-xs">weeks met</p>
                      </div>
                      <div className="rounded-3xl bg-white/80 p-3 text-sm text-[#14532D]">
                        <p className="font-semibold">{stat.hobby.skillLevel}</p>
                        <p className="text-xs">skill level</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-[#14532D]">Update skill:</span>
                      {skillLevels.map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => updateSkillLevel(stat.hobby.id, level)}
                          className={`rounded-full px-3 py-2 text-xs font-semibold transition ${stat.hobby.skillLevel === level ? 'bg-[#16A34A] text-white' : 'bg-white text-[#14532D]'}`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#15803D]">New hobby</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#14532D]">Add a new interest</h2>
              </div>
              <button type="button" onClick={() => setAddModalOpen(false)} className="rounded-full bg-[#ECFDF5] px-4 py-2 text-sm text-[#166534]">Close</button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <input
                value={newHobby.name}
                onChange={(e) => setNewHobby((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Hobby name"
                className="rounded-3xl border border-[#BBF7D0] bg-[#ECFDF5] px-4 py-3 outline-none"
              />
              <input
                value={newHobby.emoji}
                onChange={(e) => setNewHobby((prev) => ({ ...prev, emoji: e.target.value }))}
                placeholder="Emoji"
                className="rounded-3xl border border-[#BBF7D0] bg-[#ECFDF5] px-4 py-3 outline-none"
              />
              <select
                value={newHobby.category}
                onChange={(e) => setNewHobby((prev) => ({ ...prev, category: e.target.value }))}
                className="rounded-3xl border border-[#BBF7D0] bg-[#ECFDF5] px-4 py-3 outline-none"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <select
                value={newHobby.skillLevel}
                onChange={(e) => setNewHobby((prev) => ({ ...prev, skillLevel: e.target.value }))}
                className="rounded-3xl border border-[#BBF7D0] bg-[#ECFDF5] px-4 py-3 outline-none"
              >
                {skillLevels.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={newHobby.weeklyGoal}
                onChange={(e) => setNewHobby((prev) => ({ ...prev, weeklyGoal: Number(e.target.value) }))}
                placeholder="Weekly goal"
                className="rounded-3xl border border-[#BBF7D0] bg-[#ECFDF5] px-4 py-3 outline-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setAddModalOpen(false)} className="rounded-full bg-[#ECFDF5] px-5 py-3 text-sm font-semibold text-[#166534]">Cancel</button>
              <button type="button" onClick={addHobby} className="rounded-full bg-[#16A34A] px-5 py-3 text-sm font-semibold text-white">Create hobby</button>
            </div>
          </div>
        </div>
      )}

      {logModalHobby && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#15803D]">Log session</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#14532D]">{logModalHobby.name}</h2>
              </div>
              <button type="button" onClick={() => setLogModalHobby(null)} className="rounded-full bg-[#ECFDF5] px-4 py-2 text-sm text-[#166534]">Close</button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <input
                type="date"
                value={newSession.date}
                onChange={(e) => setNewSession((prev) => ({ ...prev, date: e.target.value }))}
                className="rounded-3xl border border-[#BBF7D0] bg-[#ECFDF5] px-4 py-3 outline-none"
              />
              <input
                type="number"
                min="1"
                value={newSession.duration}
                onChange={(e) => setNewSession((prev) => ({ ...prev, duration: e.target.value }))}
                placeholder="Duration (minutes)"
                className="rounded-3xl border border-[#BBF7D0] bg-[#ECFDF5] px-4 py-3 outline-none"
              />
              <select
                value={newSession.mood}
                onChange={(e) => setNewSession((prev) => ({ ...prev, mood: e.target.value }))}
                className="rounded-3xl border border-[#BBF7D0] bg-[#ECFDF5] px-4 py-3 outline-none"
              >
                {moods.map((mood) => (
                  <option key={mood} value={mood}>{mood}</option>
                ))}
              </select>
              <textarea
                value={newSession.notes}
                onChange={(e) => setNewSession((prev) => ({ ...prev, notes: e.target.value }))}
                rows="3"
                placeholder="Notes"
                className="rounded-[1.75rem] border border-[#BBF7D0] bg-[#ECFDF5] px-4 py-3 outline-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setLogModalHobby(null)} className="rounded-full bg-[#ECFDF5] px-5 py-3 text-sm font-semibold text-[#166534]">Cancel</button>
              <button type="button" onClick={saveSession} className="rounded-full bg-[#16A34A] px-5 py-3 text-sm font-semibold text-white">Save session</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HobbyTracker;
