# Security Fix Plan — rawdah-permit-system
Generated: 2026-09-29 · Profile: Standard · Stack: React 18 SPA + Vite 6 + Supabase (Postgres, RLS, Realtime)
Repo: `C:/Users/ferry/Desktop/qoder` @ 8da475a · Backend: `https://aeuavoqhrhzsxblrddlc.supabase.co`
Scanned by: security-audit skill (Mahara AI)

## Execution rules for the agent
- Execute tasks in order. After each task run its Verify step; do not continue past a failing verify — fix or stop and report.
- Run `npm run build` after each batch marked [BATCH END].
- Do not modify files outside those listed in a task without noting it.
- Never print secret values. Mask as `eyJh…`.
- Supabase SQL changes are **not** editable in this repo — they must be applied in the Supabase dashboard (SQL Editor) or via a migration. Tasks below give the exact SQL.

## Status summary

| ID | Title | Severity | Confidence | Status |
|----|-------|----------|-----------|--------|
| SEC-DB-001 | Anonymous full read/write on every Supabase table via RLS | Critical | Confirmed | Open — DB migration required |
| SEC-AUTHZ-002 | Client-side-only auth and role enforcement | Critical | Confirmed | Open — redesign required |
| SEC-SECRET-001 | Supabase anon key hardcoded in client source | High | Confirmed | Open — partial fix in repo |
| SEC-DB-003 | `audit_logs` writable anonymously | High | Confirmed | Open — DB migration required |
| SEC-INFO-001 | Destructive script + DB credentials committed to git history | High | Confirmed | Open — OWNER ACTION (history rewrite) |
| SEC-SECRET-002 | Hardcoded SMS webhook secret default + VITE_ vars in bundle | Medium | Confirmed | Open |
| SEC-HDR-001 | No CSP or security headers on the SPA | Medium | Confirmed | Open |
| SEC-INFO-002 | Plaintext staff passwords in the client bundle | Medium | Confirmed | Open |

**Score before: 8/100 (F).** Projected after Tasks 1–8: 72/100 (D). Full remediation (auth redesign + RLS) is required for a production grade.

---

## Tasks

