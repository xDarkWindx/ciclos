import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

let ctx: AudioContext | null = null;
let loop: ReturnType<typeof setInterval> | undefined;
let wake: any = null;

/** Chamar dentro de um clique/toque: navegadores só liberam áudio após interação do usuário. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
  } catch {
    /* sem áudio */
  }
}

function beep(at: number, freq: number, dur = 0.18) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.4, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

const pattern = () => {
  if (!ctx) return;
  const t = ctx.currentTime;
  [0, 0.25, 0.5].forEach((d, i) => beep(t + d, 880 + i * 220));
  navigator.vibrate?.([200, 100, 200, 100, 200]);
};

export function startAlarm() {
  stopAlarm();
  unlockAudio();
  pattern();
  loop = setInterval(pattern, 1500);
}

export function stopAlarm() {
  clearInterval(loop);
  loop = undefined;
  navigator.vibrate?.(0);
}

export const isAlarmRinging = () => loop !== undefined;

// ---- Notificação agendada (toca mesmo com o app em segundo plano / tela apagada no Android) ----
const NOTIF_ID = 4242;

export async function requestNotifyPermission() {
  try {
    if (Capacitor.isNativePlatform()) await LocalNotifications.requestPermissions();
    else if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
  } catch {
    /* ignore */
  }
}

export async function scheduleFinishNotification(atMs: number, subject: string) {
  const title = 'Tempo concluído!';
  const body = `Hora de encerrar ${subject}.`;
  try {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] });
      await LocalNotifications.schedule({
        notifications: [{ id: NOTIF_ID, title, body, schedule: { at: new Date(atMs), allowWhileIdle: true } }],
      });
    }
  } catch {
    /* ignore */
  }
}

export async function cancelFinishNotification() {
  try {
    if (Capacitor.isNativePlatform()) await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] });
  } catch {
    /* ignore */
  }
}

/** Notificação do navegador (só quando a aba está em segundo plano). */
export function webNotify(subject: string) {
  if (Capacitor.isNativePlatform() || document.visibilityState === 'visible') return;
  if ('Notification' in window && Notification.permission === 'granted') new Notification('Tempo concluído!', { body: `Hora de encerrar ${subject}.`, icon: `${import.meta.env.BASE_URL}icon.svg` });
}

// ---- Manter a tela ligada durante o estudo ----
export async function keepAwake(on: boolean) {
  try {
    if (on && !wake && 'wakeLock' in navigator) {
      wake = await (navigator as any).wakeLock.request('screen');
      wake.addEventListener('release', () => (wake = null));
    } else if (!on && wake) {
      await wake.release();
      wake = null;
    }
  } catch {
    /* ignore */
  }
}
