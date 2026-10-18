import { afterEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import {
  applySecurityMigration, asRole, createSecurityFixture, CUSTOMER_ID, enrollMember,
  INQUIRY_ID, MEMBER_ID, OUTSIDER_ID,
} from './db-fixture'

let db: PGlite | undefined
afterEach(async () => { await db?.close(); db = undefined })

async function fixture(migrate = true) {
  db = await createSecurityFixture()
  if (migrate) await applySecurityMigration(db)
  return db
}

const dataTables = ['customers', 'inquiries'] as const
const permissionDenied = { code: '42501' }

describe('CRM database membership boundary', () => {
  it('keeps the pre-migration database closed to both client roles', async () => {
    const db = await fixture(false)
    for (const role of ['anon', 'authenticated'] as const) {
      for (const table of [...dataTables, 'email_templates']) {
        await expect(asRole(db, role, MEMBER_ID, () => db.query(`SELECT * FROM public.${table}`)))
          .rejects.toMatchObject(permissionDenied)
      }
    }
  })

  it('lets an enrolled member read existing customers and inquiries', async () => {
    const db = await fixture()
    await enrollMember(db)
    await asRole(db, 'authenticated', MEMBER_ID, async () => {
      expect((await db.query('SELECT public.is_crm_member() AS allowed')).rows).toEqual([{ allowed: true }])
      expect((await db.query('SELECT name FROM public.customers')).rows).toEqual([{ name: 'Synthetic customer' }])
      expect((await db.query('SELECT subject FROM public.inquiries')).rows).toEqual([{ subject: 'Synthetic inquiry' }])
    })
  })

  it('refuses all business-table changes even from the enrolled owner', async () => {
    const db = await fixture()
    await enrollMember(db)
    await asRole(db, 'authenticated', MEMBER_ID, async () => {
      await expect(db.query("INSERT INTO public.customers VALUES ('00000000-0000-4000-8000-000000000020', 'Added customer')"))
        .rejects.toMatchObject(permissionDenied)
      await expect(db.query("INSERT INTO public.inquiries VALUES ('00000000-0000-4000-8000-000000000021', $1, 'Added inquiry')", [CUSTOMER_ID]))
        .rejects.toMatchObject(permissionDenied)
      await expect(db.query("INSERT INTO public.email_templates VALUES ('00000000-0000-4000-8000-000000000022', 'Added template')"))
        .rejects.toMatchObject(permissionDenied)
      await expect(db.query("UPDATE public.customers SET name = 'Updated customer'"))
        .rejects.toMatchObject(permissionDenied)
      await expect(db.query("UPDATE public.inquiries SET subject = 'Updated inquiry'"))
        .rejects.toMatchObject(permissionDenied)
      await expect(db.query("UPDATE public.email_templates SET body = 'Updated template'"))
        .rejects.toMatchObject(permissionDenied)
      for (const table of [...dataTables, 'email_templates']) {
        await expect(db.query(`DELETE FROM public.${table}`)).rejects.toMatchObject(permissionDenied)
        await expect(db.query(`TRUNCATE public.${table} CASCADE`)).rejects.toMatchObject(permissionDenied)
      }
    })
    expect((await db.query('SELECT name FROM public.customers')).rows).toEqual([{ name: 'Synthetic customer' }])
    expect((await db.query('SELECT subject FROM public.inquiries')).rows).toEqual([{ subject: 'Synthetic inquiry' }])
    expect((await db.query('SELECT body FROM public.email_templates')).rows).toEqual([{ body: 'Synthetic template' }])
  })

  it('keeps the read policy from authorizing writes if table write grants are mistakenly added later', async () => {
    const db = await fixture()
    await enrollMember(db)
    await db.exec('GRANT INSERT, UPDATE, DELETE ON public.customers, public.inquiries TO authenticated')
    await asRole(db, 'authenticated', MEMBER_ID, async () => {
      await expect(db.query("INSERT INTO public.customers VALUES ('00000000-0000-4000-8000-000000000020', 'Added customer')"))
        .rejects.toMatchObject(permissionDenied)
      await expect(db.query("INSERT INTO public.inquiries VALUES ('00000000-0000-4000-8000-000000000021', $1, 'Added inquiry')", [CUSTOMER_ID]))
        .rejects.toMatchObject(permissionDenied)
      expect((await db.query("UPDATE public.customers SET name = 'Updated customer' RETURNING id")).rows).toEqual([])
      expect((await db.query("UPDATE public.inquiries SET subject = 'Updated inquiry' RETURNING id")).rows).toEqual([])
      for (const table of dataTables) {
        expect((await db.query(`DELETE FROM public.${table} RETURNING id`)).rows).toEqual([])
      }
    })
    expect((await db.query('SELECT name FROM public.customers')).rows).toEqual([{ name: 'Synthetic customer' }])
    expect((await db.query('SELECT subject FROM public.inquiries')).rows).toEqual([{ subject: 'Synthetic inquiry' }])
  })

  it('denies data to a valid authenticated outsider and a missing subject', async () => {
    const db = await fixture()
    await enrollMember(db)
    for (const userId of [OUTSIDER_ID, null]) {
      await asRole(db, 'authenticated', userId, async () => {
        expect((await db.query('SELECT public.is_crm_member() AS allowed')).rows).toEqual([{ allowed: false }])
        for (const table of dataTables) {
          expect((await db.query(`SELECT * FROM public.${table}`)).rows).toEqual([])
          await expect(db.query(`DELETE FROM public.${table} RETURNING id`)).rejects.toMatchObject(permissionDenied)
        }
        await expect(db.query("UPDATE public.customers SET name = 'stolen' RETURNING id")).rejects.toMatchObject(permissionDenied)
        await expect(db.query("UPDATE public.inquiries SET subject = 'stolen' RETURNING id")).rejects.toMatchObject(permissionDenied)
        await expect(db.query("INSERT INTO public.customers VALUES ('00000000-0000-4000-8000-000000000020', 'unauthorized')"))
          .rejects.toMatchObject(permissionDenied)
        await expect(db.query("INSERT INTO public.inquiries VALUES ('00000000-0000-4000-8000-000000000021', $1, 'unauthorized')", [CUSTOMER_ID]))
          .rejects.toMatchObject(permissionDenied)
      })
    }
    expect((await db.query('SELECT name FROM public.customers')).rows).toEqual([{ name: 'Synthetic customer' }])
  })

  it('does not give anonymous clients any data or membership function access', async () => {
    const db = await fixture()
    await asRole(db, 'anon', null, async () => {
      for (const table of [...dataTables, 'email_templates']) {
        await expect(db.query(`SELECT * FROM public.${table}`)).rejects.toMatchObject(permissionDenied)
        await expect(db.query(`DELETE FROM public.${table}`)).rejects.toMatchObject(permissionDenied)
      }
      await expect(db.query("INSERT INTO public.customers VALUES ('00000000-0000-4000-8000-000000000020', 'anonymous')"))
        .rejects.toMatchObject(permissionDenied)
      await expect(db.query("UPDATE public.inquiries SET subject = 'anonymous'"))
        .rejects.toMatchObject(permissionDenied)
      await expect(db.query('SELECT public.is_crm_member()')).rejects.toMatchObject(permissionDenied)
    })
  })

  it('prevents members from inspecting or changing the membership authority or email templates', async () => {
    const db = await fixture()
    await enrollMember(db)
    await asRole(db, 'authenticated', MEMBER_ID, async () => {
      await expect(db.query('SELECT * FROM crm_private.crm_members')).rejects.toMatchObject(permissionDenied)
      await expect(db.query('INSERT INTO crm_private.crm_members VALUES ($1)', [OUTSIDER_ID])).rejects.toMatchObject(permissionDenied)
      await expect(db.query('UPDATE crm_private.crm_members SET user_id = $1', [OUTSIDER_ID])).rejects.toMatchObject(permissionDenied)
      await expect(db.query('DELETE FROM crm_private.crm_members')).rejects.toMatchObject(permissionDenied)
      await expect(db.query('SELECT * FROM public.email_templates')).rejects.toMatchObject(permissionDenied)
      await expect(db.query('TRUNCATE public.inquiries')).rejects.toMatchObject(permissionDenied)
    })
  })

  it('does not inherit default grants allowing machine credentials to change membership', async () => {
    const db = await fixture(false)
    await db.exec(`
      ALTER DEFAULT PRIVILEGES GRANT USAGE ON SCHEMAS TO service_role;
      ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated, service_role;
    `)
    await applySecurityMigration(db)
    await enrollMember(db)
    for (const role of ['anon', 'authenticated', 'service_role'] as const) {
      await asRole(db, role, MEMBER_ID, async () => {
        await expect(db.query('SELECT * FROM crm_private.crm_members')).rejects.toMatchObject(permissionDenied)
        await expect(db.query('INSERT INTO crm_private.crm_members VALUES ($1)', [OUTSIDER_ID]))
          .rejects.toMatchObject(permissionDenied)
      })
    }
    expect((await asRole(db, 'authenticated', MEMBER_ID, () => db.query('SELECT id FROM public.customers'))).rows)
      .toEqual([{ id: CUSTOMER_ID }])
  })

  it('applies membership revocation to the next request using the same authenticated identity', async () => {
    const db = await fixture()
    await enrollMember(db)
    const read = () => asRole(db, 'authenticated', MEMBER_ID, () => db.query('SELECT id FROM public.customers'))
    expect((await read()).rows).toEqual([{ id: CUSTOMER_ID }])
    await db.query('DELETE FROM crm_private.crm_members WHERE user_id = $1', [MEMBER_ID])
    expect((await read()).rows).toEqual([])
    await asRole(db, 'authenticated', MEMBER_ID, async () => {
      expect((await db.query('SELECT public.is_crm_member() AS allowed')).rows).toEqual([{ allowed: false }])
      await expect(db.query("INSERT INTO public.customers VALUES ('00000000-0000-4000-8000-000000000020', 'revoked')"))
        .rejects.toMatchObject(permissionDenied)
    })
  })

  it('preserves the machine role ability to import and update rows without a user session', async () => {
    const db = await fixture()
    await asRole(db, 'service_role', null, async () => {
      expect((await db.query('SELECT id FROM public.customers')).rows).toEqual([{ id: CUSTOMER_ID }])
      await db.exec(`
        INSERT INTO public.customers VALUES ('00000000-0000-4000-8000-000000000020', 'Machine customer');
        INSERT INTO public.inquiries VALUES ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000020', 'Machine inquiry');
      `)
      expect((await db.query("UPDATE public.inquiries SET subject = 'Processed' WHERE id = $1 RETURNING subject", [INQUIRY_ID])).rows)
        .toEqual([{ subject: 'Processed' }])
      expect((await db.query("DELETE FROM public.customers WHERE name = 'Machine customer' RETURNING name")).rows)
        .toEqual([{ name: 'Machine customer' }])
      expect((await db.query('SELECT body FROM public.email_templates')).rows).toEqual([{ body: 'Synthetic template' }])
    })
  })

  it.each([
    ['changed grants', 'GRANT SELECT ON public.customers TO anon'],
    ['column grants', 'GRANT SELECT (name) ON public.customers TO authenticated'],
    ['TRUNCATE grants', 'GRANT TRUNCATE ON public.inquiries TO authenticated'],
    ['role bypass', 'ALTER ROLE authenticated BYPASSRLS'],
    ['changed policy', 'ALTER POLICY "Allow full access for authenticated users to inquiries" ON public.inquiries USING (false)'],
    ['additional policy', 'CREATE POLICY unexpected_access ON public.customers FOR SELECT TO anon USING (true)'],
    ['disabled RLS', 'ALTER TABLE public.inquiries DISABLE ROW LEVEL SECURITY'],
    ['forced RLS', 'ALTER TABLE public.inquiries FORCE ROW LEVEL SECURITY'],
  ])('aborts and rolls back on %s instead of overwriting concurrent changes', async (_name, change) => {
    const db = await fixture(false)
    await db.exec(change)
    const metadata = async () => (await db.query(`
      SELECT jsonb_build_object(
        'policies', (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename, p.policyname) FROM pg_policies p WHERE schemaname = 'public'),
        'tables', (SELECT jsonb_agg(jsonb_build_object('name', relname, 'rls', relrowsecurity, 'acl', relacl::text) ORDER BY relname) FROM pg_class WHERE oid IN ('public.customers'::regclass, 'public.inquiries'::regclass, 'public.email_templates'::regclass))
      ) AS state
    `)).rows
    const before = await metadata()
    await expect(applySecurityMigration(db)).rejects.toThrow(/CRM migration precondition/)
    expect(await metadata()).toEqual(before)
    expect((await db.query("SELECT to_regnamespace('crm_private') IS NULL AS absent")).rows).toEqual([{ absent: true }])
    expect((await db.query('SELECT name FROM public.customers')).rows).toEqual([{ name: 'Synthetic customer' }])
  })

  it('rolls back newly created membership objects if a later DDL operation fails', async () => {
    const db = await fixture(false)
    // Model a database-level deployment guard, without modifying the SQL under test.
    await db.exec(`
      CREATE FUNCTION public.reject_new_function() RETURNS event_trigger
        LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic deployment guard'; END $$;
      CREATE EVENT TRIGGER reject_new_function ON ddl_command_start
        WHEN TAG IN ('CREATE FUNCTION') EXECUTE FUNCTION public.reject_new_function();
    `)
    await expect(applySecurityMigration(db)).rejects.toThrow(/synthetic deployment guard/)
    expect((await db.query("SELECT to_regnamespace('crm_private') IS NULL AS absent")).rows).toEqual([{ absent: true }])
    expect((await db.query("SELECT count(*)::int AS count FROM pg_policies WHERE schemaname = 'public'")).rows)
      .toEqual([{ count: 3 }])
    await expect(asRole(db, 'authenticated', MEMBER_ID, () => db.query('SELECT * FROM public.customers')))
      .rejects.toMatchObject(permissionDenied)
    expect((await db.query('SELECT name FROM public.customers')).rows).toEqual([{ name: 'Synthetic customer' }])
  })
})
