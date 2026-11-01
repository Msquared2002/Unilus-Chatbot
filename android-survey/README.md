# Silverest Survey Android app

This is a private, foreground-only Android WebView wrapper for the existing survey page. It packages the page, JavaScript, campus boundary, buildings, destinations, place catalog and current service-road graph inside the APK. No server, USB cable, laptop or internet connection is needed during field surveying. No satellite imagery or external map tiles are packaged.

The app uses an HTTPS app-asset origin intercepted inside the APK. The manifest has fine and coarse foreground location permissions, with no internet or background location permission. Android asks for location when a survey starts or an entrance/gate is measured. The screen stays on while a walkway recording is active. Leaving the app pauses that recording and releases the screen flag. Keep the app foreground while measuring an entrance/gate.

## Build

Requirements: JDK 17 or newer and Android SDK Platform 35 with Build Tools 35. The included Gradle wrapper downloads Gradle 8.13 and Android Gradle Plugin 8.13.1 on the first build. Set `ANDROID_HOME` to your Android SDK directory (or create an untracked `local.properties` here with `sdk.dir=...`). From `android-survey` in PowerShell:

```powershell
.\gradlew.bat :app:assembleDebug
```

The APK is `app/build/outputs/apk/debug/app-debug.apk`. The Gradle `bundleSurveyAssets` task copies the current shared survey files and campus data into the APK at build time. Rebuild after changing those files. A first build needs network access to download the Android Gradle Plugin; the installed app does not use network.

## Install and use

Transfer `app-debug.apk` to the Android phone and open it there, allowing installation from that source when Android asks. USB is not needed for field use. For a development install with USB, run `adb install -r app/build/outputs/apk/debug/app-debug.apk`.

Open **Silverest Survey**. Select a walkway type, then tap **Start walkway**. Keep the survey screen open while walking; tap **Pause**, **Resume**, **Finish walkway**, or **Cancel walkway** as needed. To measure an entrance or gate, choose the canonical place and tap **Mark Entrance** or **Mark Gate**, then **Save measured point**. The app only requests GPS during those actions.

Tap **Export Survey** after finishing the walkway. Android's document picker lets you save `silverest-survey-YYYY-MM-DD-NN.json` on the phone; it then offers to share that same file to another app or device. Keep a copy of the JSON before starting a new session. The JSON uses the same schema as the desktop survey tool and processor.

Later, on the laptop, from `backend`:

```powershell
npm run campus:survey:process -- "C:\path\to\silverest-survey-2026-10-11-01.json"
```

Review the generated folder before any explicit production promotion. The Android app cannot modify production routing files.
