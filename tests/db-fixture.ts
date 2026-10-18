import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

export const MEMBER_ID = '00000000-0000-4000-8000-000000000001'
export const OUTSIDER_ID = '00000000-0000-4000-8000-000000000002'
export const CUSTOMER_ID = '00000000-0000-4000-8000-000000000010'
export const INQUIRY_ID = '00000000-0000-4000-8000-000000000011'

/** No connection strings: this fixture is an isolated, in-memory PostgreSQL instance. */
export async function createSecurityFixture() {
  const db = new PGlite()
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    INSERT INTO auth.users VALUES
      ('${MEMBER_ID}', 'owner@example.invalid'),
      ('${OUTSIDER_ID}', 'outsider@example.invalid');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
    CREATE TABLE public.customers (id uuid PRIMARY KEY, name text NOT NULL);
    CREATE TABLE public.inquiries (
      id uuid PRIMARY KEY,
      customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
      subject text NOT NULL
    );
    CREATE TABLE public.email_templates (id uuid PRIMARY KEY, body text);
    INSERT INTO public.customers VALUES ('${CUSTOMER_ID}', 'Synthetic customer');
    INSERT INTO public.inquiries VALUES ('${INQUIRY_ID}', '${CUSTOMER_ID}', 'Synthetic inquiry');
    INSERT INTO public.email_templates VALUES ('00000000-0000-4000-8000-000000000012', 'Synthetic template');
    ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.customers, public.inquiries, public.email_templates FROM PUBLIC, anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers, public.inquiries, public.email_templates TO service_role;
    CREATE POLICY "Allow full access for authenticated users to customers"
      ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Allow full access for authenticated users to inquiries"
      ON public.inquiries FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Enable all for anon"
      ON public.email_templates FOR ALL TO anon USING (true) WITH CHECK (true);
  `)
  return db
}

export async function securityMigration() {
  return readFile(new URL('../supabase/migrations/20261018_crm_members.sql', import.meta.url), 'utf8')
}

export async function applySecurityMigration(db: PGlite) {
  try {
    await db.exec(await securityMigration())
  } catch (error) {
    await db.exec('ROLLBACK')
    throw error
  }
}

/** SET ROLE is real PostgreSQL authorization, not a mocked permission predicate. */
export async function asRole<T>(
  db: PGlite,
  role: 'anon' | 'authenticated' | 'service_role',
  userId: string | null,
  action: () => Promise<T>,
): Promise<T> {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId ?? ''])
  await db.exec(`SET ROLE ${role}`)
  try {
    return await action()
  } finally {
    await db.exec('RESET ROLE')
    await db.query("SELECT set_config('request.jwt.claim.sub', '', false)")
  }
}

export async function enrollMember(db: PGlite) {
  await db.query('INSERT INTO crm_private.crm_members (user_id) VALUES ($1)', [MEMBER_ID])
}
