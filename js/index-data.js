// Home page data from Firebase

import {
  getIndividualLeaderboard,
  getTeamLeaderboard,
  getPlatformStats,
  loadTestimonials
} from './firebase.js';

function getInitial(name) {
  if (!name) return 'U';
  return name.charAt(0).toUpperCase();
}

function getAvatarColor(name) {
  const colors = ['#111', '#333', '#555', '#666', '#444', '#222', '#888'];
  let hash = 0;
  const text = name || '';

  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export async function loadPlatformStats() {
  try {
    const stats = await getPlatformStats();
    const spans = document.querySelectorAll('.stats-big span');

    const studentCount = stats.studentCount || 0;
    const sessionCount = stats.sessionCount || 0;
    const goalsCount = stats.goalsCompletedCount || 0;

    if (spans[0]) {
      spans[0].dataset.target = studentCount;
      spans[0].textContent = studentCount.toLocaleString() + ' students';
    }
    if (spans[1]) {
      spans[1].dataset.target = sessionCount;
      spans[1].textContent = sessionCount.toLocaleString() + ' study sessions';
    }
    if (spans[2]) {
      spans[2].dataset.target = goalsCount;
      spans[2].textContent = goalsCount.toLocaleString() + ' goals completed';
    }

    window.__llStatsLoaded = true;
    window.dispatchEvent(new Event('ll-stats-loaded'));
  } catch (err) {
    console.warn('Could not load platform stats', err);
  }
}

function renderPodium(container, entries, isTeam) {
  if (entries.length === 0) {
    container.innerHTML = '<p class="lb-empty">No leaderboard data yet. Complete a focus room quiz to appear here.</p>';
    return;
  }

  const rankClasses = ['second', 'first', 'third'];
  const displayOrder = [1, 0, 2];
  const rankLabels = ['2nd', '1st', '3rd'];
  let html = '';

  for (let i = 0; i < displayOrder.length; i++) {
    const entryIndex = displayOrder[i];
    const entry = entries[entryIndex];
    if (!entry) continue;

    let metaText = '';
    if (isTeam) {
      metaText = entry.members + ' members · ' + entry.sessions + ' sessions';
    } else {
      metaText = entry.quizzes + ' quizzes · ' + entry.avg + '% avg';
    }

    const avatarContent = isTeam ? '&#128101;' : getInitial(entry.name);
    const crownHtml = i === 1 ? '<div class="lb-crown">&#127942;</div>' : '';

    html += `
      <div class="lb-podium-card ${rankClasses[i]}">
        ${crownHtml}
        <div class="lb-rank">${rankLabels[i]}</div>
        <div class="lb-avatar" style="background:${getAvatarColor(entry.name)}">${avatarContent}</div>
        <div class="lb-name">${entry.name}</div>
        <div class="lb-score">${entry.score}</div>
        <div class="lb-meta">${metaText}</div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function renderTable(container, entries, startRank, isTeam) {
  if (entries.length === 0) {
    container.innerHTML = '';
    return;
  }

  const rowsToShow = entries.length > 3 ? entries.slice(3) : entries;

  if (rowsToShow.length === 0 && startRank === 4 && entries.length <= 3) {
    container.innerHTML = '';
    return;
  }

  let rowsHtml = '';
  for (let i = 0; i < rowsToShow.length; i++) {
    const entry = rowsToShow[i];
    const rank = entries.length > 3 ? startRank + i : i + 1;

    let detailText = '';
    if (isTeam) {
      detailText = entry.members + ' members · ' + entry.sessions + ' sessions';
    } else {
      detailText = entry.quizzes + ' quizzes · ' + entry.avg + '% avg';
    }

    const avatarContent = isTeam ? '&#128101;' : getInitial(entry.name);

    rowsHtml += `
      <div class="lb-row">
        <span class="lb-row-rank">${rank}</span>
        <div class="lb-row-user">
          <div class="lb-row-av" style="background:${getAvatarColor(entry.name)}">${avatarContent}</div>
          <div class="lb-row-info">
            <div class="lb-row-name">${entry.name}</div>
            <div class="lb-row-detail">${detailText}</div>
          </div>
        </div>
        <div class="lb-row-score">${entry.score}<span>pts</span></div>
      </div>
    `;
  }

  const columnTitle = isTeam ? 'Team' : 'Student';
  container.innerHTML = `
    <div class="lb-table-head"><span>Rank</span><span>${columnTitle}</span><span>Score</span></div>
    ${rowsHtml}
  `;
}

function showLeaderboardError(message) {
  const targets = ['lb-individual-podium', 'lb-team-podium'];
  for (let i = 0; i < targets.length; i++) {
    const el = document.getElementById(targets[i]);
    if (el && !el.innerHTML.trim()) {
      el.innerHTML = `<p class="lb-empty">${message}</p>`;
    }
  }
}

export async function loadLeaderboards() {
  try {
    const individual = await getIndividualLeaderboard(10);
    const team = await getTeamLeaderboard(10);

    const indPodium = document.getElementById('lb-individual-podium');
    const indTable = document.getElementById('lb-individual-table');
    const teamPodium = document.getElementById('lb-team-podium');
    const teamTable = document.getElementById('lb-team-table');

    if (indPodium) renderPodium(indPodium, individual, false);
    if (indTable) {
      renderTable(indTable, individual, 4, false);
      indTable.style.opacity = '1';
      indTable.style.transform = 'none';
    }
    if (teamPodium) renderPodium(teamPodium, team, true);
    if (teamTable) {
      renderTable(teamTable, team, 4, true);
      teamTable.style.opacity = '1';
      teamTable.style.transform = 'none';
    }
  } catch (err) {
    console.warn('Could not load leaderboards', err);
    showLeaderboardError('Could not load leaderboard data. Please refresh the page.');
  }
}

export async function loadTestimonialsSection() {
  const grid = document.getElementById('testimonials-grid');
  if (!grid) return;

  try {
    const items = await loadTestimonials();

    if (items.length === 0) {
      grid.innerHTML = '<p class="lb-empty" style="grid-column:1/-1;text-align:center;padding:40px;color:#888;">No testimonials yet.</p>';
      return;
    }

    let html = '';
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      html += `
        <div class="tcard">
          <div class="tcard-head">
            <div class="tcard-av" style="background:${getAvatarColor(item.name)}">${getInitial(item.name)}</div>
            <div>
              <div class="tcard-name">${item.name}</div>
              <div class="tcard-role">${item.role || 'Student'}</div>
            </div>
          </div>
          <p>${item.quote || ''}</p>
        </div>
      `;
    }

    grid.innerHTML = html;
  } catch (err) {
    console.warn('Could not load testimonials', err);
  }
}

loadPlatformStats();
loadLeaderboards();
loadTestimonialsSection();
