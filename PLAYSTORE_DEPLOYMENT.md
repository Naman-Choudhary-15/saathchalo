# SAATHCHALO — Google Play Store Deployment Guide
## Production Release Candidate Build & Submission

This guide provides the complete, authoritative process for packaging, signing, and deploying the **SAATHCHALO** Android application to the **Google Play Store**.

---

### 1. Application Identity & Specifications

| Parameter | Value |
| :--- | :--- |
| **App Name** | SAATHCHALO |
| **Package ID / Application ID** | `com.saathchalo.app` |
| **Version Code** | `100` |
| **Version Name** | `1.0.0-rc` |
| **Target SDK** | `34` (Android 14) / `35` (Android 15) |
| **Minimum SDK** | `22` (Android 5.1 Lollipop) |
| **Architecture** | Capacitor Web Hybrid (Zero Localhost, Zero Temporary Tunnels) |

---

### 2. Prerequisites & Environment Setup

Building the signed release Android App Bundle (`.aab`) requires:
1. **Java Development Kit (JDK)**: JDK 17 or JDK 21 (`java -version`).
2. **Android Studio & SDK**: Android SDK Platform 34/35, Android SDK Command-line Tools, CMake.
3. **Environment Variables**:
   ```bash
   export ANDROID_HOME=$HOME/Android/Sdk
   export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
   export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
   ```

---

### 3. Capacitor Android Project Generation

From the repository root:

```bash
# 1. Install Capacitor dependencies
npm install @capacitor/core@latest @capacitor/cli@latest @capacitor/android@latest

# 2. Add Android Platform
npx cap add android

# 3. Synchronize Web Assets & Plugins
npx cap sync android
```

The configuration is declared in [`capacitor.config.json`](./capacitor.config.json):
```json
{
  "appId": "com.saathchalo.app",
  "appName": "SAATHCHALO",
  "webDir": ".",
  "bundledWebRuntime": false,
  "server": {
    "androidScheme": "https",
    "cleartext": false
  }
}
```

---

### 4. Release Keystore Generation

Generate a cryptographically secure 2048-bit RSA key for Play Store app signing:

```bash
keytool -genkey -v -keystore saathchalo-release-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias saathchalo \
  -storepass YOUR_SECURE_PASSWORD \
  -keypass YOUR_SECURE_PASSWORD \
  -dname "CN=SAATHCHALO, OU=Engineering, O=SaathChalo, L=Greater Noida, ST=Uttar Pradesh, C=IN"
```

> [!CAUTION]
> Back up `saathchalo-release-key.jks` in a secure vault (e.g. AWS Secrets Manager or Google Cloud Secret Manager). If the signing keystore is lost, Google Play Console will not permit updating existing app installs unless Play App Signing is enrolled.

---

### 5. Configure Gradle Signing in `android/app/build.gradle`

In `android/app/build.gradle`, configure the release signing config:

```groovy
android {
    namespace "com.saathchalo.app"
    compileSdkVersion 34

    defaultConfig {
        applicationId "com.saathchalo.app"
        minSdkVersion 22
        targetSdkVersion 34
        versionCode 100
        versionName "1.0.0"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        release {
            storeFile file("saathchalo-release-key.jks")
            storePassword System.getenv("KSTORE_PASS") ?: "YOUR_SECURE_PASSWORD"
            keyAlias "saathchalo"
            keyPassword System.getenv("KEY_PASS") ?: "YOUR_SECURE_PASSWORD"
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

---

### 6. Google Maps Android API Key Configuration

In Google Cloud Console:
1. Navigate to **APIs & Services > Credentials**.
2. Select your Google Maps API Key or create a dedicated Android key.
3. Under **Application restrictions**, select **Android apps**.
4. Click **Add an item** and enter:
   - Package name: `com.saathchalo.app`
   - SHA-1 certificate fingerprint:
     ```bash
     keytool -list -v -keystore saathchalo-release-key.jks -alias saathchalo
     ```
5. In `android/app/src/main/AndroidManifest.xml`, declare:
   ```xml
   <meta-data
       android:name="com.google.android.geo.API_KEY"
       android:value="@string/google_maps_key" />
   ```

---

### 7. Android Permissions & Network Security

In `android/app/src/main/AndroidManifest.xml`:

```xml
<!-- Network & Realtime SSE -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Location: Geolocation & Live Mobility Map -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

---

### 8. Build Signed Release AAB (Android App Bundle)

```bash
cd android
./gradlew bundleRelease
```

The signed Android App Bundle is generated at:
`android/app/build/outputs/bundle/release/app-release.aab`

For manual device testing via ADB:
```bash
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
adb install app-release.apk
```

---

### 9. Google Play Console Submission Checklist

- [x] **App Content & Privacy Policy**:
  - URL: `https://your-domain.com/#privacyModal` or dedicated policy page.
  - Documented data practices: Geolocation (rides & map), Profile (name, email).
- [x] **Account Deletion (Section 83 requirement)**:
  - In-app endpoint implemented: `DELETE /api/auth/account`.
  - Accessible via Profile Modal -> Account Management -> Delete Account.
- [x] **Data Safety Form**:
  - Location: Collected only when app is in foreground for pooling and vehicle matching.
  - Personal Info: Name, Email (for account creation & login).
  - Data transfer: All transit encrypted via HTTPS/TLS 1.3.
- [x] **App Access / Reviewer Credentials**:
  - Test Account Email: `aditya@saathchalo.com`
  - Password: `[Provided in reviewer notes]`
