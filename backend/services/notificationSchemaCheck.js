// Focused post-migration verification; no schema writes.
async function check(client) {
 const q=async(sql,p)=>(await client.query(sql,p)).rows;
 const [table]=await q("SELECT c.relrowsecurity AS rls,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='ticket_notification_reads'");
 if(!table||!table.rls||table.owner==='unilus_backend')throw Error('NOTIFICATION_SCHEMA_SECURITY_FAILED');
 const columns=await q("SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='ticket_notification_reads' ORDER BY ordinal_position");
 if(JSON.stringify(columns)!==JSON.stringify([{column_name:'owner',data_type:'text',is_nullable:'NO'},{column_name:'event_id',data_type:'integer',is_nullable:'NO'}]))throw Error('NOTIFICATION_COLUMN_DRIFT');
 const policies=await q("SELECT cmd,roles,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename='ticket_notification_reads'");
 if(policies.length!==2||policies.some(p=>JSON.stringify(p.roles)!==JSON.stringify(['unilus_backend'])&&p.roles!=='{unilus_backend}')||!policies.some(p=>p.cmd==='SELECT'&&/^\(?true\)?$/.test(p.qual)&&!p.with_check)||!policies.some(p=>p.cmd==='INSERT'&&/^\(?true\)?$/.test(p.with_check)&&!p.qual))throw Error('NOTIFICATION_POLICY_DRIFT');
 for(const role of ['anon','authenticated','unilus_backend']){
  const [r]=await q("SELECT has_table_privilege($1,'public.ticket_notification_reads','SELECT') AS s,has_table_privilege($1,'public.ticket_notification_reads','INSERT') AS i,has_table_privilege($1,'public.ticket_notification_reads','UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS extra",[role]);
  if(r.extra||r.s!==(role==='unilus_backend')||r.i!==(role==='unilus_backend'))throw Error('NOTIFICATION_GRANT_DRIFT');
 }
 const keys=await q("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public.ticket_notification_reads'::regclass");
 if(!keys.some(k=>k.definition==='PRIMARY KEY (owner, event_id)')||!keys.some(k=>k.definition==='FOREIGN KEY (event_id) REFERENCES ticket_events(id)'))throw Error('NOTIFICATION_KEY_DRIFT');
}
module.exports={check};
