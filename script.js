/**
 * STUDYPILOT AI — CORE SAAS APPLICATION CONTROLLER
 * Pure Vanilla JavaScript implementation with isolated localStorage state per user.
 */

// Global State Schema Versioning
const STORAGE_KEY_PREFIX = 'STUDYPILOT_DEMO_v1.0_';

// State Object Structure
let appState = {
    currentUser: null, // { id, name, email }
    theme: 'dark',
    profile: {
        dailyHours: 4,
        startTime: '09:00'
    },
    subjects: [],
    tasks: [],
    timetable: [],
    focusSessions: 0,
    focusLog: []
};

// Pomodoro Timer State
let timerInterval = null;
let timerSecondsLeft = 25 * 60;
let timerTotalSeconds = 25 * 60;
let timerMode = 'work'; // 'work', 'shortBreak', 'longBreak'
let isTimerRunning = false;
let lastTimerTimestamp = null;

// Calendar State
let currentCalDate = new Date();

// ==========================================================================
// 1. INITIALIZATION & RECOVERY
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initEventHandlers();
    checkExistingSession();
});

function getStorageKey(key) {
    const userId = appState.currentUser ? appState.currentUser.id : 'guest';
    return `${STORAGE_KEY_PREFIX}${userId}_${key}`;
}

function saveStateToStorage() {
    if (!appState.currentUser) return;
    try {
        const dataToSave = {
            profile: appState.profile,
            subjects: appState.subjects,
            tasks: appState.tasks,
            timetable: appState.timetable,
            focusSessions: appState.focusSessions,
            focusLog: appState.focusLog
        };
        localStorage.setItem(getStorageKey('state'), JSON.stringify(dataToSave));
    } catch (err) {
        showToast('Failed to save state to local storage', 'error');
    }
}

function loadStateFromStorage() {
    if (!appState.currentUser) return;
    try {
        const savedRaw = localStorage.getItem(getStorageKey('state'));
        if (savedRaw) {
            const parsed = JSON.parse(savedRaw);
            appState.profile = parsed.profile || { dailyHours: 4, startTime: '09:00' };
            appState.subjects = parsed.subjects || [];
            appState.tasks = parsed.tasks || [];
            appState.timetable = parsed.timetable || [];
            appState.focusSessions = parsed.focusSessions || 0;
            appState.focusLog = parsed.focusLog || [];
        } else {
            // Inject Starter Seed Data for smooth demo testing if fresh user
            seedStarterDemoData();
        }
    } catch (err) {
        showToast('Corrupted data cleared. Starting fresh.', 'warning');
        seedStarterDemoData();
    }
}

function seedStarterDemoData() {
    appState.subjects = [
        { id: 'subj-1', name: 'Calculus II', difficulty: 'Hard', progress: 45, examDate: getFutureDateStr(4) },
        { id: 'subj-2', name: 'Computer Architecture', difficulty: 'Medium', progress: 70, examDate: getFutureDateStr(12) },
        { id: 'subj-3', name: 'Physics I', difficulty: 'Easy', progress: 85, examDate: getFutureDateStr(20) }
    ];

    appState.tasks = [
        { id: 'task-1', title: 'Solve Ch 5 Derivatives', subjectId: 'subj-1', dueDate: getFutureDateStr(1), priority: 'High', duration: 60, completed: false },
        { id: 'task-2', title: 'Read Memory Hierarchy Unit', subjectId: 'subj-2', dueDate: getFutureDateStr(3), priority: 'Medium', duration: 45, completed: false },
        { id: 'task-3', title: 'Review Kinematics Notes', subjectId: 'subj-3', dueDate: getFutureDateStr(5), priority: 'Low', duration: 30, completed: true }
    ];

    generateAlgorithmicTimetable();
    saveStateToStorage();
}

function getFutureDateStr(daysAhead) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
}

// ==========================================================================
// 2. THEME ENGINE & UI NAVIGATION
// ==========================================================================
function initTheme() {
    const savedTheme = localStorage.getItem(`${STORAGE_KEY_PREFIX}global_theme`) || 'dark';
    setTheme(savedTheme);
}

