import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';

const priorities = [
  { label: '🔴 High', value: 'High' },
  { label: '🟡 Medium', value: 'Medium' },
  { label: '🟢 Low', value: 'Low' }
];
const statuses = ['To Do', 'In Progress', 'Done'];
const projectStatuses = ['Active', 'On Hold', 'Completed'];
const views = ['kanban', 'list'];
const tabs = ['board', 'projects', 'time', 'logs', 'review'];

const formatDateKey = (date) => date.toISOString().split('T')[0];
const formatPrettyDate = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const formatDuration = (minutes) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${mins}m`;
};

const WorkTracker = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('board');
  const [viewMode, setViewMode] = useState('kanban');
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [workLogs, setWorkLogs] = useState({});
  const [filterProject, setFilterProject] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [workLogModalOpen, setWorkLogModalOpen] = useState(false);
  const [currentTimerTask, setCurrentTimerTask] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', color: '#93C5FD', description: '', status: 'Active' });
  const [newTask, setNewTask] = useState({ title: '', description: '', projectId: '', priority: 'Medium', dueDate: formatDateKey(new Date()), status: 'To Do' });
  const [newTimeLog, setNewTimeLog] = useState({ taskId: '', projectId: '', date: formatDateKey(new Date()), duration: '', notes: '' });
  const [newWorkLog, setNewWorkLog] = useState({ accomplished: '', blockers: '', tomorrowPriorities: '' });

  useEffect(() => {
    if (!currentUser?.uid) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const projectsRef = collection(db, 'users', currentUser.uid, 'work-tracker', 'projects');
        const projectsSnap = await getDocs(query(projectsRef, orderBy('createdAt', 'desc')));
        const loadedProjects = projectsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        setProjects(loadedProjects);

        const tasksRef = collection(db, 'users', currentUser.uid, 'work-tracker', 'tasks');
        const tasksSnap = await getDocs(query(tasksRef, orderBy('createdAt', 'desc')));
        const loadedTasks = tasksSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        setTasks(loadedTasks);

        const timeLogsRef = collection(db, 'users', currentUser.uid, 'work-tracker', 'time-logs');
        const timeLogsSnap = await getDocs(query(timeLogsRef, orderBy('date', 'desc')));
        setTimeLogs(timeLogsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));

        const workLogRef = collection(db, 'users', currentUser.uid, 'work-tracker', 'work-logs');
        const workLogSnap = await getDocs(query(workLogRef, orderBy('date', 'desc')));
        const loadedWorkLogs = workLogSnap.docs.reduce((acc, docSnap) => ({ ...acc, [docSnap.id]: docSnap.data() }), {});
        setWorkLogs(loadedWorkLogs);
      } catch (error) {
        console.error('Work tracker load error', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser]);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const interval = window.setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning]);

  const projectById = useMemo(() => projects.reduce((map, project) => ({ ...map, [project.id]: project }), {}), [projects]);
  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (task.archived) return false;
    if (filterProject && task.projectId !== filterProject) return false;
    if (filterPriority && task.priority !== filterPriority) return false;
    return true;
  }), [tasks, filterProject, filterPriority]);

  const boardTasks = useMemo(() => statuses.map((status) => ({
    status,
    items: filteredTasks.filter((task) => task.status === status)
  })), [filteredTasks]);

  const todayKey = formatDateKey(new Date());
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekKey = formatDateKey(weekStart);

  const reviewStats = useMemo(() => {
    const completedTasksThisWeek = tasks.filter((task) => {
      if (task.status !== 'Done') return false;
      const createdAt = task.createdAt?.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
      return formatDateKey(createdAt) >= weekKey;
    }).length;

    const hoursByProject = projects.map((project) => {
      const matchingLogs = timeLogs.filter((log) => log.projectId === project.id);
      const weeklyMinutes = matchingLogs.reduce((sum, log) => {
        const logDate = log.date?.toDate ? log.date.toDate() : new Date(log.date);
        return formatDateKey(logDate) >= weekKey ? sum + Number(log.duration || 0) : sum;
      }, 0);
      return { project, weeklyHours: weeklyMinutes / 60 };
    });

    const carryoverTasks = tasks.filter((task) => {
      if (task.status === 'Done' || task.archived) return false;
      const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
      const dueKey = formatDateKey(dueDate);
      return dueKey >= weekKey && dueKey <= todayKey;
    });

    return { completedTasksThisWeek, hoursByProject, carryoverTasks };
  }, [tasks, timeLogs, projects, weekKey, todayKey]);

  const taskCount = filteredTasks.length;
  const quickProject = projects[0]?.name || 'None';
  const activeProjectTasks = tasks.filter((task) => task.projectId === projects[0]?.id).length;

  const addProject = async () => {
    if (!currentUser?.uid || !newProject.name.trim()) return;
    try {
      const ref = doc(collection(db, 'users', currentUser.uid, 'work-tracker', 'projects'));
      const payload = { ...newProject, createdAt: Timestamp.now() };
      await setDoc(ref, payload);
      setProjects((prev) => [{ id: ref.id, ...payload }, ...prev]);
      setNewProject({ name: '', color: '#93C5FD', description: '', status: 'Active' });
      setProjectModalOpen(false);
    } catch (error) {
      console.error('Add project error', error);
    }
  };

  const addTask = async () => {
    if (!currentUser?.uid || !newTask.title.trim()) return;
    try {
      const ref = doc(collection(db, 'users', currentUser.uid, 'work-tracker', 'tasks'));
      const payload = {
        ...newTask,
        createdAt: Timestamp.now(),
        dueDate: Timestamp.fromDate(new Date(`${newTask.dueDate}T12:00:00`)),
        archived: false
      };
      await setDoc(ref, payload);
      setTasks((prev) => [{ id: ref.id, ...payload }, ...prev]);
      setNewTask({ title: '', description: '', projectId: '', priority: 'Medium', dueDate: formatDateKey(new Date()), status: 'To Do' });
      setTaskModalOpen(false);
    } catch (error) {
      console.error('Add task error', error);
    }
  };

  const addTimeLog = async () => {
    if (!currentUser?.uid || !newTimeLog.taskId || !newTimeLog.duration) return;
    try {
      const task = tasks.find((item) => item.id === newTimeLog.taskId);
      const payload = {
        ...newTimeLog,
        projectId: task?.projectId || '',
        duration: Number(newTimeLog.duration),
        date: Timestamp.fromDate(new Date(`${newTimeLog.date}T12:00:00`))
      };
      const ref = doc(collection(db, 'users', currentUser.uid, 'work-tracker', 'time-logs'));
      await setDoc(ref, payload);
      setTimeLogs((prev) => [{ id: ref.id, ...payload }, ...prev]);
      setNewTimeLog({ taskId: '', projectId: '', date: formatDateKey(new Date()), duration: '', notes: '' });
      setTimeModalOpen(false);
    } catch (error) {
      console.error('Add time log error', error);
    }
  };

  const addWorkLog = async () => {
    if (!currentUser?.uid) return;
    try {
      const key = formatDateKey(new Date());
      const ref = doc(db, 'users', currentUser.uid, 'work-tracker', 'work-logs', key);
      const payload = { ...newWorkLog, date: key, updatedAt: Timestamp.now() };
      await setDoc(ref, payload);
      setWorkLogs((prev) => ({ ...prev, [key]: payload }));
      setNewWorkLog({ accomplished: '', blockers: '', tomorrowPriorities: '' });
      setWorkLogModalOpen(false);
    } catch (error) {
      console.error('Add work log error', error);
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    if (!currentUser?.uid) return;
    try {
      const taskRef = doc(db, 'users', currentUser.uid, 'work-tracker', 'tasks', taskId);
      await updateDoc(taskRef, { status });
      setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status } : task)));
    } catch (error) {
      console.error('Update task status error', error);
    }
  };

  const archiveTask = async (taskId) => {
    if (!currentUser?.uid) return;
    try {
      const taskRef = doc(db, 'users', currentUser.uid, 'work-tracker', 'tasks', taskId);
      await updateDoc(taskRef, { archived: true });
      setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, archived: true } : task)));
    } catch (error) {
      console.error('Archive task error', error);
    }
  };

  const toggleProjectStatus = async (projectId) => {
    if (!currentUser?.uid) return;
    try {
      const project = projects.find((item) => item.id === projectId);
      if (!project) return;
      const nextIndex = (projectStatuses.indexOf(project.status) + 1) % projectStatuses.length;
      const nextStatus = projectStatuses[nextIndex];
      const projectRef = doc(db, 'users', currentUser.uid, 'work-tracker', 'projects', projectId);
      await updateDoc(projectRef, { status: nextStatus });
      setProjects((prev) => prev.map((item) => (item.id === projectId ? { ...item, status: nextStatus } : item)));
    } catch (error) {
      console.error('Toggle project status error', error);
    }
  };

  const startTaskTimer = (taskId) => {
    setCurrentTimerTask(taskId);
    setTimerSeconds(25 * 60);
    setTimerRunning(true);
  };

  const stopTaskTimer = () => setTimerRunning(false);

  const logTimer = () => {
    if (!currentTimerTask) return;
    const task = tasks.find((item) => item.id === currentTimerTask);
    setNewTimeLog((prev) => ({
      ...prev,
      taskId: currentTimerTask,
      projectId: task?.projectId || ''
    }));
    setTimeModalOpen(true);
    setTimerRunning(false);
  };

  const onDragStart = (event, taskId) => {
    event.dataTransfer.setData('taskId', taskId);
  };

  const onDrop = (event, status) => {
    const taskId = event.dataTransfer.getData('taskId');
    if (taskId) updateTaskStatus(taskId, status);
  };

  const onDragOver = (event) => event.preventDefault();

  if (loading) {
    return <div className="min-h-screen bg-[#EFF6FF] flex items-center justify-center text-[#1E40AF]">Loading work tracker…</div>;
  }

  return (
    <div className="min-h-screen bg-[#EFF6FF] px-4 py-6 text-[#1E40AF] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[#BFDBFE] bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#2563EB]">Work Tracker</p>
              <h1 className="mt-3 text-4xl font-semibold text-[#1D4ED8]">Soft productivity with calm focus.</h1>
              <p className="mt-2 text-sm text-[#1E40AF]">Manage tasks, projects, timers, and end-of-day reflections in a breezy blue workspace.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-full bg-[#DBEAFE] px-5 py-3 text-sm font-semibold text-[#1E3A8A]">Tasks {taskCount}</div>
              <div className="rounded-full bg-[#DBEAFE] px-5 py-3 text-sm font-semibold text-[#1E3A8A]">Project {quickProject}</div>
            </div>
          </div>
        </section>

        <nav className="grid gap-2 sm:grid-cols-5">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${activeTab === tab ? 'bg-[#3B82F6] text-white' : 'bg-[#DBEAFE] text-[#1E40AF]'}`}
            >
              {tab === 'board' ? 'Board' : tab === 'projects' ? 'Projects' : tab === 'time' ? 'Time' : tab === 'logs' ? 'Logs' : 'Review'}
            </button>
          ))}
        </nav>

        {activeTab === 'board' && (
          <section className="rounded-[2rem] border border-[#BFDBFE] bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#2563EB]">Kanban board</p>
                <p className="mt-2 text-sm text-[#1E40AF]">Drag tasks between columns or switch to list view.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('kanban')}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${viewMode === 'kanban' ? 'bg-[#3B82F6] text-white' : 'bg-[#DBEAFE] text-[#1E40AF]'}`}
                >
                  Kanban
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${viewMode === 'list' ? 'bg-[#3B82F6] text-white' : 'bg-[#DBEAFE] text-[#1E40AF]'}`}
                >
                  List
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[2rem] bg-[#EFF6FF] p-5 text-center shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2563EB]">Projects</p>
                <p className="mt-4 text-3xl font-semibold text-[#1E3A8A]">{projects.length}</p>
              </div>
              <div className="rounded-[2rem] bg-[#EFF6FF] p-5 text-center shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2563EB]">In progress</p>
                <p className="mt-4 text-3xl font-semibold text-[#1E3A8A]">{filteredTasks.filter((task) => task.status === 'In Progress').length}</p>
              </div>
              <div className="rounded-[2rem] bg-[#EFF6FF] p-5 text-center shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2563EB]">Due soon</p>
                <p className="mt-4 text-3xl font-semibold text-[#1E3A8A]">{filteredTasks.filter((task) => {
                  const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
                  return dueDate <= new Date(new Date().setDate(new Date().getDate() + 3));
                }).length}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="rounded-3xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm outline-none"
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="rounded-3xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm outline-none"
              >
                <option value="">All priorities</option>
                {priorities.map((priority) => (
                  <option key={priority.value} value={priority.value}>{priority.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setTaskModalOpen(true)}
                className="rounded-full bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2563EB]"
              >
                + New task
              </button>
            </div>

            {viewMode === 'kanban' ? (
              <div className="mt-6 grid gap-4 xl:grid-cols-3">
                {boardTasks.map((column) => (
                  <div
                    key={column.status}
                    onDrop={(event) => onDrop(event, column.status)}
                    onDragOver={onDragOver}
                    className="rounded-[2rem] border border-[#BFDBFE] bg-[#F8FAFF] p-4"
                  >
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#2563EB]">{column.status}</p>
                    <p className="mt-2 text-xs text-[#3B82F6]">{column.items.length} tasks</p>
                    <div className="mt-4 space-y-3">
                      {column.items.map((task) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, task.id)}
                          className="rounded-[1.75rem] border border-[#DBEAFE] bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-[#1E40AF]">{task.title}</p>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${task.priority === 'High' ? 'bg-[#FECACA] text-[#991B1B]' : task.priority === 'Medium' ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-[#DCFCE7] text-[#166534]'}`}>{task.priority}</span>
                          </div>
                          <p className="mt-2 text-sm text-[#475569]">{task.description}</p>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#475569]">
                            <span>{projectById[task.projectId]?.name || 'No project'}</span>
                            <span>Due {formatPrettyDate(task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate))}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => updateTaskStatus(task.id, statuses[(statuses.indexOf(task.status) + 1) % statuses.length])}
                              className="rounded-full bg-[#DBEAFE] px-3 py-2 text-xs font-semibold text-[#1E3A8A]"
                            >
                              Move to next
                            </button>
                            <button
                              type="button"
                              onClick={() => archiveTask(task.id)}
                              className="rounded-full bg-[#EFF6FF] px-3 py-2 text-xs font-semibold text-[#1E40AF]"
                            >
                              Archive
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentTimerTask(task.id);
                              }}
                              className="rounded-full bg-[#3B82F6] px-3 py-2 text-xs font-semibold text-white"
                            >
                              Track time
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {filteredTasks.map((task) => (
                  <div key={task.id} className="rounded-[2rem] border border-[#BFDBFE] bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-[#1E40AF]">{task.title}</p>
                        <p className="mt-1 text-sm text-[#475569]">{task.description}</p>
                      </div>
                      <span className="rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-semibold text-[#1E3A8A]">{task.status}</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-3xl bg-[#EFF6FF] p-3 text-sm text-[#1E40AF]">{projectById[task.projectId]?.name || 'No project'}</div>
                      <div className="rounded-3xl bg-[#EFF6FF] p-3 text-sm text-[#1E40AF]">Due {formatPrettyDate(task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate))}</div>
                      <div className="rounded-3xl bg-[#EFF6FF] p-3 text-sm text-[#1E40AF]">{task.priority}</div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-sm">
                      <button
                        type="button"
                        onClick={() => updateTaskStatus(task.id, statuses[(statuses.indexOf(task.status) + 1) % statuses.length])}
                        className="rounded-full bg-[#DBEAFE] px-4 py-2 font-semibold text-[#1E3A8A]"
                      >
                        Toggle status
                      </button>
                      <button
                        type="button"
                        onClick={() => archiveTask(task.id)}
                        className="rounded-full bg-[#EFF6FF] px-4 py-2 font-semibold text-[#1E40AF]"
                      >
                        Archive
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentTimerTask(task.id)}
                        className="rounded-full bg-[#3B82F6] px-4 py-2 font-semibold text-white"
                      >
                        Track time
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'projects' && (
          <section className="rounded-[2rem] border border-[#BFDBFE] bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#2563EB]">Projects</p>
                <p className="mt-2 text-sm text-[#1E40AF]">Create and manage project progress.</p>
              </div>
              <button
                type="button"
                onClick={() => setProjectModalOpen(true)}
                className="rounded-full bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2563EB]"
              >
                + New project
              </button>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => {
                const projectTasks = tasks.filter((task) => task.projectId === project.id && !task.archived);
                const completed = projectTasks.filter((task) => task.status === 'Done').length;
                const completion = projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : 0;
                const nextDue = projectTasks.reduce((next, task) => {
                  const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
                  return !next || dueDate < next ? dueDate : next;
                }, null);
                return (
                  <div key={project.id} className="rounded-[2rem] border border-[#DBEAFE] bg-[#EFF6FF] p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xl font-semibold text-[#1D4ED8]">{project.name}</p>
                        <p className="mt-1 text-sm text-[#1E40AF]">{project.description}</p>
                      </div>
                      <div className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: project.color }}>
                        {project.status}
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-3xl bg-white p-4 text-sm text-[#1E40AF]">Tasks {projectTasks.length}</div>
                      <div className="rounded-3xl bg-white p-4 text-sm text-[#1E40AF]">Completion {completion}%</div>
                      <div className="rounded-3xl bg-white p-4 text-sm text-[#1E40AF]">Next due {nextDue ? formatPrettyDate(nextDue) : 'No deadline'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleProjectStatus(project.id)}
                      className="mt-4 rounded-full bg-[#DBEAFE] px-4 py-3 text-sm font-semibold text-[#1E3A8A]"
                    >
                      Advance status
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === 'time' && (
          <section className="rounded-[2rem] border border-[#BFDBFE] bg-white p-6 shadow-soft">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[2rem] bg-[#EFF6FF] p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#2563EB]">Focus session</p>
                <div className="mt-6 flex h-72 flex-col items-center justify-center rounded-[2rem] bg-white shadow-inner">
                  <p className="text-6xl font-semibold text-[#1E40AF]">{String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:{String(timerSeconds % 60).padStart(2, '0')}</p>
                  <p className="mt-3 text-sm text-[#475569]">Task: {projectById[currentTimerTask ? tasks.find((task) => task.id === currentTimerTask)?.projectId : '']?.name || tasks.find((task) => task.id === currentTimerTask)?.title || 'None selected'}</p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setTimerRunning(true)}
                      className="rounded-full bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white"
                    >
                      Start
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimerRunning(false)}
                      className="rounded-full bg-[#DBEAFE] px-5 py-3 text-sm font-semibold text-[#1E3A8A]"
                    >
                      Pause
                    </button>
                    <button
                      type="button"
                      onClick={logTimer}
                      className="rounded-full bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white"
                    >
                      Log session
                    </button>
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  <select
                    value={newTimeLog.taskId}
                    onChange={(e) => {
                      const taskId = e.target.value;
                      const task = tasks.find((item) => item.id === taskId);
                      setNewTimeLog((prev) => ({ ...prev, taskId, projectId: task?.projectId || '' }));
                    }}
                    className="w-full rounded-[1.75rem] border border-[#BFDBFE] bg-white px-4 py-3 outline-none"
                  >
                    <option value="">Choose a task</option>
                    {tasks.filter((task) => !task.archived).map((task) => (
                      <option key={task.id} value={task.id}>{task.title}</option>
                    ))}
                  </select>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      type="date"
                      value={newTimeLog.date}
                      onChange={(e) => setNewTimeLog((prev) => ({ ...prev, date: e.target.value }))}
                      className="rounded-[1.75rem] border border-[#BFDBFE] bg-white px-4 py-3 outline-none"
                    />
                    <input
                      type="number"
                      min="1"
                      value={newTimeLog.duration}
                      onChange={(e) => setNewTimeLog((prev) => ({ ...prev, duration: e.target.value }))}
                      placeholder="Minutes"
                      className="rounded-[1.75rem] border border-[#BFDBFE] bg-white px-4 py-3 outline-none"
                    />
                  </div>
                  <textarea
                    value={newTimeLog.notes}
                    onChange={(e) => setNewTimeLog((prev) => ({ ...prev, notes: e.target.value }))}
                    rows="3"
                    placeholder="Notes"
                    className="w-full rounded-[1.75rem] border border-[#BFDBFE] bg-white px-4 py-3 outline-none"
                  />
                  <button
                    type="button"
                    onClick={addTimeLog}
                    className="rounded-full bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white"
                  >
                    Save time log
                  </button>
                </div>
              </div>
              <div className="rounded-[2rem] bg-[#EFF6FF] p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#2563EB]">Summary</p>
                <div className="mt-6 space-y-4">
                  <div className="rounded-[1.75rem] bg-white p-5">
                    <p className="text-sm text-[#475569]">Today</p>
                    <p className="mt-2 text-3xl font-semibold text-[#1E40AF]">{(timeLogs.filter((log) => formatDateKey(log.date?.toDate ? log.date.toDate() : new Date(log.date)) === todayKey).reduce((sum, log) => sum + Number(log.duration || 0), 0) / 60).toFixed(1)}h</p>
                  </div>
                  <div className="rounded-[1.75rem] bg-white p-5">
                    <p className="text-sm text-[#475569]">This week</p>
                    <p className="mt-2 text-3xl font-semibold text-[#1E40AF]">{(timeLogs.reduce((sum, log) => {
                      const logDate = log.date?.toDate ? log.date.toDate() : new Date(log.date);
                      return formatDateKey(logDate) >= weekKey ? sum + Number(log.duration || 0) : sum;
                    }, 0) / 60).toFixed(1)}h</p>
                  </div>
                  <div className="rounded-[1.75rem] bg-white p-5">
                    <p className="text-sm text-[#475569]">Focus logs</p>
                    <p className="mt-2 text-3xl font-semibold text-[#1E40AF]">{timeLogs.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'logs' && (
          <section className="rounded-[2rem] border border-[#BFDBFE] bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#2563EB]">Work logs</p>
                <p className="mt-2 text-sm text-[#1E40AF]">End your day with reflection and keep history on hand.</p>
              </div>
              <button
                type="button"
                onClick={() => setWorkLogModalOpen(true)}
                className="rounded-full bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2563EB]"
              >
                + Daily log
              </button>
            </div>
            <div className="mt-6 space-y-4">
              {Object.entries(workLogs).sort(([a], [b]) => (a > b ? -1 : 1)).map(([date, log]) => (
                <div key={date} className="rounded-[2rem] bg-[#EFF6FF] p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-lg font-semibold text-[#1D4ED8]">{date}</p>
                    <span className="rounded-full bg-[#DBEAFE] px-3 py-1 text-sm font-semibold text-[#1E40AF]">Logged</span>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm text-[#1E40AF]">
                    <div className="rounded-[1.75rem] bg-white p-4">Accomplished: {log.accomplished}</div>
                    <div className="rounded-[1.75rem] bg-white p-4">Blockers: {log.blockers}</div>
                    <div className="rounded-[1.75rem] bg-white p-4">Tomorrow: {log.tomorrowPriorities}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'review' && (
          <section className="rounded-[2rem] border border-[#BFDBFE] bg-white p-6 shadow-soft">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#2563EB]">Weekly review</p>
              <p className="mt-2 text-sm text-[#1E40AF]">See completed tasks, hours per project, and carryover work.</p>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="rounded-[1.75rem] bg-[#EFF6FF] p-5 text-center">
                <p className="text-sm text-[#475569]">Tasks done</p>
                <p className="mt-4 text-4xl font-semibold text-[#1E40AF]">{reviewStats.completedTasksThisWeek}</p>
              </div>
              <div className="rounded-[1.75rem] bg-[#EFF6FF] p-5 text-center">
                <p className="text-sm text-[#475569]">Carryover</p>
                <p className="mt-4 text-4xl font-semibold text-[#1E40AF]">{reviewStats.carryoverTasks.length}</p>
              </div>
              <div className="rounded-[1.75rem] bg-[#EFF6FF] p-5 text-center">
                <p className="text-sm text-[#475569]">Projects tracked</p>
                <p className="mt-4 text-4xl font-semibold text-[#1E40AF]">{projects.length}</p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <div className="rounded-[2rem] bg-[#EFF6FF] p-5 shadow-sm">
                <p className="text-sm font-semibold text-[#2563EB]">Hours by project</p>
                <div className="mt-4 space-y-3">
                  {reviewStats.hoursByProject.map((item) => (
                    <div key={item.project.id} className="rounded-[1.75rem] bg-white p-4">
                      <div className="flex items-center justify-between gap-3 text-sm text-[#1E40AF]">
                        <span>{item.project.name}</span>
                        <span>{item.weeklyHours.toFixed(1)}h</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[2rem] bg-[#EFF6FF] p-5 shadow-sm">
                <p className="text-sm font-semibold text-[#2563EB]">Carryover tasks</p>
                <div className="mt-4 space-y-3">
                  {reviewStats.carryoverTasks.map((task) => (
                    <div key={task.id} className="rounded-[1.75rem] bg-white p-4 text-sm text-[#1E40AF]">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>{task.title}</span>
                        <span>{task.status}</span>
                      </div>
                      <p className="mt-2 text-xs text-[#475569]">Due {formatPrettyDate(task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate))}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {taskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#2563EB]">New task</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#1D4ED8]">Add task</h2>
              </div>
              <button type="button" onClick={() => setTaskModalOpen(false)} className="rounded-full bg-[#DBEAFE] px-4 py-2 text-sm text-[#1E3A8A]">Close</button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <input
                value={newTask.title}
                onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Title"
                className="rounded-3xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 outline-none"
              />
              <select
                value={newTask.projectId}
                onChange={(e) => setNewTask((prev) => ({ ...prev, projectId: e.target.value }))}
                className="rounded-3xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 outline-none"
              >
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
                rows="3"
                placeholder="Description"
                className="col-span-2 rounded-[1.75rem] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 outline-none"
              />
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask((prev) => ({ ...prev, priority: e.target.value }))}
                className="rounded-3xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 outline-none"
              >
                {priorities.map((priority) => (
                  <option key={priority.value} value={priority.value}>{priority.label}</option>
                ))}
              </select>
              <input
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask((prev) => ({ ...prev, dueDate: e.target.value }))}
                className="rounded-3xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 outline-none"
              />
              <select
                value={newTask.status}
                onChange={(e) => setNewTask((prev) => ({ ...prev, status: e.target.value }))}
                className="rounded-3xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 outline-none"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setTaskModalOpen(false)} className="rounded-full bg-[#EFF6FF] px-5 py-3 text-sm font-semibold text-[#1E40AF]">Cancel</button>
              <button type="button" onClick={addTask} className="rounded-full bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white">Create task</button>
            </div>
          </div>
        </div>
      )}

      {projectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#2563EB]">New project</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#1D4ED8]">Add project</h2>
              </div>
              <button type="button" onClick={() => setProjectModalOpen(false)} className="rounded-full bg-[#DBEAFE] px-4 py-2 text-sm text-[#1E3A8A]">Close</button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <input
                value={newProject.name}
                onChange={(e) => setNewProject((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Name"
                className="rounded-3xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 outline-none"
              />
              <input
                value={newProject.color}
                onChange={(e) => setNewProject((prev) => ({ ...prev, color: e.target.value }))}
                placeholder="Color"
                className="rounded-3xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 outline-none"
              />
              <select
                value={newProject.status}
                onChange={(e) => setNewProject((prev) => ({ ...prev, status: e.target.value }))}
                className="rounded-3xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 outline-none"
              >
                {projectStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <textarea
                value={newProject.description}
                onChange={(e) => setNewProject((prev) => ({ ...prev, description: e.target.value }))}
                rows="3"
                placeholder="Description"
                className="rounded-[1.75rem] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 outline-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setProjectModalOpen(false)} className="rounded-full bg-[#EFF6FF] px-5 py-3 text-sm font-semibold text-[#1E40AF]">Cancel</button>
              <button type="button" onClick={addProject} className="rounded-full bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white">Create project</button>
            </div>
          </div>
        </div>
      )}

      {workLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#2563EB]">Daily work log</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#1D4ED8]">Reflect on today</h2>
              </div>
              <button type="button" onClick={() => setWorkLogModalOpen(false)} className="rounded-full bg-[#DBEAFE] px-4 py-2 text-sm text-[#1E3A8A]">Close</button>
            </div>
            <div className="mt-6 space-y-4">
              <textarea
                value={newWorkLog.accomplished}
                onChange={(e) => setNewWorkLog((prev) => ({ ...prev, accomplished: e.target.value }))}
                rows="3"
                placeholder="What did I accomplish today?"
                className="w-full rounded-[1.75rem] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 outline-none"
              />
              <textarea
                value={newWorkLog.blockers}
                onChange={(e) => setNewWorkLog((prev) => ({ ...prev, blockers: e.target.value }))}
                rows="3"
                placeholder="Blockers?"
                className="w-full rounded-[1.75rem] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 outline-none"
              />
              <textarea
                value={newWorkLog.tomorrowPriorities}
                onChange={(e) => setNewWorkLog((prev) => ({ ...prev, tomorrowPriorities: e.target.value }))}
                rows="3"
                placeholder="Tomorrow's priorities"
                className="w-full rounded-[1.75rem] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 outline-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setWorkLogModalOpen(false)} className="rounded-full bg-[#EFF6FF] px-5 py-3 text-sm font-semibold text-[#1E40AF]">Cancel</button>
              <button type="button" onClick={addWorkLog} className="rounded-full bg-[#3B82F6] px-5 py-3 text-sm font-semibold text-white">Save log</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkTracker;
