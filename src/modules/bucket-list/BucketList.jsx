import React, { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import confetti from 'canvas-confetti';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';

const categories = [
  { label: 'Travel ✈️', value: 'Travel' },
  { label: 'Experience 🎢', value: 'Experience' },
  { label: 'Learn 📚', value: 'Learn' },
  { label: 'Achieve 🏆', value: 'Achieve' },
  { label: 'Give 🤲', value: 'Give' },
  { label: 'Create 🎨', value: 'Create' },
  { label: 'Relationship 💛', value: 'Relationship' },
  { label: 'Spiritual 🌙', value: 'Spiritual' },
  { label: 'Health 💪', value: 'Health' },
  { label: 'Wild Card 🎲', value: 'Wild Card' }
];
const priorities = ['Low', 'Medium', 'High'];
const statuses = ['Dream', 'Planning', 'In Progress', 'Done'];
const tabs = ['list', 'memories', 'journal'];
const prompts = [
  "Where in the world would you go if money wasn't a problem?",
  'What skill would make your 10-years-ago self proud?',
  'What experience do you want before you are 80?',
  'What legacy do you want to leave behind?',
  'How can you make the next year feel magical?',
  'What would your dream morning routine include?'
];

const formatDateKey = (date) => date.toISOString().split('T')[0];
const formatFriendly = (date) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const BucketList = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list');
  const [items, setItems] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const [completionModal, setCompletionModal] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    category: 'Travel',
    priority: 'Medium',
    targetDate: '',
    status: 'Dream',
    why: '',
    isPinned: false,
    completionNote: ''
  });
  const [newEntry, setNewEntry] = useState({ title: '', text: '', date: formatDateKey(new Date()) });
  const [completionNote, setCompletionNote] = useState('');

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const itemsRef = collection(db, 'users', currentUser.uid, 'bucket-list', 'items');
        const journalRef = collection(db, 'users', currentUser.uid, 'bucket-list', 'dream-journal');
        const [itemsSnap, journalSnap] = await Promise.all([
          getDocs(query(itemsRef, orderBy('createdAt', 'desc'))),
          getDocs(query(journalRef, orderBy('date', 'desc')))
        ]);
        setItems(itemsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        setJournalEntries(journalSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      } catch (error) {
        console.error('Bucket list load error', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser]);

  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((item) => item.status === 'Done').length;
    const categoryCounts = categories.map((category) => ({
      category: category.value,
      count: items.filter((item) => item.category === category.value).length
    }));
    const nextUp = items.filter((item) => item.status === 'Planning' || item.status === 'In Progress');
    const percentage = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percentage, categoryCounts, nextUp };
  }, [items]);

  const randomPrompt = () => {
    const next = prompts[Math.floor(Math.random() * prompts.length)];
    setPrompt(next);
  };

  const addItem = async () => {
    if (!currentUser?.uid || !newItem.title.trim()) return;
    try {
      const ref = doc(collection(db, 'users', currentUser.uid, 'bucket-list', 'items'));
      const payload = {
        ...newItem,
        targetDate: newItem.targetDate ? Timestamp.fromDate(new Date(`${newItem.targetDate}T12:00:00`)) : null,
        completedAt: newItem.status === 'Done' ? Timestamp.now() : null,
        createdAt: Timestamp.now()
      };
      await setDoc(ref, payload);
      setItems((prev) => [{ id: ref.id, ...payload }, ...prev]);
      setNewItem({
        title: '',
        description: '',
        category: 'Travel',
        priority: 'Medium',
        targetDate: '',
        status: 'Dream',
        why: '',
        isPinned: false,
        completionNote: ''
      });
      setTaskModalOpen(false);
    } catch (error) {
      console.error('Add bucket item error', error);
    }
  };

  const addJournalEntry = async () => {
    if (!currentUser?.uid || !newEntry.title.trim() || !newEntry.text.trim()) return;
    try {
      const ref = doc(collection(db, 'users', currentUser.uid, 'bucket-list', 'dream-journal'));
      const payload = { ...newEntry, date: newEntry.date, createdAt: Timestamp.now() };
      await setDoc(ref, payload);
      setJournalEntries((prev) => [{ id: ref.id, ...payload }, ...prev]);
      setNewEntry({ title: '', text: '', date: formatDateKey(new Date()) });
      setJournalModalOpen(false);
    } catch (error) {
      console.error('Add journal entry error', error);
    }
  };

  const togglePin = async (itemId) => {
    if (!currentUser?.uid) return;
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;
    try {
      const itemRef = doc(db, 'users', currentUser.uid, 'bucket-list', 'items', itemId);
      await updateDoc(itemRef, { isPinned: !item.isPinned });
      setItems((prev) => prev.map((entry) => (entry.id === itemId ? { ...entry, isPinned: !entry.isPinned } : entry)));
    } catch (error) {
      console.error('Toggle pin error', error);
    }
  };

  const updateStatus = async (itemId, status) => {
    if (!currentUser?.uid) return;
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;
    try {
      const itemRef = doc(db, 'users', currentUser.uid, 'bucket-list', 'items', itemId);
      const payload = { status };
      if (status === 'Done') {
        payload.completedAt = Timestamp.now();
      }
      await updateDoc(itemRef, payload);
      setItems((prev) => prev.map((entry) => (entry.id === itemId ? { ...entry, ...payload } : entry)));
      if (status === 'Done') {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        setCompletionModal(item);
      }
    } catch (error) {
      console.error('Update item status error', error);
    }
  };

  const saveCompletionNote = async (itemId) => {
    if (!currentUser?.uid) return;
    try {
      const itemRef = doc(db, 'users', currentUser.uid, 'bucket-list', 'items', itemId);
      await updateDoc(itemRef, { completionNote });
      setItems((prev) => prev.map((entry) => (entry.id === itemId ? { ...entry, completionNote } : entry)));
      setCompletionModal(null);
      setCompletionNote('');
    } catch (error) {
      console.error('Save completion note error', error);
    }
  };

  const pinnedItems = useMemo(() => items.filter((item) => item.isPinned), [items]);
  const nextUp = useMemo(() => items.filter((item) => item.status === 'Planning' || item.status === 'In Progress'), [items]);
  const categorySummary = useMemo(() => categories.map((category) => ({
    ...category,
    count: items.filter((item) => item.category === category.value).length
  })), [items]);

  if (loading) {
    return <div className="min-h-screen bg-[#EFF6FF] flex items-center justify-center text-[#4338CA]">Loading bucket list…</div>;
  }

  return (
    <div className="min-h-screen bg-[#EEF2FF] px-4 py-6 text-[#312E81] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[#C7D2FE] bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#4338CA]">Bucket List & Dreams</p>
              <h1 className="mt-3 text-4xl font-semibold text-[#312E81]">A gentle place for your wildest wishes.</h1>
              <p className="mt-2 text-sm text-[#4C51BF]">Track dreams, celebrate completions, and journal future visions in a starry blue space.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setTaskModalOpen(true)}
                className="rounded-full bg-[#6366F1] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#4F46E5]"
              >
                + Add item
              </button>
              <button
                type="button"
                onClick={() => setJournalModalOpen(true)}
                className="rounded-full bg-[#C7D2FE] px-5 py-3 text-sm font-semibold text-[#4338CA] shadow-sm hover:bg-[#A5B4FC]"
              >
                + Dream journal
              </button>
            </div>
          </div>
        </section>

        <nav className="grid gap-2 sm:grid-cols-3">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${activeTab === tab ? 'bg-[#4338CA] text-white' : 'bg-[#E0E7FF] text-[#312E81]'}`}
            >
              {tab === 'list' ? 'My List' : tab === 'memories' ? 'Memories' : 'Dream Journal'}
            </button>
          ))}
        </nav>

        {activeTab === 'list' && (
          <section className="rounded-[2rem] border border-[#C7D2FE] bg-white p-6 shadow-soft">
            <div className="grid gap-4 xl:grid-cols-[0.95fr_0.45fr]">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-[2rem] bg-[#EEF2FF] p-5 text-center">
                    <p className="text-sm uppercase tracking-[0.2em] text-[#4338CA]">Total items</p>
                    <p className="mt-4 text-3xl font-semibold text-[#312E81]">{stats.total}</p>
                  </div>
                  <div className="rounded-[2rem] bg-[#EEF2FF] p-5 text-center">
                    <p className="text-sm uppercase tracking-[0.2em] text-[#4338CA]">Completed</p>
                    <p className="mt-4 text-3xl font-semibold text-[#312E81]">{stats.completed}</p>
                  </div>
                  <div className="rounded-[2rem] bg-[#EEF2FF] p-5 text-center">
                    <p className="text-sm uppercase tracking-[0.2em] text-[#4338CA]">Done %</p>
                    <p className="mt-4 text-3xl font-semibold text-[#312E81]">{stats.percentage}%</p>
                  </div>
                </div>

                <div className="rounded-[2rem] bg-[#F8FBFF] p-5">
                  <p className="text-sm uppercase tracking-[0.2em] text-[#4338CA]">Next up</p>
                  <div className="mt-4 space-y-3">
                    {nextUp.slice(0, 4).map((item) => (
                      <div key={item.id} className="rounded-[1.75rem] border border-[#DBEAFE] bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-[#312E81]">{item.title}</p>
                            <p className="mt-1 text-sm text-[#4C51BF]">{item.category}</p>
                          </div>
                          <span className="rounded-full bg-[#E0E7FF] px-3 py-1 text-xs font-semibold text-[#4338CA]">{item.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[2rem] bg-[#F8FBFF] p-5">
                  <p className="text-sm uppercase tracking-[0.2em] text-[#4338CA]">Inspiration prompt</p>
                  <p className="mt-4 text-sm text-[#312E81]">{prompt || 'Tap below for a dream prompt.'}</p>
                  <button
                    type="button"
                    onClick={randomPrompt}
                    className="mt-4 rounded-full bg-[#6366F1] px-5 py-3 text-sm font-semibold text-white hover:bg-[#4F46E5]"
                  >
                    Dream prompt
                  </button>
                  {prompt && (
                    <button
                      type="button"
                      onClick={() => setNewItem((prev) => ({ ...prev, title: prompt }))}
                      className="mt-3 rounded-full bg-[#E0E7FF] px-5 py-3 text-sm font-semibold text-[#4338CA]"
                    >
                      Add this to my list
                    </button>
                  )}
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-[2rem] bg-[#EEF2FF] p-5">
                  <p className="text-sm uppercase tracking-[0.2em] text-[#4338CA]">Pinned top 5</p>
                  <div className="mt-4 space-y-3">
                    {pinnedItems.slice(0, 5).map((item) => (
                      <div key={item.id} className="rounded-[1.75rem] border border-[#DBEAFE] bg-white p-3">
                        <p className="text-sm font-semibold text-[#312E81]">{item.title}</p>
                        <p className="text-xs text-[#4C51BF]">{item.category}</p>
                      </div>
                    ))}
                    {!pinnedItems.length && <p className="text-sm text-[#4C51BF]">Pin your most important dreams to keep them front and center.</p>}
                  </div>
                </div>

                <div className="rounded-[2rem] bg-[#EEF2FF] p-5">
                  <p className="text-sm uppercase tracking-[0.2em] text-[#4338CA]">Categories</p>
                  <div className="mt-4 space-y-2">
                    {categorySummary.map((category) => (
                      <div key={category.value} className="flex items-center justify-between rounded-full bg-white px-4 py-3 text-sm text-[#312E81] shadow-sm">
                        <span>{category.label}</span>
                        <span>{category.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>

            <div className="mt-6 space-y-4">
              {items.map((item) => (
                <div key={item.id} className={`rounded-[2rem] border p-5 shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:scale-[1.01] ${item.status === 'Done' ? 'border-[#A5B4FC] bg-[#EEF2FF]' : 'border-[#C7D2FE] bg-white'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className={`text-xl font-semibold ${item.status === 'Done' ? 'line-through text-[#6D28D9]' : 'text-[#312E81]'}`}>{item.title}</p>
                      <p className="mt-1 text-sm text-[#4C51BF]">{item.category} • {item.priority}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status === 'Done' ? 'bg-[#C7D2FE] text-[#4338CA]' : 'bg-[#E0E7FF] text-[#4338CA]'}`}>{item.status}</span>
                      <button
                        type="button"
                        onClick={() => togglePin(item.id)}
                        className="rounded-full bg-[#F8FAFF] px-3 py-1 text-xs font-semibold text-[#4338CA]"
                      >
                        {item.isPinned ? 'Unpin' : 'Pin'}
                      </button>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-[#4C51BF]">{item.description}</p>
                  {item.why && <p className="mt-3 text-sm text-[#4338CA]"><span className="font-semibold">Why:</span> {item.why}</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#4C51BF]">
                    {item.targetDate && <span>Target {formatFriendly(item.targetDate?.toDate ? item.targetDate.toDate() : item.targetDate)}</span>}
                    <button
                      type="button"
                      onClick={() => updateStatus(item.id, statuses[(statuses.indexOf(item.status) + 1) % statuses.length])}
                      className="rounded-full bg-[#E0E7FF] px-4 py-2 font-semibold text-[#4338CA]"
                    >
                      Move to next
                    </button>
                  </div>
                  {item.status === 'Done' && item.completionNote && (
                    <div className="mt-4 rounded-[1.75rem] bg-[#F8FAFF] p-4 text-sm text-[#4338CA]">
                      <p className="font-semibold">Completion memory</p>
                      <p>{item.completionNote}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'memories' && (
          <section className="rounded-[2rem] border border-[#C7D2FE] bg-white p-6 shadow-soft">
            <div className="grid gap-4">
              {items.filter((item) => item.status === 'Done').map((item) => (
                <div key={item.id} className="rounded-[2rem] border border-[#DBEAFE] bg-[#EEF2FF] p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-semibold text-[#312E81]">{item.title}</p>
                      <p className="mt-1 text-sm text-[#4C51BF]">{item.category}</p>
                    </div>
                    <span className="rounded-full bg-[#E0E7FF] px-3 py-1 text-xs font-semibold text-[#4338CA]">Done</span>
                  </div>
                  <p className="mt-4 text-sm text-[#4C51BF]">{item.description}</p>
                  {item.completionNote && <div className="mt-4 rounded-[1.75rem] bg-white p-4 text-sm text-[#4338CA]">"{item.completionNote}"</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'journal' && (
          <section className="rounded-[2rem] border border-[#C7D2FE] bg-white p-6 shadow-soft">
            <div className="grid gap-4">
              {journalEntries.map((entry) => (
                <div key={entry.id} className="rounded-[2rem] border border-[#DBEAFE] bg-[#EEF2FF] p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xl font-semibold text-[#312E81]">{entry.title}</p>
                    <span className="rounded-full bg-[#E0E7FF] px-3 py-1 text-xs font-semibold text-[#4338CA]">{formatFriendly(entry.date)}</span>
                  </div>
                  <p className="mt-4 text-sm text-[#4C51BF]">{entry.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {taskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
          <div className="w-full max-w-3xl rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#4338CA]">New bucket item</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#312E81]">Add a dream or goal</h2>
              </div>
              <button type="button" onClick={() => setTaskModalOpen(false)} className="rounded-full bg-[#E0E7FF] px-4 py-2 text-sm text-[#4338CA]">Close</button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <input
                value={newItem.title}
                onChange={(e) => setNewItem((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Title"
                className="rounded-3xl border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-3 outline-none"
              />
              <select
                value={newItem.category}
                onChange={(e) => setNewItem((prev) => ({ ...prev, category: e.target.value }))}
                className="rounded-3xl border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-3 outline-none"
              >
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
              <textarea
                value={newItem.description}
                onChange={(e) => setNewItem((prev) => ({ ...prev, description: e.target.value }))}
                rows="3"
                placeholder="Description"
                className="col-span-2 rounded-[1.75rem] border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-3 outline-none"
              />
              <select
                value={newItem.priority}
                onChange={(e) => setNewItem((prev) => ({ ...prev, priority: e.target.value }))}
                className="rounded-3xl border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-3 outline-none"
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
              <select
                value={newItem.status}
                onChange={(e) => setNewItem((prev) => ({ ...prev, status: e.target.value }))}
                className="rounded-3xl border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-3 outline-none"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <input
                type="date"
                value={newItem.targetDate}
                onChange={(e) => setNewItem((prev) => ({ ...prev, targetDate: e.target.value }))}
                className="rounded-3xl border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-3 outline-none"
              />
              <textarea
                value={newItem.why}
                onChange={(e) => setNewItem((prev) => ({ ...prev, why: e.target.value }))}
                rows="3"
                placeholder="Why this matters"
                className="col-span-2 rounded-[1.75rem] border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-3 outline-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setTaskModalOpen(false)} className="rounded-full bg-[#E0E7FF] px-5 py-3 text-sm font-semibold text-[#4338CA]">Cancel</button>
              <button type="button" onClick={addItem} className="rounded-full bg-[#4338CA] px-5 py-3 text-sm font-semibold text-white">Save item</button>
            </div>
          </div>
        </div>
      )}

      {journalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
          <div className="w-full max-w-3xl rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#4338CA]">Dream journal</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#312E81]">Write a future vision</h2>
              </div>
              <button type="button" onClick={() => setJournalModalOpen(false)} className="rounded-full bg-[#E0E7FF] px-4 py-2 text-sm text-[#4338CA]">Close</button>
            </div>
            <div className="mt-6 grid gap-4">
              <input
                value={newEntry.title}
                onChange={(e) => setNewEntry((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Title"
                className="rounded-3xl border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-3 outline-none"
              />
              <input
                type="date"
                value={newEntry.date}
                onChange={(e) => setNewEntry((prev) => ({ ...prev, date: e.target.value }))}
                className="rounded-3xl border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-3 outline-none"
              />
              <textarea
                value={newEntry.text}
                onChange={(e) => setNewEntry((prev) => ({ ...prev, text: e.target.value }))}
                rows="5"
                placeholder="Free-writing journal entry"
                className="rounded-[1.75rem] border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-3 outline-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setJournalModalOpen(false)} className="rounded-full bg-[#E0E7FF] px-5 py-3 text-sm font-semibold text-[#4338CA]">Cancel</button>
              <button type="button" onClick={addJournalEntry} className="rounded-full bg-[#4338CA] px-5 py-3 text-sm font-semibold text-white">Save entry</button>
            </div>
          </div>
        </div>
      )}

      {completionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#4338CA]">Celebrate</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#312E81]">How did it feel?</h2>
              </div>
              <button type="button" onClick={() => setCompletionModal(null)} className="rounded-full bg-[#E0E7FF] px-4 py-2 text-sm text-[#4338CA]">Close</button>
            </div>
            <div className="mt-6">
              <textarea
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                rows="4"
                placeholder="Write about how it felt"
                className="w-full rounded-[1.75rem] border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-3 outline-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setCompletionModal(null)} className="rounded-full bg-[#E0E7FF] px-5 py-3 text-sm font-semibold text-[#4338CA]">Skip</button>
              <button type="button" onClick={() => saveCompletionNote(completionModal.id)} className="rounded-full bg-[#4338CA] px-5 py-3 text-sm font-semibold text-white">Save memory</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BucketList;
