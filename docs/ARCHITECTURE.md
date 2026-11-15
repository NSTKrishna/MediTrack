# MediTrack Architecture Baseline

## Status

Milestones 0–10 are implemented (see `DEVELOPMENT_PROGRESS.md`). This document describes the
architecture as built; sections below the data model record the original baseline.

## Data model (Cloud Firestore)

```text
users/{uid}                              profile: email, displayName, role, timeZone
  medicines/{medicineId}                 schedule, stock (remainingStock), lastInventoryTxId
  doses/{medicineId}_{slotKey}           one per scheduled dose: outcome taken|skipped, stockDeducted
  inventoryTransactions/{txId}           append-only ledger: dose_{doseId} | refill_{opId}
  alerts/{alertId}                       caregiver alerts (written by Cloud Functions only)
  pushTokens/{tokenId}                   Expo push tokens for this user's devices
invitations/{id}                         patient → invitee email, permissions, expiresAt, status
careLinks/{patientId}_{caregiverId}      permissions, status active|revoked
```

`slotKey` is the scheduled instant in UTC, `YYYYMMDDTHHmmZ`. Because the dose ID is derived from
the medicine and the slot, every path that confirms a dose (notification action, retry, in-app tap,
another device) resolves to the same document.

## Dose confirmation and inventory

`confirmDose` runs one Firestore transaction that reads the dose and the medicine, then writes the
dose, the stock decrement, and the ledger entry `dose_{doseId}` together. A taken dose is final;
a skipped dose may later be confirmed as taken. Stock never goes below zero: a taken dose with no
stock is recorded with `stockDeducted: false`. Refills use a client-generated operation ID that is
reused on retry. The security rules require every stock change to chain exactly from the stored
value through a new ledger entry, so concurrent writers cannot lose updates; the client re-runs a
transaction that loses a race (`withContentionRetry`).

## Notifications

Repeating local reminders carry `{userId, medicineId, hour, minute}`. The slot is that clock time on
the delivery day, so a late tap still confirms the right dose. Taken and Skip actions are written to
a durable on-device queue first, then to Firestore, so cold starts and offline taps are not lost.
Opening or dismissing a notification never records anything. Reminders are reconciled with the
medicine list whenever it changes or the app returns to the foreground.

## Caregiver permission matrix

| Permission         | Grants read access to                           | Requires          |
| ------------------ | ----------------------------------------------- | ----------------- |
| `viewMedicines`    | `medicines` (names, doses, times, stock values) | —                 |
| `viewDoseHistory`  | `doses`                                         | —                 |
| `viewInventory`    | `inventoryTransactions`                         | `viewMedicines`   |
| `missedDoseAlerts` | push and in-app alerts for missed doses         | `viewDoseHistory` |
| `lowStockAlerts`   | push and in-app alerts at the refill point      | `viewInventory`   |

Caregivers never write patient data, cannot read the patient's profile, alerts, or push tokens, and
cannot change their own permissions. Only the patient changes permissions; either party can revoke.

## Cloud Functions

| Function                        | Trigger                       | Purpose                                           |
| ------------------------------- | ----------------------------- | ------------------------------------------------- |
| `onInventoryTransactionCreated` | ledger entry created          | Low-stock alerts to permitted caregivers          |
| `detectMissedDoses`             | every 15 minutes              | Missed-dose alerts (2 h grace, patient time zone) |
| `deleteMyAccount`               | callable, recent sign-in only | Deletes the user's data, links, and Auth account  |

Alert document IDs are deterministic (`lowstock_{txId}`, `missed_{doseId}`), so overlapping scans
and retried triggers send at most one alert per event per caregiver.

## Governing specification

The React Native Development Specification supplied on 2026-11-18 is the governing scope. This document translates its architecture requirements into the proposed project structure.

## Target architecture

MediTrack is an Expo-managed React Native mobile application written in strict TypeScript. It uses Expo Router for route composition, Zustand for client state, Firebase Authentication and Cloud Firestore for identity and data, Cloud Functions for trusted server-side operations, Expo Notifications for local reminders, SecureStore for sensitive session-related data, and AsyncStorage for non-sensitive preferences.

Use a feature-based design with screens confined to presentation and orchestration. Feature services, hooks, store slices, and Firebase/notification adapters hold business and infrastructure concerns:

```text
Expo Router screens
        |
        v
feature components + hooks
        |
        v
feature services + Zustand stores
        |                         |
        v                         v
Firebase adapters          notification / local-storage adapters
        |
        v
Firebase Auth, Firestore, Cloud Functions
```

## Engineering principles

- Treat health and personally identifiable information as sensitive by default.
- Enforce least-privilege, role-based authorization at the server boundary.
- Keep audit trails for security-relevant and clinical-data changes.
- Isolate Firebase, notification, and device-storage access behind adapters.
- Use strict TypeScript, automated tests, and environment-specific configuration from the first implementation milestone.
- Store secrets outside source control and provide a checked-in example configuration only.

## Proposed repository layout

```text
MediTrack/
  app/                   # Expo Router routes only
    (auth)/
    (tabs)/
    medicine/
    caregiver/
  src/
    components/
      common/
      forms/
      cards/
      navigation/
    features/            # feature-specific UI, hooks, services, and state
      auth/
      dashboard/
      medicines/
      reminders/
      dose-tracking/
      inventory/
      caregivers/
      reports/
      profile/
    services/
      firebase/
      notifications/
      storage/
    hooks/
    store/
    navigation/
    constants/
    types/
    utils/
  assets/
    images/
    icons/
    fonts/
  infrastructure/
    firebase/            # rules, indexes, emulators, Cloud Functions
  docs/
    ARCHITECTURE.md
    DEVELOPMENT_PLAN.md
    DEVELOPMENT_PROGRESS.md
  tests/
    integration/
    e2e/
```

This layout implements the specification's suggested structure. Folders are created only when their milestone first needs them; Milestone 1 should not pre-create unimplemented business modules.

## Decisions made and still open

1. Environments: development, staging, and production variants are defined (`app.config.ts`,
   `eas.json`). **Open:** the Firebase project IDs and the organisation's bundle identifier.
2. A development build is required for notification actions (Expo Go is insufficient).
3. **Open:** health-data classification, jurisdiction, and retention period. Deletion is
   implemented; time-based retention is not.
4. The permission matrix above is implemented. Reports are generated on-device and not stored.
5. **Open:** deployment ownership and observability. Scheduled functions require the Blaze plan.
