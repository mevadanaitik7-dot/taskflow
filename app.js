// ===================================================
// TASKFLOW - Complete App Logic
// ===================================================

const DB = {
  get: (key, def = null) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { console.error(e); }
  }
};

let state = {
  tasks: DB.get('tf_tasks', []),
  dailyTemplates: DB.get('tf_daily_templates', [
    { id: 'dt1', name: 'Morning Walk 🚶', color: '#4facfe' },
    { id: 'dt2', name: 'Read 30 min 📚', color: '#43e97b' },
    { id: 'dt3', name: 'Meditation 🧘', color: '#f093fb' }
  ]),
  history: DB.get('tf_history', {}),
  currentFilter: 'all',
  selectedPriority: 'normal',
  selectedColor: '#f093fb',
  selectedDailyColor: '#4facfe',
  notifSettings: DB.get('tf_notif', { morning: false, morningTime: '08:00', evening: false, eveningTime: '20:00' }),
  lastDailyReset: DB.get('tf_last_daily', null),
  lastMonthlyReset: DB.get('tf_last_monthly', null),
  currentTab: 'today',
  editingTaskId: null
};

const quotes = [
  "Jo aaj kiya woh kal ki neenv hai! 🏗️",
  "Ek ek kadam se manzil milti hai! 👣",
  "Aaj mehnat, kal success! 💪",
  "Sab kuch possible hai, bas shuru karo! 🚀",
  "Apni potential ko jaano aur use karo! ⚡",
  "Champions bante nahi, banate hain! 🏆",
  "Har din ek nayi shuruat! 🌅",
  "Sapne wo nahi jo sote mein aayein, sapne vo jo sone na den! 🔥",
  "Your only limit is your mind! 🧠",
  "Be the best version of yourself today! ✨",
  "Small steps, big dreams! 🌟",
  "Struggle is part of the journey! 💎",
  "Success begins with self-discipline! 🎯",
  "Har mushkil aasan hogi, sirf koshish karo! 🌊",
  "Aaj ka task, kal ki jeet! 🥇"
];

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    document.getElementById('splash').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('splash').style.display = 'none';
      document.getElementById('app').classList.remove('hidden');
      initApp();
    }, 500);
  }, 2500);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'add') {
    setTimeout(() => openAddTaskModal(), 3000);
  }
});

function initApp() {
  updateHeader();
  refreshQuote();
  checkDailyReset();
  renderAll();
  updateStats();
  scheduleNotifications();
  loadNotifSettings();
  setInterval(() => { updateHeader(); checkDailyReset(); }, 60000);
}

function updateHeader() {
  const now = new Date();
  const hour = now.getHours();
  let greeting = '🌙 Good Night!';
  if (hour >= 5 && hour < 12) greeting = '🌅 Good Morning!';
  else if (hour >= 12 && hour < 17) greeting = '☀️ Good Afternoon!';
  else if (hour >= 17 && hour < 21) greeting = '🌆 Good Evening!';
  document.getElementById('headerGreeting').textContent = greeting;
  document.getElementById('headerDate').textContent = now.toLocaleDateString('hi-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function refreshQuote() {
  const q = quotes[Math.floor(Math.random() * quotes.length)];
  const el = document.getElementById('quoteText');
  el.style.opacity = '0';
  setTimeout(() => { el.textContent = q; el.style.opacity = '1'; el.style.transition = 'opacity 0.5s'; }, 200);
}

function todayStr() { return new Date().toISOString().split('T')[0]; }
function monthStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }

function checkDailyReset() {
  const today = todayStr();
  if (state.lastDailyReset !== today) {
    if (state.lastDailyReset) saveToHistory(state.lastDailyReset);
    injectDailyTasks(today);
    state.lastDailyReset = today;
    DB.set('tf_last_daily', today);
  }
  checkMonthlyReset();
}

function injectDailyTasks(today) {
  state.tasks = state.tasks.filter(t => !(t.isDaily && t.date === today));
  state.dailyTemplates.forEach(tmpl => {
    state.tasks.push({
      id: 'daily_' + tmpl.id + '_' + today,
      title: tmpl.name, desc: 'Auto-added daily task 🔄',
      priority: 'daily', color: tmpl.color,
      date: today, time: '', completed: false,
      isDaily: true, templateId: tmpl.id, createdAt: new Date().toISOString()
    });
  });
  saveTasks();
}

