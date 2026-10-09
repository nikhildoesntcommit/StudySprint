const DB_NAME = 'studysprint-pages-v1';
const DB_VERSION = 1;
const TASK_COLUMNS = ['ID', 'Task', 'Subject', 'Deadline', 'Status', 'Priority'];
const nativeFetch = window.fetch.bind(window);
const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains('users')) db.createObjectStore('users', { keyPath: 'username' });
    if (!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', { keyPath: 'username' });
    if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Could not open StudySprint browser storage.'));
});

function record(storeName, mode, action) {
  return dbPromise.then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    let request;
    try { request = action(transaction.objectStore(storeName)); }
    catch (error) { reject(error); return; }
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error || request?.error || new Error('Browser storage operation failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Browser storage operation was cancelled.'));
  }));
}
const get = (store, key) => record(store, 'readonly', (table) => table.get(key));
const all = (store) => record(store, 'readonly', (table) => table.getAll());
const put = (store, value) => record(store, 'readwrite', (table) => table.put(value));
const clear = (store) => record(store, 'readwrite', (table) => table.clear());
const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const textResponse = (value, status = 200, type = 'text/plain; charset=utf-8') => new Response(value, { status, headers: { 'Content-Type': type, 'Cache-Control': 'no-store' } });
const csvCell = (value) => { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };
const serializeTasks = (tasks) => `${[TASK_COLUMNS.join(','), ...tasks.map((task) => TASK_COLUMNS.map((key) => csvCell(task[key])).join(','))].join('\n')}\n`;
const slug = (name) => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'student';
const randomHex = (length = 16) => [...crypto.getRandomValues(new Uint8Array(length))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const saltBytes = (hex) => Uint8Array.from(hex.match(/.{2}/g) || [], (byte) => parseInt(byte, 16));
async function passwordHash(password, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const result = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes(salt), iterations: 310000, hash: 'SHA-256' }, material, 256);
  return [...new Uint8Array(result)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function sameSecret(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
const publicUser = ({ username, name, className, school }) => ({ username, name, className, school });
async function currentUser(url) {
  const username = url.searchParams.get('user');
  if (!username || !(await get('users', username))) throw Object.assign(new Error('Please log in to access this study data.'), { status: 401 });
  return username;
}
function bytesToBase64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(value); const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
async function handleApi(input, init = {}) {
  const url = new URL(typeof input === 'string' ? input : input.url, location.href);
  const pathname = url.pathname;
  const method = (init.method || (typeof input === 'object' ? input.method : 'GET') || 'GET').toUpperCase();
  try {
    if (pathname.endsWith('/api/health')) return jsonResponse({ ok: true, version: '3.0.0', storage: 'this browser' });
    if (pathname.endsWith('/api/users') && method === 'GET') return jsonResponse((await all('users')).map(publicUser));
    if (pathname.endsWith('/api/auth/register') && method === 'POST') {
      const inputData = JSON.parse(init.body || '{}');
      const name = String(inputData.name || '').trim(); const className = String(inputData.className || '').trim(); const school = String(inputData.school || '').trim(); const password = String(inputData.password || '');
      if (!name || !className || !school || password.length < 8) return jsonResponse({ error: 'Enter your name, class, school, and a password of at least 8 characters.' }, 400);
      if (name.length > 80 || className.length > 40 || school.length > 120) return jsonResponse({ error: 'One or more fields are too long.' }, 400);
      const users = await all('users'); const base = slug(name); let username;
      do { username = `${base}-${randomHex(4)}`; } while (users.some((user) => user.username === username));
      const salt = randomHex(); const user = { username, name, className, school, salt, hash: await passwordHash(password, salt), createdAt: new Date().toISOString() };
      await put('users', user); await put('tasks', { username, csv: `${TASK_COLUMNS.join(',')}\n` });
      return jsonResponse(publicUser(user), 201);
    }
    if (pathname.endsWith('/api/auth/login') && method === 'POST') {
      const inputData = JSON.parse(init.body || '{}'); const user = await get('users', inputData.username);
      if (!user || typeof inputData.password !== 'string' || !sameSecret(await passwordHash(inputData.password, user.salt), user.hash)) return jsonResponse({ error: 'That name and password do not match.' }, 401);
      return jsonResponse(publicUser(user));
    }
    if (pathname.endsWith('/api/auth/reset-password') && method === 'POST') {
      const inputData = JSON.parse(init.body || '{}'); const password = String(inputData.password || '');
      if (password.length < 8) return jsonResponse({ error: 'Use a password of at least 8 characters.' }, 400);
      const user = await get('users', inputData.username); if (!user) return jsonResponse({ error: 'Choose a saved user first.' }, 404);
      user.salt = randomHex(); user.hash = await passwordHash(password, user.salt); await put('users', user);
      return jsonResponse({ changed: true });
    }
    if (pathname.endsWith('/api/tasks') || pathname.endsWith('/api/tasks/reset')) {
      const username = await currentUser(url);
      if (pathname.endsWith('/api/tasks/reset') && method === 'POST') {
        const seed = await nativeFetch(new URL('./data/StudySprint_DB.original.csv', location.href), { cache: 'no-store' });
        if (!seed.ok) return jsonResponse({ error: 'The sample CSV could not be loaded.' }, 500);
        await put('tasks', { username, csv: await seed.text() }); return new Response(null, { status: 204 });
      }
      if (method === 'GET') {
        const saved = await get('tasks', username);
        return textResponse(saved?.csv || `${TASK_COLUMNS.join(',')}\n`, 200, 'text/csv; charset=utf-8');
      }
      if (method === 'PUT') {
        const tasks = JSON.parse(init.body || '[]');
        if (!Array.isArray(tasks) || tasks.some((task) => !task || TASK_COLUMNS.some((key) => typeof task[key] !== 'string' || !task[key].trim()))) return jsonResponse({ error: 'Each task must contain all six StudySprint CSV fields.' }, 400);
        const ids = tasks.map((task) => task.ID);
        if (new Set(ids).size !== ids.length) return jsonResponse({ error: 'Task IDs must be unique.' }, 400);
        if (tasks.some((task) => !['Done', 'To do'].includes(task.Status))) return jsonResponse({ error: 'Task status must be Done or To do.' }, 400);
        await put('tasks', { username, csv: serializeTasks(tasks) }); return jsonResponse({ saved: tasks.length });
      }
    }
    if (pathname.endsWith('/api/files') && method === 'POST') {
      const username = await currentUser(url); const blob = init.body instanceof Blob ? init.body : await new Response(init.body).blob();
      if (blob.size < 5 || blob.size > 25 * 1024 * 1024) return jsonResponse({ error: 'Choose a PDF smaller than 25 MB.' }, 400);
      const header = new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer());
      if (header !== '%PDF-') return jsonResponse({ error: 'Please choose a valid PDF file.' }, 400);
      const id = crypto.randomUUID(); await put('files', { id, username, blob, name: url.searchParams.get('name') || 'Study material.pdf', bytes: blob.size });
      return jsonResponse({ id, url: `/user-files/${username}/${id}.pdf`, bytes: blob.size }, 201);
    }
    const deletion = pathname.match(/\/api\/files\/([0-9a-f-]{36})$/i);
    if (deletion && method === 'DELETE') {
      const username = await currentUser(url); const file = await get('files', deletion[1]);
      if (file?.username === username) await record('files', 'readwrite', (table) => table.delete(deletion[1]));
      return new Response(null, { status: 204 });
    }
    const view = pathname.match(/\/user-files\/([a-z0-9-]{3,64})\/([0-9a-f-]{36}\.pdf)$/i);
    if (view && method === 'GET') {
      const file = await get('files', view[2].slice(0, -4));
      if (!file || file.username !== view[1]) return textResponse('Not found', 404);
      return new Response(file.blob, { headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' } });
    }
    if (pathname.endsWith('/api/debug/reset-all') && method === 'POST') {
      await Promise.all(['users', 'tasks', 'files'].map(clear)); localStorage.clear(); sessionStorage.clear();
      return new Response(null, { status: 204 });
    }
    return nativeFetch(input, init);
  } catch (error) {
    return jsonResponse({ error: error.message || 'StudySprint browser storage error.' }, error.status || 500);
  }
}
window.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.href);
  if (url.pathname.includes('/api/') || url.pathname.includes('/user-files/')) return handleApi(input, init);
  return nativeFetch(input, init);
};

// Browser-local app data is most reliable in a normal browser profile, rather than private mode.
if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

// Open saved PDFs in an in-app viewer instead of navigating GitHub Pages to a nonexistent file route.
document.addEventListener('click', async (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const link = target?.closest('a.resource-open[href*="/user-files/"]');
  if (!link) return;
  event.preventDefault();
  try {
    const response = await window.fetch(link.href);
    if (!response.ok) throw new Error('This PDF could not be opened.');
    const objectUrl = URL.createObjectURL(await response.blob());
    const viewer = document.createElement('div');
    viewer.setAttribute('role', 'dialog'); viewer.setAttribute('aria-label', 'Textbook PDF');
    viewer.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;display:flex;flex-direction:column;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom);';
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close PDF';
    close.style.cssText = 'height:52px;border:0;background:#243c30;color:#fff;font:600 16px system-ui;';
    const frame = document.createElement('iframe'); frame.title = 'Textbook PDF'; frame.src = objectUrl; frame.style.cssText = 'border:0;flex:1;width:100%;';
    close.addEventListener('click', () => { URL.revokeObjectURL(objectUrl); viewer.remove(); });
    viewer.append(close, frame); document.body.append(viewer);
  } catch (error) { window.alert(error.message || 'This PDF could not be opened.'); }
});
