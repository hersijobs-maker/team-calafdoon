# Build Android APK via GitHub Actions

This project includes automated cloud builds. You do NOT need Android Studio or any local tools.

## Quick Start

1. **Push to GitHub** — Create a new repository on GitHub and push this project:
   ```
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. **Automatic build** — Every push to `main` triggers a debug APK build automatically.

3. **Download the APK** — Go to your GitHub repo page:
   - Click the **Actions** tab
   - Click the latest **Build Android APK** run
   - Scroll down to **Artifacts**
   - Download **team-calafdoon-apk**

The file is `app-debug.apk`. Transfer it to your Android phone and install it.

## Manual Build (if you want to trigger it yourself)

1. Go to the **Actions** tab in your GitHub repo
2. Select **Build Android APK** from the left sidebar
3. Click **Run workflow** button (top right)
4. Choose the `main` branch and click **Run workflow**
5. Wait ~5 minutes, then download the artifact

## Release APK (for Play Store or distribution)

1. Go to **Actions** tab
2. Select **Build Release APK**
3. Click **Run workflow**
4. If you have a signing keystore, provide it as base64. If not, leave blank for an unsigned release APK.
5. Download **team-calafdoon-release-apk** artifact

## Installing the APK on your phone

1. Transfer the `.apk` file to your Android phone (via USB, email, Google Drive, etc.)
2. Open the file on your phone
3. If prompted, enable **Install from unknown sources** in Settings
4. Tap **Install**
5. Open **Team Calafdoon** from your app drawer

## Requirements

- A GitHub account (free)
- No local development tools needed
- The build runs on GitHub's cloud servers (Ubuntu + Java 21 + Gradle)
- Build time: approximately 5-8 minutes
- APK artifacts are kept for 30 days (debug) or 90 days (release)