function setTheme(theme) {
    appState.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}global_theme`, theme);
}

function toggleTheme() {
    const newTheme = appState.theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function switchMainView(viewName) {
    const landing = document.getElementById('view-landing');
    const app = document.getElementById('view-app');

    if (viewName === 'app') {
        landing.classList.add('hidden');
        app.classList.remove('hidden');
        renderDashboardUI();
    } else {
        app.classList.add('hidden');
        landing.classList.remove('hidden');
    }
}

function switchAppPage(pageId) {
    document.querySelectorAll('.app-page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

    const targetPage = document.getElementById(pageId);
    const targetNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);

    if (targetPage) targetPage.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    // Trigger page-specific re-renders
    if (pageId === 'page-overview') renderOverviewPage();
    if (pageId === 'page-subjects') renderSubjectsPage();
    if (pageId === 'page-tasks') renderTasksPage();
    if (pageId === 'page-calendar') renderCalendarPage();
    if (pageId === 'page-analytics') renderAnalyticsPage();
    if (pageId === 'page-settings') renderSettingsPage();
    if (pageId === 'page-plan') renderPlanPage();

    // Close mobile sidebar if open
    closeMobileSidebar();
}

// ==========================================================================
// 3. AUTHENTICATION (DEMO LOCAL STORAGE ISOLATION)
// ==========================================================================
function checkExistingSession() {
    const sessionUser = localStorage.getItem(`${STORAGE_KEY_PREFIX}current_session`);
    if (sessionUser) {
        try {
            appState.currentUser = JSON.parse(sessionUser);
            loadStateFromStorage();
            switchMainView('app');
        } catch (e) {
            logoutUser();
        }
    } else {
        switchMainView('landing');
    }
}

function handleLogin(email, password) {
    // Clear potential old error text
    document.getElementById('err-login-email').textContent = '';
    document.getElementById('err-login-password').textContent = '';

    const users = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}users_db`) || '[]');
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!found) {
        document.getElementById('err-login-email').textContent = 'Account not found.';
        return;
    }

    // Simple client-side string match for local demo UI purposes
    if (found.password !== password) {
        document.getElementById('err-login-password').textContent = 'Incorrect password.';
        return;
    }

    completeLoginSession(found);
}

function handleSignup(name, email, password) {
    const users = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}users_db`) || '[]');
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        document.getElementById('err-signup-email').textContent = 'Email already registered.';
        return;
    }

    const newUser = {
        id: 'user_' + Date.now(),
        name: name,
        email: email,
        password: password // Client demo mode only
    };

    users.push(newUser);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}users_db`, JSON.stringify(users));

    completeLoginSession(newUser);
}

function completeLoginSession(userObj) {
    appState.currentUser = { id: userObj.id, name: userObj.name, email: userObj.email };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}current_session`, JSON.stringify(appState.currentUser));

    closeAuthModal();
    loadStateFromStorage();
    switchMainView('app');
    showToast(`Welcome back, ${appState.currentUser.name}!`, 'success');
}

function logoutUser() {
    appState.currentUser = null;
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}current_session`);
    switchMainView('landing');
    showToast('Signed out successfully.', 'info');
}

function loginAsDemoUser() {
    const demoUser = { id: 'demo_user_01', name: 'Alex Mercer (Demo)', email: 'demo@studypilot.ai' };
    completeLoginSession(demoUser);
}

// ==========================================================================
// 4. SMART ALGORITHMIC PLAN GENERATOR (RULE-BASED ENGINE)
// ==========================================================================
function generateAlgorithmicTimetable() {
    if (appState.subjects.length === 0) {
        appState.timetable = [];
        return;
    }

    const dailyHours = parseFloat(appState.profile.dailyHours) || 4;
    const startTimeStr = appState.profile.startTime || '09:00';

    // 1. Compute Subject Urgency Priority Scores
    const today = new Date();
    const scoredSubjects = appState.subjects.map(subj => {
        let diffWeight = subj.difficulty === 'Hard' ? 3 : (subj.difficulty === 'Medium' ? 2 : 1);
        let gapWeight = (100 - (subj.progress || 0)) / 100;

        let daysUntilExam = 30;
        if (subj.examDate) {
            const diffTime = new Date(subj.examDate) - today;
            daysUntilExam = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        }

        let urgencyScore = (diffWeight * 2) + (gapWeight * 3) + (20 / daysUntilExam);
        return { ...subj, urgencyScore };
    });

    // Sort by calculated urgency
    scoredSubjects.sort((a, b) => b.urgencyScore - a.urgencyScore);

    // 2. Schedule Blocks
    let totalMinutesAvailable = Math.floor(dailyHours * 60);
    let currentMinutes = parseTimeToMinutes(startTimeStr);
    const timetable = [];

    let subjIndex = 0;
    while (totalMinutesAvailable >= 30) {
        const activeSubj = scoredSubjects[subjIndex % scoredSubjects.length];

        // Block size: 45 min study session
        let sessionDuration = Math.min(45, totalMinutesAvailable);
        let startTimeFormatted = formatMinutesToTime(currentMinutes);
        currentMinutes += sessionDuration;
        let endTimeFormatted = formatMinutesToTime(currentMinutes);

        timetable.push({
            id: 'tb_' + Math.random().toString(36).substr(2, 9),
            timeBlock: `${startTimeFormatted} - ${endTimeFormatted}`,
            subjectName: activeSubj.name,
            activity: activeSubj.progress < 50 ? 'Core Learning & Concepts' : 'Practice & Revision',
            durationMinutes: sessionDuration,
            priority: activeSubj.difficulty
        });

        totalMinutesAvailable -= sessionDuration;

        // Add 15 min rest break if time allows
        if (totalMinutesAvailable >= 15) {
            let breakStart = formatMinutesToTime(currentMinutes);
            currentMinutes += 15;
            let breakEnd = formatMinutesToTime(currentMinutes);

            timetable.push({
                id: 'tb_break_' + Math.random().toString(36).substr(2, 9),
                timeBlock: `${breakStart} - ${breakEnd}`,
                subjectName: '☕ Rest & Hydration',
                activity: 'Brain Break / Recovery',
                durationMinutes: 15,
                priority: 'Low'
            });

            totalMinutesAvailable -= 15;
        }

        subjIndex++;
    }

    appState.timetable = timetable;
    saveStateToStorage();
}

function parseTimeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function formatMinutesToTime(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayM = m < 10 ? '0' + m : m;
    return `${displayH}:${displayM} ${period}`;
}

// ==========================================================================
// 5. RENDER FUNCTIONS & UI UPDATES
// ==========================================================================
function renderDashboardUI() {
    // Set User Details Topbar
    document.getElementById('user-welcome-heading').textContent = `Welcome back, ${appState.currentUser.name}`;
    document.getElementById('topbar-date-display').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

    // Avatar initials
    const initials = appState.currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('user-avatar-badge').textContent = initials || 'US';

    renderOverviewPage();
}

function renderOverviewPage() {
    // Stat 1: Subjects Count
    document.getElementById('stat-subjects-count').textContent = appState.subjects.length;

    // Stat 2: Tasks Completed
    const completedTasks = appState.tasks.filter(t => t.completed).length;
    const totalTasks = appState.tasks.length;
    const taskPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    document.getElementById('stat-tasks-completed').textContent = `${completedTasks} / ${totalTasks}`;
    document.getElementById('stat-tasks-pct').textContent = `${taskPct}% completed`;

    // Stat 3: Focus Hours
    const focusHrs = (appState.focusSessions * 25 / 60).toFixed(1);
    document.getElementById('stat-focus-hours').textContent = `${focusHrs} hrs`;
    document.getElementById('stat-focus-count').textContent = `${appState.focusSessions} sessions total`;

    // Stat 4: Upcoming Exam
    const upcomingExams = appState.subjects
        .filter(s => s.examDate)
        .sort((a, b) => new Date(a.examDate) - new Date(b.examDate));

    if (upcomingExams.length > 0) {
        const nextExam = upcomingExams[0];
        const daysLeft = Math.ceil((new Date(nextExam.examDate) - new Date()) / (1000 * 60 * 60 * 24));
        document.getElementById('stat-next-exam').textContent = daysLeft <= 0 ? 'Today!' : `${daysLeft} Days`;
        document.getElementById('stat-next-exam-sub').textContent = `${nextExam.name}`;
    } else {
        document.getElementById('stat-next-exam').textContent = 'None';
        document.getElementById('stat-next-exam-sub').textContent = 'No exams scheduled';
    }

    // Render Overview Schedule List
    const schedContainer = document.getElementById('overview-schedule-list');
    if (appState.timetable.length === 0) {
        schedContainer.innerHTML = `<p class="empty-state">No schedule generated yet. Visit Study Plan Engine to generate.</p>`;
    } else {
        schedContainer.innerHTML = appState.timetable.slice(0, 4).map(item => `
      <div class="schedule-item">
        <span class="schedule-time">${item.timeBlock}</span>
        <div class="schedule-details">
          <strong>${escapeHTML(item.subjectName)}</strong>
          <span>${escapeHTML(item.activity)}</span>
        </div>
        <span class="badge badge-${item.priority.toLowerCase()}">${item.durationMinutes}m</span>
      </div>
    `).join('');
    }

    // Render Alerts
    const alertsContainer = document.getElementById('overview-alerts-list');
    if (upcomingExams.length === 0) {
        alertsContainer.innerHTML = `<p class="empty-state">No upcoming exams registered.</p>`;
    } else {
        alertsContainer.innerHTML = upcomingExams.map(ex => `
      <div class="schedule-item">
        <div class="schedule-details">
          <strong>📅 ${escapeHTML(ex.name)} Exam</strong>
          <span>Date: ${ex.examDate}</span>
        </div>
        <span class="badge badge-hard">Exam</span>
      </div>
    `).join('');
    }

    // Render Subject Progress
    const subjProgressContainer = document.getElementById('overview-subject-progress');
    if (appState.subjects.length === 0) {
        subjProgressContainer.innerHTML = `<p class="empty-state">No subjects added.</p>`;
    } else {
        subjProgressContainer.innerHTML = appState.subjects.map(s => `
      <div>
        <div class="flex-between text-sm mb-1">
          <strong>${escapeHTML(s.name)}</strong>
          <span>${s.progress}%</span>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width: ${s.progress}%"></div>
        </div>
      </div>
    `).join('');
    }

    // Render Bar Chart
    renderWeeklyBarChart();
}