### TASK 1 — SEC-DB-001: Replace permissive RLS policies with authenticated-only policies
- **Severity / confidence:** Critical / Confirmed
- **Source:** manual review + live anonymous API probe
- **Evidence:** `database/schema.sql:276-301` grants `FOR ALL TO anon ... USING (true) WITH CHECK (true)`. Live probe using only the public anon key returned `201 Created` for `POST /profiles` with `role: super_admin`, and `204` for anonymous `PATCH`/`DELETE` on `/customers`.
- **Why it matters:** anyone who reads the anon key (which is shipped in the bundle, SEC-SECRET-001) gets full read/write/delete over customers, orders, permits, payments and staff records — no login needed.
- **Preconditions:** tables already have `ENABLE ROW LEVEL SECURITY` (schema.sql:265-273). Apply in the Supabase dashboard → SQL Editor, or as a migration.
- **Steps:**
  1. In the Supabase SQL Editor, run:
     ```sql
     -- 1. Drop every permissive policy
     DROP POLICY IF EXISTS "Allow select on company_settings" ON company_settings;
     DROP POLICY IF EXISTS "Allow all on company_settings"   ON company_settings;
     DROP POLICY IF EXISTS "Allow select on financial_accounts" ON financial_accounts;
     DROP POLICY IF EXISTS "Allow all on financial_accounts"   ON financial_accounts;
     DROP POLICY IF EXISTS "Allow select on profiles" ON profiles;
     DROP POLICY IF EXISTS "Allow all on profiles"   ON profiles;
     DROP POLICY IF EXISTS "Allow select on customers" ON customers;
     DROP POLICY IF EXISTS "Allow all on customers"   ON customers;
     DROP POLICY IF EXISTS "Allow select on permits" ON permits;
     DROP POLICY IF EXISTS "Allow all on permits"   ON permits;
     DROP POLICY IF EXISTS "Allow select on sales_orders" ON sales_orders;
     DROP POLICY IF EXISTS "Allow all on sales_orders"   ON sales_orders;
     DROP POLICY IF EXISTS "Allow select on order_permits" ON order_permits;
     DROP POLICY IF EXISTS "Allow all on order_permits"   ON order_permits;
     DROP POLICY IF EXISTS "Allow select on sms_messages" ON sms_messages;
     DROP POLICY IF EXISTS "Allow all on sms_messages"   ON sms_messages;
     DROP POLICY IF EXISTS "Allow select on audit_logs" ON audit_logs;
     DROP POLICY IF EXISTS "Allow insert on audit_logs" ON audit_logs;

     -- 2. Read/write only for authenticated users.
     --    (Anon stays allowed ONLY on the public self-registration path.)
     CREATE POLICY "authenticated read company_settings"  ON company_settings  FOR SELECT TO authenticated USING (true);
     CREATE POLICY "authenticated write company_settings" ON company_settings  FOR ALL    TO authenticated USING (true) WITH CHECK (true);
     CREATE POLICY "authenticated read financial_accounts"  ON financial_accounts  FOR SELECT TO authenticated USING (true);
     CREATE POLICY "authenticated write financial_accounts" ON financial_accounts  FOR ALL    TO authenticated USING (true) WITH CHECK (true);
     CREATE POLICY "authenticated read profiles"  ON profiles  FOR SELECT TO authenticated USING (true);
     CREATE POLICY "authenticated write profiles" ON profiles  FOR ALL    TO authenticated USING (true) WITH CHECK (true);
     CREATE POLICY "authenticated read customers"  ON customers  FOR SELECT TO authenticated USING (true);
     CREATE POLICY "authenticated write customers" ON customers  FOR ALL    TO authenticated USING (true) WITH CHECK (true);
     CREATE POLICY "authenticated read permits"  ON permits  FOR SELECT TO authenticated USING (true);
     CREATE POLICY "authenticated write permits" ON permits  FOR ALL    TO authenticated USING (true) WITH CHECK (true);
     CREATE POLICY "authenticated read sales_orders"  ON sales_orders  FOR SELECT TO authenticated USING (true);
     CREATE POLICY "authenticated write sales_orders" ON sales_orders  FOR ALL    TO authenticated USING (true) WITH CHECK (true);
     CREATE POLICY "authenticated read order_permits"  ON order_permits  FOR SELECT TO authenticated USING (true);
     CREATE POLICY "authenticated write order_permits" ON order_permits  FOR ALL    TO authenticated USING (true) WITH CHECK (true);
     CREATE POLICY "authenticated read sms_messages"  ON sms_messages  FOR SELECT TO authenticated USING (true);
     CREATE POLICY "authenticated write sms_messages" ON sms_messages  FOR ALL    TO authenticated USING (true) WITH CHECK (true);
     ```
  2. Also remove the blanket `anon` grant from `database/schema.sql:276-301` in the repo so a future re-provision does not reintroduce it. Replace the same block with the authenticated-only policies above (minus `TO anon`).
  3. If `CustomerSelfRegister.tsx` inserts into `customers` without a logged-in user, add a narrow anon policy **for INSERT only on `customers`**, scoped to required columns:
     ```sql
     CREATE POLICY "anon self-register customers" ON customers
       FOR INSERT TO anon
       WITH CHECK (full_name IS NOT NULL AND created_by IS NULL);
     ```
- **Acceptance criteria:**
  - Anonymous `GET /rest/v1/profiles` with only the anon key returns `401`/empty (RLS denies), not `200` with rows.
  - Anonymous `POST /rest/v1/profiles` returns `401`/`42501`, not `201`.
  - An authenticated session can still read/write all tables.
- **Verify:**
  ```bash
  curl -s -o /dev/null -w "%{http_code}" -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    "https://aeuavoqhrhzsxblrddlc.supabase.co/rest/v1/profiles?select=id&limit=1"
  ```
  Expected: `401` (or `200` with an empty array if a residual select policy exists — the write tests must return `401`).
