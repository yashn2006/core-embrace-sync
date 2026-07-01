# Native iOS + Android (Capacitor)

The web app is wrapped with Capacitor so it can ship as a real iOS/Android app on the App Store and Play Store — same code, same login, same real-time Supabase data.

## One-time setup (on your Mac / PC)

```bash
# 1) Pull the project from GitHub
git clone <your-repo> && cd <repo>
bun install

# 2) Build the web bundle Capacitor will wrap
bun run build

# 3) Add the native platforms
bunx cap add ios
bunx cap add android

# 4) Copy the built web assets into the native shells
bunx cap sync
```

## Icons + splash

Drop a **1024×1024 PNG** logo and a **2732×2732 PNG** splash into `resources/`, then:

```bash
bun add -d @capacitor/assets
bunx capacitor-assets generate --iconBackgroundColor '#ffffff' --splashBackgroundColor '#ffffff'
```

This generates every required icon + splash size for iOS and Android automatically.

## Run it

```bash
bunx cap open ios       # opens Xcode — hit Run
bunx cap open android   # opens Android Studio — hit Run
```

## Live updates

`capacitor.config.ts` points `server.url` at the deployed web app, so every time you publish on Lovable the native apps pick up the new UI on next launch — no App Store re-submission needed for UI changes. Only Capacitor plugin changes (push, camera, etc.) require a rebuild.

## Push notifications on iOS + Android

Web Push (already wired) works while the browser is running. To get **true background push on a locked phone**, the native shell uses APNS (iOS) and FCM (Android) via `@capacitor/push-notifications`:

1. **iOS**: enable the **Push Notifications** and **Background Modes → Remote notifications** capabilities in Xcode, and upload your APNs auth key to Firebase.
2. **Android**: drop `google-services.json` from your Firebase project into `android/app/`.
3. On login, the app calls `PushNotifications.register()` and stores the returned device token in the `push_subscriptions` table (a new row per device — `native_ios` / `native_android` platform).
4. The existing `push_notifications_queue` cron already fans out reminders; add an FCM/APNs sender for rows whose subscription is native. (Web rows keep using VAPID.)

**Answer to "will notifications reach the phone when the app is off?"** — yes, once the native build is installed and APNs/FCM tokens are registered. Web push only fires while the browser process is alive; the native wrapper fixes that.

## Offline-friendly behavior

- Assets are bundled inside the app, so the shell always loads instantly.
- TanStack Query cache + Supabase realtime reconnect resume automatically when the network returns.
- Lead edits made offline should be queued via optimistic updates (already used for status/progress) and reconciled on reconnect.