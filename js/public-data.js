// Public Firestore data via REST (no Firebase SDK — works on GitHub Pages)

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

export async function fetchPlatformStats() {
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

export async function fetchIndividualLeaderboard(max = 10) {
  const rows = await restListCollection('quizResults');
  return buildIndividualLeaderboard(rows, max);
}

export async function fetchTeamLeaderboard(max = 10) {
  let rows = [];
  try {
    rows = await restRunQuery('sessions', 'status', 'finished');
  } catch (err) {
    console.warn('Could not load team sessions for leaderboard.', err);
    return [];
  }
  return buildTeamLeaderboard(rows, max);
}

export async function fetchTestimonials() {
  return restListCollection('testimonials');
}
