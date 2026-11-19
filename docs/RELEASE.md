# MediTrack Release Guide

## Environments

| Variant     | `APP_VARIANT` | EAS profile   | EAS environment | App ID suffix | Firebase project    |
| ----------- | ------------- | ------------- | --------------- | ------------- | ------------------- |
| Development | `development` | `development` | development     | `.dev`        | `meditrack-dev`     |
| Staging     | `staging`     | `preview`     | preview         | `.staging`    | `meditrack-staging` |
| Production  | `production`  | `production`  | production      | none          | `meditrack-prod`    |

The Firebase project names are suggestions; create your own. Each variant installs side by side.

## One-time setup

1. **Identifiers.** Set `APP_BUNDLE_ID` (for example `com.yourorg.meditrack`) in `.env.local` and in
   each EAS environment. It cannot change after the first store release.
2. **Expo project.** `npx eas-cli login`, then `npx eas-cli init`. Put the printed project ID in
   `EAS_PROJECT_ID` (needed for caregiver push).
3. **Firebase projects.** For each environment:
   - Create the project, add the Blaze plan (scheduled functions need it), and enable Email/Password
     sign-in and Firestore in production mode.
   - Register the Android and iOS apps with the variant's identifier and copy the web config values
     into the EAS environment as `EXPO_PUBLIC_FIREBASE_*`
     (`eas env:create --environment production --name EXPO_PUBLIC_FIREBASE_API_KEY --value …`).
   - Add the project to the CLI: `npx firebase use --add` (alias it `dev`, `staging`, or `prod`).
   - Apply security actions A1–A6 in `docs/SECURITY_REVIEW.md`.
4. **Deploy backend** (per project): `npx firebase deploy --only firestore,storage,functions -P prod`.
   The functions `predeploy` step compiles TypeScript first.
5. **Lockfile.** Keep `bun.lock` or `package-lock.json`, not both. EAS picks the package manager from
   the lockfile.

## Building

```sh
# Internal Android APK and iOS ad-hoc build against staging
npx eas-cli build --profile preview --platform all

# Store builds: Android App Bundle (AAB) and iOS archive; build numbers auto-increment
npx eas-cli build --profile production --platform all

# Submit to Google Play (internal track) and App Store Connect (TestFlight)
npx eas-cli submit --profile production --platform all
```

A development client (`--profile development`) is required for notification actions during
development. Expo Go does not support every notification feature used here.

## Local development

```sh
npm install          # or bun install
cp .env.example .env.local   # fill in dev Firebase values
npm run emulators    # optional: local Firestore/Auth/Functions; set EXPO_PUBLIC_FIREBASE_EMULATOR_HOST
npm start
```

## Release checklist

Complete for every store release. Items marked ✅ were verified on 2026-11-18; the rest need
the release owner.

### Code and tests

- [x] ✅ `npm run typecheck`, `npm run lint`, `npm run format` pass
- [x] ✅ `npm test` (87), `npm run test:functions` (12 + 5-zone parity), `npm run test:emulator` (47) pass
- [x] ✅ `npx expo prebuild` generates Android and iOS projects with the expected IDs, permissions, icons
- [ ] `npx expo-doctor` passes all checks (remove the unused lockfile first)
- [ ] Device test plan in `docs/TEST_REPORT.md` passed on Android and iOS hardware

### Configuration

- [ ] `APP_BUNDLE_ID` set to the organisation's identifier
- [ ] EAS project initialised; `EAS_PROJECT_ID` set in every EAS environment
- [ ] `EXPO_PUBLIC_FIREBASE_*` set per EAS environment; production values point at production
- [ ] `version` in `app.config.ts` bumped for the release (build numbers are remote and automatic)
- [ ] Firestore and Storage rules and functions deployed to production from this commit
- [ ] Firebase security actions A1–A6 applied in production

### Store readiness

- [ ] Privacy policy URL published (health data, caregivers, deletion, contact)
- [ ] Google Play Data safety form and Health apps declaration completed
- [ ] App Store privacy nutrition labels completed (health and fitness, contact info, identifiers)
- [ ] Store listing: screenshots, description, and a statement that MediTrack does not give medical advice
- [ ] Demo account (patient and caregiver) provided for app review
- [ ] In-app account deletion verified on a production build

### Go / no-go

- [ ] No open critical or high-severity issues
- [ ] Rollback plan: previous build available on each store track; Firestore PITR enabled
