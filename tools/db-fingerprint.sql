-- Schema fingerprint: run in production (Supabase SQL editor) and on a local database started from supabase/migrations.
-- Every row should match. A different hash shows which kind of object drifted (functions, columns, policies, grants...).
with o as (
 select 'func' k, p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' n, md5(pg_get_functiondef(p.oid)) h from pg_proc p where p.pronamespace in ('public'::regnamespace,'private'::regnamespace) and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')
 union all select 'fgrant', p.proname||'('||pg_get_function_identity_arguments(p.oid)||')', md5(coalesce((select string_agg(x.grantee::regrole::text||x.privilege_type, ',' order by x.grantee::regrole::text||x.privilege_type collate "C") from aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) x where x.grantee=0 or x.grantee::regrole::text in ('anon','authenticated')),'')) from pg_proc p where p.pronamespace='public'::regnamespace and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')
 union all select 'col', c.relname||'.'||a.attname, md5(format_type(a.atttypid,a.atttypmod)||a.attnotnull||coalesce(pg_get_expr(ad.adbin,ad.adrelid),'')||a.attidentity::text) from pg_attribute a join pg_class c on c.oid=a.attrelid left join pg_attrdef ad on ad.adrelid=a.attrelid and ad.adnum=a.attnum where c.relnamespace in ('public'::regnamespace,'private'::regnamespace) and c.relkind='r' and a.attnum>0 and not a.attisdropped
 union all select 'con', conrelid::regclass::text||'.'||conname, md5(pg_get_constraintdef(oid)) from pg_constraint where connamespace in ('public'::regnamespace,'private'::regnamespace)
 union all select 'idx', indexrelid::regclass::text, md5(pg_get_indexdef(indexrelid)) from pg_index i join pg_class c on c.oid=i.indrelid where c.relnamespace='public'::regnamespace
 union all select 'pol', schemaname||'.'||tablename||'.'||policyname, md5(permissive||cmd||roles::text||coalesce(qual,'')||coalesce(with_check,'')) from pg_policies where schemaname in ('public','storage')
 union all select 'trg', tgname, md5(pg_get_triggerdef(t.oid)) from pg_trigger t join pg_class c on c.oid=t.tgrelid where not tgisinternal and c.relnamespace='public'::regnamespace
 union all select 'rls', relname, md5(relrowsecurity::text) from pg_class where relnamespace='public'::regnamespace and relkind='r'
 union all select 'tgrant', c.relname, md5(coalesce((select string_agg(x.grantee::regrole::text||x.privilege_type, ',' order by x.grantee::regrole::text||x.privilege_type collate "C") from aclexplode(c.relacl) x where x.grantee=0 or x.grantee::regrole::text in ('anon','authenticated')),'')) from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r'
 union all select 'pub', tablename, 'x' from pg_publication_tables where pubname='supabase_realtime'
 union all select 'bucket', id, md5(public::text||coalesce(file_size_limit::text,'')||coalesce(allowed_mime_types::text,'')) from storage.buckets
)
select k, count(*), left(md5(string_agg(n||' '||h, ',' order by n collate "C")),10) from o group by k order by k;
