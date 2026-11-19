# MediTrack Final Test Report

Date: 2026-11-18. Build: 1.0.0 (1). Expo SDK 54, React Native 0.81.5, Firebase JS SDK 13.4.

## Automated results

All suites were run on 2026-11-18 on macOS (Node 22.23, Java 25, Firestore emulator 1.22.0).

| Suite                                    | Command                                              | Result                          |
| ---------------------------------------- | ---------------------------------------------------- | ------------------------------- |
| Type checking (app)                      | `npm run typecheck`                                  | Pass                            |
| Type checking and build (functions)      | `npm --prefix functions run build`                   | Pass                            |
| Lint                                     | `npm run lint`                                       | Pass (0 errors, 0 warnings)     |
| Formatting                               | `npm run format`                                     | Pass                            |
| Unit and component tests                 | `npm test`                                           | 87 / 87 pass (11 suites)        |
| Cloud Functions unit tests + TZ parity   | `npm run test:functions`                             | 12 / 12 pass, parity in 5 zones |
| Firestore rules, transactions, functions | `npm run test:emulator`                              | 47 / 47 pass (4 suites)         |
| Expo dependency checks                   | `npx expo-doctor`                                    | 17 / 18 (see note)              |
| Native project generation                | `npx expo prebuild`                                  | Pass for Android and iOS        |
| Functions load in emulator               | `firebase emulators:exec --only functions,firestore` | All 3 functions register        |

`expo-doctor` reports one warning: the repository has both `bun.lock` and `package-lock.json`.
Both are in sync; keep the one for your chosen package manager before using EAS Build.

## Coverage by area

| Area                        | What is tested                                                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                        | Error messages do not reveal whether an account exists; profile role/email immutable (rules)                                                                                                                    |
| Schedules                   | Time parsing, weekday/date-range/creation-time rules, DST-aware server conversion, client/server parity                                                                                                         |
| Reminders                   | Trigger building, reconciliation (schedule, reschedule, cancel), permission and disabled states, sign-out                                                                                                       |
| Notification actions        | Body tap never records; Taken/Skip queued once per response; snooze keeps the slot; offline retry; cross-account protection; low-stock alert after a queued dose                                                |
| Dose tracking               | Deterministic IDs; skip→taken upgrade; taken is final; dose state never inferred from time passing                                                                                                              |
| Inventory                   | Exactly one deduction per taken dose; no negatives; refills idempotent per operation; low-stock crossing only on the crossing change                                                                            |
| Concurrency and idempotency | 6 clients confirming the same dose → 1 deduction; 6 concurrent different doses → consistent chained ledger; concurrent refills and doses → no lost updates                                                      |
| Caregiver permissions       | All 32 permission states × 5 toggles satisfy the rules; invitations, verified-email acceptance, forged links, escalation, consent changes, revocation, re-invitation, read-only enforcement, alert immutability |
| Caregiver alerts (server)   | Low-stock and missed-dose alerts go only to active, permitted caregivers, once; no alert before the grace period or for recorded/inactive doses; push payload carries no medicine names                         |
| Reports                     | Calendar ranges, custom-range validation, taken/skipped/missed/pending tallies, deleted medicines, inventory summary, HTML escaping                                                                             |
| Components                  | Refill form (validation, retry reuses operation ID), permission toggles, dose row actions, state views                                                                                                          |
| Account deletion            | Profile, all sub-collections, care links, and invitations removed; other users untouched                                                                                                                        |

## Not yet verified

These need hardware, accounts, or credentials that were not available in this environment:

1. **Real-device testing on Android and iOS.** No device, Android SDK, or Xcode was available. Use
   the device test plan below on at least one current Android device (Android 14+) and one iPhone
   (iOS 17+) using EAS development or preview builds.
2. **EAS builds (APK/AAB/IPA).** Configuration is complete and native projects generate cleanly, but
   no build was run; it requires an Expo account (`eas init`) and, for iOS, an Apple developer team.
3. **Live Firebase projects.** No dev, staging, or production project exists yet. Rules and functions
   were tested only in the emulator. Scheduled functions require the Blaze plan.
4. **Push delivery to caregivers.** Requires an EAS project ID and physical devices.

## Device test plan

Run on each platform. Record device model, OS version, build, and pass/fail.

| #   | Scenario                                                                  | Expected                                                                |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Sign up as patient; add a medicine with a time 2 minutes ahead            | Permission prompt once; reminder arrives on time with Taken/Snooze/Skip |
| 2   | Tap **Taken** from the lock screen with the app killed                    | App opens; dose shows Taken; stock −1; one ledger entry                 |
| 3   | Tap **Taken** in airplane mode, then reconnect                            | "Will sync" banner; after reconnecting, exactly one deduction           |
| 4   | Tap the notification body (not a button)                                  | App opens; nothing recorded                                             |
| 5   | **Snooze**                                                                | Reminder returns in 10 minutes; Taken then records the original slot    |
| 6   | Confirm the same dose from the app after confirming from the notification | Shows Taken; no second deduction                                        |
| 7   | Take doses until stock reaches the threshold                              | One low-stock notification at the crossing, not on later doses          |
| 8   | Record a refill of 45                                                     | Stock +45; history shows the refill                                     |
| 9   | Reboot the device                                                         | Reminders still fire                                                    |
| 10  | Change device time zone                                                   | Reminders follow local time; profile time zone updates on next open     |
| 11  | Turn on **Discreet notifications**                                        | No medicine names on the lock screen                                    |
| 12  | Invite a caregiver; caregiver signs up, verifies email, accepts           | Caregiver sees only the permitted sections                              |
| 13  | Patient turns off a permission while the caregiver has that screen open   | Section disappears or "Access removed" shows                            |
| 14  | Leave a dose unconfirmed for 2 hours (caregiver has missed-dose alerts)   | Caregiver receives one push and one in-app alert                        |
| 15  | Export a weekly report as PDF and share it                                | PDF opens with correct totals                                           |
| 16  | VoiceOver / TalkBack through Today, Inventory, Care, Reports              | All controls labelled; alerts announced; no unlabelled buttons          |
| 17  | Largest system font size                                                  | Text wraps without clipping; buttons remain usable                      |
| 18  | Delete account                                                            | Requires password; data removed; caregivers lose access                 |
| 19  | Sign out                                                                  | Reminders stop on the device                                            |
