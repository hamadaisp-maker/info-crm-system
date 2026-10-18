-- Apply only to the audited, closed CRM database. This changes access metadata,
-- never customer records or columns. Enrolled accounts can only read existing
-- customers and inquiries. Keep the Data API disabled until verified.
-- The database administrator enrolls approved Auth UUIDs separately; no personal
-- identifiers or credentials belong in this migration or its public repository.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(20261018, 784321);

-- Serialize the check and policy/grant replacement with other changes to these
-- tables. A conflicting operation fails instead of applying an outdated audit.
LOCK TABLE public.customers, public.inquiries, public.email_templates
  IN ACCESS EXCLUSIVE MODE;

DO $preconditions$
DECLARE
  client_role text;
  table_name text;
  expected_policy record;
BEGIN
  IF to_regnamespace('crm_private') IS NOT NULL
     OR to_regprocedure('public.is_crm_member()') IS NOT NULL THEN
    RAISE EXCEPTION 'CRM migration precondition: membership objects already exist';
  END IF;

  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')) <> 3
     OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname IN ('customers', 'inquiries', 'email_templates')
           AND c.relkind = 'r' AND c.relrowsecurity AND NOT c.relforcerowsecurity) <> 3 THEN
    RAISE EXCEPTION 'CRM migration precondition: table or RLS state changed';
  END IF;

  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role
                   AND NOT rolsuper AND NOT rolbypassrls)
       OR NOT has_schema_privilege(client_role, 'public', 'USAGE') THEN
      RAISE EXCEPTION 'CRM migration precondition: client role state changed';
    END IF;
    FOREACH table_name IN ARRAY ARRAY['customers', 'inquiries', 'email_templates'] LOOP
      -- TRUNCATE bypasses RLS. Column grants could otherwise allow partial reads
      -- despite a negative table-grant audit, so both forms must remain closed.
      IF has_table_privilege(client_role, format('public.%I', table_name),
           'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
         OR has_any_column_privilege(client_role, format('public.%I', table_name),
           'SELECT,INSERT,UPDATE,REFERENCES') THEN
        RAISE EXCEPTION 'CRM migration precondition: client grants changed';
      END IF;
    END LOOP;
  END LOOP;

  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') <> 3 THEN
    RAISE EXCEPTION 'CRM migration precondition: policy set changed';
  END IF;
  FOR expected_policy IN
    SELECT * FROM (VALUES
      ('customers', 'Allow full access for authenticated users to customers', 'authenticated'),
      ('inquiries', 'Allow full access for authenticated users to inquiries', 'authenticated'),
      ('email_templates', 'Enable all for anon', 'anon')
    ) AS expected(table_name, policy_name, policy_role)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public'
        AND p.tablename = expected_policy.table_name
        AND p.policyname = expected_policy.policy_name
        AND p.permissive = 'PERMISSIVE' AND p.cmd = 'ALL'
        AND p.roles = ARRAY[expected_policy.policy_role]::name[]
        AND p.qual = 'true' AND p.with_check = 'true'
    ) THEN
      RAISE EXCEPTION 'CRM migration precondition: policy definition changed';
    END IF;
  END LOOP;
END;
$preconditions$;

CREATE SCHEMA crm_private;
REVOKE ALL ON SCHEMA crm_private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE crm_private.crm_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id)
);
ALTER TABLE crm_private.crm_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_private.crm_members FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.is_crm_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $membership$
  SELECT EXISTS (
    SELECT 1 FROM crm_private.crm_members m WHERE m.user_id = auth.uid()
  );
$membership$;
REVOKE ALL ON FUNCTION public.is_crm_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_crm_member() TO authenticated;

DROP POLICY "Allow full access for authenticated users to customers" ON public.customers;
DROP POLICY "Allow full access for authenticated users to inquiries" ON public.inquiries;
DROP POLICY "Enable all for anon" ON public.email_templates;

CREATE POLICY "CRM members read customers"
  ON public.customers FOR SELECT TO authenticated
  USING ((SELECT public.is_crm_member()));
CREATE POLICY "CRM members read inquiries"
  ON public.inquiries FOR SELECT TO authenticated
  USING ((SELECT public.is_crm_member()));

GRANT SELECT ON public.customers, public.inquiries TO authenticated;
-- email_templates stays inaccessible to clients. Existing service_role grants
-- and BYPASSRLS behavior are deliberately unaffected.
COMMIT;
