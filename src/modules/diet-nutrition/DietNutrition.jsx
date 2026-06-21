import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, orderBy, Timestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';

const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
const defaultLog = {
  meals: {
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: []
  },
  water: 0,
  notes: ''
};

const formatDateKey = (date) => date.toISOString().split('T')[0];
const friendlyDate = (date) => date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

const DietNutrition = () => {
  const { currentUser } = useAuth();
  const today = new Date();
  const todayKey = formatDateKey(today);
  const [log, setLog] = useState(defaultLog);
  const [settings, setSettings] = useState({ calorieGoal: 2000, waterGoal: 8, reminderNote: '' });
  const [mealOpen, setMealOpen] = useState(null);
  const [newMeal, setNewMeal] = useState({ name: '', calories: '', notes: '' });
  const [recentMeals, setRecentMeals] = useState([]);
  const [weeklyLogs, setWeeklyLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (!currentUser?.uid) return;
    const loadData = async () => {
      try {
        const settingsRef = doc(db, 'users', currentUser.uid, 'diet-nutrition', 'settings');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          setSettings(settingsSnap.data());
        }

        const logRef = doc(db, 'users', currentUser.uid, 'diet-nutrition', 'logs', todayKey);
        const logSnap = await getDoc(logRef);
        if (logSnap.exists()) {
          const data = logSnap.data();
          setLog(data);
          setNoteText(data.notes || '');
        }

        const mealQuery = query(collection(db, 'users', currentUser.uid, 'diet-nutrition', 'logs'), orderBy('date', 'desc'));
        const querySnap = await getDocs(mealQuery);
        const weekly = [];
        const recent = [];
        querySnap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const dateKey = docSnap.id;
          if (weekly.length < 7) {
            weekly.push({ date: dateKey, ...data });
          }
          mealTypes.forEach((mealType) => {
            (data.meals?.[mealType] || []).forEach((item) => {
              if (recent.length < 8) recent.push({ mealType, ...item });
            });
          });
        });
        setWeeklyLogs(weekly.reverse());
        setRecentMeals(recent.slice(0, 8));
      } catch (error) {
        console.error('Diet load error', error);
      }
    };
    loadData();
  }, [currentUser, todayKey]);

  const totalCalories = useMemo(() => {
    return mealTypes.reduce((sum, mealType) => {
      return sum + (log.meals[mealType] || []).reduce((mealSum, item) => mealSum + (Number(item.calories) || 0), 0);
    }, 0);
  }, [log]);

  const waterProgress = Math.min(100, Math.round((log.water / settings.waterGoal) * 100));
  const calorieProgress = Math.min(100, Math.round((totalCalories / settings.calorieGoal) * 100));

  const streak = useMemo(() => {
    let days = 0;
    const start = getStartOfWeek(today);
    const logs = weeklyLogs.slice().reverse();
    for (let index = logs.length - 1; index >= 0; index -= 1) {
      const entry = logs[index];
      if (entry.water >= settings.waterGoal) {
        days += 1;
      } else {
        break;
      }
    }
    return days;
  }, [weeklyLogs, settings.waterGoal, today]);

  const handleSaveLog = async (updatedLog) => {
    if (!currentUser?.uid) return;
    setSaving(true);
    try {
      const logRef = doc(db, 'users', currentUser.uid, 'diet-nutrition', 'logs', todayKey);
      await setDoc(logRef, { ...updatedLog, date: Timestamp.fromDate(today) });
      setLog(updatedLog);
      setNoteText(updatedLog.notes || '');
    } catch (error) {
      console.error('Save diet log error', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMeal = async (mealType) => {
    const mealItem = {
      name: newMeal.name,
      calories: newMeal.calories ? Number(newMeal.calories) : null,
      notes: newMeal.notes
    };
    const updatedMeals = {
      ...log.meals,
      [mealType]: [...(log.meals[mealType] || []), mealItem]
    };
    const updatedLog = { ...log, meals: updatedMeals };
    await handleSaveLog(updatedLog);
    setRecentMeals((prev) => [mealItem, ...prev.slice(0, 7)]);
    setNewMeal({ name: '', calories: '', notes: '' });
    setMealOpen(null);
  };

  const handleWaterAdd = async (amount = 1) => {
    const updatedLog = { ...log, water: (log.water || 0) + amount };
    await handleSaveLog(updatedLog);
  };

  const handleRecentMealAdd = async (mealType, item) => {
    const updatedMeals = {
      ...log.meals,
      [mealType]: [...(log.meals[mealType] || []), item]
    };
    const updatedLog = { ...log, meals: updatedMeals };
    await handleSaveLog(updatedLog);
  };

  const handleSettingsSave = async () => {
    if (!currentUser?.uid) return;
    try {
      const settingsRef = doc(db, 'users', currentUser.uid, 'diet-nutrition', 'settings');
      await setDoc(settingsRef, settings);
    } catch (error) {
      console.error('Save diet settings error', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFBEE] px-4 py-6 text-[#2C2C2A] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[2rem] border border-[#F4E5B7] bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#D9B84A]">Diet & Nutrition</p>
              <h1 className="mt-3 text-3xl font-semibold text-[#2C2C2A]">{friendlyDate(today)}</h1>
              <p className="mt-2 text-sm text-[#6D6B6F]">Track meals, water, and nourishment with bright calm.</p>
            </div>
            <div className="rounded-[2rem] bg-[#FFF7D6] p-4 text-center shadow-sm">
              <p className="text-sm text-[#A08238]">Water streak</p>
              <p className="mt-2 text-3xl font-semibold text-[#6E6200]">{streak} days</p>
            </div>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[2rem] border border-[#F4E5B7] bg-[#FFF8E5] p-6">
              <div className="relative h-60 overflow-hidden rounded-[2rem] bg-[#FFF7D6] p-6">
                <div className="absolute inset-x-8 bottom-10 flex h-12 items-center justify-between rounded-full bg-[#FFF2B4] px-4 text-sm font-semibold text-[#9C7D20]">
                  <span>{log.water || 0} / {settings.waterGoal} glasses</span>
                  <span>{waterProgress}%</span>
                </div>
                <div className="absolute inset-x-14 bottom-24 h-32 rounded-full border border-[#F4E5B7] bg-[#FFF7D6]">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-full bg-[#F4D965] transition-all duration-500"
                    style={{ height: `${waterProgress}%` }}
                  />
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => handleWaterAdd(1)}
                  className="rounded-full bg-[#F4D965] px-5 py-3 text-sm font-semibold text-[#7F6A1D] shadow-sm transition hover:bg-[#E3C249]"
                >
                  + Glass
                </button>
                <button
                  type="button"
                  onClick={() => handleWaterAdd(2)}
                  className="rounded-full bg-[#FFF4C7] px-5 py-3 text-sm font-semibold text-[#7F6A1D] shadow-sm transition hover:bg-[#F2E089]"
                >
                  +2 Glasses
                </button>
              </div>
            </div>
            <div className="rounded-[2rem] border border-[#F4E5B7] bg-[#FFF8E5] p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#D9B84A]">Calories</p>
              <p className="mt-4 text-4xl font-semibold text-[#2C2C2A]">{totalCalories}</p>
              <p className="text-sm text-[#6D6B6F]">of {settings.calorieGoal} kcal goal</p>
              <div className="mt-5 h-4 overflow-hidden rounded-full bg-[#F9E8AE]">
                <div className="h-4 rounded-full bg-[#D9B84A]" style={{ width: `${calorieProgress}%` }} />
              </div>
              <p className="mt-2 text-sm text-[#6D6B6F]">{calorieProgress}%</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#F4E5B7] bg-white p-6 shadow-soft">
          <div className="grid gap-4 lg:grid-cols-2">
            {mealTypes.map((mealType) => (
              <div key={mealType} className="rounded-[2rem] border border-[#FBF0D0] bg-[#FFF9E2] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#D9B84A]">{mealType}</p>
                    <p className="mt-2 text-sm text-[#6D6B6F]">{(log.meals[mealType] || []).length} items</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMealOpen(mealType === mealOpen ? null : mealType)}
                    className="rounded-full bg-[#F4D965] px-4 py-2 text-sm font-semibold text-[#7F6A1D]"
                  >
                    {mealOpen === mealType ? 'Close' : 'Log'}
                  </button>
                </div>
                {mealOpen === mealType && (
                  <div className="mt-4 space-y-4">
                    <input
                      value={newMeal.name}
                      onChange={(e) => setNewMeal((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Meal name"
                      className="w-full rounded-3xl border border-[#F4E5B7] bg-white px-4 py-3 outline-none"
                    />
                    <input
                      value={newMeal.calories}
                      onChange={(e) => setNewMeal((prev) => ({ ...prev, calories: e.target.value }))}
                      placeholder="Calories"
                      type="number"
                      className="w-full rounded-3xl border border-[#F4E5B7] bg-white px-4 py-3 outline-none"
                    />
                    <textarea
                      value={newMeal.notes}
                      onChange={(e) => setNewMeal((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Notes or description"
                      rows="3"
                      className="w-full rounded-3xl border border-[#F4E5B7] bg-white px-4 py-3 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddMeal(mealType)}
                      disabled={!newMeal.name.trim()}
                      className="w-full rounded-full bg-[#D9B84A] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#c9ab39] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Add {mealType}
                    </button>
                  </div>
                )}
                <div className="mt-4 space-y-3">
                  {(log.meals[mealType] || []).map((item, index) => (
                    <div key={index} className="rounded-3xl bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-[#2C2C2A]">{item.name}</p>
                        <span className="rounded-full bg-[#FFF4C7] px-3 py-1 text-xs font-semibold text-[#A08238]">
                          {item.calories ? `${item.calories} kcal` : 'No kcal'}
                        </span>
                      </div>
                      {item.notes && <p className="mt-2 text-sm text-[#6D6B6F]">{item.notes}</p>}
                    </div>
                  ))}
                </div>
                {recentMeals.length > 0 && (
                  <div className="mt-4 rounded-3xl bg-[#FFF4C7] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A08238]">Quick add recent</p>
                    <div className="mt-3 grid gap-2">
                      {recentMeals.slice(0, 3).map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleRecentMealAdd(mealType, item)}
                          className="w-full rounded-3xl bg-white px-3 py-2 text-left text-sm text-[#6D6B6F] shadow-sm"
                        >
                          {item.name} {item.calories ? `• ${item.calories} kcal` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#F4E5B7] bg-white p-6 shadow-soft">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[2rem] bg-[#FFF8E5] p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#D9B84A]">Daily goal settings</p>
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="text-sm font-semibold text-[#2C2C2A]">Calorie goal</span>
                  <input
                    type="number"
                    value={settings.calorieGoal}
                    onChange={(e) => setSettings((prev) => ({ ...prev, calorieGoal: Number(e.target.value) }))}
                    className="mt-2 w-full rounded-3xl border border-[#F4E5B7] bg-white px-4 py-3 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#2C2C2A]">Water goal (glasses)</span>
                  <input
                    type="number"
                    value={settings.waterGoal}
                    onChange={(e) => setSettings((prev) => ({ ...prev, waterGoal: Number(e.target.value) }))}
                    className="mt-2 w-full rounded-3xl border border-[#F4E5B7] bg-white px-4 py-3 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#2C2C2A]">Meal reminders</span>
                  <textarea
                    value={settings.reminderNote}
                    onChange={(e) => setSettings((prev) => ({ ...prev, reminderNote: e.target.value }))}
                    rows="3"
                    className="mt-2 w-full rounded-3xl border border-[#F4E5B7] bg-white px-4 py-3 outline-none"
                    placeholder="Morning smoothie, midday salad, evening meal ideas"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSettingsSave}
                  className="rounded-full bg-[#D9B84A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#c9ab39]"
                >
                  Save goals
                </button>
              </div>
            </div>
            <div className="rounded-[2rem] bg-[#FFF8E5] p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#D9B84A]">Nutrition notes</p>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows="8"
                className="mt-4 w-full rounded-[2rem] border border-[#F4E5B7] bg-white px-4 py-4 outline-none"
                placeholder="Describe how you felt, mindful eating notes, cravings, energy levels..."
              />
              <button
                type="button"
                onClick={() => handleSaveLog({ ...log, notes: noteText })}
                className="mt-4 rounded-full bg-[#D9B84A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#c9ab39]"
              >
                Save note
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#F4E5B7] bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-[#2C2C2A]">Weekly overview</h2>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-[2rem] bg-[#FFF8E5] p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#D9B84A]">Calories this week</p>
              <div className="mt-6 flex items-end gap-3">
                {weeklyLogs.map((entry) => {
                  const calories = mealTypes.reduce((sum, mealType) => sum + (entry.meals?.[mealType]?.reduce((mealSum, item) => mealSum + (Number(item.calories) || 0), 0) || 0), 0);
                  return (
                    <div key={entry.date} className="flex-1 text-center">
                      <div className="mx-auto h-40 w-8 rounded-full bg-[#FEF6DC]" style={{ height: `${Math.min(100, calories / 20)}%` }} />
                      <p className="mt-2 text-xs text-[#6D6B6F]">{new Date(entry.date).getDate()}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-[2rem] bg-[#FFF8E5] p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#D9B84A]">Water this week</p>
              <div className="mt-6 flex items-end gap-3">
                {weeklyLogs.map((entry) => (
                  <div key={entry.date} className="flex-1 text-center">
                    <div className="mx-auto h-40 w-8 rounded-full bg-[#E6F7D9]" style={{ height: `${Math.min(100, ((entry.water || 0) / settings.waterGoal) * 100)}%` }} />
                    <p className="mt-2 text-xs text-[#6D6B6F]">{new Date(entry.date).getDate()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DietNutrition;
