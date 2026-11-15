# MediTrack Development Plan

## Milestone 0 — Discovery and foundation planning

Status: complete.

Completed:

- Inspected the workspace: it is empty and is not currently a Git repository.
- Confirmed that no runtime, application code, dependencies, environment configuration, test setup, or CI configuration exists.
- Reviewed the MediTrack React Native Development Specification.
- Produced the architecture baseline and progress record.

## Milestone 1 — Foundation setup (exact execution sequence after specification review)

Milestone 1 implements UI/UX only, using mock data. It must not connect Firebase, schedule real notifications, or implement persistence and authorization.

1. Initialize an Expo-managed React Native application with TypeScript and Expo Router; configure strict TypeScript, Expo app metadata, linting, formatting, test runner, and `.env.example` without credentials.
2. Add the required runtime dependencies: Expo Router, Zustand, React Native-safe UI utilities, and the project test tooling. Defer Firebase, notifications, SecureStore, and AsyncStorage integration to the milestones that use them, unless Expo template requirements install them transitively.
3. Establish `app/`, `src/components`, `src/features`, `src/constants`, `src/types`, `src/store`, `src/hooks`, `src/utils`, `assets/`, and `tests/`; leave services and unimplemented feature folders absent until needed.
4. Define a medical-blue/soft-green/light-neutral design token set, typography scale, spacing scale, card styles, touch targets, and accessible color contrast conventions using `StyleSheet`.
5. Build reusable common, form, card, and navigation components with loading, empty, validation, and error presentation states.
6. Implement splash and onboarding routes, with mock-only onboarding completion state.
7. Implement mock-only login and registration screens; no authentication service or credentials.
8. Implement dashboard, medicine list, add medicine, medicine details, dose history, inventory, caregiver dashboard, profile, and settings screens using typed mock models and feature-local mock data.
9. Compose Expo Router route groups for onboarding/authenticated flows and tab navigation. Visual route protection is temporary and must be replaced by Firebase-backed protection in Milestone 2.
10. Add unit/component tests for design primitives, navigation route availability, forms, and mock data transformations; run TypeScript, lint, format, and relevant tests; correct failures.
11. Update `DEVELOPMENT_PROGRESS.md` with files, commands, results, known constraints, and a Milestone 1 completion report. Stop for approval before Milestone 2.

## Risks to resolve before Milestone 1

- Medication reminders are safety-sensitive; background JavaScript timers are not reliable and must not be used for reminder delivery.
- Expo Notifications may not meet exact-alarm, device-restart, or action-handling requirements on every platform; a development build/native module decision may be required in Milestone 4.
- Firebase client configuration is public by design, but service-account credentials and other secrets must never enter the repository.
- Firestore rules and Cloud Functions must enforce patient/caregiver authorization; client-side route guards alone are insufficient.
- Inventory changes require idempotency and Firestore transactions to prevent duplicate deductions or concurrent-update errors.
- iOS and Android notification permissions, channels, time zones, and OS battery controls require real-device verification.