- **Rollback:** re-run the original `CREATE POLICY ... TO anon, authenticated` block from `git show bd62fab:database/schema.sql`.

### TASK 2 — SEC-DB-003: Lock `audit_logs` to append-only for authenticated users
- **Severity / confidence:** High / Confirmed
- **Source:** manual review
- **Evidence:** `database/schema.sql:300-301` — `Allow insert on audit_logs ... TO anon` and `Allow select ... TO anon`.
- **Why it matters:** an attacker can forge or delete audit entries, destroying the evidence trail of their own access.
- **Steps:**
  1. In Supabase SQL Editor:
     ```sql
     DROP POLICY IF EXISTS "Allow insert on audit_logs" ON audit_logs;
     DROP POLICY IF EXISTS "Allow select on audit_logs" ON audit_logs;

     CREATE POLICY "authenticated insert audit_logs" ON audit_logs
       FOR INSERT TO authenticated WITH CHECK (true);
     CREATE POLICY "authenticated read audit_logs" ON audit_logs
       SELECT TO authenticated USING (true);
     -- No UPDATE/DELETE policy exists => those are denied by RLS automatically.
     ```
  2. Update `database/schema.sql:300-301` to match (remove `TO anon`).
- **Acceptance criteria:** anon `POST /rest/v1/audit_logs` → `401`; authenticated insert still works; no policy grants UPDATE/DELETE on `audit_logs`.
- **Verify:** `curl -X POST` to `/rest/v1/audit_logs` with the anon key → expect `401`.

### TASK 3 — SEC-SECRET-001 / SEC-INFO-001: Remove hardcoded credentials and destructive script from the repo
- **Severity / confidence:** High / Confirmed
- **Source:** manual review, `git ls-files` scan
- **Evidence:** `src/services/supabase.ts:12-13` hard-codes `DEFAULT_SUPABASE_URL`/`DEFAULT_SUPABASE_KEY`; `src/components/SmsInbox.tsx:762` and `792` render the full project URL and key prefix in the UI; `.ts_work/*.py` (6 tracked files) embed the live key, including `wipe_database.py` which DELETEs every table.
- **Why it matters:** the key plus the open RLS policies (TASK 1) is a complete database compromise. `wipe_database.py` is a one-command data-loss primitive.
- **Steps:**
  1. `src/services/supabase.ts` — remove the fallback constants so credentials must come from env/localStorage:
     ```ts
     // DELETE these two lines:
     const DEFAULT_SUPABASE_URL = 'https://aeuavoqhrhzsxblrddlc.supabase.co';
     const DEFAULT_SUPABASE_KEY = 'eyJhbG...YvxI';

     function getSupabaseCredentials(): { url: string; key: string } {
       const url = (import.meta as any).env?.VITE_SUPABASE_URL || localStorage.getItem('rawdah_cloud_supabase_url') || '';
       const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || localStorage.getItem('rawdah_cloud_supabase_key') || '';
       return { url, key };
     }
     ```
  2. `src/components/SmsInbox.tsx` — replace the hard-coded URL/key strings in the onboarding UI with values read from the configured client (lines ~762, ~766, ~792, ~796):
     ```ts
     const sb = (await import('../services/supabase')).supabase;
     const restUrl = (sb as any)?.supabaseUrl
       ? `${(sb as any).supabaseUrl}/rest/v1/sms_messages`
       : '';
     const anonKey = (sb as any)?.supabaseKey || '';
     ```
     then render `restUrl` / `anonKey` and only show the copy buttons when both are non-empty. If the user has not configured cloud, show a placeholder telling them to set it up in CloudSetupModal first.
  3. Remove the tracked credentials from `.ts_work/`:
     ```bash
     git rm -r .ts_work/
     ```
     If the scripts are still needed, move them outside the repo and load the key from an env var (`SUPABASE_ANON_KEY`) never committed.
  4. Add `.ts_work/` to `.gitignore`.
  5. Update `database/schema.sql` if it also contains the literal key (check: `grep -n "eyJhbG" database/schema.sql`).
