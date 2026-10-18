# Temporary owner-only viewer release

Applies only to the existing info-crm-system Vercel project, its existing GitHub repository and its existing Supabase database. Publication is pending owner approval. Keep personal addresses, Auth UUIDs, secrets and customer rows out of this public document.

## Prerequisites

- Confirm remote main and the production deployment are still the audited baseline, or reconcile changes first. Use the isolated recovery branch; never deploy the dirty original checkout.
- Record Auth settings, API state, grants and policies as metadata only. Data API must stay OFF during preparation. The migration checks its baseline and locks the affected tables; abort on any mismatch.
- Complete the current tests/build and independent final review. Required RO-1: old rows beyond the first page must be accessible.
- Obtain approval for the reviewed code, existing GitHub/Vercel destination, one membership migration, Auth/API/template settings, one confirmed owner account and the first login-code email.
- No service key, machine-client setup, import RPC, historical data import or production write test is needed. The temporary app explicitly pauses imports and rejects business writes. vercel.json removes the daily cron schedule; the endpoint remains a non-processing 503 response.

## Ordered application

1. Verify Data API is OFF. Disable public signup. Keep email confirmation ON and anonymous sign-in OFF. Re-read saved settings.
2. Create exactly the approved owner in Supabase Auth with Auto confirm user checked (email_confirm:true), using a cryptographically random password never printed or retained. Routine login uses email codes. Verify exactly one matching account and a non-null email_confirmed_at. The dashboard create-user form sends no email.
3. Apply only supabase/migrations/20261018_crm_members.sql. It changes access metadata, not customer rows or columns. A failed precondition or statement leaves the API closed; do not blindly rerun partial SQL.
4. As database administrator, resolve the approved address to exactly one confirmed Auth UUID and insert only that UUID into crm_private.crm_members. Require the membership table to be empty before insertion and exactly one row afterward. Do not enroll every Auth account or save the address/UUID in Git.
5. Verify effective privileges and policies with metadata/read-only checks: anon cannot access business tables; authenticated has SELECT only on customers/inquiries; both policies are FOR SELECT with membership checks; email_templates stays closed; clients cannot read/change the membership table. Check that the owner is the only member. Do not perform a test INSERT/UPDATE/DELETE on production data.
6. Record the old Magic Link/OTP template. Set subject to 問い合わせ管理システムの確認コード and a short body displaying {{ .Token }}. Suggested body: ログイン画面に次の確認コードを入力してほしい。<p><strong>{{ .Token }}</strong></p>この操作に心当たりがなければ、このメールは無視してよい。 No customer information is included.
7. Publish only the reviewed temporary viewer to the existing repository/project. Merge serially after rechecking current main. Confirm Vercel deployed the approved commit. Keep Data API OFF until anonymous login redirect and paused write/import endpoints are verified.
8. Enable Data API only after restrictions and the deployment are verified. Confirm exposed schemas include public and exclude crm_private; confirm a healthy schema cache. Do not create the placeholder pg_pgrst_no_exposed_schemas schema.
9. Verify anonymous / redirects to /login, the remaining read API denies access, business writes return 405, and cron/webhook return 503 without processing. Send the approved initial code to the approved owner, who enters it in the browser.
10. Verify actual authenticated list, next page and detail rendering using only metadata such as headings/counts in outputs. Never record customer names, addresses, messages or screenshots of real rows. Verify logout and subsequent anonymous denial.

## Email limitation

The current built-in Supabase sender is rate limited and restricted to eligible project-team addresses. The approved owner's address matches the signed-in project administrator; actual delivery remains to be verified. If sending fails, retain the safe state and diagnose the actual error. Do not silently create a mail-provider account or use unrelated credentials. Staff enrollment and new SMTP setup are outside this owner-only release.

## Failure / rollback

Disable Data API first if protection or deployment verification fails. Revoke authenticated SELECT on customers/inquiries only after confirming those are still this release's grants. Keep RLS and restrictive policies. Do not restore anonymous access, remove historical data or overwrite another session's changes.

A failed migration rolls back its own metadata changes. Deployment rollback does not undo account or database configuration. Old deployments still have no anon access. The formerly published cron fallback is not safe for a future write-enabled release; rotation and importer correction belong to that separate work, not this disabled-import viewer.

## Verification record

- Current temporary viewer: 80 synthetic tests in eight files passed, typecheck passed, and targeted ESLint/diff checks passed.
- Production build passed with Next.js 16.4.2 and Webpack. Turbopack could not bind its local build-worker port in this execution environment; the deployed Vercel build still needs confirmation.
- Running production build against a synthetic-only local Auth/Data server: anonymous redirect, code login, 50-row inquiry/customer lists, second-page old records, both detail dialogs, logout and subsequent anonymous rejection all verified in the browser. No production customer data or actual email was used.
- Independent final review found RO-PAGE-2 (PostgREST 416 for an out-of-range offset). The actual SDK/HTTP-shaped regression test now passes and the reviewer confirmed zero required fixes.
- Production login, email delivery and actual protected list rendering remain pending until performed.
