import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

export interface User { sub: string; email: string; name: string; picture?: string }

const WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const ANDROID_CLIENT_ID = import.meta.env.VITE_GOOGLE_ANDROID_CLIENT_ID as string | undefined;
const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.appdata';
const USER_KEY = 'ciclos.user';
const REFRESH_KEY = 'ciclos.refresh';
const TOKEN_KEY = 'ciclos.token';

export const isNative = () => Capacitor.isNativePlatform();
export const authConfigured = () => !!(isNative() ? ANDROID_CLIENT_ID : WEB_CLIENT_ID);
export class NeedsReauth extends Error {}

type Token = { value: string; exp: number };
let token: Token | null = null;
let pending: Promise<Token> | null = null;

/** Guarda o token (vale ~1 h) para que recarregar o app não peça um novo — é isso que abre o pop-up do Google. */
function saveToken(t: Token | null) {
  token = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* sem armazenamento: segue só em memória */
  }
}

function loadToken(): Token | null {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function restoreUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
  } catch {
    return null;
  }
}

async function fetchUser(accessToken: string): Promise<User> {
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error('Falha ao obter perfil Google');
  const u = await r.json();
  return { sub: u.sub, email: u.email, name: u.name ?? u.email, picture: u.picture };
}

export async function signIn(): Promise<User> {
  const t = isNative() ? await nativeAuth() : await webAuth('select_account');
  saveToken(t);
  const user = await fetchUser(t.value);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export function signOut() {
  const g = (window as any).google?.accounts?.oauth2;
  if (g && token) g.revoke(token.value, () => {});
  saveToken(null);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

/** Access token válido para a API do Drive; renova silenciosamente quando possível. */
export async function getAccessToken(): Promise<string> {
  const valid = (t: Token | null) => t !== null && t.exp - Date.now() > 60_000;
  if (valid(token)) return token!.value;
  const stored = loadToken();
  if (valid(stored)) {
    token = stored;
    return stored!.value;
  }
  // Uma renovação por vez: evita abrir vários pop-ups se houver chamadas simultâneas.
  pending ??= (isNative() ? nativeRefresh() : webAuth('', restoreUser()?.email))
    .then((t) => (saveToken(t), t))
    .finally(() => (pending = null));
  return (await pending).value;
}

// ---------------- Web: Google Identity Services ----------------
let gisLoading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Não foi possível carregar o login do Google (sem internet?)'));
    document.head.appendChild(s);
  });
  return gisLoading;
}

async function webAuth(prompt: string, hint?: string): Promise<{ value: string; exp: number }> {
  if (!WEB_CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID não configurado');
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: WEB_CLIENT_ID,
      scope: SCOPES,
      prompt,
      login_hint: hint,
      callback: (resp: any) => {
        if (resp.error) reject(prompt === '' ? new NeedsReauth(resp.error) : new Error(resp.error));
        else resolve({ value: resp.access_token, exp: Date.now() + Number(resp.expires_in) * 1000 });
      },
      error_callback: (err: any) => reject(prompt === '' ? new NeedsReauth(err?.type) : new Error(err?.type ?? 'erro de login')),
    });
    client.requestAccessToken();
  });
}

// ---------------- Android: OAuth2 + PKCE via navegador do sistema ----------------
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Esquema de redirecionamento exigido pelo Google para clientes Android: ID invertido. */
const redirectUri = () => `com.googleusercontent.apps.${ANDROID_CLIENT_ID!.replace('.apps.googleusercontent.com', '')}:/oauth2redirect`;

async function tokenRequest(params: Record<string, string>) {
  // HTTP nativo do Capacitor: a requisição sai do Android, sem passar pelas regras de CORS do WebView.
  const r = await CapacitorHttp.post({
    url: 'https://oauth2.googleapis.com/token',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: { client_id: ANDROID_CLIENT_ID!, ...params },
  });
  const j = typeof r.data === 'string' ? JSON.parse(r.data || '{}') : r.data ?? {};
  if (r.status < 200 || r.status >= 300) throw new Error(j.error_description ?? j.error ?? `Falha no token (${r.status})`);
  return j;
}

async function nativeAuth(): Promise<{ value: string; exp: number }> {
  if (!ANDROID_CLIENT_ID) throw new Error('VITE_GOOGLE_ANDROID_CLIENT_ID não configurado');
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const url =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: ANDROID_CLIENT_ID, redirect_uri: redirectUri(), response_type: 'code', scope: SCOPES,
      code_challenge: challenge, code_challenge_method: 'S256', state, access_type: 'offline', prompt: 'consent',
    });

  const code = await new Promise<string>((resolve, reject) => {
    let settled = false;
    const cleanup = async () => {
      settled = true;
      (await urlSub).remove();
      (await closeSub).remove();
    };
    const urlSub = App.addListener('appUrlOpen', async ({ url: cb }) => {
      if (settled || !cb.startsWith(redirectUri())) return;
      await cleanup();
      await Browser.close().catch(() => {});
      const q = new URL(cb.replace(':/', '://')).searchParams;
      if (q.get('state') !== state) return reject(new Error('Resposta OAuth inválida'));
      const c = q.get('code');
      c ? resolve(c) : reject(new Error(q.get('error') ?? 'Login cancelado'));
    });
    // Usuário fechou a aba do login sem concluir. Pequena espera: no retorno normal o
    // navegador também fecha, e o appUrlOpen pode chegar logo em seguida.
    const closeSub = Browser.addListener('browserFinished', () => {
      setTimeout(async () => {
        if (settled) return;
        await cleanup();
        reject(new Error('Login cancelado'));
      }, 1500);
    });
    void Browser.open({ url });
  });

  const j = await tokenRequest({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirectUri() });
  if (j.refresh_token) localStorage.setItem(REFRESH_KEY, j.refresh_token);
  return { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
}

async function nativeRefresh(): Promise<{ value: string; exp: number }> {
  const rt = localStorage.getItem(REFRESH_KEY);
  if (!rt) throw new NeedsReauth('sem refresh token');
  try {
    const j = await tokenRequest({ grant_type: 'refresh_token', refresh_token: rt });
    return { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  } catch (e) {
    if (navigator.onLine) throw new NeedsReauth(String(e));
    throw e;
  }
}