function checkMonthlyReset() {
  const currentMonth = monthStr();
  if (state.lastMonthlyReset && state.lastMonthlyReset !== currentMonth) archiveMonth(state.lastMonthlyReset);
  if (state.lastMonthlyReset !== currentMonth) {
    state.lastMonthlyReset = currentMonth;
    DB.set('tf_last_monthly', currentMonth);
  }
}

function archiveMonth(monthKey) {
  let archive = DB.get('tf_archive', {});
  archive[monthKey] = state.history;
  DB.set('tf_archive', archive);
}

function saveToHistory(date) {
  const dayTasks = state.tasks.filter(t => t.date === date);
  if (dayTasks.length > 0) {
    state.history[date] = dayTasks.map(t => ({ id: t.id, title: t.title, completed: t.completed, priority: t.priority, color: t.color }));
    DB.set('tf_history', state.history);
  }
}

function saveTasks() {
  saveToHistory(todayStr());
  DB.set('tf_tasks', state.tasks);
}

function renderAll() {
  renderTodayTasks();
  renderUpcomingTasks();
  renderDailySection();
  updateStats();
}

function renderTodayTasks() {
  const today = todayStr();
  let tasks = state.tasks.filter(t => t.date === today && !t.isDaily);
  tasks = sortByPriority(tasks);
  if (state.currentFilter !== 'all') tasks = tasks.filter(t => t.priority === state.currentFilter);
  const container = document.getElementById('taskList');
  container.innerHTML = '';
  if (tasks.length === 0) {
    document.getElementById('emptyToday').style.display = 'block';
  } else {
    document.getElementById('emptyToday').style.display = 'none';
    tasks.forEach(t => container.appendChild(createTaskCard(t)));
  }
}

function renderUpcomingTasks() {
  const today = todayStr();
  let tasks = state.tasks.filter(t => t.date > today).sort((a,b) => a.date.localeCompare(b.date));
  const container = document.getElementById('upcomingList');
  container.innerHTML = '';
  if (tasks.length === 0) {
    document.getElementById('emptyUpcoming').style.display = 'block';
  } else {
    document.getElementById('emptyUpcoming').style.display = 'none';
    tasks.forEach(t => container.appendChild(createTaskCard(t, true)));
  }
}

function renderDailySection() {
  const today = todayStr();
  const tasks = state.tasks.filter(t => t.isDaily && t.date === today);
  const container = document.getElementById('dailyList');
  container.innerHTML = '';
  tasks.forEach(t => container.appendChild(createTaskCard(t)));
}

const priorityOrder = { 'very-important': 0, 'important': 1, 'normal': 2, 'daily': 3, 'low': 4 };
function sortByPriority(tasks) {
  return tasks.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
  });
}

function createTaskCard(task, showDate = false) {
  const card = document.createElement('div');
  card.className = `task-card ${task.priority} ${task.completed ? 'completed-card' : ''}`;
  card.id = `card_${task.id}`;
  const priorityLabels = { 'very-important': '🔴 Very Important', 'important': '🟠 Important', 'normal': '🟡 Normal', 'daily': '🔵 Daily', 'low': '🟢 Low Priority' };
  const dateDisplay = showDate ? `<span class="task-date-badge">📅 ${formatDate(task.date)}</span>` : '';
  const dailyTag = task.isDaily ? '<div class="daily-tag">🔄 DAILY</div>' : '';
  const colorDot = task.color ? `<div class="task-color-dot" style="background:${task.color}"></div>` : '';
  const reminderBadge = task.time ? `<span class="task-date-badge">⏰ ${task.time}</span>` : '';
  card.innerHTML = `
    ${dailyTag}
    <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="toggleTask('${task.id}')"></div>
    <div class="task-info">
      <div class="task-title">${escHtml(task.title)}</div>
      ${task.desc ? `<div class="task-desc">${escHtml(task.desc)}</div>` : ''}
      <div class="task-meta">
        <span class="priority-badge ${task.priority}">${priorityLabels[task.priority] || task.priority}</span>
        ${colorDot}${dateDisplay}${reminderBadge}
      </div>
    </div>
    <div class="task-actions">
      <button class="task-btn btn-edit" onclick="editTask('${task.id}')"><i class="fas fa-pen"></i></button>
      <button class="task-btn btn-delete" onclick="deleteTask('${task.id}')"><i class="fas fa-trash"></i></button>
    </div>
  `;
  return card;
}

