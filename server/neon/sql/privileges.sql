-- Read-only catalog diagnostic, usable after target verification. No passwords/rolpassword.
BEGIN READ ONLY;
SELECT jsonb_build_object(
  'login',session_user,'role',current_user,'database',current_database(),
  'serverVersion',current_setting('server_version_num'),
  'ssl',(SELECT jsonb_build_object('enabled',ssl,'protocol',version,'cipher',cipher)
         FROM pg_stat_ssl WHERE pid = pg_backend_pid()),
  'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,
    'bypassrls',rolbypassrls,'createDb',rolcreatedb,'createRole',rolcreaterole,
    'replication',rolreplication,'inherit',rolinherit,'login',rolcanlogin))
    FROM pg_roles WHERE rolname IN ('neondb_owner','finanzas_migrator','finanzas_runtime','neon_superuser')),
  'memberships',(WITH RECURSIVE reachable(start_role,role_id) AS (
    SELECT r.oid,r.oid FROM pg_roles r WHERE rolname IN ('finanzas_runtime','finanzas_migrator')
    UNION SELECT r.start_role,m.roleid FROM reachable r JOIN pg_auth_members m ON m.member=r.role_id)
    SELECT coalesce(jsonb_agg(jsonb_build_object('start',r.start_role::regrole::text,
      'member',m.member::regrole::text,'role',m.roleid::regrole::text,
      'inherit',m.inherit_option,'set',m.set_option,'admin',m.admin_option)),'[]')
    FROM reachable r JOIN pg_auth_members m ON m.member=r.role_id),
  'runtimeDdl',jsonb_build_object('databaseCreate',has_database_privilege('finanzas_runtime',current_database(),'CREATE'),
    'temp',has_database_privilege('finanzas_runtime',current_database(),'TEMP'),
    'publicCreate',has_schema_privilege('finanzas_runtime','public','CREATE')),
  'runtimeOwnership',jsonb_build_object(
    'databases',(SELECT count(*) FROM pg_database WHERE datdba='finanzas_runtime'::regrole),
    'schemas',(SELECT count(*) FROM pg_namespace WHERE nspowner='finanzas_runtime'::regrole),
    'objects',(SELECT count(*) FROM pg_class WHERE relowner='finanzas_runtime'::regrole),
    'functions',(SELECT count(*) FROM pg_proc WHERE proowner='finanzas_runtime'::regrole)),
  'executableDefiners',(SELECT coalesce(jsonb_agg(n.nspname||'.'||p.proname),'[]')
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE p.prosecdef AND n.nspname NOT IN ('pg_catalog','information_schema')
      AND has_schema_privilege('finanzas_runtime',n.oid,'USAGE')
      AND has_function_privilege('finanzas_runtime',p.oid,'EXECUTE')),
  'domain',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',c.relname,
    'owner',c.relowner::regrole::text,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,
    'runtimeSelect',has_table_privilege('finanzas_runtime',c.oid,'SELECT'),
    'runtimeInsert',has_table_privilege('finanzas_runtime',c.oid,'INSERT'),
    'runtimeDelete',has_table_privilege('finanzas_runtime',c.oid,'DELETE'),
    'runtimeUpdate',has_table_privilege('finanzas_runtime',c.oid,'UPDATE'))),'[]')
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='finanzas' AND c.relkind='r'),
  'columns',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,
    'update',has_column_privilege('finanzas_runtime',c.oid,a.attnum,'UPDATE'))),'[]')
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    WHERE n.nspname='finanzas' AND c.relkind='r'));
COMMIT;
