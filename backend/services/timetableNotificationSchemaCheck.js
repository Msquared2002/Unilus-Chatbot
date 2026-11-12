async function check(client){
 const names=['timetable_publications','timetable_changes','timetable_subscriptions','timetable_notification_reads','timetable_demo_overrides'];
 for(const name of names){
  const rows=(await client.query("SELECT c.relrowsecurity AS rls,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=$1",[name])).rows;
  if(rows.length!==1||!rows[0].rls||rows[0].owner==='unilus_backend')throw Error('TIMETABLE_NOTIFICATION_RLS_REQUIRED');
  for(const role of ['anon','authenticated','unilus_backend']){
   const r=(await client.query("SELECT has_table_privilege($1,$2,'SELECT') AS s,has_table_privilege($1,$2,'INSERT') AS i,has_table_privilege($1,$2,'UPDATE') AS u,has_table_privilege($1,$2,'DELETE') AS d,has_table_privilege($1,$2,'TRUNCATE,REFERENCES,TRIGGER') AS extra",[role,'public.'+name])).rows[0];
   const backend=role==='unilus_backend',mutable=backend&&name==='timetable_subscriptions';
   if(r.s!==backend||r.i!==backend||r.u!==mutable||r.d!==mutable||r.extra)throw Error('TIMETABLE_NOTIFICATION_GRANT_DRIFT');
  }
  const policies=(await client.query("SELECT cmd,roles,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename=$1",[name])).rows;
  const commands=name==='timetable_subscriptions'?['SELECT','INSERT','UPDATE','DELETE']:['SELECT','INSERT'];
  if(policies.length!==commands.length||commands.some(cmd=>!policies.some(p=>p.cmd===cmd))||policies.some(p=>!(Array.isArray(p.roles)?p.roles.length===1&&p.roles[0]==='unilus_backend':p.roles==='{unilus_backend}')||(p.qual&&!/^\(?true\)?$/.test(p.qual))||(p.with_check&&!/^\(?true\)?$/.test(p.with_check))))throw Error('TIMETABLE_NOTIFICATION_POLICY_DRIFT');
 }
}
module.exports={check};