function renderWeeklyBarChart() {
    const chartContainer = document.getElementById('weekly-bar-chart');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Dummy activity height values derived from focus log
    const mockHeights = [40, 65, 30, 85, 50, 90, 70];

    chartContainer.innerHTML = days.map((day, idx) => `
    <div class="chart-col">
      <div class="chart-bar-container">
        <div class="chart-bar-fill" style="height: ${mockHeights[idx]}%;"></div>
      </div>
      <span class="chart-label">${day}</span>
    </div>
  `).join('');
}

function renderPlanPage() {
    document.getElementById('cfg-daily-hours').value = appState.profile.dailyHours || 4;
    document.getElementById('cfg-start-time').value = appState.profile.startTime || '09:00';

    const tbody = document.getElementById('timetable-tbody');
    if (appState.timetable.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No timetable active. Click "Generate Optimized Schedule" to build.</td></tr>`;
        return;
    }

    tbody.innerHTML = appState.timetable.map(t => `
    <tr>
      <td><strong>${t.timeBlock}</strong></td>
      <td>${escapeHTML(t.subjectName)}</td>
      <td>${escapeHTML(t.activity)}</td>
      <td>${t.durationMinutes} mins</td>
      <td><span class="badge badge-${t.priority.toLowerCase()}">${t.priority}</span></td>
    </tr>
  `).join('');
}

function renderSubjectsPage() {
    const container = document.getElementById('subjects-cards-container');
    if (appState.subjects.length === 0) {
        container.innerHTML = `<div class="card grid-col-2 empty-state"><p>No subjects added yet. Click "+ Add New Subject" to begin.</p></div>`;
        return;
    }

    container.innerHTML = appState.subjects.map(subj => `
    <div class="card subject-card">
      <div class="subject-card-actions">
        <button class="btn-icon" onclick="openEditSubjectModal('${subj.id}')" title="Edit">✏️</button>
        <button class="btn-icon" onclick="confirmDeleteSubject('${subj.id}')" title="Delete">🗑️</button>
      </div>
      <div>
        <span class="badge badge-${subj.difficulty.toLowerCase()}">${subj.difficulty} Difficulty</span>
        <h3 class="mt-2">${escapeHTML(subj.name)}</h3>
        <p class="sub-text mt-1">Exam Date: ${subj.examDate || 'Not set'}</p>
      </div>
      <div class="mt-4">
        <div class="flex-between text-sm mb-1">
          <span>Syllabus Covered</span>
          <strong>${subj.progress}%</strong>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width: ${subj.progress}%"></div>
        </div>
      </div>
    </div>
  `).join('');

    updateSubjectDropdowns();
}

function renderTasksPage() {
    const container = document.getElementById('task-list-container');
    const searchVal = document.getElementById('task-search-input').value.toLowerCase();
    const filterSubj = document.getElementById('task-filter-subject').value;
    const filterPrio = document.getElementById('task-filter-priority').value;
    const filterStatus = document.getElementById('task-filter-status').value;

    let filtered = appState.tasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchVal);
        const matchesSubj = filterSubj === 'ALL' || task.subjectId === filterSubj;
        const matchesPrio = filterPrio === 'ALL' || task.priority === filterPrio;
        const matchesStatus = filterStatus === 'ALL' ||
            (filterStatus === 'COMPLETED' && task.completed) ||
            (filterStatus === 'PENDING' && !task.completed);

        return matchesSearch && matchesSubj && matchesPrio && matchesStatus;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="card empty-state"><p>No tasks match the selected filters.</p></div>`;
        return;
    }

    container.innerHTML = filtered.map(task => {
        const subj = appState.subjects.find(s => s.id === task.subjectId);
        const subjName = subj ? subj.name : 'General';

        return `
      <div class="task-item ${task.completed ? 'completed' : ''}">
        <div class="task-left">
          <input type="checkbox" class="checkbox-custom" ${task.completed ? 'checked' : ''} onchange="toggleTaskStatus('${task.id}')" />
          <div>
            <strong class="task-title">${escapeHTML(task.title)}</strong>
            <div class="task-meta">
              <span>📚 ${escapeHTML(subjName)}</span>
              <span>📅 ${task.dueDate}</span>
              <span>⏱️ ${task.duration}m</span>
            </div>
          </div>
        </div>
        <div class="task-right">
          <span class="badge badge-${task.priority.toLowerCase()}">${task.priority}</span>
          <button class="btn-icon ml-2" onclick="openEditTaskModal('${task.id}')">✏️</button>
          <button class="btn-icon" onclick="confirmDeleteTask('${task.id}')">🗑️</button>
        </div>
      </div>
    `;
    }).join('');
}

