import { getAccessToken } from '../auth/auth';

const FILE_NAME = 'ciclos.sqlite';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

async function authed(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const r = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Drive ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

export async function findRemote(): Promise<string | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const r = await authed(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(id)&orderBy=createdTime&pageSize=1`);
  return (await r.json()).files?.[0]?.id ?? null;
}

export async function download(id: string): Promise<Uint8Array> {
  const r = await authed(`${API}/files/${id}?alt=media`);
  return new Uint8Array(await r.arrayBuffer());
}

export async function upload(bytes: Uint8Array, id: string | null): Promise<void> {
  const blob = new Blob([bytes as BlobPart], { type: 'application/x-sqlite3' });
  if (id) {
    await authed(`${UPLOAD}/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/x-sqlite3' }, body: blob });
    return;
  }
  const boundary = 'ciclos' + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/x-sqlite3\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ]);
  await authed(`${UPLOAD}/files?uploadType=multipart`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
}