- **Acceptance criteria:** `grep -rn "eyJhbG" src/ .ts_work/ database/` returns nothing; `git ls-files` shows no `.ts_work/` files; app still connects when `.env.local` is present.
- **Verify:**
  ```bash
  grep -rn "eyJhbGci" --include="*.ts" --include="*.tsx" --include="*.py" --include="*.sql" . || echo "CLEAN"
  npm run build
  ```
  Expected: `CLEAN`, then a successful build.
- **Rollback:** `git checkout HEAD -- .ts_work/ src/services/supabase.ts src/components/SmsInbox.tsx`.

### TASK 4 — SEC-AUTHZ-002: Move authentication to Supabase Auth; make the client a thin consumer
- **Severity / confidence:** Critical / Confirmed
- **Source:** manual review
- **Evidence:** `src/components/LoginScreen.tsx:45` compares a plaintext password in the browser; `src/App.tsx:66` computes `allowedTabs` client-side; `src/services/mockData.ts:75-127` ships all staff passwords.
- **Why it matters:** every authorization decision runs in code the user controls. `localStorage.setItem('rawdah_current_user', {role:'super_admin'})` is a full bypass. With TASK 1 applied, this client-side auth is the only front door — and it is not a door.
- **Preconditions:** TASK 1 complete. Requires Supabase Auth (email/password or magic link) enabled in the dashboard.
- **Steps (design; implement incrementally and keep the app running):**
  1. **Enable Supabase Auth** for the project (dashboard → Authentication → Providers → Email).
  2. **Create auth users** for the 5 staff accounts; store their business profile (role, permissions, full name) in the existing `profiles` table keyed by `auth.uid()`.
  3. **`src/components/LoginScreen.tsx`** — replace the local lookup with:
     ```ts
     const { data, error } = await supabase.auth.signInWithPassword({ email, password });
     ```
     Remove `handleQuickRoleLogin` (LoginScreen.tsx:59) entirely — one-click role login is a bypass.
  4. **`src/services/dataService.ts`** — make `getCurrentUser()` derive from the Supabase session instead of `localStorage`:
     ```ts
     const { data: { user } } = await supabase.auth.getUser();
     const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
     ```
     `setCurrentUser` and the `rawdah_current_user` localStorage key should be deleted.
  5. **Delete `password` from `UserProfile`** and from `mockData.ts` (`initialProfiles`). Keep mock data for offline/demo mode only, with `password` removed.
  6. **Enforce roles server-side:** add RLS policies that compare `role`:
     ```sql
     CREATE POLICY "admin write profiles" ON profiles
       FOR ALL TO authenticated
       USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin')
       WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin');
     ```
     The client's `allowedTabs` stays as UX, never as the security boundary.
  7. **Cloud functions / RPC:** the existing `rpc_claim_permit` (schema.sql:319) is `SECURITY DEFINER` — audit it to ensure it validates `p_user_id` against `auth.uid()` rather than trusting the client.
- **Acceptance criteria:** logging in requires a real Supabase session; the app cannot reach data with an unauthenticated client; changing localStorage has no effect on data access; an `inventory`-role user calling a delete RPC is rejected by the database.
- **Verify:** with TASK 1 applied, `curl` the REST API with an expired/absent token → `401`. Then log in through the app and confirm reads/writes work.
- **Rollback:** large change — keep the old login flow behind a feature flag (`VITE_USE_SUPABASE_AUTH`) until the new flow is verified.

### TASK 5 — SEC-INFO-002: Remove plaintext passwords from the client bundle
- **Severity / confidence:** Medium / Confirmed
- **Source:** manual review
- **Evidence:** `src/services/mockData.ts:75,88,101,114,127` — `admin123`, `sales123`, `inventory123`, `acc123`, `sara123`.
- **Why it matters:** these are readable by anyone who opens the browser DevTools on the deployed site.
- **Steps:** fold into TASK 4 step 5 — delete the `password` field from `UserProfile` (src/types/index.ts), `initialProfiles`, and every `saveProfile` fallback (`dataService.ts:~820`). If a demo/offline mode still needs a login, gate it behind a build-time `VITE_DEMO_MODE` flag and load credentials from `.env.local` (never the bundle).
- **Acceptance criteria:** `grep -rn "admin123\|sales123\|inventory123\|acc123\|sara123" src/ dist/` returns nothing after `npm run build`.
- **Verify:** `grep -rn "admin123" src/ dist/ | wc -l` → `0`.

