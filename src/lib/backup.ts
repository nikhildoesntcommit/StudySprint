import type { StudyData, Task } from '../types';
import { pickData, useStore } from '../store/store';
import { download, uid } from './id';
import { ymd } from './dates';

export function exportBackup(includeKey = false) {
  const data = pickData(useStore.getState());
  const copy: StudyData = structuredClone(data);
  if (!includeKey) copy.settings.ai.key = '';
  download(`studysprint-backup-${ymd()}.json`, JSON.stringify({ app: 'StudySprint', version: 4, exportedAt: new Date().toISOString(), data: copy }, null, 2));
}

export function parseBackup(text: string): Partial<StudyData> {
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
  const data = json?.app === 'StudySprint' ? json.data : json;
  if (!data || typeof data !== 'object' || !Array.isArray(data.tasks ?? []) || !('subjects' in data || 'tasks' in data || 'cards' in data)) {
    throw new Error('This does not look like a StudySprint backup.');
  }
  return data;
}

// ---- Import from the previous StudySprint (v3) --------------------------

const LEGACY_DB = 'studysprint-pages-v1';

export async function hasLegacyData(): Promise<boolean> {
  try {
    if (!('databases' in indexedDB)) return false;
    const dbs = await indexedDB.databases();
    return dbs.some((d) => d.name === LEGACY_DB);
  } catch { return false; }
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Reads tasks saved by StudySprint v3 (all local profiles) and imports them. Returns count. */
export async function importLegacy(): Promise<number> {
  const db: IDBDatabase = await new Promise((resolve, reject) => {
    const req = indexedDB.open(LEGACY_DB);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!db.objectStoreNames.contains('tasks')) { db.close(); return 0; }
  const records: { username: string; csv: string }[] = await new Promise((resolve, reject) => {
    const tx = db.transaction('tasks', 'readonly');
    const req = tx.objectStore('tasks').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  const st = useStore.getState();
  let count = 0;
  const subjectIds = new Map(st.subjects.map((s) => [s.name.toLowerCase(), s.id]));
  const tasks: Task[] = [];
  for (const rec of records) {
    const rows = parseCsv(rec.csv || '');
    const [head, ...body] = rows;
    if (!head) continue;
    const col = (name: string) => head.findIndex((h) => h.trim().toLowerCase() === name);
    const [ti, si, di, sti, pi] = ['task', 'subject', 'deadline', 'status', 'priority'].map(col);
    for (const r of body) {
      const title = r[ti]?.trim();
      if (!title) continue;
      const subjName = r[si]?.trim();
      let subjectId = subjName ? subjectIds.get(subjName.toLowerCase()) : undefined;
      if (subjName && !subjectId) {
        subjectId = st.addSubject({ name: subjName, emoji: '📘', color: 'blue' }).id;
        subjectIds.set(subjName.toLowerCase(), subjectId);
      }
      const pr = (r[pi] || '').toLowerCase();
      const done = /done|complete/i.test(r[sti] || '');
      tasks.push({
        id: uid('task'), title, subjectId,
        due: /^\d{4}-\d{2}-\d{2}$/.test(r[di] || '') ? r[di] : undefined,
        priority: pr.startsWith('h') ? 3 : pr.startsWith('m') ? 2 : pr.startsWith('l') ? 1 : 0,
        status: done ? 'done' : 'todo', completedAt: done ? Date.now() : undefined,
        subtasks: [], tags: ['imported'], createdAt: Date.now(), order: Date.now() + count,
      });
      count++;
    }
  }
  if (tasks.length) useStore.getState().set((s) => ({ tasks: [...s.tasks, ...tasks] }));
  return count;
}