function updateSubjectDropdowns() {
    const filterSelect = document.getElementById('task-filter-subject');
    const modalSelect = document.getElementById('task-subject-select');

    const optionsHTML = appState.subjects.map(s => `<option value="${s.id}">${escapeHTML(s.name)}</option>`).join('');

    filterSelect.innerHTML = `<option value="ALL">All Subjects</option>` + optionsHTML;
    modalSelect.innerHTML = optionsHTML || `<option value="">No Subjects Available</option>`;
}

function renderCalendarPage() {
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('cal-month-year-label').textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const grid = document.getElementById('calendar-days-grid');
    grid.innerHTML = '';

    // Previous month padding
    for (let i = 0; i < firstDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'cal-day-cell other-month';
        grid.appendChild(cell);
    }

    // Days of month
    const todayStr = new Date().toISOString().split('T')[0];

    for (let day = 1; day <= daysInMonth; day++) {
        const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const cell = document.createElement('div');
        cell.className = 'cal-day-cell';
        if (cellDateStr === todayStr) cell.classList.add('today');

        // Check for events
        const hasExam = appState.subjects.some(s => s.examDate === cellDateStr);
        const hasTask = appState.tasks.some(t => t.dueDate === cellDateStr);

        cell.innerHTML = `
      <span class="cal-day-num">${day}</span>
      <div class="cal-day-dots">
        ${hasExam ? '<span class="cal-dot exam" title="Exam Date"></span>' : ''}
        ${hasTask ? '<span class="cal-dot" title="Task Due"></span>' : ''}
      </div>
    `;

        cell.addEventListener('click', () => {
            document.querySelectorAll('.cal-day-cell').forEach(c => c.classList.remove('selected'));
            cell.classList.add('selected');
            renderCalendarDayDetails(cellDateStr);
        });

        grid.appendChild(cell);
    }
}

function renderCalendarDayDetails(dateStr) {
    const title = document.getElementById('cal-selected-date-title');
    const list = document.getElementById('cal-selected-events-list');

    title.textContent = `Events for ${dateStr}`;

    const exams = appState.subjects.filter(s => s.examDate === dateStr);
    const tasks = appState.tasks.filter(t => t.dueDate === dateStr);

    if (exams.length === 0 && tasks.length === 0) {
        list.innerHTML = `<p class="empty-text">No exams or tasks due on this date.</p>`;
        return;
    }

    let html = '';
    exams.forEach(e => {
        html += `<div class="schedule-item"><div class="schedule-details"><strong>🚨 ${escapeHTML(e.name)} Exam</strong></div><span class="badge badge-hard">Exam</span></div>`;
    });
    tasks.forEach(t => {
        html += `<div class="schedule-item"><div class="schedule-details"><strong>📌 ${escapeHTML(t.title)}</strong></div><span class="badge badge-medium">${t.priority}</span></div>`;
    });

    list.innerHTML = html;
}

function renderAnalyticsPage() {
    const completedTasks = appState.tasks.filter(t => t.completed).length;
    const totalTasks = appState.tasks.length;
    const taskPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    document.getElementById('analytics-task-ratio').textContent = `${completedTasks}/${totalTasks}`;
    document.getElementById('analytics-task-bar').style.width = `${taskPct}%`;
    document.getElementById('analytics-task-text').textContent = `${taskPct}% total tasks completed`;

    // Render Motivational Card based on real metrics
    const quoteTitle = document.getElementById('analytics-quote-title');
    const quoteBody = document.getElementById('analytics-quote-body');

    if (taskPct >= 80) {
        quoteTitle.textContent = "🔥 Outstanding Velocity!";
        quoteBody.textContent = "You've completed over 80% of your scheduled tasks. Peak academic performance!";
    } else if (taskPct >= 50) {
        quoteTitle.textContent = "⚡ Steady Momentum!";
        quoteBody.textContent = "You're past the halfway milestone. Keep completing your high-priority items.";
    } else {
        quoteTitle.textContent = "🎯 Time to Accelerate!";
        quoteBody.textContent = "Focus on completing a few quick wins today to build your study streak.";
    }

    // Render Subject Mastery Breakdown
    const barsContainer = document.getElementById('analytics-subject-bars');
    if (appState.subjects.length === 0) {
        barsContainer.innerHTML = `<p class="empty-state">No subjects available.</p>`;
        return;
    }

    barsContainer.innerHTML = appState.subjects.map(s => `
    <div>
      <div class="flex-between text-sm mb-1">
        <strong>${escapeHTML(s.name)}</strong>
        <span>${s.progress}%</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" style="width: ${s.progress}%;"></div>
      </div>
    </div>
  `).join('');
}