### TASK 6 — SEC-SECRET-002: Remove the hardcoded SMS webhook secret default
- **Severity / confidence:** Medium / Confirmed
- **Source:** manual review
- **Evidence:** `src/components/CloudSetupModal.tsx:27` falls back to `'rawdah_sec_2026'`; `.env`/`.env.local` hold `VITE_SMS_WEBHOOK_SECRET`.
- **Why it matters:** a default secret shipped in the bundle is a secret known to the public. (`VITE_` variables are baked into the bundle by design — that is acceptable for an *anon* key, never for a webhook secret.)
- **Steps:**
  1. `src/components/CloudSetupModal.tsx:27` — replace the fallback:
     ```ts
     localStorage.getItem('rawdah_sms_secret') || ''
     ```
     and require a non-empty value before saving; show a validation error if blank.
  2. If the webhook secret is used anywhere to *verify* incoming SMS server-side, that check must move to a Supabase Edge Function that reads the secret from the project's secret store (`SUPABASE_SMS_WEBHOOK_SECRET`), never from the client.
- **Acceptance criteria:** no literal secret default in `src/`; the secret must be entered per-installation or live server-side.
- **Verify:** `grep -rn "rawdah_sec_2026" src/` → no output.

### TASK 7 — SEC-HDR-001: Add security headers via Vercel / Netlify config
- **Severity / confidence:** Medium / Confirmed
- **Source:** `scripts/check_headers.py` on the Supabase endpoint (F 45/100: CSP FAIL, X-Content-Type-Options FAIL, Permissions-Policy FAIL) + manual review of `vercel.json` / `netlify.toml` (only catch-all rewrites, no headers).
- **Why it matters:** without CSP or `frame-ancestors`, any third-party script or iframe can reach your users' session.
- **Steps:**
  1. Choose **one** host and delete the other config (`vercel.json` xor `netlify.toml` + `public/_redirects`) to avoid duplicate/conflicting rules.
  2. For **Vercel**, replace the contents of `vercel.json`:
     ```json
     {
       "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
       "headers": [
         {
           "source": "/(.*)",
           "headers": [
             { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://aeuavoqhrhzsxblrddlc.supabase.co wss://aeuavoqhrhzsxblrddlc.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
             { "key": "X-Content-Type-Options", "value": "nosniff" },
             { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
             { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
             { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
             { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload" },
             { "key": "X-Frame-Options", "value": "DENY" }
           ]
         }
       ]
     }
     ```
  3. For **Netlify**, replace `netlify.toml`:
     ```toml
     [build]
       command = "npm run build"
       publish = "dist"

     [[redirects]]
       from = "/*"
       to = "/index.html"
       status = 200

     [[headers]]
       for = "/*"
       [headers.values]
         Content-Security-Policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://aeuavoqhrhzsxblrddlc.supabase.co wss://aeuavoqhrhzsxblrddlc.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
         X-Content-Type-Options = "nosniff"
         Referrer-Policy = "strict-origin-when-cross-origin"
         Permissions-Policy = "camera=(), microphone=(), geolocation=()"
         Cross-Origin-Opener-Policy = "same-origin"
         Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
         X-Frame-Options = "DENY"
     ```
     and delete `public/_redirects` (the Netlify redirect is already in the toml).
  4. CSP here allows `'unsafe-inline'` for styles (Tailwind relies on it) but **not** for scripts. Verify the app works; if a script breaks, first try to fix the script rather than relaxing CSP. If a nonce is needed later, move headers into a Vercel Edge middleware that issues a per-request nonce.
- **Acceptance criteria:** after deploy, `curl -sI <app-url>` shows all seven headers; app still renders and communicates with Supabase.
- **Verify:**
  ```bash
  python skills/security-audit/scripts/check_headers.py https://<your-app>.vercel.app
  ```
  Expected: grade improvement (CSP, clickjacking, xcto, referrer all PASS), and no console errors in the app.