function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
  renderAll();
  if (task.completed) { showToast(`✅ "${task.title}" complete!`); checkAllComplete(); }
}

function checkAllComplete() {
  const today = todayStr();
  const todayTasks = state.tasks.filter(t => t.date === today);
  if (todayTasks.length > 0 && todayTasks.every(t => t.completed)) setTimeout(showCelebration, 500);
}

function deleteTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  showConfirm('Task Delete Karo?', `"${task.title}" permanently delete hoga!`, () => {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveTasks(); renderAll(); showToast('🗑️ Task deleted!');
  });
}

function editTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  state.editingTaskId = id;
  openAddTaskModal(task);
}

function openAddTaskModal(existingTask = null) {
  document.getElementById('taskTitle').value = existingTask ? existingTask.title : '';
  document.getElementById('taskDesc').value = existingTask ? existingTask.desc || '' : '';
  document.getElementById('taskDate').value = existingTask ? existingTask.date : todayStr();
  document.getElementById('taskTime').value = existingTask ? existingTask.time || '' : '';
  state.selectedPriority = existingTask ? existingTask.priority : 'normal';
  document.querySelectorAll('.priority-card').forEach(c => c.classList.toggle('selected', c.dataset.priority === state.selectedPriority));
  state.selectedColor = existingTask ? existingTask.color || '#f093fb' : '#f093fb';
  document.querySelectorAll('.color-opt').forEach(c => c.classList.toggle('selected', c.dataset.color === state.selectedColor));
  openModal('addTaskModal');
}

function addTask() {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) { showToast('⚠️ Task ka naam toh do!'); return; }
  const taskData = {
    id: state.editingTaskId || 'task_' + Date.now(),
    title, desc: document.getElementById('taskDesc').value.trim(),
    priority: state.selectedPriority, color: state.selectedColor,
    date: document.getElementById('taskDate').value || todayStr(),
    time: document.getElementById('taskTime').value,
    completed: false, isDaily: false, createdAt: new Date().toISOString()
  };
  if (state.editingTaskId) {
    const idx = state.tasks.findIndex(t => t.id === state.editingTaskId);
    if (idx !== -1) { taskData.completed = state.tasks[idx].completed; taskData.createdAt = state.tasks[idx].createdAt; state.tasks[idx] = taskData; }
    state.editingTaskId = null;
    showToast('✏️ Task updated!');
  } else {
    state.tasks.push(taskData);
    showToast('🚀 Task add ho gaya!');
    scheduleTaskReminder(taskData);
  }
  saveTasks(); renderAll(); closeModal('addTaskModal');
}