function renderSettingsPage() {
    document.getElementById('sett-display-name').value = appState.currentUser ? appState.currentUser.name : '';
    document.getElementById('sett-daily-hours').value = appState.profile.dailyHours || 4;
    document.getElementById('sett-start-time').value = appState.profile.startTime || '09:00';
}

// ==========================================================================
// 6. POMODORO TIMER CONTROLLER (TIMESTAMP-ACCURATE)
// ==========================================================================
function setTimerMode(mode) {
    timerMode = mode;
    document.querySelectorAll('.timer-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    if (mode === 'work') timerTotalSeconds = 25 * 60;
    if (mode === 'shortBreak') timerTotalSeconds = 5 * 60;
    if (mode === 'longBreak') timerTotalSeconds = 15 * 60;

    resetTimer();
}

function startTimer() {
    if (isTimerRunning) return;
    isTimerRunning = true;
    lastTimerTimestamp = Date.now();

    document.getElementById('timer-btn-start').classList.add('hidden');
    document.getElementById('timer-btn-pause').classList.remove('hidden');
    document.getElementById('timer-status-label').textContent = timerMode === 'work' ? 'Focusing...' : 'Taking a Break';

    timerInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - lastTimerTimestamp) / 1000);
        lastTimerTimestamp = now;

        timerSecondsLeft = Math.max(0, timerSecondsLeft - elapsed);
        updateTimerDisplay();

        if (timerSecondsLeft <= 0) {
            completeTimerSession();
        }
    }, 1000);
}

function pauseTimer() {
    isTimerRunning = false;
    clearInterval(timerInterval);
    document.getElementById('timer-btn-start').classList.remove('hidden');
    document.getElementById('timer-btn-pause').classList.add('hidden');
    document.getElementById('timer-status-label').textContent = 'Paused';
}

