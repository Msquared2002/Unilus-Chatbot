const { checkSecurity } = require('./migrationService');
async function verifyRuntime(db) {
  const r=await db.get('SELECT rolname,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolinherit FROM pg_roles WHERE rolname=current_user');
  if(!r||r.rolname!=='unilus_backend'||r.rolsuper||r.rolbypassrls||r.rolcreaterole||r.rolcreatedb||r.rolinherit)throw Error('Dedicated restricted runtime role required');
  const membership=await db.get('SELECT count(*) AS n FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=current_user');
  if(Number(membership.n))throw Error('Runtime role memberships require review');
  await checkSecurity({query:async(sql,params)=>({rows:await db.all(sql,params)})});
}
module.exports={verifyRuntime};