function selectPriority(p, el) {
  state.selectedPriority = p;
  document.querySelectorAll('.priority-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}
function selectColor(c, el) {
  state.selectedColor = c;
  document.querySelectorAll('.color-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}
function selectDailyColor(c, el) {
  state.selectedDailyColor = c;
  document.querySelectorAll('#dailyManagerModal .color-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

function openDailyTaskManager() { renderDailyTemplates(); openModal('dailyManagerModal'); }
function renderDailyTemplates() {
  const container = document.getElementById('dailyTemplateList');
  container.innerHTML = '';
  state.dailyTemplates.forEach(t => {
    const div = document.createElement('div');
    div.className = 'daily-template-item';
    div.innerHTML = `<div class="template-color" style="background:${t.color}"></div><div class="template-name">${escHtml(t.name)}</div><button class="template-del" onclick="deleteDailyTemplate('${t.id}')"><i class="fas fa-trash"></i></button>`;
    container.appendChild(div);
  });
}
function addDailyTemplate() {
  const name = document.getElementById('newDailyTask').value.trim();
  if (!name) { showToast('⚠️ Daily task ka naam do!'); return; }
  const tmpl = { id: 'dt_' + Date.now(), name, color: state.selectedDailyColor };
  state.dailyTemplates.push(tmpl);
  DB.set('tf_daily_templates', state.dailyTemplates);
  document.getElementById('newDailyTask').value = '';
  state.tasks.push({ id: 'daily_' + tmpl.id + '_' + todayStr(), title: tmpl.name, desc: 'Auto-added daily task 🔄', priority: 'daily', color: tmpl.color, date: todayStr(), time: '', completed: false, isDaily: true, templateId: tmpl.id, createdAt: new Date().toISOString() });
  saveTasks(); renderAll(); renderDailyTemplates(); showToast('🔄 Daily task added!');
}
function deleteDailyTemplate(id) {
  state.dailyTemplates = state.dailyTemplates.filter(t => t.id !== id);
  DB.set('tf_daily_templates', state.dailyTemplates);
  state.tasks = state.tasks.filter(t => !(t.templateId === id && t.date === todayStr()));
  saveTasks(); renderAll(); renderDailyTemplates(); showToast('🗑️ Daily task removed!');
}

function updateStats() {
  const today = todayStr();
  const todayTasks = state.tasks.filter(t => t.date === today);
  const total = todayTasks.length;
  const done = todayTasks.filter(t => t.completed).length;
  const pending = total - done;
  const pct = total > 0 ? Math.round((done/total)*100) : 0;
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statDone').textContent = done;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statPercent').textContent = pct + '%';
  document.getElementById('progressPct').textContent = pct + '%';
  document.getElementById('progressFill').style.width = pct + '%';
  let msg = 'Shuru karo! Har kadam count karta hai 🚀';
  if (pct > 0 && pct < 30) msg = 'Acha shuruat! Jaari rakho 💪';
  else if (pct >= 30 && pct < 60) msg = "Halfway there! You're crushing it! 🔥";
  else if (pct >= 60 && pct < 90) msg = 'Almost there! Thodi aur mehnat! ⚡';
  else if (pct >= 90 && pct < 100) msg = 'So close! Bas kuch aur! 🎯';
  else if (pct === 100) msg = '🎉 Aaj sab complete! Champion ho tum!';
  document.getElementById('progressMsg').textContent = msg;
}

function filterTasks(filter, el) {
  state.currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderTodayTasks();
}

function showTab(tab) {
  state.currentTab = tab;
  ['today','upcoming','daily'].forEach(t => {
    document.getElementById(`section-${t}`).style.display = t === tab ? 'block' : 'none';
    const tabEl = document.getElementById(`tab-${t}`);
    if (tabEl) tabEl.classList.toggle('active', t === tab);
  });
  document.getElementById('tab-progress')?.classList.remove('active');
  if (tab === 'today') renderTodayTasks();
  if (tab === 'upcoming') renderUpcomingTasks();
  if (tab === 'daily') renderDailySection();
}

function showSection(section) {
  if (section === 'progress') { openModal('progressModal'); renderProgress(); }
  else if (section === 'history') {
    const now = new Date();
    document.getElementById('historyMonth').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    openModal('historyModal'); loadHistory();
  }
}

function renderProgress() {
  const today = todayStr(), month = monthStr();
  const monthDays = {};
  Object.keys(state.history).forEach(date => { if (date.startsWith(month)) monthDays[date] = state.history[date]; });
  monthDays[today] = state.tasks.filter(t => t.date === today).map(t => ({ id: t.id, title: t.title, completed: t.completed, priority: t.priority }));
  let totalTasks = 0, completedTasks = 0;
  Object.values(monthDays).forEach(dayTasks => { totalTasks += dayTasks.length; completedTasks += dayTasks.filter(t => t.completed).length; });
  const monthPct = totalTasks > 0 ? Math.round((completedTasks/totalTasks)*100) : 0;
  document.getElementById('monthStats').innerHTML = `
    <div class="month-stat-item"><div class="month-stat-val" style="color:var(--accent-1)">${totalTasks}</div><div class="month-stat-lbl">Total</div></div>
    <div class="month-stat-item"><div class="month-stat-val" style="color:var(--accent-4)">${completedTasks}</div><div class="month-stat-lbl">Done ✅</div></div>
    <div class="month-stat-item"><div class="month-stat-val" style="color:var(--accent-2)">${totalTasks - completedTasks}</div><div class="month-stat-lbl">Pending ❌</div></div>
  `;
  drawBarChart(monthDays);
  drawRingChart(monthPct);
  document.getElementById('ringCenter').textContent = monthPct + '%';
  renderDaySummary(monthDays);
}

function drawBarChart(monthDays) {
  const canvas = document.getElementById('progressChart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 320 * dpr; canvas.height = 200 * dpr;
  ctx.scale(dpr, dpr);
  const W = 320, H = 200;
  ctx.clearRect(0, 0, W, H);
  const days = Object.keys(monthDays).sort().slice(-14);
  if (days.length === 0) return;
  const barW = Math.min(18, (W - 40) / days.length - 4);
  const maxTasks = Math.max(...days.map(d => monthDays[d].length), 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = 20 + ((H-50)/4)*i; ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(W-10, y); ctx.stroke(); }
  days.forEach((date, i) => {
    const dayData = monthDays[date] || [];
    const total = dayData.length, done = dayData.filter(t => t.completed).length;
    const x = 35 + i * ((W-45)/days.length);
    if (total > 0) {
      const totalH = ((H-50)/maxTasks) * total;
      const grad = ctx.createLinearGradient(0, H-30-totalH, 0, H-30);
      grad.addColorStop(0, 'rgba(79,172,254,0.4)'); grad.addColorStop(1, 'rgba(79,172,254,0.1)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(x - barW/2, H-30-totalH, barW, totalH, [3,3,0,0]); ctx.fill();
      const doneH = total > 0 ? ((H-50)/maxTasks) * done : 0;
      const grad2 = ctx.createLinearGradient(0, H-30-doneH, 0, H-30);
      grad2.addColorStop(0, '#f093fb'); grad2.addColorStop(1, '#f5576c');
      ctx.fillStyle = grad2; ctx.beginPath(); ctx.roundRect(x - barW/2, H-30-doneH, barW, doneH, [3,3,0,0]); ctx.fill();
    }
    const d = new Date(date);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '8px Poppins'; ctx.textAlign = 'center';
    ctx.fillText(d.getDate(), x, H-12);
  });
}

function drawRingChart(pct) {
  const canvas = document.getElementById('ringChart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 160 * dpr; canvas.height = 160 * dpr;
  ctx.scale(dpr, dpr);
  const cx = 80, cy = 80, r = 60, lw = 14;
  ctx.clearRect(0, 0, 160, 160);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = lw; ctx.stroke();
  const angle = (pct/100) * Math.PI * 2 - Math.PI/2;
  const grad = ctx.createLinearGradient(0, 0, 160, 160);
  grad.addColorStop(0, '#f093fb'); grad.addColorStop(1, '#f5576c');
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI/2, angle); ctx.strokeStyle = grad; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
}

function renderDaySummary(monthDays) {
  const container = document.getElementById('daySummary');
  container.innerHTML = '';
  Object.keys(monthDays).sort().reverse().slice(0, 15).forEach(date => {
    const dayData = monthDays[date] || [];
    const total = dayData.length, done = dayData.filter(t => t.completed).length;
    const pct = total > 0 ? Math.round((done/total)*100) : 0;
    const div = document.createElement('div');
    div.className = 'day-row';
    div.innerHTML = `<div class="day-date">${formatDate(date)}</div><div class="day-bar-track"><div class="day-bar-fill" style="width:${pct}%"></div></div><div class="day-pct">${done}/${total} (${pct}%)</div>`;
    container.appendChild(div);
  });
}

function loadHistory() {
  const monthVal = document.getElementById('historyMonth').value;
  if (!monthVal) return;
  const container = document.getElementById('historyContent');
  container.innerHTML = '';
  const allDates = Object.keys(state.history).filter(d => d.startsWith(monthVal)).sort().reverse();
  if (allDates.length === 0) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>Is month ki koi history nahi</p></div>'; return; }
  allDates.forEach(date => {
    const tasks = state.history[date];
    const done = tasks.filter(t => t.completed).length;
    const div = document.createElement('div');
    div.className = 'history-day';
    div.innerHTML = `<div class="history-day-header"><span>📅 ${formatDate(date)}</span><span>${done}/${tasks.length} Complete</span></div>${tasks.map(t => `<div class="history-task ${t.completed ? 'done' : 'undone'}">${escHtml(t.title)}<span class="priority-badge ${t.priority}" style="margin-left:auto">${t.priority}</span></div>`).join('')}`;
    container.appendChild(div);
  });
}

function confirmMonthReset() {
  showConfirm('⚠️ Monthly Reset', 'Is month ka sara data archive ho jaayega!', () => {
    archiveMonth(monthStr()); state.history = {}; DB.set('tf_history', {});
    const today = todayStr(); state.tasks = state.tasks.filter(t => t.date >= today);
    saveTasks(); closeModal('progressModal'); renderAll(); showToast('🔄 Monthly reset complete!');
  });
}

function openNotifSettings() { openModal('notifModal'); loadNotifSettings(); }
function loadNotifSettings() {
  const s = state.notifSettings;
  document.getElementById('morningToggle').checked = s.morning || false;
  document.getElementById('eveningToggle').checked = s.evening || false;
  document.getElementById('morningTime').value = s.morningTime || '08:00';
  document.getElementById('eveningTime').value = s.eveningTime || '20:00';
}
function saveNotifSettings() {
  state.notifSettings = { morning: document.getElementById('morningToggle').checked, morningTime: document.getElementById('morningTime').value, evening: document.getElementById('eveningToggle').checked, eveningTime: document.getElementById('eveningTime').value };
  DB.set('tf_notif', state.notifSettings);
  scheduleNotifications();
}
async function requestNotificationPermission() {
  const statusEl = document.getElementById('notifStatus');
  if (!('Notification' in window)) { statusEl.textContent = '❌ Is browser mein notifications support nahi!'; return; }
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    statusEl.textContent = '✅ Notifications enable ho gayi!';
    statusEl.style.background = 'rgba(67,233,123,0.2)'; statusEl.style.color = '#43e97b';
    scheduleNotifications();
    setTimeout(() => new Notification('⚡ TaskFlow', { body: 'Notifications sahi se kaam kar rahi hain! 🎉' }), 1000);
  } else {
    statusEl.textContent = '❌ Permission denied! Settings mein jaake enable karo.';
    statusEl.style.background = 'rgba(255,71,87,0.2)'; statusEl.style.color = '#ff4757';
  }
}
function scheduleNotifications() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const s = state.notifSettings, now = new Date();
  if (s.morning) {
    const [h, m] = (s.morningTime || '08:00').split(':');
    let t = new Date(); t.setHours(parseInt(h), parseInt(m), 0, 0);
    if (t <= now) t.setDate(t.getDate() + 1);
    setTimeout(() => { const today = todayStr(); const pending = state.tasks.filter(t => t.date === today && !t.completed).length; new Notification('🌅 Good Morning! TaskFlow', { body: `Aapke ${pending} tasks wait kar rahe hain! 💪` }); scheduleNotifications(); }, t - now);
  }
  if (s.evening) {
    const [h, m] = (s.eveningTime || '20:00').split(':');
    let t = new Date(); t.setHours(parseInt(h), parseInt(m), 0, 0);
    if (t <= now) t.setDate(t.getDate() + 1);
    setTimeout(() => { const today = todayStr(); const done = state.tasks.filter(t => t.date === today && t.completed).length; const total = state.tasks.filter(t => t.date === today).length; new Notification('🌙 Evening Review - TaskFlow', { body: `Aaj ${done}/${total} tasks complete kiye! 🌟` }); scheduleNotifications(); }, t - now);
  }
}
function scheduleTaskReminder(task) {
  if (!task.time || !task.date || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const [h, m] = task.time.split(':');
  const reminderTime = new Date(task.date); reminderTime.setHours(parseInt(h), parseInt(m), 0, 0);
  const diff = reminderTime - new Date();
  if (diff > 0) setTimeout(() => new Notification(`⏰ Task Reminder!`, { body: `"${task.title}" ka time ho gaya! 🚀` }), diff);
}

function openModal(id) { document.getElementById(id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('open'); document.body.style.overflow = ''; if (id === 'addTaskModal') state.editingTaskId = null; }
function closeModalOutside(event, id) { if (event.target === document.getElementById(id)) closeModal(id); }

function showConfirm(title, msg, onConfirm) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = msg;
  const btn = document.getElementById('confirmBtn');
  btn.onclick = () => { onConfirm(); closeModal('confirmModal'); };
  openModal('confirmModal');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg; toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function showCelebration() {
  const el = document.getElementById('celebration');
  el.style.display = 'flex';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
  el.onclick = () => { el.style.display = 'none'; };
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
