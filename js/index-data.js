// Home page data (REST only — works on localhost and GitHub Pages)

const PROJECT_ID = 'learnloop-f89c2';
const DB_ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function parseRestValue(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return parseInt(value.integerValue, 10);
  if (value.doubleValue !== undefined) return parseFloat(value.doubleValue);
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.nullValue !== undefined) return null;
  if (value.arrayValue) {
    return (value.arrayValue.values || []).map(parseRestValue);
  }
  if (value.mapValue) {
    const obj = {};
    const fields = value.mapValue.fields || {};
    for (const key in fields) {
      obj[key] = parseRestValue(fields[key]);
    }
    return obj;
  }
  return null;
}

function parseRestDoc(doc) {
  const data = {};
  const fields = doc.fields || {};
  for (const key in fields) {
    data[key] = parseRestValue(fields[key]);
  }
  const parts = (doc.name || '').split('/');
  return { id: parts[parts.length - 1], ...data };
}

async function restRunQuery(collectionName, field, value) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: collectionName }],
      where: {
        fieldFilter: {
          field: { fieldPath: field },
          op: 'EQUAL',
          value: { stringValue: value }
        }
      }
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`Could not query ${collectionName} (${res.status})`);
  }

  const rows = await res.json();
  const docs = [];

  for (let i = 0; i < rows.length; i++) {
    if (rows[i].document) {
      docs.push(parseRestDoc(rows[i].document));
    }
  }

  return docs;
}

async function restListCollection(collectionName) {
  const docs = [];
  let pageToken = '';

  do {
    const params = new URLSearchParams({ pageSize: '300' });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${DB_ROOT}/${collectionName}?${params}`);
    if (!res.ok) {
      throw new Error(`Could not load ${collectionName} (${res.status})`);
    }

    const data = await res.json();
    if (data.documents) {
      for (let i = 0; i < data.documents.length; i++) {
        docs.push(parseRestDoc(data.documents[i]));
      }
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return docs;
}

async function restGetDocument(collectionName, docId) {
  const res = await fetch(`${DB_ROOT}/${collectionName}/${docId}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Could not load ${collectionName}/${docId} (${res.status})`);
  }
  return parseRestDoc(await res.json());
}

function buildIndividualLeaderboard(rows, max) {
  const byUser = {};

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const key = r.uid;
    if (!key) continue;

    if (!byUser[key]) {
      byUser[key] = { uid: key, name: r.userName || 'Learner', score: 0, quizzes: 0, totalPercent: 0 };
    }
    const cur = byUser[key];
    cur.score += r.score || 0;
    cur.quizzes += 1;
    cur.totalPercent += r.avgPercent || 0;
    cur.name = r.userName || cur.name;
  }

  const users = [];
  for (const uid in byUser) {
    const u = byUser[uid];
    const avg = u.quizzes ? Math.round(u.totalPercent / u.quizzes) : 0;
    users.push({ uid: u.uid, name: u.name, score: u.score, quizzes: u.quizzes, avg });
  }

  users.sort((a, b) => b.score - a.score);
  return users.slice(0, max);
}

function buildTeamLeaderboard(rows, max) {
  const teams = [];

  for (let i = 0; i < rows.length; i++) {
    const s = rows[i];
    if (s.status !== 'finished' || !s.members?.length) continue;

    let teamScore = 0;
    for (let m = 0; m < s.members.length; m++) {
      teamScore += s.members[m].score || 0;
    }

    teams.push({
      name: s.teamName || `Team ${(s.hostEmail || 'Session').split('@')[0]}`,
      score: teamScore,
      members: s.members.length,
      sessions: 1
    });
  }

  teams.sort((a, b) => b.score - a.score);
  return teams.slice(0, max);
}

async function fetchPlatformStats() {
  const cached = await restGetDocument('platformStats', 'global');
  if (cached) {
    return {
      studentCount: cached.studentCount || 0,
      sessionCount: cached.sessionCount || 0,
      goalsCompletedCount: cached.goalsCompletedCount || 0
    };
  }
  return { studentCount: 0, sessionCount: 0, goalsCompletedCount: 0 };
}

async function fetchIndividualLeaderboard(max = 10) {
  const rows = await restListCollection('quizResults');
  return buildIndividualLeaderboard(rows, max);
}

async function fetchTeamLeaderboard(max = 10) {
  let rows = [];
  try {
    rows = await restRunQuery('sessions', 'status', 'finished');
  } catch (err) {
    console.warn('Could not load team sessions for leaderboard.', err);
    return [];
  }
  return buildTeamLeaderboard(rows, max);
}

async function fetchTestimonials() {
  return restListCollection('testimonials');
}

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

function revealStats() {
  const statsBig = document.querySelector('.stats-big');
  if (statsBig) {
    statsBig.style.opacity = '1';
    statsBig.style.transform = 'none';
  }
}

export async function loadPlatformStats() {
  try {
    const stats = await fetchPlatformStats();
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

    revealStats();
    window.__llStatsLoaded = true;
    window.dispatchEvent(new Event('ll-stats-loaded'));
  } catch (err) {
    console.warn('Could not load platform stats', err);
    revealStats();
  }
}

function renderPodium(container, entries, isTeam) {
  if (!container) return;

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

    const avatarContent = isTeam ? 'T' : getInitial(entry.name);

    html += `
      <div class="lb-podium-card ${rankClasses[i]}" style="opacity:1;transform:none">
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
  if (!container) return;

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

    const avatarContent = isTeam ? 'T' : getInitial(entry.name);

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
  container.style.opacity = '1';
  container.style.transform = 'none';
}

function showLeaderboardError(message) {
  const targets = ['lb-individual-podium', 'lb-team-podium'];
  for (let i = 0; i < targets.length; i++) {
    const el = document.getElementById(targets[i]);
    if (el) {
      el.innerHTML = `<p class="lb-empty">${message}</p>`;
    }
  }
}

export async function loadLeaderboards() {
  try {
    const individual = await fetchIndividualLeaderboard(10);
    const team = await fetchTeamLeaderboard(10);

    renderPodium(document.getElementById('lb-individual-podium'), individual, false);
    renderTable(document.getElementById('lb-individual-table'), individual, 4, false);
    renderPodium(document.getElementById('lb-team-podium'), team, true);
    renderTable(document.getElementById('lb-team-table'), team, 4, true);
  } catch (err) {
    console.warn('Could not load leaderboards', err);
    showLeaderboardError('Could not load leaderboard data. Please refresh the page.');
  }
}

export async function loadTestimonialsSection() {
  const grid = document.getElementById('testimonials-grid');
  if (!grid) return;

  try {
    const items = await fetchTestimonials();

    if (items.length === 0) {
      grid.innerHTML = '<p class="lb-empty" style="grid-column:1/-1;text-align:center;padding:40px;color:#888;">No testimonials yet.</p>';
      return;
    }

    let html = '';
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      html += `
        <div class="tcard" style="opacity:1;transform:none">
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
    grid.innerHTML = '<p class="lb-empty" style="grid-column:1/-1;text-align:center;padding:40px;color:#888;">Could not load testimonials.</p>';
  }
}

loadPlatformStats();
loadLeaderboards();
loadTestimonialsSection();
