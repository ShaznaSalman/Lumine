import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';

const routineKeys = ['am', 'pm'];
const productCategories = ['Cleanser', 'Moisturiser', 'SPF', 'Makeup', 'Haircare', 'Body', 'Other'];
const skinConditions = ['Clear', 'Dry', 'Oily', 'Combination', 'Breakout', 'Sensitive'];
const habitList = [
  { key: 'water', label: 'Drank water 💧' },
  { key: 'spf', label: 'Wore SPF ☀️' },
  { key: 'sleep', label: 'Got 8hrs sleep 😴' },
  { key: 'vitamins', label: 'Took vitamins 💊' },
  { key: 'noPicking', label: 'No picking 🚫' },
  { key: 'selfMassage', label: 'Self-massage 🤲' }
];
const conditionColors = {
  Clear: '#FEE8E0',
  Dry: '#FFF0D9',
  Oily: '#FDEBEF',
  Combination: '#FDF2E9',
  Breakout: '#FDE9EF',
  Sensitive: '#F9ECEE'
};

const formatDateKey = (date) => date.toISOString().split('T')[0];
const friendlyDate = (date) => date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
const friendlyMonth = (date) => date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
const getStartOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const Selfcare = () => {
  const { currentUser } = useAuth();
  const today = new Date();
  const todayKey = formatDateKey(today);
  const [activeTab, setActiveTab] = useState('routines');
  const [routines, setRoutines] = useState({ am: { steps: [] }, pm: { steps: [] } });
  const [routineStatus, setRoutineStatus] = useState({ am: [], pm: [] });
  const [products, setProducts] = useState([]);
  const [productFilter, setProductFilter] = useState('All');
  const [newProduct, setNewProduct] = useState({ name: '', brand: '', category: 'Cleanser', startedDate: '', finishDate: '', rating: 3, notes: '', status: '' });
  const [skinLogs, setSkinLogs] = useState({});
  const [skinCondition, setSkinCondition] = useState('Clear');
  const [skinNotes, setSkinNotes] = useState('');
  const [habitsToday, setHabitsToday] = useState({ water: false, spf: false, sleep: false, vitamins: false, noPicking: false, selfMassage: false });
  const [habitLogs, setHabitLogs] = useState({});
  const [notes, setNotes] = useState('');
  const [newStep, setNewStep] = useState({ name: '', product: '', notes: '' });
  const [addStepRoutine, setAddStepRoutine] = useState('am');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const loadSelfcare = async () => {
      try {
        const routineData = {};
        for (const key of routineKeys) {
          const ref = doc(db, 'users', currentUser.uid, 'selfcare', 'routines', key);
          const snap = await getDoc(ref);
          routineData[key] = snap.exists() ? snap.data() : { steps: [] };
        }
        setRoutines(routineData);

        const statusRef = doc(db, 'users', currentUser.uid, 'selfcare', 'routine-status', todayKey);
        const statusSnap = await getDoc(statusRef);
        setRoutineStatus(statusSnap.exists() ? statusSnap.data() : { am: [], pm: [] });

        const productSnapshot = await getDocs(query(collection(db, 'users', currentUser.uid, 'selfcare', 'products'), orderBy('status', 'asc')));
        setProducts(productSnapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));

        const skinSnapshot = await getDocs(collection(db, 'users', currentUser.uid, 'selfcare', 'skin-logs'));
        const skinData = {};
        skinSnapshot.docs.forEach((docItem) => {
          skinData[docItem.id] = docItem.data();
        });
        setSkinLogs(skinData);
        if (skinData[todayKey]) {
          setSkinCondition(skinData[todayKey].condition || 'Clear');
          setSkinNotes(skinData[todayKey].notes || '');
        }

        const habitSnapshot = await getDocs(collection(db, 'users', currentUser.uid, 'selfcare', 'habits'));
        const habitData = {};
        habitSnapshot.docs.forEach((docItem) => {
          habitData[docItem.id] = docItem.data();
        });
        setHabitLogs(habitData);
        if (habitData[todayKey]) setHabitsToday(habitData[todayKey]);

        const notesRef = doc(db, 'users', currentUser.uid, 'selfcare', 'notes', 'journal');
        const notesSnap = await getDoc(notesRef);
        if (notesSnap.exists()) {
          setNotes(notesSnap.data().text || '');
        }
      } catch (error) {
        console.error('Load selfcare error', error);
      } finally {
        setLoading(false);
      }
    };

    loadSelfcare();
  }, [currentUser, todayKey]);

  const saveRoutine = async (routineKey, updatedRoutine) => {
    if (!currentUser?.uid) return;
    setRoutines((prev) => ({ ...prev, [routineKey]: updatedRoutine }));
    const ref = doc(db, 'users', currentUser.uid, 'selfcare', 'routines', routineKey);
    await setDoc(ref, updatedRoutine);
  };

  const saveRoutineStatus = async (updatedStatus) => {
    if (!currentUser?.uid) return;
    setRoutineStatus(updatedStatus);
    const statusRef = doc(db, 'users', currentUser.uid, 'selfcare', 'routine-status', todayKey);
    await setDoc(statusRef, updatedStatus);
  };

  const addRoutineStep = async (routineKey) => {
    const routine = routines[routineKey];
    const step = {
      id: `${Date.now()}`,
      name: newStep.name,
      product: newStep.product,
      notes: newStep.notes,
      order: routine.steps.length + 1
    };
    const updated = { steps: [...routine.steps, step] };
    setNewStep({ name: '', product: '', notes: '' });
    await saveRoutine(routineKey, updated);
  };

  const moveStep = async (routineKey, index, direction) => {
    const routine = routines[routineKey];
    const steps = [...routine.steps];
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    [steps[index], steps[target]] = [steps[target], steps[index]];
    steps.forEach((step, idx) => { step.order = idx + 1; });
    await saveRoutine(routineKey, { steps });
  };

  const toggleStepDone = async (routineKey, stepId) => {
    const current = routineStatus[routineKey] || [];
    const next = current.includes(stepId) ? current.filter((id) => id !== stepId) : [...current, stepId];
    const updatedStatus = { ...routineStatus, [routineKey]: next };
    await saveRoutineStatus(updatedStatus);
  };

  const completionPercent = (routineKey) => {
    const steps = routines[routineKey]?.steps || [];
    if (!steps.length) return 0;
    const doneCount = (routineStatus[routineKey] || []).length;
    return Math.round((doneCount / steps.length) * 100);
  };

  const saveNewProduct = async () => {
    if (!currentUser?.uid || !newProduct.name.trim()) return;
    const docRef = doc(collection(db, 'users', currentUser.uid, 'selfcare', 'products'));
    const productItem = { ...newProduct, startedDate: newProduct.startedDate || todayKey, finishDate: newProduct.finishDate || '', rating: Number(newProduct.rating), status: newProduct.status };
    await setDoc(docRef, productItem);
    setProducts((prev) => [{ id: docRef.id, ...productItem }, ...prev]);
    setNewProduct({ name: '', brand: '', category: 'Cleanser', startedDate: '', finishDate: '', rating: 3, notes: '', status: '' });
  };

  const filteredProducts = useMemo(() => {
    if (productFilter === 'All') return products;
    return products.filter((product) => product.category === productFilter);
  }, [products, productFilter]);

  const saveSkinLog = async () => {
    if (!currentUser?.uid) return;
    const data = { condition: skinCondition, notes: skinNotes };
    const ref = doc(db, 'users', currentUser.uid, 'selfcare', 'skin-logs', todayKey);
    await setDoc(ref, data);
    setSkinLogs((prev) => ({ ...prev, [todayKey]: data }));
  };

  const saveHabit = async (key, value) => {
    if (!currentUser?.uid) return;
    const updated = { ...habitsToday, [key]: value };
    setHabitsToday(updated);
    const ref = doc(db, 'users', currentUser.uid, 'selfcare', 'habits', todayKey);
    await setDoc(ref, updated);
    setHabitLogs((prev) => ({ ...prev, [todayKey]: updated }));
  };

  const saveNotes = async () => {
    if (!currentUser?.uid) return;
    const ref = doc(db, 'users', currentUser.uid, 'selfcare', 'notes', 'journal');
    await setDoc(ref, { text: notes, updatedAt: Timestamp.now() });
  };

  const habitStreaks = useMemo(() => {
    const streaks = {};
    for (const habit of habitList) streaks[habit.key] = 0;
    const dates = Object.keys(habitLogs).sort((a, b) => new Date(b) - new Date(a));
    for (const habit of habitList) {
      let count = 0;
      for (const date of dates) {
        if (habitLogs[date]?.[habit.key]) count += 1;
        else break;
      }
      streaks[habit.key] = count;
    }
    return streaks;
  }, [habitLogs]);

  const monthDays = useMemo(() => {
    const days = [];
    const start = getStartOfMonth(today);
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i += 1) {
      const date = new Date(today.getFullYear(), today.getMonth(), i);
      const key = formatDateKey(date);
      days.push({ date, key, entry: skinLogs[key] });
    }
    return days;
  }, [today, skinLogs]);

  if (loading) {
    return <div className="min-h-screen bg-[#FFF3EE] flex items-center justify-center text-[#A45E44]">Loading selfcare…</div>;
  }

  return (
    <div className="min-h-screen bg-[#FFF3EE] px-4 py-6 text-[#2C2C2A] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[#F6D7C2] bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#D68A69]">Selfcare & Skincare</p>
              <h1 className="mt-3 text-3xl font-semibold text-[#2C2C2A]">Glow routine</h1>
            </div>
            <div className="rounded-3xl bg-[#FFF0E3] px-4 py-3 text-sm font-semibold text-[#B66D47] shadow-sm">
              {friendlyDate(today)}
            </div>
          </div>
        </section>

        <nav className="grid gap-2 sm:grid-cols-5">
          {['routines', 'products', 'skin', 'habits', 'notes'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab ? 'bg-[#FFE5D1] text-[#B66D47]' : 'bg-[#FFF4EC] text-[#A47058]'
              }`}
            >
              {tab === 'routines' ? 'Routines' : tab === 'products' ? 'Products' : tab === 'skin' ? 'Skin Log' : tab === 'habits' ? 'Habits' : 'Notes'}
            </button>
          ))}
        </nav>

        {activeTab === 'routines' && (
          <section className="rounded-[2rem] border border-[#F6D7C2] bg-white p-6 shadow-soft">
            <div className="grid gap-6 lg:grid-cols-2">
              {routineKeys.map((key) => {
                const routine = routines[key] || { steps: [] };
                const percent = completionPercent(key);
                return (
                  <div key={key} className="rounded-[2rem] border border-[#F6D7C2] bg-[#FFF4EB] p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-[0.2em] text-[#D68A69]">{key.toUpperCase()}</p>
                        <h2 className="text-xl font-semibold text-[#2C2C2A]">Routine</h2>
                      </div>
                      <div className="rounded-full bg-[#FFE4D1] px-3 py-1 text-sm font-semibold text-[#B66D47]">{percent}%</div>
                    </div>
                    <div className="space-y-3">
                      {routine.steps.map((step, index) => {
                        const done = routineStatus[key]?.includes(step.id);
                        return (
                          <div key={step.id} className="rounded-3xl border border-[#F3D0B4] bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <label className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={done}
                                  onChange={() => toggleStepDone(key, step.id)}
                                  className="h-5 w-5 accent-[#D68A69]"
                                />
                                <div>
                                  <p className="font-semibold text-[#2C2C2A]">{step.name}</p>
                                  {step.product && <p className="text-sm text-[#6D6B6F]">{step.product}</p>}
                                </div>
                              </label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => moveStep(key, index, -1)}
                                  disabled={index === 0}
                                  className="rounded-full bg-[#FFF1E7] px-3 py-2 text-sm text-[#B66D47] disabled:opacity-40"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveStep(key, index, 1)}
                                  disabled={index === routine.steps.length - 1}
                                  className="rounded-full bg-[#FFF1E7] px-3 py-2 text-sm text-[#B66D47] disabled:opacity-40"
                                >
                                  ↓
                                </button>
                              </div>
                            </div>
                            {step.notes && <p className="mt-3 text-sm text-[#6D6B6F]">{step.notes}</p>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-5 rounded-3xl bg-[#FFF1E7] p-4">
                      <p className="mb-3 text-sm font-semibold text-[#B66D47]">Add step</p>
                      <input
                        value={newStep.name}
                        onChange={(e) => setNewStep((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Step name"
                        className="mb-3 w-full rounded-3xl border border-[#F6D7C2] bg-white px-4 py-3 outline-none"
                      />
                      <input
                        value={newStep.product}
                        onChange={(e) => setNewStep((prev) => ({ ...prev, product: e.target.value }))}
                        placeholder="Product name"
                        className="mb-3 w-full rounded-3xl border border-[#F6D7C2] bg-white px-4 py-3 outline-none"
                      />
                      <textarea
                        value={newStep.notes}
                        onChange={(e) => setNewStep((prev) => ({ ...prev, notes: e.target.value }))}
                        rows="3"
                        placeholder="Notes"
                        className="mb-3 w-full rounded-3xl border border-[#F6D7C2] bg-white px-4 py-3 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => { setAddStepRoutine(key); addRoutineStep(key); }}
                        disabled={!newStep.name.trim()}
                        className="rounded-full bg-[#D68A69] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b66d59] disabled:opacity-60"
                      >
                        Add step
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === 'products' && (
          <section className="rounded-[2rem] border border-[#F6D7C2] bg-white p-6 shadow-soft">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#2C2C2A]">Product tracker</h2>
                <p className="mt-2 text-sm text-[#6D6B6F]">Save your skincare favourites and keep a holy grail shelf.</p>
              </div>
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="rounded-full border border-[#F6D7C2] bg-[#FFF4EE] px-4 py-3 text-sm outline-none"
              >
                <option value="All">All categories</option>
                {productCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-[2rem] bg-[#FFF4EE] p-5">
                <p className="mb-4 text-sm font-semibold text-[#D68A69]">Add a product</p>
                <div className="space-y-3">
                  <input
                    value={newProduct.name}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Product name"
                    className="w-full rounded-3xl border border-[#F6D7C2] bg-white px-4 py-3 outline-none"
                  />
                  <input
                    value={newProduct.brand}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, brand: e.target.value }))}
                    placeholder="Brand"
                    className="w-full rounded-3xl border border-[#F6D7C2] bg-white px-4 py-3 outline-none"
                  />
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full rounded-3xl border border-[#F6D7C2] bg-white px-4 py-3 outline-none"
                  >
                    {productCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="date"
                      value={newProduct.startedDate}
                      onChange={(e) => setNewProduct((prev) => ({ ...prev, startedDate: e.target.value }))}
                      className="w-full rounded-3xl border border-[#F6D7C2] bg-white px-4 py-3 outline-none"
                    />
                    <input
                      type="date"
                      value={newProduct.finishDate}
                      onChange={(e) => setNewProduct((prev) => ({ ...prev, finishDate: e.target.value }))}
                      className="w-full rounded-3xl border border-[#F6D7C2] bg-white px-4 py-3 outline-none"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={newProduct.rating}
                      onChange={(e) => setNewProduct((prev) => ({ ...prev, rating: Number(e.target.value) }))}
                      placeholder="Rating 1-5"
                      className="w-full rounded-3xl border border-[#F6D7C2] bg-white px-4 py-3 outline-none"
                    />
                    <select
                      value={newProduct.status}
                      onChange={(e) => setNewProduct((prev) => ({ ...prev, status: e.target.value }))}
                      className="w-full rounded-3xl border border-[#F6D7C2] bg-white px-4 py-3 outline-none"
                    >
                      <option value="">Select status</option>
                      <option value="Holy Grail">Holy Grail ⭐</option>
                      <option value="Would repurchase">Would repurchase</option>
                      <option value="Didn\'t work">Didn\'t work ❌</option>
                    </select>
                  </div>
                  <textarea
                    value={newProduct.notes}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, notes: e.target.value }))}
                    rows="3"
                    placeholder="Notes"
                    className="w-full rounded-3xl border border-[#F6D7C2] bg-white px-4 py-3 outline-none"
                  />
                  <button
                    type="button"
                    onClick={saveNewProduct}
                    disabled={!newProduct.name.trim()}
                    className="w-full rounded-full bg-[#D68A69] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b66d59] disabled:opacity-60"
                  >
                    Add product
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                {filteredProducts.length === 0 ? (
                  <p className="rounded-[1.75rem] bg-[#FFF4EE] p-6 text-sm text-[#6D6B6F]">No products yet. Add your favourites here.</p>
                ) : (
                  filteredProducts.map((product) => (
                    <div key={product.id} className="rounded-[1.75rem] border border-[#F6D7C2] bg-[#FFF8F0] p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-[#2C2C2A]">{product.name}</p>
                          <p className="text-sm text-[#6D6B6F]">{product.brand} • {product.category}</p>
                        </div>
                        <div className="text-sm text-[#B66D47]">{'⭐'.repeat(product.rating || 0)}</div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#A47058]">
                        {product.status && <span className="rounded-full bg-[#FFE5D3] px-3 py-1">{product.status}</span>}
                        <span>{product.startedDate}</span>
                        {product.finishDate && <span>Ends {product.finishDate}</span>}
                      </div>
                      {product.notes && <p className="mt-3 text-sm text-[#6D6B6F]">{product.notes}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'skin' && (
          <section className="rounded-[2rem] border border-[#F6D7C2] bg-white p-6 shadow-soft">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#2C2C2A]">Skin log</h2>
                <p className="mt-2 text-sm text-[#6D6B6F]">Record your skin condition and review monthly patterns.</p>
              </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-[2rem] bg-[#FFF4EE] p-5">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#D68A69]">Today</p>
                <div className="grid gap-3">
                  <div className="grid grid-cols-3 gap-3">
                    {skinConditions.map((condition) => (
                      <button
                        key={condition}
                        type="button"
                        onClick={() => setSkinCondition(condition)}
                        className={`rounded-3xl px-3 py-3 text-sm font-semibold transition ${
                          skinCondition === condition ? 'bg-[#F9E0D9] text-[#B66D47]' : 'bg-white text-[#7F634B]'
                        }`}
                      >
                        {condition}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={skinNotes}
                    onChange={(e) => setSkinNotes(e.target.value)}
                    rows="4"
                    placeholder="Journal your skin today"
                    className="w-full rounded-3xl border border-[#F6D7C2] bg-white px-4 py-3 outline-none"
                  />
                  <button
                    type="button"
                    onClick={saveSkinLog}
                    className="rounded-full bg-[#D68A69] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b66d59]"
                  >
                    Save skin log
                  </button>
                </div>
              </div>
              <div className="rounded-[2rem] bg-[#FFF4EE] p-5">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#D68A69]">Monthly calendar</p>
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#A47058]">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-7 gap-2">
                  {monthDays.map((day) => (
                    <div key={day.key} className="rounded-3xl border border-[#F6D7C2] bg-white p-3">
                      <div className="text-sm font-semibold text-[#2C2C2A]">{day.date.getDate()}</div>
                      {day.entry && (
                        <div className="mx-auto mt-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: conditionColors[day.entry.condition] || '#F5E1D9' }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'habits' && (
          <section className="rounded-[2rem] border border-[#F6D7C2] bg-white p-6 shadow-soft">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#2C2C2A]">Selfcare habits</h2>
                <p className="mt-2 text-sm text-[#6D6B6F]">Toggle your daily rituals and celebrate your streaks.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {habitList.map((habit) => (
                <div key={habit.key} className="rounded-[2rem] bg-[#FFF4EE] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[#2C2C2A]">{habit.label}</p>
                      <p className="mt-2 text-sm text-[#6D6B6F]">Streak {habitStreaks[habit.key] || 0} days</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => saveHabit(habit.key, !habitsToday[habit.key])}
                      className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                        habitsToday[habit.key] ? 'bg-[#D68A69] text-white' : 'bg-white text-[#B66D47]'
                      }`}
                    >
                      {habitsToday[habit.key] ? 'Done' : 'Off'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'notes' && (
          <section className="rounded-[2rem] border border-[#F6D7C2] bg-white p-6 shadow-soft">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#2C2C2A]">Glow-up notes</h2>
                <p className="mt-2 text-sm text-[#6D6B6F]">Write affirmations, progress reflections, and self-love reminders.</p>
              </div>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="10"
              className="w-full rounded-[2rem] border border-[#F6D7C2] bg-[#FFF4EE] px-6 py-5 text-sm outline-none"
              placeholder="Today I felt..."
            />
            <button
              type="button"
              onClick={saveNotes}
              className="mt-4 rounded-full bg-[#D68A69] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b66d59]"
            >
              Save notes
            </button>
          </section>
        )}
      </div>
    </div>
  );
};

export default Selfcare;