function resetTimer() {
    pauseTimer();
    timerSecondsLeft = timerTotalSeconds;
    document.getElementById('timer-status-label').textContent = 'Ready';
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const m = Math.floor(timerSecondsLeft / 60);
    const s = timerSecondsLeft % 60;
    document.getElementById('timer-display-clock').textContent =
        `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function completeTimerSession() {
    pauseTimer();
    if (timerMode === 'work') {
        appState.focusSessions++;
        appState.focusLog.push({ date: new Date().toISOString() });
        saveStateToStorage();
        document.getElementById('timer-today-count').textContent = appState.focusSessions;
        showToast('🎉 Focus session completed! Great work.', 'success');
    } else {
        showToast('Break over! Ready to return to focus?', 'info');
    }
}

// ==========================================================================
// 7. EVENT HANDLERS & MODAL MANAGEMENT
// ==========================================================================
function initEventHandlers() {
    // Navigation Event Listeners
    document.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const pageId = e.currentTarget.dataset.page;
            switchAppPage(pageId);
        });
    });

    // Mobile Sidebar Toggle
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    document.getElementById('sidebar-toggle-btn')?.addEventListener('click', () => {
        sidebar.classList.add('open');
        overlay.classList.add('open');
    });

    const closeSidebar = () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
    };

    document.getElementById('sidebar-close-btn')?.addEventListener('click', closeSidebar);
    overlay?.addEventListener('click', closeSidebar);

    // Theme Toggles
    document.getElementById('btn-theme-toggle-landing')?.addEventListener('click', toggleTheme);
    document.getElementById('btn-theme-toggle-app')?.addEventListener('click', toggleTheme);

    // Auth Modals & Triggers
    const authModal = document.getElementById('auth-modal');
    const loginForm = document.getElementById('form-login');
    const signupForm = document.getElementById('form-signup');

    document.getElementById('nav-btn-login')?.addEventListener('click', () => {
        authModal.classList.remove('hidden');
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    });

    document.getElementById('nav-btn-signup')?.addEventListener('click', () => {
        authModal.classList.remove('hidden');
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    });

    document.getElementById('hero-btn-signup')?.addEventListener('click', () => {
        authModal.classList.remove('hidden');
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    });

    document.getElementById('hero-btn-demo')?.addEventListener('click', loginAsDemoUser);
    document.getElementById('btn-quick-demo')?.addEventListener('click', loginAsDemoUser);

    document.getElementById('auth-close-btn')?.addEventListener('click', closeAuthModal);

    document.getElementById('link-to-signup')?.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
    });

    document.getElementById('link-to-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        signupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });

    // Password Visibility Toggles
    document.querySelectorAll('.toggle-pwd-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.target);
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = 'Hide';
            } else {
                input.type = 'password';
                btn.textContent = 'Show';
            }
        });
    });

    // Submit Auth Forms
    loginForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLogin(document.getElementById('login-email').value, document.getElementById('login-password').value);
    });

    signupForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSignup(
            document.getElementById('signup-name').value,
            document.getElementById('signup-email').value,
            document.getElementById('signup-password').value
        );
    });

    document.getElementById('btn-logout')?.addEventListener('click', logoutUser);

    // Subject Modal Actions
    document.getElementById('btn-open-subject-modal')?.addEventListener('click', () => {
        document.getElementById('form-subject').reset();
        document.getElementById('subj-id').value = '';
        document.getElementById('modal-subject-title').textContent = 'Add New Subject';
        openModal('modal-subject');
    });

    document.getElementById('form-subject')?.addEventListener('submit', handleSaveSubject);

    // Task Modal Actions
    document.getElementById('btn-open-task-modal')?.addEventListener('click', () => {
        document.getElementById('form-task').reset();
        document.getElementById('task-id').value = '';
        document.getElementById('modal-task-title').textContent = 'Create New Task';
        openModal('modal-task');
    });

    document.getElementById('form-task')?.addEventListener('submit', handleSaveTask);

    // Task Filters Event Handlers
    ['task-search-input', 'task-filter-subject', 'task-filter-priority', 'task-filter-status'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', renderTasksPage);
    });

    // Generic Modal Close Triggers
    document.querySelectorAll('.modal-close-trigger').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal('modal-subject');
            closeModal('modal-task');
        });
    });

    // Timetable Generator Config Form
    document.getElementById('form-plan-config')?.addEventListener('submit', (e) => {
        e.preventDefault();
        appState.profile.dailyHours = document.getElementById('cfg-daily-hours').value;
        appState.profile.startTime = document.getElementById('cfg-start-time').value;
        generateAlgorithmicTimetable();
        renderPlanPage();
        showToast('New study timetable generated successfully!', 'success');
    });

    // Pomodoro Controls
    document.querySelectorAll('.timer-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => setTimerMode(btn.dataset.mode));
    });

    document.getElementById('timer-btn-start')?.addEventListener('click', startTimer);
    document.getElementById('timer-btn-pause')?.addEventListener('click', pauseTimer);
    document.getElementById('timer-btn-reset')?.addEventListener('click', resetTimer);

    // Calendar Controls
    document.getElementById('cal-prev-month')?.addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() - 1);
        renderCalendarPage();
    });
    document.getElementById('cal-next-month')?.addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() + 1);
        renderCalendarPage();
    });

    // Settings & Data Management
    document.getElementById('form-settings-profile')?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (appState.currentUser) {
            appState.currentUser.name = document.getElementById('sett-display-name').value;
        }
        appState.profile.dailyHours = document.getElementById('sett-daily-hours').value;
        appState.profile.startTime = document.getElementById('sett-start-time').value;
        saveStateToStorage();
        renderDashboardUI();
        showToast('Profile settings saved!', 'success');
    });

    document.getElementById('btn-export-data')?.addEventListener('click', exportUserDataJSON);
    document.getElementById('input-import-file')?.addEventListener('change', importUserDataJSON);
    document.getElementById('btn-reset-data')?.addEventListener('click', () => {
        showConfirmModal(
            'Reset All Data',
            'Are you sure you want to reset all subjects, tasks, and plans? This cannot be undone.',
            () => {
                seedStarterDemoData();
                renderDashboardUI();
                showToast('All local data reset to default demo state.', 'info');
            }
        );
    });
}

function closeMobileSidebar() {
    document.getElementById('app-sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('open');
}

function closeAuthModal() {
    document.getElementById('auth-modal')?.classList.add('hidden');
}

function openModal(id) {
    document.getElementById(id)?.classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id)?.classList.add('hidden');
}

// ==========================================================================
// 8. SUBJECT & TASK MUTATIONS
// ==========================================================================
function handleSaveSubject(e) {
    e.preventDefault();
    const id = document.getElementById('subj-id').value;
    const name = document.getElementById('subj-name').value.trim();
    const difficulty = document.getElementById('subj-difficulty').value;
    const progress = parseInt(document.getElementById('subj-progress').value, 10);
    const examDate = document.getElementById('subj-exam-date').value;

    if (id) {
        // Edit existing
        const index = appState.subjects.findIndex(s => s.id === id);
        if (index !== -1) {
            appState.subjects[index] = { id, name, difficulty, progress, examDate };
        }
    } else {
        // Check duplicate name
        if (appState.subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) {
            showToast('A subject with this name already exists.', 'warning');
            return;
        }
        appState.subjects.push({
            id: 'subj_' + Date.now(),
            name,
            difficulty,
            progress,
            examDate
        });
    }

    saveStateToStorage();
    closeModal('modal-subject');
    renderSubjectsPage();
    showToast('Subject saved successfully!', 'success');
}

function openEditSubjectModal(id) {
    const subj = appState.subjects.find(s => s.id === id);
    if (!subj) return;

    document.getElementById('subj-id').value = subj.id;
    document.getElementById('subj-name').value = subj.name;
    document.getElementById('subj-difficulty').value = subj.difficulty;
    document.getElementById('subj-progress').value = subj.progress;
    document.getElementById('subj-exam-date').value = subj.examDate;

    document.getElementById('modal-subject-title').textContent = 'Edit Subject';
    openModal('modal-subject');
}

function confirmDeleteSubject(id) {
    showConfirmModal('Delete Subject', 'Deleting this subject will also detach associated tasks.', () => {
        appState.subjects = appState.subjects.filter(s => s.id !== id);
        saveStateToStorage();
        renderSubjectsPage();
        showToast('Subject deleted.', 'info');
    });
}

function handleSaveTask(e) {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const title = document.getElementById('task-title').value.trim();
    const subjectId = document.getElementById('task-subject-select').value;
    const dueDate = document.getElementById('task-due-date').value;
    const priority = document.getElementById('task-priority').value;
    const duration = parseInt(document.getElementById('task-duration').value, 10);

    if (id) {
        const idx = appState.tasks.findIndex(t => t.id === id);
        if (idx !== -1) {
            appState.tasks[idx] = { ...appState.tasks[idx], title, subjectId, dueDate, priority, duration };
        }
    } else {
        appState.tasks.push({
            id: 'task_' + Date.now(),
            title,
            subjectId,
            dueDate,
            priority,
            duration,
            completed: false
        });
    }

    saveStateToStorage();
    closeModal('modal-task');
    renderTasksPage();
    showToast('Task saved!', 'success');
}

function openEditTaskModal(id) {
    const task = appState.tasks.find(t => t.id === id);
    if (!task) return;

    document.getElementById('task-id').value = task.id;
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-subject-select').value = task.subjectId;
    document.getElementById('task-due-date').value = task.dueDate;
    document.getElementById('task-priority').value = task.priority;
    document.getElementById('task-duration').value = task.duration;

    document.getElementById('modal-task-title').textContent = 'Edit Task';
    openModal('modal-task');
}

function toggleTaskStatus(id) {
    const task = appState.tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveStateToStorage();
        renderTasksPage();
    }
}

function confirmDeleteTask(id) {
    showConfirmModal('Delete Task', 'Are you sure you want to delete this task?', () => {
        appState.tasks = appState.tasks.filter(t => t.id !== id);
        saveStateToStorage();
        renderTasksPage();
        showToast('Task deleted.', 'info');
    });
}

// ==========================================================================
// 9. DATA IMPORT / EXPORT & HELPERS
// ==========================================================================
function exportUserDataJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `StudyPilot_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Data exported successfully!', 'success');
}

function importUserDataJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
        try {
            const imported = JSON.parse(evt.target.result);
            if (imported && imported.subjects && imported.tasks) {
                appState.subjects = imported.subjects || [];
                appState.tasks = imported.tasks || [];
                appState.timetable = imported.timetable || [];
                appState.profile = imported.profile || appState.profile;
                saveStateToStorage();
                renderDashboardUI();
                showToast('Data backup imported successfully!', 'success');
            } else {
                throw new Error('Invalid schema');
            }
        } catch (err) {
            showToast('Failed to import JSON: Invalid format.', 'error');
        }
    };
    reader.readAsText(file);
}

// Toast System
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3500);
}

// Confirmation Modal Helper
function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent = message;

    modal.classList.remove('hidden');

    const btnOk = document.getElementById('confirm-btn-ok');
    const btnCancel = document.getElementById('confirm-btn-cancel');

    const cleanup = () => {
        modal.classList.add('hidden');
        btnOk.removeEventListener('click', confirmHandler);
        btnCancel.removeEventListener('click', cancelHandler);
    };

    const confirmHandler = () => {
        cleanup();
        onConfirm();
    };

    const cancelHandler = () => {
        cleanup();
    };

    btnOk.addEventListener('click', confirmHandler);
    btnCancel.addEventListener('click', cancelHandler);
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}