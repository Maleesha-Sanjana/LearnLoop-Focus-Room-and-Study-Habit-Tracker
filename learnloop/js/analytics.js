// =============================================
// analytics.js – Charts & Insights
// =============================================

let currentUser = null;
let dailyChart = null;
let subjectChart = null;
let trendChart = null;

Chart.defaults.color = "#888888";
Chart.defaults.borderColor = "#e8e8e8";

(async () => {
  currentUser = await requireAuth();
  await loadAnalytics();
})();

async function loadAnalytics() {
  const days = parseInt(document.getElementById("range-select").value);
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0,0,0,0);
  const sinceISO = since.toISOString();

  const snap = await db.collection("sessions")
    .where("userId","==",currentUser.uid)
    .where("startTime",">=", sinceISO)
    .orderBy("startTime","asc")
    .get();

  const sessions = [];
  snap.forEach(d => sessions.push({ ...d.data(), _startDate: new Date(d.data().startTime || 0) }));

  // ── Summary Stats ──
  const totalMins = sessions.reduce((s, d) => s + (d.duration || 0), 0);
  const activeDays = new Set(sessions.map(s => s.startTime?.toDate().toDateString())).size;
  const avgMins = activeDays > 0 ? Math.round(totalMins / activeDays) : 0;

  document.getElementById("a-total").textContent = formatDuration(totalMins);
  document.getElementById("a-avg").textContent = formatDuration(avgMins);
  document.getElementById("a-sessions").textContent = sessions.length;

  // Streak
  const userDoc = await db.collection("users").doc(currentUser.uid).get();
  document.getElementById("a-streak").textContent = userDoc.data()?.streak || 0;

  // ── Daily Data ──
  const dailyMap = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
    dailyMap[d.toDateString()] = 0;
  }
  sessions.forEach(s => {
    const key = s._startDate.toDateString();
    if (key && dailyMap[key] !== undefined) dailyMap[key] += (s.duration || 0);
  });

  const dailyLabels = Object.keys(dailyMap).map(k => {
    const d = new Date(k);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
  const dailyValues = Object.values(dailyMap).map(m => Math.round((m / 60) * 10) / 10);

  // ── Subject Data ──
  const subjectMap = {};
  sessions.forEach(s => {
    const sub = s.subject || "General";
    subjectMap[sub] = (subjectMap[sub] || 0) + (s.duration || 0);
  });
  const subjectLabels = Object.keys(subjectMap);
  const subjectValues = Object.values(subjectMap).map(m => Math.round((m / 60) * 10) / 10);

  // ── Weekly Trend ──
  const weeklyMap = {};
  sessions.forEach(s => {
    const d = s._startDate;
    if (!d) return;
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    weekStart.setHours(0,0,0,0);
    const key = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    weeklyMap[key] = (weeklyMap[key] || 0) + (s.duration || 0);
  });
  const weekLabels = Object.keys(weeklyMap);
  const weekValues = Object.values(weeklyMap).map(m => Math.round((m / 60) * 10) / 10);

  // ── Render Charts ──
  renderDailyChart(dailyLabels, dailyValues);
  renderSubjectChart(subjectLabels, subjectValues);
  renderTrendChart(weekLabels, weekValues);
  renderInsights(sessions, subjectMap, dailyMap, totalMins, activeDays);
}

function renderDailyChart(labels, values) {
  if (dailyChart) dailyChart.destroy();
  const ctx = document.getElementById("chart-daily").getContext("2d");
  dailyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Hours",
        data: values,
        backgroundColor: "rgba(17,17,17,0.08)",
        borderColor: "#111111",
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "Hours" } },
        x: { ticks: { maxTicksLimit: 10 } }
      }
    }
  });
}

function renderSubjectChart(labels, values) {
  if (subjectChart) subjectChart.destroy();
  if (labels.length === 0) return;
  const ctx = document.getElementById("chart-subjects").getContext("2d");
  subjectChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map((_, i) => getSubjectColor(i)),
        borderColor: "#1a1a2e",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "right", labels: { boxWidth: 12, padding: 12 } }
      }
    }
  });
}

function renderTrendChart(labels, values) {
  if (trendChart) trendChart.destroy();
  if (labels.length === 0) return;
  const ctx = document.getElementById("chart-trend").getContext("2d");
  trendChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Hours per Week",
        data: values,
        borderColor: "#111111",
        backgroundColor: "rgba(17,17,17,0.05)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#111111",
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderInsights(sessions, subjectMap, dailyMap, totalMins, activeDays) {
  const el = document.getElementById("insights-list");
  const insights = [];

  // Best study day
  const dayTotals = {};
  sessions.forEach(s => {
    const d = s._startDate;
    if (!d) return;
    const day = d.toLocaleDateString("en-US", { weekday: "long" });
    dayTotals[day] = (dayTotals[day] || 0) + (s.duration || 0);
  });
  const bestDay = Object.entries(dayTotals).sort((a,b) => b[1]-a[1])[0];
  if (bestDay) insights.push({ icon: "📅", title: "Best Study Day", value: bestDay[0], color: "var(--primary)" });

  // Top subject
  const topSubject = Object.entries(subjectMap).sort((a,b) => b[1]-a[1])[0];
  if (topSubject) insights.push({ icon: "📚", title: "Most Studied", value: topSubject[0], color: "var(--accent)" });

  // Consistency
  const consistency = activeDays > 0 ? Math.round((activeDays / parseInt(document.getElementById("range-select").value)) * 100) : 0;
  insights.push({ icon: "🎯", title: "Consistency", value: `${consistency}%`, color: consistency >= 70 ? "var(--success)" : "var(--warning)" });

  // Average session length
  const avgSession = sessions.length > 0 ? Math.round(totalMins / sessions.length) : 0;
  insights.push({ icon: "⏱️", title: "Avg Session", value: formatDuration(avgSession), color: "var(--secondary)" });

  // Weak subject (least studied)
  const weakSubject = Object.entries(subjectMap).sort((a,b) => a[1]-b[1])[0];
  if (weakSubject && Object.keys(subjectMap).length > 1) {
    insights.push({ icon: "⚠️", title: "Needs Attention", value: weakSubject[0], color: "var(--warning)" });
  }

  // Study streak message
  const streak = parseInt(document.getElementById("a-streak").textContent);
  if (streak >= 7) insights.push({ icon: "🔥", title: "On Fire!", value: `${streak} day streak`, color: "var(--danger)" });

  el.innerHTML = insights.map(i => `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:16px;border-left:3px solid ${i.color};">
      <div style="font-size:1.5rem;margin-bottom:6px;">${i.icon}</div>
      <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:2px;">${i.title}</div>
      <div style="font-size:1.1rem;font-weight:700;color:${i.color};">${i.value}</div>
    </div>`).join("");
}
