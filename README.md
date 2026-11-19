# MediTrack

Medication reminders, dose tracking, inventory, caregiver sharing, and adherence reports.
Expo (React Native) + TypeScript, Firebase Auth, Cloud Firestore, and Cloud Functions.

## Quick start

```sh
bun install                      # or npm install
cp .env.example .env.local       # add your Firebase web config
npm start                        # use a development build for notification actions
```

## Scripts

| Command                  | What it does                                                                      |
| ------------------------ | --------------------------------------------------------------------------------- |
| `npm test`               | Unit and component tests                                                          |
| `npm run test:functions` | Cloud Functions logic, including client/server time-zone parity                   |
| `npm run test:emulator`  | Security rules, transactions, and functions against the emulator (needs Java 21+) |
| `npm run test:all`       | Everything above plus typecheck and lint                                          |
| `npm run emulators`      | Local Firebase emulators with the UI on port 4000                                 |

## Project layout

```text
app/                 Expo Router screens
src/features/        Domain logic and feature UI (doses, inventory, caregivers, reports, …)
src/services/        Firebase and notification adapters
src/store/           Zustand stores
functions/           Cloud Functions (caregiver alerts, account deletion)
firestore.rules      Security rules — the authorization boundary
tests/               Unit, component, and emulator tests
docs/                Architecture, security review, release guide, test report
```

## Documentation

- [Architecture and data model](docs/ARCHITECTURE.md)
- [Security review](docs/SECURITY_REVIEW.md)
- [Release guide and checklist](docs/RELEASE.md)
- [Test report and device test plan](docs/TEST_REPORT.md)
- [Development progress](docs/DEVELOPMENT_PROGRESS.md)

## Note for macOS users

If this folder is inside an iCloud-synced Desktop or Documents folder, iCloud can evict files in
`node_modules`, which makes Jest, Metro, and installs hang. Keep the project outside iCloud, or
exclude `node_modules` from syncing.
