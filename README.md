# Ciclos de Estudo

App (web/PWA + Android) para controlar o **ciclo de estudos** de concursos: matérias, ciclos, cronômetro com alarme, histórico e dashboard.

- **Stack:** React + TypeScript + Vite · **SQLite** (sql.js/WASM) · Capacitor (Android) · PWA offline
- **Conta:** login com Google (SSO). **Sincronização:** o próprio arquivo SQLite é salvo na pasta privada do app no Google Drive (`appDataFolder`).

## Funcionalidades

- Cadastro de **matérias** (com cor) e de **vários ciclos**; cada ciclo é uma lista ordenada de etapas (matéria + minutos). A mesma matéria pode aparecer em várias etapas; há o total por matéria.
- **Cronômetro** por etapa, regressivo (até zero) ou progressivo (até a meta) — configurável. **Alarme** ao terminar (som + vibração; no Android também notificação agendada, que toca com a tela apagada).
- **Pausar/continuar** com um toque, **cancelar** (descarta) e **parar e salvar** (registra o progresso parcial, como "Falta: 39m 45s").
- Ao concluir todas as etapas, a volta fecha e **uma nova volta começa automaticamente**.
- **Histórico** de sessões (filtro por matéria, anotações, registro manual, exportação CSV).
- **Dashboard:** hoje × meta diária, sequência de dias, horas/dia (14 dias), tempo por matéria (7d/30d/tudo), progresso da volta atual, voltas concluídas e duração média.
- O cronômetro sobrevive a recarregar a página/fechar o app (é calculado por timestamps).
- Extras além do pedido: meta diária, sequência, anotação ao fim da sessão, registro manual, CSV, modo escuro, tela ligada durante o estudo.

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # timer, estatísticas e merge de sincronização
npm run build      # build de produção (dist/)
```

Sem `VITE_GOOGLE_CLIENT_ID` o app oferece **modo local** (sem login/sync), útil para desenvolvimento.

## Configurar o login Google + Drive

No [Google Cloud Console](https://console.cloud.google.com/): crie um projeto, ative a **Google Drive API**, configure a tela de consentimento (escopo `drive.appdata`, que não é sensível) e crie dois clientes OAuth:

1. **Aplicativo da Web** → origens JavaScript autorizadas: `http://localhost:5173` e o domínio de produção.
2. **Android** → package `app.ciclos.estudos` + SHA-1 da chave de assinatura (debug e release).

Copie `.env.example` para `.env` e preencha `VITE_GOOGLE_CLIENT_ID` (web) e `VITE_GOOGLE_ANDROID_CLIENT_ID` (Android).

## Android

```bash
# edite android/gradle.properties:
#   googleRedirectScheme=com.googleusercontent.apps.<ID do cliente Android, sem ".apps.googleusercontent.com">
npm run android:sync    # build web + cap sync + aplica ajustes no projeto Android
npx cap open android    # abre no Android Studio para gerar o APK/AAB
```

No Android o login usa OAuth2 + PKCE pelo navegador do sistema (o Google bloqueia login em WebView), com redirect por deep link e refresh token para renovar o acesso sem pedir login de novo.

## Como a sincronização funciona

Toda tabela sincronizada tem `id` (UUID), `updated_at` e `deleted` (exclusão lógica). A cada mudança (e ao abrir/voltar online) o app: baixa o `ciclos.sqlite` do Drive → mescla linha a linha (vence o `updated_at` mais recente; exclusões propagam) → salva local → envia o arquivo mesclado. As voltas têm id determinístico (`<ciclo>:<n>`), então dois dispositivos que fecham a mesma volta não duplicam. O cronômetro em andamento é **local** a cada dispositivo (não sincroniza).

## Estrutura

```
src/db      schema, SQLite (sql.js + IndexedDB), repositório, merge
src/core    cronômetro (puro/testável), controlador, alarme, estatísticas
src/auth    login Google (web: GIS · Android: PKCE)
src/sync    Drive appDataFolder + orquestração de sync
src/ui      telas
android/    projeto Capacitor
```

## Deploy (GitHub Pages)

O workflow `.github/workflows/deploy.yml` roda os testes, builda com `BASE_PATH=/<repo>/` e publica em `https://<usuario>.github.io/<repo>/` a cada push na `main`.

1. Settings → Pages → **Source: GitHub Actions**.
2. Settings → Secrets and variables → Actions → **Variables**: crie `VITE_GOOGLE_CLIENT_ID`.
3. No Google Cloud, adicione `https://<usuario>.github.io` às origens JavaScript autorizadas do cliente Web.
