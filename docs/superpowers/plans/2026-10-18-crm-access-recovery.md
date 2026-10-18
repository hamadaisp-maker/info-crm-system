# Temporary owner-only CRM viewer

## Goal and scope

The owner approved a temporary, read-only view of existing CRM data while a separate Claude task builds the replacement system. Preserve the old list/detail presentation. Only the approved owner is enrolled. No real email address, Auth UUID, credential or customer row belongs in this public repository.

Production is still at commit 1c8687f9e29e00c8bc5329a127af537671867bd9. Supabase Resume is complete. Data API remains disabled. All three business tables have RLS enabled and anon/authenticated have no effective grants. No historical customer data has been changed.

## Design

- Keep Supabase email-code login, with no signup UI and shouldCreateUser:false. Disable public signup. An administrator creates only the approved account with email_confirm:true, then verifies its confirmed status and inserts exactly that immutable Auth UUID into the private membership table.
- crm_private.crm_members is inaccessible to API clients, including service_role. The fixed-search-path SECURITY DEFINER function is_crm_member() exposes only the caller's membership boolean.
- Replace the audited old policies in one guarded transaction. Grant authenticated SELECT only on customers/inquiries, with FOR SELECT policies requiring membership. Keep anon and email_templates closed. Do not add data columns or modify historical rows; preserve existing service_role privileges.
- Per-request SSR clients verify getUser() and membership before reads. Refresh HttpOnly, SameSite=Lax, production Secure cookies through proxy. Data authorization does not rely on proxy alone. Responses are private/no-store.
- Keep existing list/detail information. Add bounded pagination with stable ordering so old records beyond the former 20-row limit remain accessible. Details show full content, answers and notes.
- Remove registration, editing, merging and import controls. Business write endpoints return 405 without a database client. Cron/webhook return 503 without processing inputs or calling upstream services. Auth POST endpoints remain enabled and require same origin.
- Do not publish a service-role client, add a service key, apply the sheet-import RPC, or restore automatic imports. Earlier importer improvements are outside this temporary viewer.

## Review and validation

The independent design review approved the narrower design. RO-1 requires access to old records via pagination rather than only showing the latest 20. The previous OTP-1 confirmation requirement still applies. Old importer/CAS requirements are excluded because no importer executes.

Verify real security SQL with synthetic data: member SELECT succeeds; member INSERT/UPDATE/DELETE/TRUNCATE fail; anonymous and nonmember reads fail; membership cannot be edited; revocation takes effect; unexpected metadata aborts and rolls back. Test actual handlers for write/import refusal, Auth/cookie boundaries, pagination and rendering. Run build, typecheck and targeted lint. Inspect the running local UI using only synthetic data.

A fresh independent reviewer must find zero required fixes before publication. Production release, settings, owner enrollment and the first login-code email require concrete destination approval. See docs/crm-access-release.md. The task is not complete until the owner can log in and view data on the original URL without customer data entering logs/screenshots.