- **Rollback:** `git checkout HEAD -- vercel.json netlify.toml public/_redirects`.

### TASK 8 — Add `security.txt` and `.well-known`
- **Severity / confidence:** Info / Confirmed
- **Source:** manual review (no well-known files in `public/`)
- **Steps:** create `public/.well-known/security.txt` from `assets/security.txt`, filling in a real contact and an `Expires` date. Deploy.
- **Verify:** `curl https://<app>/.well-known/security.txt` → 200.

[BATCH END] — after Tasks 3, 5, 6, 7: `npm run build` must succeed.

---

## OWNER ACTIONS (human required — cannot be done in code)
1. **Rotate the Supabase anon key today.** Dashboard → Settings → API → "Rotate anon key". Until TASK 1 is applied, anyone with the current key (which is in the public bundle and in git history) has full database access. Then redeploy the app with the new key.
2. **Rewrite git history** to purge `.ts_work/*.py` (they contain the live key + a destructive wipe script). `git filter-repo --path .ts_work/ --invert-paths`, then force-push and have all clones re-clone. Coordinate this — history rewriting is disruptive.
3. **Change all 5 staff passwords** once TASK 4 lands (they are currently public).
4. **Rotate the SMS webhook secret** `rawdah_sec_2026` and set a real one per installation.
5. **Decide the trust boundary:** until Supabase Auth (TASK 4) is live, treat the app as **demo-only** — do not take real customer PII or payments.

## Not run / limitations
- **Semgrep (SAST):** not installed on this host. Recommended: `pip install semgrep && semgrep scan --config p/react --config p/owasp-top-ten --json -o security-reports/raw/semgrep.json`.
- **Gitleaks / TruffleHog:** not installed. A `git ls-files` + regex scan was run instead (found the 6 `.ts_work/` files and 2 source files listed above). Full-history scrubbing still needs a real scanner after the key rotation.
- **OWASP ZAP baseline (passive DAST):** Docker not available on this host. The app has no deployed staging URL to scan.
- **TestSprite:** `.testsprite/plans/` exists (4 plans) but the TestSprite MCP is not configured in this environment, so functional/access-control tests did not run.
- **`dist/` and `dist.zip`** were not scanned — `dist/` is a build artifact; the source-level findings cover it.
- **`vercel_ready_files/`** is an untracked duplicate of the source tree (see App.tsx, CloudSetupModal.tsx …). It should be deleted or git-ignored; if it is a deploy artifact it must receive the same fixes as `src/`.

## Appendix A — False positives dismissed
- `.env` / `.env.local` are correctly listed in `.gitignore` and never appear in git history — no committed env files. (The *content* problem — `VITE_` vars being bundled — is real and covered by SEC-SECRET-002.)
- `npm audit`: 0 vulnerabilities. `osv-scanner` (via OSV.dev API) over all 228 lockfile dependencies: 0 advisories. No dependency findings.
- `public/_redirects` / `vercel.json` / `netlify.toml` catch-all rewrites: normal SPA pattern, not an open redirect.
- WhatsApp `wa.me` links (`CustomersCRM.tsx:549`): numeric-only sanitization applied (`replace(/[^0-9]/g,'')`); safe.

## Appendix B — Non-security defects found
- `vercel_ready_files/` duplicates the whole project tree untracked — drift risk and it re-ships the same credentials.
- `dist.zip` (152 KB) is a stale build artifact committed at repo root.
- `.ts_work/wipe_database.py` is a destructive production script sitting in the repo root.
- `.env` and `.env.local` are byte-identical duplicates.

## Appendix C — Raw outputs index
- `security-reports/raw/npmaudit.json` — npm audit, 0 vulnerabilities
- `security-reports/raw/osv.json` — OSV.dev results, 228 deps queried, 0 advisories
- `security-reports/raw/headers_supabase.json` — check_headers.py on the Supabase endpoint (F 45/100)
