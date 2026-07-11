import {
  getIndividualLeaderboard,
  getTeamLeaderboard,
  getPlatformStats,
  loadTestimonials
} from './firebase.js';

function initial(name) {
  return (name || 'U').charAt(0).toUpperCase();
}

function avatarColor(name) {
  const colors = ['#111', '#333', '#555', '#666', '#444', '#222', '#888'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export async function loadPlatformStats() {
  try {
    const stats = await getPlatformStats();
    const spans = document.querySelectorAll('.stats-big span');
    if (spans[0]) spans[0].dataset.target = stats.studentCount ?? 0;
    if (spans[1]) spans[1].dataset.target = stats.sessionCount ?? 0;
    if (spans[2]) spans[2].dataset.target = stats.goalsCompletedCount ?? 0;
    if (spans[0]) spans[0].textContent = `${(stats.studentCount ?? 0).toLocaleString()} students`;
    if (spans[1]) spans[1].textContent = `${(stats.sessionCount ?? 0).toLocaleString()} study sessions`;
    if (spans[2]) spans[2].textContent = `${(stats.goalsCompletedCount ?? 0).toLocaleString()} goals completed`;
    window.__llStatsLoaded = true;
    window.dispatchEvent(new Event('ll-stats-loaded'));
  } catch (err) {
    console.warn('Could not load platform stats', err);
  }
}

function renderPodium(container, entries, isTeam) {
  if (!entries.length) {
    container.innerHTML = '<p class="lb-empty">No leaderboard data yet. Complete a focus room quiz to appear here.</p>';
    return;
  }

  const ranks = ['second', 'first', 'third'];
  const order = [1, 0, 2];
  const labels = ['2nd', '1st', '3rd'];

  container.innerHTML = order.map((idx, i) => {
    const e = entries[idx];
    if (!e) return '';
    const meta = isTeam
      ? `${e.members} members · ${e.sessions} sessions`
      : `${e.quizzes} quizzes · ${e.avg}% avg`;
    return `
      <div class="lb-podium-card ${ranks[i]}">
        ${i === 1 ? '<div class="lb-crown">&#127942;</div>' : ''}
        <div class="lb-rank">${labels[i]}</div>
        <div class="lb-avatar" style="background:${avatarColor(e.name)}">${isTeam ? '&#128101;' : initial(e.name)}</div>
        <div class="lb-name">${e.name}</div>
        <div class="lb-score">${e.score}</div>
        <div class="lb-meta">${meta}</div>
      </div>
    `;
  }).join('');
}

function renderTable(container, entries, startRank, isTeam) {
  const rest = entries.slice(3);
  if (!rest.length && startRank === 4 && entries.length <= 3) {
    container.innerHTML = '';
    return;
  }
  if (!entries.length) {
    container.innerHTML = '';
    return;
  }

  const rows = (entries.length > 3 ? rest : entries).map((e, i) => {
    const rank = entries.length > 3 ? startRank + i : i + 1;
    const detail = isTeam
      ? `${e.members} members · ${e.sessions} sessions`
      : `${e.quizzes} quizzes · ${e.avg}% avg`;
    return `
      <div class="lb-row">
        <span class="lb-row-rank">${rank}</span>
        <div class="lb-row-user">
          <div class="lb-row-av" style="background:${avatarColor(e.name)}">${isTeam ? '&#128101;' : initial(e.name)}</div>
          <div class="lb-row-info">
            <div class="lb-row-name">${e.name}</div>
            <div class="lb-row-detail">${detail}</div>
          </div>
        </div>
        <div class="lb-row-score">${e.score}<span>pts</span></div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="lb-table-head"><span>Rank</span><span>${isTeam ? 'Team' : 'Student'}</span><span>Score</span></div>
    ${rows}
  `;
}

export async function loadLeaderboards() {
  try {
    const [individual, team] = await Promise.all([
      getIndividualLeaderboard(10),
      getTeamLeaderboard(10)
    ]);

    const indPodium = document.getElementById('lb-individual-podium');
    const indTable = document.getElementById('lb-individual-table');
    const teamPodium = document.getElementById('lb-team-podium');
    const teamTable = document.getElementById('lb-team-table');

    if (indPodium) renderPodium(indPodium, individual, false);
    if (indTable) renderTable(indTable, individual, 4, false);
    if (teamPodium) renderPodium(teamPodium, team, true);
    if (teamTable) renderTable(teamTable, team, 4, true);
  } catch (err) {
    console.warn('Could not load leaderboards', err);
  }
}

export async function loadTestimonialsSection() {
  const grid = document.getElementById('testimonials-grid');
  if (!grid) return;

  try {
    const items = await loadTestimonials();
    if (!items.length) {
      grid.innerHTML = '<p class="lb-empty" style="grid-column:1/-1;text-align:center;padding:40px;color:#888;">No testimonials yet.</p>';
      return;
    }

    grid.innerHTML = items.map(t => `
      <div class="tcard">
        <div class="tcard-head">
          <div class="tcard-av" style="background:${avatarColor(t.name)}">${initial(t.name)}</div>
          <div>
            <div class="tcard-name">${t.name}</div>
            <div class="tcard-role">${t.role || 'Student'}</div>
          </div>
        </div>
        <p>${t.quote || ''}</p>
      </div>
    `).join('');
  } catch (err) {
    console.warn('Could not load testimonials', err);
  }
}

loadPlatformStats();
loadLeaderboards();
loadTestimonialsSection();
