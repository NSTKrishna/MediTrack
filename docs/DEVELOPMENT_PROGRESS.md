# MediTrack Development Progress

## Milestone 0 — Repository Inspection

Status: Milestone 0 complete. Milestone 1 implementation complete; automated verification blocked by dependency installation.

| Check                       | Result                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Master specification        | Reviewed: MediTrack React Native Development Specification, supplied 2026-11-18.                                           |
| Repository                  | Empty workspace; no Git metadata.                                                                                          |
| React Native / Expo         | Not initialized. No `package.json`, `app.json`, `app.config.*`, `babel.config.*`, or `metro.config.*`.                     |
| TypeScript                  | Not initialized. No `tsconfig.json`.                                                                                       |
| Dependencies                | None installed; no manifest or lockfile.                                                                                   |
| Screens / components        | None exist.                                                                                                                |
| Configuration at inspection | No environment template, linting, formatting, tests, CI, Firebase, or deployment configuration existed before Milestone 1. |

## Architecture recorded

- Feature-based React Native project structure.
- Expo Router routes separated from feature logic.
- Zustand state management.
- Firebase and device capabilities isolated behind service adapters.
- Milestone 1 uses typed mock data only; authentication, Firestore, and notifications are intentionally deferred.

## Milestone 1 readiness

The full implementation sequence, dependencies, expected boundaries, and verification gate are recorded in `docs/DEVELOPMENT_PLAN.md`.

## Milestone 1 implementation

- Added Expo Router app configuration, strict TypeScript, ESLint, Prettier, Jest, environment-template, and Git-ignore baselines.
- Added mock-only onboarding, login, registration, dashboard, medicine list, add-medicine, medicine-details, dose-history, inventory, caregiver, profile, and settings screens.
- Added reusable screen, button, and medicine-card components plus a medical-blue, soft-green, neutral design system.
- Added typed mock medicine and dose-history models, a minimal Zustand onboarding store, tab navigation, and a unit test for mock data integrity.
- Firebase, SecureStore, AsyncStorage, real notifications, persistence, role protection, and backend connectivity remain intentionally unimplemented, as required by the milestone sequence.

## Verification status

- Dependency installation was attempted through both npm and Bun with elevated registry access, but neither completed or produced project dependencies in this environment.
- `typecheck`, `lint`, `format`, and `test` cannot run until dependency installation succeeds. No test result is claimed.

## Approval gate

Approval to begin Milestone 1 and Milestone 2 was received on 2026-11-18.

## Milestone 2 implementation (in progress)

- Added Firebase client configuration, Auth and Firestore profile services, Firebase Auth session persistence, SecureStore session metadata, an Auth Zustand store, and authenticated-route redirection.
- Added password-reset UI and Firestore deny-by-default rules. Firebase project values and deployment are still required before live authentication can be exercised.

## Milestones 6–10 (2026-11-18)

Milestone 6 was completed before Milestone 7 began, as required: caregiver alerts depend on the
deterministic dose IDs and the inventory ledger introduced in Milestone 6.

### Environment note

The project sits in an iCloud-synced Desktop folder, and iCloud had evicted files in
`node_modules` (`compressed,dataless`), which made Jest and installs hang. That explains the
earlier "dependency installation did not complete" note. Verification was run from a copy of the
sources outside iCloud with a fresh install. See the README for the fix.

### Milestone 6 — Inventory: complete

- Taken doses deduct stock in the same Firestore transaction that records the dose
  (`src/services/firebase/doses.ts`). Dose IDs are `${medicineId}_${slotKey}`, so notification
  retries, repeated actions, and in-app taps cannot double-deduct.
- Notification Taken/Skip actions are stored in a durable on-device queue, then written; cold
  starts and offline taps are handled. Snooze keeps the original slot.
- Refill amount input with validation and idempotent operation IDs (`RefillForm`).
- Inventory history from the Firestore ledger on the Inventory and medicine-detail screens.
- Low-stock local notifications on the crossing change only; in-app low-stock banners.
- Rules make the ledger append-only and require every stock change to be backed by it.
- Emulator tests: idempotency, concurrent same-dose and different-dose confirmations, concurrent
  refills, and rule rejections (21 tests).

### Milestone 7 — Caregiver integration: complete

- Invitations by email with a 7-day expiry; acceptance requires a verified email and creates the
  care link atomically.
- Consent controls with the permission matrix and dependency enforcement (UI and rules).
- Caregiver dashboard, per-patient read-only view, alerts feed, and invitation inbox.
- Revocation by either party; access stops on the next read.
- Cloud Functions: low-stock alerts (Firestore trigger), missed-dose alerts (every 15 minutes, in
  the patient's time zone), Expo push with minimal payloads.
- Authorization and privacy tests (21 rules tests, 6 server alert tests).

### Milestone 8 — Reports and analytics: complete

- Daily, weekly, monthly, and custom-range reports from Firestore with taken, skipped, missed, and
  pending tallies; per-medicine and per-day adherence; missed-dose list; inventory history.
- PDF export via `expo-print` and the share sheet, with escaped HTML.
- Loading, error (with retry), empty, and future-range states. Caregivers see reports only when dose
  history is shared, and only for the collections they may read.

### Milestone 9 — Testing and security: complete except device testing

- 87 unit/component tests, 12 functions tests plus time-zone parity in 5 zones, and 47 emulator
  tests; all pass. Details in `docs/TEST_REPORT.md`.
- Security review in `docs/SECURITY_REVIEW.md`; six issues found and fixed, including caregiver
  sign-up being blocked by the rules, directly editable stock, and missing account deletion.
- **Not done:** real Android and iOS device testing (no devices or SDKs available here). A
  19-step device test plan is in the test report.

### Milestone 10 — Final release: complete except items needing accounts and devices

- Accessibility pass: contrast fixed to WCAG AA, screen-reader labels and announced alerts, 44pt
  targets, font scaling limits on buttons.
- Performance: one Firestore listener per collection per session (screens previously each added
  their own), bounded queries, `FlatList` for long lists, memoized rows and calculations.
- App icon, adaptive icon, notification icon, and splash screen.
- `app.config.ts` with development/staging/production variants; `eas.json` with APK (internal) and
  AAB (store) profiles; Android backups disabled; iOS privacy manifest.
- Missing native dependencies fixed; `expo-doctor` dependency checks pass; `expo prebuild`
  validated for both platforms.
- Release documentation: `docs/RELEASE.md` (guide and checklist), `docs/TEST_REPORT.md`, `README.md`.
- **Not done:** EAS builds, store submission, and production Firebase projects. These need an Expo
  account, an Apple developer team, and Firebase projects (see the release checklist).
