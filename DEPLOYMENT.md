# Team Calafdoon — Mobile App Deployment Guide

## Overview

The mobile app is built as a PWA (Progressive Web App) wrapped with Capacitor for native Android and iOS packaging. It shares the same database, users, authentication, chat, and payment system as the website — no separate backend.

## Architecture

```
TeamCalafdoon.com (website)  ←→  Supabase (database + auth + storage)
         ↕                              ↕
Mobile App (/m route)         ←→  Same Supabase backend
```

- **Website**: All existing routes (`/`, `/login`, `/dashboard`, `/chat`, `/admin`, etc.)
- **Mobile app**: `/m` route with bottom tab navigation (Home, Search, Messages, Notifications, Profile)
- **Shared backend**: Same Supabase project, same users, same data

## PWA (Progressive Web App)

The web app is installable on any phone without going through app stores:

- **Android**: Open `teamcalafdoon.com/m` in Chrome → menu → "Install app" or "Add to Home Screen"
- **iPhone**: Open `teamcalafdoon.com/m` in Safari → Share → "Add to Home Screen"

The PWA manifest is at `public/manifest.json` with standalone display mode, emerald theme color, and app icons.

---

## Android APK/AAB Build

### Prerequisites
- Android Studio (latest)
- JDK 17+

### Steps

1. **Build web assets and sync to native:**
   ```bash
   npm run cap:sync
   ```

2. **Open in Android Studio:**
   ```bash
   npm run cap:open:android
   ```

3. **In Android Studio:**
   - Wait for Gradle sync to complete
   - To build APK: `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
   - To build AAB (for Play Store): `Build` → `Generate Signed Bundle / APK` → `Android App Bundle`
   - Sign with your keystore when prompted

4. **Output locations:**
   - APK: `android/app/build/outputs/apk/debug/app-debug.apk`
   - AAB: `android/app/build/outputs/bundle/release/app-release.aab`

### Play Store Submission
- Upload the `.aab` file to Google Play Console
- App ID: `com.teamcalafdoon.app`
- Fill in store listing, screenshots, privacy policy
- Target API level: 34+ (as required by Google Play)

---

## iOS Build

### Prerequisites
- macOS with Xcode 15+
- Apple Developer account ($99/year)

### Steps

1. **Build web assets and sync to native:**
   ```bash
   npm run cap:sync
   ```

2. **Open in Xcode:**
   ```bash
   npm run cap:open:ios
   ```

3. **In Xcode:**
   - Select your team (Apple Developer account)
   - Set Bundle Identifier: `com.teamcalafdoon.app`
   - Set version number and build number
   - To build: `Product` → `Archive`
   - Then use Organizer to upload to App Store Connect

4. **App Store Connect:**
   - Create a new app with the same bundle ID
   - Upload the archive
   - Fill in App Store listing, screenshots, privacy policy
   - Submit for review

### Permissions (already configured in Info.plist)
- Camera: "Team Calafdoon needs camera access so you can take profile photos and upload payment screenshots."
- Photo Library: "Team Calafdoon needs photo library access so you can select profile photos and payment screenshots."
- Microphone: "Team Calafdoon needs microphone access for voice messages and voice calls."

---

## Native App Icons

Icons are generated from `resources/icon.png` (1024x1024 source).

To regenerate icons after changing the source:
```bash
npm run assets:generate
```

This creates:
- Android: adaptive launcher icons in all density buckets
- iOS: AppIcon.appiconset with all required sizes
- iOS: Splash screen images

---

## Development Workflow

### Making changes to the mobile app

1. Edit files in `src/mobile/`
2. Run `npm run build` to rebuild web assets
3. Run `npx cap sync` to copy to native projects
4. Run the app in Android Studio or Xcode

### Making changes to the website

- Edit files in `src/pages/` and `src/components/` as before
- The mobile app at `/m` is completely separate — website changes don't affect it

### Testing on a physical device

**Android:**
- Enable USB debugging on your phone
- Connect via USB
- In Android Studio, select your device and click Run

**iOS:**
- Connect your iPhone via USB
- In Xcode, select your device and click Run
- Trust the developer certificate on your phone: Settings → General → VPN & Device Management

---

## Important Notes

- **No data changes**: The mobile app uses the exact same Supabase database. No migrations needed.
- **Same users**: Existing users log in with the same email and password.
- **Same payment system**: The $1 chat unlock and registration payment work identically.
- **Admin Panel**: Admin continues to work on the website. The mobile app is user-facing only.
- **Service Worker**: Push notifications for incoming calls work in the PWA. In native apps, the Capacitor push notification plugin handles this.

## Capacitor Configuration

See `capacitor.config.ts` for:
- App ID: `com.teamcalafdoon.app`
- App name: `Team Calafdoon`
- Splash screen: emerald background, 2 second display
- Status bar: light style, emerald background
- Web directory: `dist` (Vite build output)
