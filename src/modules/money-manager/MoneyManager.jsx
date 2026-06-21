import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';

const expenseCategories = [
  'Food',
  'Transport',
  'Shopping',
  'Health',
  'Beauty',
  'Subscriptions',
  'Education',
  'Gifts',
  'Charity',
  'Other'
];
const incomeCategories = ['Salary', 'Freelance', 'Gift', 'Other'];
const currencyOptions = ['$', '£', '€', 'LKR', 'AED', 'AUD', 'JPY'];
const tabItems = ['overview', 'transactions', 'budget', 'savings'];

const formatDateKey = (date) => date.toISOString().split('T')[0];
const formatMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const friendlyDate = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const friendlyMonth = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

const MoneyManager = () => {
  const { currentUser } = useAuth();
  const today = new Date();
  const currentMonthKey = formatMonthKey(today);

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ currency: '$' });
  const [transactions, setTransactions] = useState([]);
  const [transactionFilters, setTransactionFilters] = useState({ month: currentMonthKey, category: 'All', type: 'All', search: '' });
  const [budgetMonth, setBudgetMonth] = useState(currentMonthKey);
  const [budget, setBudget] = useState({ total: 0, categories: {} });
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [quickOpen, setQuickOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState({ type: 'expense', amount: '', category: 'Food', description: '', date: formatDateKey(today) });
  const [newBudgetTotal, setNewBudgetTotal] = useState('');
  const [goalForm, setGoalForm] = useState({ name: '', targetAmount: '', savedAmount: '', targetDate: formatDateKey(today), emoji: '💰' });
  const [goalContribution, setGoalContribution] = useState({});

  useEffect(() => {
    if (!currentUser?.uid) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const settingsRef = doc(db, 'users', currentUser.uid, 'money-manager', 'settings');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          setSettings({ ...settings, ...settingsSnap.data() });
        }

        const txRef = collection(db, 'users', currentUser.uid, 'money-manager', 'transactions');
        const txQuery = query(txRef, orderBy('date', 'desc'));
        const txSnap = await getDocs(txQuery);
        setTransactions(txSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));

        const budgetRef = doc(db, 'users', currentUser.uid, 'money-manager', 'budgets', budgetMonth);
        const budgetSnap = await getDoc(budgetRef);
        if (budgetSnap.exists()) {
          setBudget(budgetSnap.data());
        }

        const goalsRef = collection(db, 'users', currentUser.uid, 'money-manager', 'savings');
        const goalsSnap = await getDocs(query(goalsRef, orderBy('targetDate', 'asc')));
        setSavingsGoals(goalsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      } catch (error) {
        console.error('Money Manager load error', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser, budgetMonth]);

  const formatMoney = (value) => {
    const amount = Number(value) || 0;
    return `${settings.currency || '$'}${amount.toFixed(2)}`;
  };

  const saveSettings = async (nextSettings) => {
    if (!currentUser?.uid) return;
    try {
      const settingsRef = doc(db, 'users', currentUser.uid, 'money-manager', 'settings');
      await setDoc(settingsRef, nextSettings);
      setSettings(nextSettings);
    } catch (error) {
      console.error('Save money settings error', error);
    }
  };

  const saveBudget = async (monthKey, nextBudget) => {
    if (!currentUser?.uid) return;
    try {
      const budgetRef = doc(db, 'users', currentUser.uid, 'money-manager', 'budgets', monthKey);
      await setDoc(budgetRef, nextBudget);
      setBudget(nextBudget);
    } catch (error) {
      console.error('Save budget error', error);
    }
  };

  const saveTransaction = async () => {
    if (!currentUser?.uid || !newTransaction.amount) return;
    try {
      const txRef = doc(collection(db, 'users', currentUser.uid, 'money-manager', 'transactions'));
      const txData = {
        type: newTransaction.type,
        amount: Number(newTransaction.amount),
        category: newTransaction.category,
        description: newTransaction.description,
        date: Timestamp.fromDate(new Date(`${newTransaction.date}T12:00:00`))
      };
      await setDoc(txRef, txData);
      setTransactions((prev) => [{ id: txRef.id, ...txData }, ...prev]);
      setNewTransaction({
        type: 'expense',
        amount: '',
        category: 'Food',
        description: '',
        date: formatDateKey(today)
      });
      setQuickOpen(false);
    } catch (error) {
      console.error('Save transaction error', error);
    }
  };

  const deleteTransaction = async (id) => {
    if (!currentUser?.uid) return;
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'money-manager', 'transactions', id));
      setTransactions((prev) => prev.filter((tx) => tx.id !== id));
    } catch (error) {
      console.error('Delete transaction error', error);
    }
  };

  const saveGoal = async () => {
    if (!currentUser?.uid || !goalForm.name || !goalForm.targetAmount) return;
    try {
      const goalRef = doc(collection(db, 'users', currentUser.uid, 'money-manager', 'savings'));
      const nextGoal = {
        name: goalForm.name,
        targetAmount: Number(goalForm.targetAmount),
        savedAmount: Number(goalForm.savedAmount) || 0,
        targetDate: Timestamp.fromDate(new Date(`${goalForm.targetDate}T12:00:00`)),
        emoji: goalForm.emoji
      };
      await setDoc(goalRef, nextGoal);
      setSavingsGoals((prev) => [...prev, { id: goalRef.id, ...nextGoal }]);
      setGoalForm({ name: '', targetAmount: '', savedAmount: '', targetDate: formatDateKey(today), emoji: '💰' });
    } catch (error) {
      console.error('Save savings goal error', error);
    }
  };

  const contributeToGoal = async (goalId) => {
    if (!currentUser?.uid) return;
    const amount = Number(goalContribution[goalId]);
    if (!amount || amount <= 0) return;
    const goal = savingsGoals.find((item) => item.id === goalId);
    if (!goal) return;
    try {
      const goalRef = doc(db, 'users', currentUser.uid, 'money-manager', 'savings', goalId);
      const updated = { savedAmount: (goal.savedAmount || 0) + amount };
      await updateDoc(goalRef, updated);
      setSavingsGoals((prev) => prev.map((item) => (item.id === goalId ? { ...item, savedAmount: item.savedAmount + amount } : item)));
      setGoalContribution((prev) => ({ ...prev, [goalId]: '' }));
    } catch (error) {
      console.error('Contribute to goal error', error);
    }
  };

  const transactionOptions = useMemo(() => {
    const monthFilter = transactionFilters.month;
    return transactions.filter((tx) => {
      const txMonth = formatMonthKey(tx.date.toDate());
      const matchesMonth = monthFilter === 'All' || txMonth === monthFilter;
      const matchesType = transactionFilters.type === 'All' || tx.type === transactionFilters.type;
      const matchesCategory = transactionFilters.category === 'All' || tx.category === transactionFilters.category;
      const matchesSearch = tx.description.toLowerCase().includes(transactionFilters.search.toLowerCase());
      return matchesMonth && matchesType && matchesCategory && matchesSearch;
    });
  }, [transactions, transactionFilters]);

  const currentMonthTransactions = useMemo(() => {
    return transactions.filter((tx) => formatMonthKey(tx.date.toDate()) === currentMonthKey);
  }, [transactions, currentMonthKey]);

  const totalIncome = useMemo(() => {
    return currentMonthTransactions.reduce((sum, tx) => (tx.type === 'income' ? sum + (tx.amount || 0) : sum), 0);
  }, [currentMonthTransactions]);

  const totalExpenses = useMemo(() => {
    return currentMonthTransactions.reduce((sum, tx) => (tx.type === 'expense' ? sum + (tx.amount || 0) : sum), 0);
  }, [currentMonthTransactions]);

  const netBalance = totalIncome - totalExpenses;

  const expenseByCategory = useMemo(() => {
    return expenseCategories.reduce((map, category) => {
      const total = currentMonthTransactions
        .filter((tx) => tx.type === 'expense' && tx.category === category)
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);
      return { ...map, [category]: total };
    }, {});
  }, [currentMonthTransactions]);

  const budgetCategoryProgress = useMemo(() => {
    return expenseCategories.reduce((map, category) => {
      const spent = expenseByCategory[category] || 0;
      const limit = Number(budget.categories?.[category] || 0);
      const ratio = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
      return { ...map, [category]: { spent, limit, ratio } };
    }, {});
  }, [budget, expenseByCategory]);

  const budgetUsage = useMemo(() => {
    const spent = totalExpenses;
    const limit = Number(budget.total || 0);
    return limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
  }, [budget.total, totalExpenses]);

  const budgetColor = (value) => {
    if (value < 70) return 'bg-[#A7F3D0]';
    if (value < 95) return 'bg-[#FDE68A]';
    return 'bg-[#FCA5A5]';
  };

  if (loading) {
    return <div className="min-h-screen bg-[#E8FFFA] flex items-center justify-center text-[#1D4D43]">Loading money manager…</div>;
  }

  return (
    <div className="min-h-screen bg-[#E8FFFA] px-4 py-6 text-[#1D4D43] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[#C8F0E6] bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1F7F68]">Money Manager</p>
              <h1 className="mt-3 text-4xl font-semibold text-[#134B3B]">{settings.currency || '$'}{netBalance.toFixed(2)}</h1>
              <p className="mt-2 text-sm text-[#3A6C5E]">This month: income, expenses, and savings progress in one calm space.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-full bg-[#D1FAE5] px-4 py-3 text-sm font-semibold text-[#065F46] shadow-sm">Income {formatMoney(totalIncome)}</div>
              <div className="rounded-full bg-[#FED7D7] px-4 py-3 text-sm font-semibold text-[#991B1B] shadow-sm">Expense {formatMoney(totalExpenses)}</div>
            </div>
          </div>
        </section>

        <nav className="grid gap-2 sm:grid-cols-4">
          {tabItems.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab ? 'bg-[#2D7D6A] text-white' : 'bg-[#E6FCF4] text-[#16684E]'
              }`}
            >
              {tab === 'overview' ? 'Overview' : tab === 'transactions' ? 'Transactions' : tab === 'budget' ? 'Budget' : 'Savings'}
            </button>
          ))}
        </nav>

        {activeTab === 'overview' && (
          <section className="rounded-[2rem] border border-[#C8F0E6] bg-white p-6 shadow-soft">
            <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
              <div className="space-y-5">
                <div className="rounded-[2rem] bg-[#ECFDF5] p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#0F766E]">Monthly snapshot</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-[1.75rem] bg-white p-4 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#4D7C71]">Income</p>
                      <p className="mt-3 text-3xl font-semibold text-[#134B3B]">{formatMoney(totalIncome)}</p>
                    </div>
                    <div className="rounded-[1.75rem] bg-white p-4 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#4D7C71]">Expenses</p>
                      <p className="mt-3 text-3xl font-semibold text-[#991B1B]">{formatMoney(totalExpenses)}</p>
                    </div>
                    <div className="rounded-[1.75rem] bg-white p-4 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#4D7C71]">Net balance</p>
                      <p className="mt-3 text-3xl font-semibold text-[#134B3B]">{formatMoney(netBalance)}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[2rem] bg-[#F0FDFA] p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#0F766E]">Budget usage</p>
                    <p className="text-sm font-semibold text-[#16684E]">{budgetUsage}%</p>
                  </div>
                  <div className="mt-3 h-4 overflow-hidden rounded-full bg-[#D1FAE5]">
                    <div className={`${budgetColor(budgetUsage)} h-4 rounded-full`} style={{ width: `${budgetUsage}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-[#3A6C5E]">{formatMoney(totalExpenses)} of {formatMoney(budget.total)} budget</p>
                </div>
              </div>
              <div className="rounded-[2rem] bg-[#F0FDFA] p-5 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#0F766E]">Category breakdown</p>
                <div className="mt-4 space-y-4">
                  {expenseCategories.map((category) => {
                    const spent = expenseByCategory[category] || 0;
                    const percent = budget.categories?.[category] ? Math.min(100, Math.round((spent / budget.categories[category]) * 100)) : 0;
                    return (
                      <div key={category}>
                        <div className="flex items-center justify-between text-sm font-semibold text-[#134B3B]">
                          <span>{category}</span>
                          <span>{formatMoney(spent)}</span>
                        </div>
                        <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#D1FAE5]">
                          <div className={`${budgetColor(percent)} h-3 rounded-full`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'transactions' && (
          <section className="rounded-[2rem] border border-[#C8F0E6] bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#134B3B]">Transactions</h2>
                <p className="mt-2 text-sm text-[#3A6C5E]">Search, filter, and review every entry.</p>
              </div>
              <button
                type="button"
                onClick={() => setQuickOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full bg-[#2D7D6A] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#265f52]"
              >
                + Add transaction
              </button>
            </div>

            {quickOpen && (
              <div className="mt-6 rounded-[2rem] bg-[#E6FFFA] p-6 shadow-sm">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <select
                    value={newTransaction.type}
                    onChange={(e) => setNewTransaction((prev) => ({ ...prev, type: e.target.value, category: e.target.value === 'income' ? 'Salary' : 'Food' }))}
                    className="rounded-3xl border border-[#C8F0E6] bg-white px-4 py-3 outline-none"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                  <input
                    type="number"
                    value={newTransaction.amount}
                    onChange={(e) => setNewTransaction((prev) => ({ ...prev, amount: e.target.value }))}
                    placeholder="Amount"
                    className="rounded-3xl border border-[#C8F0E6] bg-white px-4 py-3 outline-none"
                  />
                  <select
                    value={newTransaction.category}
                    onChange={(e) => setNewTransaction((prev) => ({ ...prev, category: e.target.value }))}
                    className="rounded-3xl border border-[#C8F0E6] bg-white px-4 py-3 outline-none"
                  >
                    {(newTransaction.type === 'income' ? incomeCategories : expenseCategories).map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={newTransaction.date}
                    onChange={(e) => setNewTransaction((prev) => ({ ...prev, date: e.target.value }))}
                    className="rounded-3xl border border-[#C8F0E6] bg-white px-4 py-3 outline-none"
                  />
                  <button
                    type="button"
                    onClick={saveTransaction}
                    className="rounded-3xl bg-[#2D7D6A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#265f52]"
                  >
                    Save
                  </button>
                </div>
                <textarea
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction((prev) => ({ ...prev, description: e.target.value }))}
                  rows="2"
                  placeholder="Description"
                  className="mt-4 w-full rounded-[1.75rem] border border-[#C8F0E6] bg-white px-4 py-3 outline-none"
                />
              </div>
            )}

            <div className="mt-6 grid gap-4 lg:grid-cols-4">
              <select
                value={transactionFilters.month}
                onChange={(e) => setTransactionFilters((prev) => ({ ...prev, month: e.target.value }))}
                className="rounded-3xl border border-[#C8F0E6] bg-[#E6FFFA] px-4 py-3 outline-none"
              >
                <option value="All">All months</option>
                <option value={currentMonthKey}>{friendlyMonth(currentMonthKey)}</option>
                <option value={formatMonthKey(new Date(today.getFullYear(), today.getMonth() - 1, 1))}>{friendlyMonth(formatMonthKey(new Date(today.getFullYear(), today.getMonth() - 1, 1)))}</option>
              </select>
              <select
                value={transactionFilters.type}
                onChange={(e) => setTransactionFilters((prev) => ({ ...prev, type: e.target.value }))}
                className="rounded-3xl border border-[#C8F0E6] bg-[#E6FFFA] px-4 py-3 outline-none"
              >
                <option value="All">All types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
              <select
                value={transactionFilters.category}
                onChange={(e) => setTransactionFilters((prev) => ({ ...prev, category: e.target.value }))}
                className="rounded-3xl border border-[#C8F0E6] bg-[#E6FFFA] px-4 py-3 outline-none"
              >
                <option value="All">All categories</option>
                {[...expenseCategories, ...incomeCategories].map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <input
                type="search"
                value={transactionFilters.search}
                onChange={(e) => setTransactionFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Search description"
                className="rounded-3xl border border-[#C8F0E6] bg-[#E6FFFA] px-4 py-3 outline-none"
              />
            </div>

            <div className="mt-6 overflow-hidden rounded-[2rem] border border-[#C8F0E6] bg-[#F0FFFB] text-sm shadow-sm">
              <div className="grid gap-2 bg-[#E6FFFA] px-5 py-4 text-[#1F7F68] font-semibold sm:grid-cols-[1.4fr_1fr_1fr_1fr_0.6fr]">
                <span>Description</span>
                <span>Category</span>
                <span>Date</span>
                <span>Amount</span>
                <span className="text-right">Actions</span>
              </div>
              {transactionOptions.length === 0 ? (
                <div className="px-5 py-8 text-center text-[#3A6C5E]">No transactions match these filters.</div>
              ) : (
                transactionOptions.map((tx) => (
                  <div key={tx.id} className="grid gap-2 border-t border-[#C8F0E6] px-5 py-4 sm:grid-cols-[1.4fr_1fr_1fr_1fr_0.6fr]">
                    <div>
                      <p className="font-semibold text-[#134B3B]">{tx.description || tx.category}</p>
                      <p className="text-xs text-[#3A6C5E]">{tx.type}</p>
                    </div>
                    <div className="text-[#16684E]">{tx.category}</div>
                    <div className="text-[#3A6C5E]">{friendlyDate(tx.date.toDate())}</div>
                    <div className={`font-semibold ${tx.type === 'income' ? 'text-[#065F46]' : 'text-[#991B1B]'}`}>{formatMoney(tx.amount)}</div>
                    <button
                      type="button"
                      onClick={() => deleteTransaction(tx.id)}
                      className="ml-auto rounded-full bg-[#FEE2E2] px-3 py-2 text-xs font-semibold text-[#9B1238] transition hover:bg-[#fecaca]"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {activeTab === 'budget' && (
          <section className="rounded-[2rem] border border-[#C8F0E6] bg-white p-6 shadow-soft">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-[2rem] bg-[#E6FFFA] p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#0F766E]">Monthly budget</p>
                <div className="mt-4 grid gap-4">
                  <select
                    value={budgetMonth}
                    onChange={(e) => setBudgetMonth(e.target.value)}
                    className="rounded-3xl border border-[#C8F0E6] bg-white px-4 py-3 outline-none"
                  >
                    <option value={formatMonthKey(new Date(today.getFullYear(), today.getMonth() - 1, 1))}>{friendlyMonth(formatMonthKey(new Date(today.getFullYear(), today.getMonth() - 1, 1)))}</option>
                    <option value={currentMonthKey}>{friendlyMonth(currentMonthKey)}</option>
                  </select>
                  <div className="rounded-[1.75rem] bg-white p-4 shadow-sm">
                    <label className="block text-sm font-semibold text-[#134B3B]">Total budget</label>
                    <input
                      type="number"
                      value={budget.total || newBudgetTotal}
                      onChange={(e) => {
                        setNewBudgetTotal(e.target.value);
                        setBudget((prev) => ({ ...prev, total: e.target.value }));
                      }}
                      placeholder="0"
                      className="mt-3 w-full rounded-3xl border border-[#C8F0E6] px-4 py-3 outline-none"
                    />
                  </div>
                  <div className="overflow-hidden rounded-[1.75rem] bg-[#F0FFFB] p-4 shadow-sm">
                    <p className="text-sm font-semibold text-[#0F766E]">Current budget</p>
                    <p className="mt-2 text-3xl font-semibold text-[#134B3B]">{formatMoney(budget.total)}</p>
                    <p className="mt-1 text-sm text-[#3A6C5E]">{budgetUsage}% used</p>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#D1FAE5]">
                      <div className={`${budgetColor(budgetUsage)} h-3 rounded-full`} style={{ width: `${budgetUsage}%` }} />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => saveBudget(budgetMonth, { total: Number(budget.total || 0), categories: budget.categories || {} })}
                  className="mt-5 rounded-full bg-[#2D7D6A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#265f52]"
                >
                  Save budget
                </button>
              </div>
              <div className="rounded-[2rem] bg-[#F0FDFA] p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#0F766E]">Category limits</p>
                <div className="mt-4 space-y-4">
                  {expenseCategories.map((category) => (
                    <div key={category} className="rounded-[1.75rem] bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-semibold text-[#134B3B]">{category}</p>
                        <input
                          type="number"
                          value={budget.categories?.[category] || ''}
                          onChange={(e) => setBudget((prev) => ({
                            ...prev,
                            categories: { ...prev.categories, [category]: Number(e.target.value) }
                          }))}
                          placeholder="Limit"
                          className="w-32 rounded-3xl border border-[#C8F0E6] px-4 py-3 outline-none"
                        />
                      </div>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#D1FAE5]">
                        <div
                          className={`${budgetColor(budgetCategoryProgress[category]?.ratio || 0)} h-3 rounded-full`}
                          style={{ width: `${budgetCategoryProgress[category]?.ratio || 0}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-[#3A6C5E]">
                        Spent {formatMoney(budgetCategoryProgress[category]?.spent)} of {formatMoney(budget.categories?.[category] || 0)} • {budgetCategoryProgress[category]?.ratio || 0}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'savings' && (
          <section className="rounded-[2rem] border border-[#C8F0E6] bg-white p-6 shadow-soft">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div className="rounded-[2rem] bg-[#E6FFFA] p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#0F766E]">Create savings goal</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input
                      value={goalForm.name}
                      onChange={(e) => setGoalForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Goal name"
                      className="rounded-3xl border border-[#C8F0E6] bg-white px-4 py-3 outline-none"
                    />
                    <input
                      type="number"
                      value={goalForm.targetAmount}
                      onChange={(e) => setGoalForm((prev) => ({ ...prev, targetAmount: e.target.value }))}
                      placeholder="Target amount"
                      className="rounded-3xl border border-[#C8F0E6] bg-white px-4 py-3 outline-none"
                    />
                    <input
                      type="date"
                      value={goalForm.targetDate}
                      onChange={(e) => setGoalForm((prev) => ({ ...prev, targetDate: e.target.value }))}
                      className="rounded-3xl border border-[#C8F0E6] bg-white px-4 py-3 outline-none"
                    />
                    <input
                      value={goalForm.emoji}
                      onChange={(e) => setGoalForm((prev) => ({ ...prev, emoji: e.target.value }))}
                      placeholder="Emoji"
                      className="rounded-3xl border border-[#C8F0E6] bg-white px-4 py-3 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={saveGoal}
                    className="mt-4 rounded-full bg-[#2D7D6A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#265f52]"
                  >
                    Add goal
                  </button>
                </div>
                <div className="rounded-[2rem] bg-[#F0FDFA] p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#0F766E]">Currency</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {currencyOptions.map((symbol) => (
                      <button
                        key={symbol}
                        type="button"
                        onClick={() => saveSettings({ ...settings, currency: symbol })}
                        className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${
                          settings.currency === symbol ? 'bg-[#2D7D6A] text-white' : 'bg-white text-[#16684E]'
                        }`}
                      >
                        {symbol}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {savingsGoals.length === 0 ? (
                  <div className="rounded-[2rem] bg-[#E6FFFA] p-6 text-[#16684E]">No goals yet. Add a goal and watch your savings grow.</div>
                ) : (
                  savingsGoals.map((goal) => {
                    const targetDate = goal.targetDate?.toDate?.() || new Date();
                    const progress = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100)) : 0;
                    return (
                      <div key={goal.id} className="rounded-[2rem] border border-[#C8F0E6] bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm text-[#3A6C5E]">{goal.emoji} {goal.name}</p>
                            <p className="mt-1 text-sm text-[#6D6B6F]">Target {friendlyDate(targetDate)}</p>
                          </div>
                          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#E6FFFA] text-lg font-semibold text-[#165D47]">
                            {progress}%
                          </div>
                        </div>
                        <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#D1FAE5]">
                          <div className="h-3 rounded-full bg-[#2D7D6A]" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#3A6C5E]">
                          <span>{formatMoney(goal.savedAmount)} saved</span>
                          <span>of {formatMoney(goal.targetAmount)}</span>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <input
                            type="number"
                            value={goalContribution[goal.id] || ''}
                            onChange={(e) => setGoalContribution((prev) => ({ ...prev, [goal.id]: e.target.value }))}
                            placeholder="Amount"
                            className="w-28 rounded-3xl border border-[#C8F0E6] px-4 py-3 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => contributeToGoal(goal.id)}
                            className="rounded-full bg-[#2D7D6A] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#265f52]"
                          >
                            Add to savings
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        )}
      </div>
      <button
        type="button"
        onClick={() => setQuickOpen(true)}
        className="fixed bottom-6 right-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#2D7D6A] text-3xl text-white shadow-2xl transition hover:bg-[#265f52]"
      >
        +
      </button>
    </div>
  );
};

export default MoneyManager;
