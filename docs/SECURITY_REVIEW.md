# MediTrack Security Review (Milestone 9)

Date: 2026-11-18. Scope: Firebase configuration, Firestore and Storage rules, Cloud Functions,
on-device storage, notifications, authorization, and handling of health data.

## Summary

| Area                          | Status        | Notes                                                                    |
| ----------------------------- | ------------- | ------------------------------------------------------------------------ |
| Firestore rules               | Pass (tested) | Deny-by-default; 47 emulator tests cover ownership, caregivers, ledger   |
| Storage rules                 | Pass          | Storage is unused; `storage.rules` denies everything                     |
| Secrets in repository         | Pass          | No keys, service accounts, or `.env` files; scan run on 2026-11-18       |
| Caregiver authorization       | Pass (tested) | Read-only, per-permission, verified-email invitations, instant revoke    |
| Inventory integrity           | Pass (tested) | Stock changes must be backed by an immutable, consistent ledger entry    |
| Push and notification content | Pass          | No medicine names in push; private lock-screen visibility; discreet mode |
| Account deletion              | Pass (tested) | Server-side deletion of all user data and the Auth account               |
| On-device storage             | Residual risk | Firebase session token in AsyncStorage (see R1)                          |
| Production Firebase settings  | Action needed | Console settings below must be applied per project (see A1–A6)           |

## Findings and fixes made in this milestone

1. **Profile creation rule rejected caregivers.** The rule required `role == 'patient'`, so caregiver
   sign-up failed. Fixed; role is now `patient` or `caregiver` and is immutable afterwards, and the
   profile email must match the authenticated email.
2. **Stock could be edited directly.** Any field of a medicine, including `remainingStock`, could be
   changed by the owner. Now a stock change must reference a new inventory transaction, created in
   the same write, whose `previousStock` equals the stored value and whose `resultingStock` equals
   the new one. Ledger entries and dose records are append-only.
3. **Dose deductions could be duplicated.** Dose records used random IDs and the notification
   handler used the tap time as the slot. Dose IDs are now `${medicineId}_${slotKey}` and the
   deduction ledger ID is `dose_${doseId}`, so retries and repeated actions cannot double-deduct.
   The rules require a taken dose to have its deduction, and a deduction to have its taken dose.
4. **Accessibility alerts were not announced** (also a safety issue for error messages): alert
   containers were not accessibility elements. Fixed in `StateView` and `VerifyEmailNotice`.
5. **Missing native peer dependencies** (`expo-linking`, `react-native-screens`) could crash release
   builds. Installed; `expo-doctor` passes its dependency checks.
6. **No account deletion.** Added the `deleteMyAccount` callable function (requires sign-in within
   the last 5 minutes) and a Settings flow that re-authenticates with the password first.

## Authorization model

- Patients own `/users/{uid}/**`. Other users can read it only through an active care link
  `/careLinks/{patientId}_{caregiverId}` whose `permissions[...]` flag for that collection is true.
- Caregivers never write patient data. Rules give them no write paths under `/users/{patientId}`.
- Care links can only be created in the same batch as accepting a **pending, unexpired** invitation
  addressed to the caregiver's **verified** email, with permissions **identical** to the invitation.
  Names on invitations and links are checked against the writer's profile to prevent spoofing.
- Permission dependencies are enforced in rules and UI: inventory requires medicines, missed-dose
  alerts require dose history, low-stock alerts require inventory.
- Revocation (by either party) sets the link to `revoked`; every caregiver read fails from that
  write onward. A revoked link can only be reactivated by a new accepted invitation.
- Cloud Functions use the Admin SDK and re-read link status and permissions at send time.

See `docs/ARCHITECTURE.md` for the full permission matrix.

## Sensitive-data handling

- **Push notifications** go through Expo, Apple, and Google. Payloads contain only the patient's
  name and a generic message ("may have missed a dose"); medicine details stay in Firestore.
- **Local notifications** use Android channels with private lock-screen visibility. "Discreet
  notifications" removes medicine names from titles and bodies on both platforms.
- **PDF reports** are generated on-device into the app's private cache and shared only through the
  system share sheet at the user's request. The HTML template escapes all user-entered text.
- **Logging**: the app has no `console` logging; Cloud Functions log only counts and opaque IDs.
- **Backups**: Android `allowBackup` is disabled so app storage is not copied to cloud backups.

## Residual risks

- **R1. Session token in AsyncStorage.** Firebase Auth's React Native persistence stores its refresh
  token in AsyncStorage (app sandbox, unencrypted at rest beyond OS file protection). Mitigated by
  sandboxing and disabled backups. Exposure requires a rooted or jailbroken device or a device
  backup. A SecureStore-backed persistence adapter would remove this; deferred because SecureStore
  has per-item size limits on some platforms.
- **R2. Pending-action queue.** Notification confirmations waiting to sync (medicine name and time)
  are stored in AsyncStorage until written. Same mitigations as R1; entries are removed once synced.
- **R3. Reminders after an end date.** Repeating local reminders are reconciled whenever the app
  is opened. If the app is not opened after a medicine's end date, reminders continue until it is.
- **R4. DST edge cases.** A dose time that does not exist on a daylight-saving transition day
  (for example 2:30 AM on spring-forward) may map to a different instant on the device and server,
  which could produce a spurious missed-dose alert for that one slot.
- **R5. Client-side password policy.** The app requires 8 characters; enforce a server-side policy
  in Firebase (A2) so other clients cannot bypass it.

## Actions required per Firebase project (dev, staging, production)

- **A1.** Enable **Email enumeration protection** (Authentication → Settings).
- **A2.** Set a **password policy** (minimum length 8 or more, enforced).
- **A3.** Enable **App Check** (Play Integrity / App Attest) and enforce it for Firestore and
  Functions once production builds are registered.
- **A4.** Restrict the Firebase **API key** to the app's Android package and iOS bundle IDs in
  Google Cloud Console → Credentials.
- **A5.** Deploy rules from this repository (`firebase deploy --only firestore,storage`); do not edit
  rules in the console.
- **A6.** Enable **point-in-time recovery** and scheduled exports for Firestore in production, and
  restrict IAM so only release owners can deploy.
