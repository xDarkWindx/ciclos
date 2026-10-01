// Idempotente: aplica ao projeto Android gerado pelo Capacitor o que o app precisa
// (deep link do OAuth do Google, permissões de notificação/alarme e placeholder do esquema).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const manifest = 'android/app/src/main/AndroidManifest.xml';
const gradle = 'android/app/build.gradle';
const props = 'android/gradle.properties';
if (!existsSync(manifest)) {
  console.error('Projeto android/ não encontrado. Rode: npx cap add android');
  process.exit(1);
}

let m = readFileSync(manifest, 'utf8');
if (!m.includes('${googleRedirectScheme}')) {
  m = m.replace(
    '</activity>',
    `    <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="\${googleRedirectScheme}" />
            </intent-filter>
        </activity>`,
  );
}
// USE_EXACT_ALARM (Android 13+) é concedida na instalação a apps de alarme/cronômetro; sem alarme exato,
// o Android 14+ adia a notificação até o aparelho sair do modo de economia (só toca ao desbloquear).
for (const p of ['POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM', 'USE_EXACT_ALARM', 'VIBRATE', 'WAKE_LOCK']) {
  if (!m.includes(`android.permission.${p}"`)) m = m.replace('</manifest>', `    <uses-permission android:name="android.permission.${p}" />\n</manifest>`);
}
writeFileSync(manifest, m);

let g = readFileSync(gradle, 'utf8');
if (!g.includes('googleRedirectScheme')) {
  g = g.replace(
    'versionName "1.0"',
    'versionName "1.0"\n        manifestPlaceholders = [googleRedirectScheme: (project.findProperty("googleRedirectScheme") ?: "com.googleusercontent.apps.CONFIGURE_ME")]',
  );
  writeFileSync(gradle, g);
}

let p = readFileSync(props, 'utf8');
if (!p.includes('googleRedirectScheme')) {
  p += '\n# Esquema de redirect do OAuth: com.googleusercontent.apps.<ID-do-cliente-Android-sem-.apps.googleusercontent.com>\ngoogleRedirectScheme=com.googleusercontent.apps.CONFIGURE_ME\n';
  writeFileSync(props, p);
}
console.log('android/ ajustado.');
