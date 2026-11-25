-- STAGE B ONLY, after independent development endpoint verification and owner approval.
-- Run as neondb_owner on the DIRECT endpoint. No passwords or role memberships here.
BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT pg_advisory_xact_lock(78234199421);
DO $bootstrap$
DECLARE name text; existing pg_roles%ROWTYPE;
BEGIN
  IF current_database() <> 'neondb' OR current_user <> 'neondb_owner' OR session_user <> 'neondb_owner' THEN
    RAISE EXCEPTION 'BOOTSTRAP_CONTEXT_REFUSED';
  END IF;
  FOREACH name IN ARRAY ARRAY['finanzas_migrator','finanzas_runtime'] LOOP
    SELECT * INTO existing FROM pg_roles WHERE rolname = name;
    IF FOUND THEN
      IF existing.rolsuper OR existing.rolbypassrls OR existing.rolcreatedb OR existing.rolcreaterole
         OR existing.rolreplication OR existing.rolinherit
         OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member = existing.oid) THEN
        RAISE EXCEPTION 'UNSAFE_EXISTING_ROLE';
      END IF;
      -- Existing LOGIN/password are preserved. No silent credential rotation or repair.
    ELSE
      EXECUTE format('CREATE ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION',name);
    END IF;
  END LOOP;
END
$bootstrap$;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE neondb FROM PUBLIC;
GRANT CONNECT, CREATE ON DATABASE neondb TO finanzas_migrator;
GRANT CONNECT ON DATABASE neondb TO finanzas_runtime;
DO $check$
BEGIN
  IF has_database_privilege('finanzas_runtime','neondb','CREATE')
     OR has_database_privilege('finanzas_runtime','neondb','TEMP')
     OR has_schema_privilege('finanzas_runtime','public','CREATE')
     OR EXISTS(SELECT 1 FROM pg_database WHERE datdba = 'finanzas_runtime'::regrole)
     OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner = 'finanzas_runtime'::regrole)
     OR EXISTS(SELECT 1 FROM pg_class WHERE relowner = 'finanzas_runtime'::regrole)
     OR EXISTS(SELECT 1 FROM pg_proc WHERE proowner = 'finanzas_runtime'::regrole) THEN
    RAISE EXCEPTION 'RUNTIME_PRIVILEGE_DRIFT';
  END IF;
END
$check$;
COMMIT;
