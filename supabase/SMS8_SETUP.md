# SMS8 setup and verification

The app stays offline first. Clinical records and the local login verifier are
saved on each provisioned device. Connecting does not automatically sync patient
records or submit SMS. Online sign-in restores cloud access; **Sync Now** and SMS
submission remain separate manual actions.

## 1. Prepare the development Supabase project

Apply migrations `001` through `005` in order (Dashboard SQL Editor, or
`supabase db push` after linking the intended development project). For an
existing database, take a backup and compare its schema to `001` first; its
`ALTER TABLE` statements add missing sync timestamps and soft-delete columns.
Other existing business columns and their types must still match the baseline.
The device registry must have unique letters per facility. Resolve any existing
duplicate letters before applying `004`; never rename existing patient codes.

Create the initial admin in `public.users` using your existing provisioning
process. No default password/account is introduced. The updated login endpoint
verifies the app credential, provisions a shadow Auth identity, sets trusted
`app_metadata`, and exchanges a magic-link hash for real access/refresh tokens.
The email Auth provider must be enabled; no email is sent by this flow. Keep
Supabase's single-session-per-user setting disabled so the facility account can
have concurrent sessions on multiple devices.

Deploy from the repository root:

```powershell
supabase functions deploy login
supabase functions deploy send-sms
supabase functions deploy sms-status
```

`supabase/config.toml` disables gateway JWT validation for these endpoints. The
login function validates credentials; both SMS functions explicitly validate the
bearer session with Supabase Auth and check the current, non-deleted app account
and facility permissions. They do not accept anonymous sending.

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` to functions. Never put service keys or SMS8 secrets
in a `VITE_` variable, browser configuration, Git, or chat.

## 2. Pair your Android phone

1. Sign in to SMS8, install its Android gateway app and pair your phone from the
   Devices screen.
2. Enable SMS permissions, select the intended SIM, and keep the gateway online
   and able to run in the background.
3. Note the paired device ID and API key from your SMS8 dashboard.
4. Set these **Supabase Edge Function secrets**, using the dashboard:

   - `SMS8_API_KEY`: your SMS8 account key.
   - `SMS8_DEVICE_ID`: one paired Android device ID.
   - `SMS8_SENDER_NUMBER`: that SIM's actual E.164 number, e.g. `+2557XXXXXXXX`.

All authorized facilities use this one server-configured gateway. Phone-number
selection is not sent by the browser. The displayed sender number is a label;
the Android SIM actually determines the sender. SMS8 cannot turn it into a
branded sender name. Each template includes the patient's facility name.

Official API reference: https://sms8.io/sms8-api-documentation

## 3. Configure and provision the app

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, build and deploy the frontend.
The legacy `VITE_USE_SERVER_AUTH` flag is no longer used: online operations
always require the updated server authentication flow.

Sign in online once on each device. Provisioning reserves a unique A–Z letter
atomically for its facility; an existing local letter is preserved and must
match its cloud reservation. Patient codes are never rewritten. First-time
offline registration is blocked until a letter is provisioned. Existing legacy
patient codes remain readable. New numeric patient IDs and visit IDs use
randomness to avoid same-millisecond collisions between devices.

In SMS Configuration select **SMS8 — Android phone / SIM** and save. Existing
provider configurations remain available, but this repository only implements
the SMS8 sending adapter. Other adapters must be deployed separately.

## 4. Manual acceptance check

- On devices A and B, sign in with the same facility account. Disconnect both,
  restart the app and sign in from the local cache. Register a patient and visit
  on each; confirm different device letters and retained records.
- Reconnect. Confirm no sync/SMS happens automatically. Select **Sync Now** on
  each, then sync the first device again; verify both patients and visits are
  visible. Expired cloud sessions can use **Sign in online** without clearing
  local work or changing the letter.
- Use a test patient whose phone belongs to a willing test recipient. Select
  **Sync this patient first** if required, then **Refresh shared SMS history**.
- Preview and submit one SMS. Confirm `queued` is shown until SMS8 reports
  `sent`/`delivered`. Use **Refresh delivery status** for updates.
- Verify the recipient sees the configured SIM number and the correct facility
  name in the text. Check the phone's SIM selection if the number differs.
- From the other device try sending again: shared server history prevents
  duplicate requests. Confirmed sends have a three-day cooldown with an explicit
  audited individual-send override. Queued/uncertain requests cannot be overridden.

## Interrupted sends

Requests are reserved with status `unknown` before contacting SMS8. Request IDs
are idempotent, so the same ID cannot submit twice. HTTP errors or timeouts after
submission are never retried automatically. A gateway read failure does not
erase a known sent status. No UI action automatically resends when reconnecting.

An unknown request without a gateway message ID requires checking the SMS8
dashboard/device before any administrative reconciliation. It deliberately
blocks another submission for that patient; exactly-once delivery cannot be
guaranteed across a third-party API that does not document idempotency support.
Do not delete the ledger row just to bypass this protection.

History stores masked recipient numbers, account and device identity, message,
request ID, provider ID and status. Local legacy SMS phone logs are masked at
bootstrap/read/write. Patient `enc:v1` numbers remain compatible, but their
facility-derived keys are not secret; stronger offline key management is a
separate migration. Broader sync conflict resolution and destructive duplicate
cleanup also remain separate follow-up work.

## Automated checks

From `touchhealth-ts`: `npm ci`, `npm run lint`, `npm run test`, `npm run build`.
The tests include an embedded PostgreSQL database for migrations, RLS, device
allocation and transactional SMS reservations; no hosted database is modified.

From the repository root with Deno installed:

```powershell
deno check --node-modules-dir=none supabase/functions/login/index.ts supabase/functions/send-sms/index.ts supabase/functions/sms-status/index.ts
deno test --node-modules-dir=none --allow-env supabase/functions/tests/sms_test.ts
```

The Edge Function tests mock all Supabase/SMS8 network requests and use fake
credentials. No live SMS is sent by the automated tests.
