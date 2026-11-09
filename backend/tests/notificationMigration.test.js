const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
test('notification SQL preserves event rows and restricts commands with RLS',async()=>{
 const pg=new PGlite();const client={query:(sql,p)=>p?pg.query(sql,p):pg.query(sql)};
 try{
  await pg.exec("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE unilus_backend;CREATE TABLE public.ticket_events(id serial primary key,body text);INSERT INTO ticket_events(body) VALUES('synthetic private event');ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;");
  await pg.exec(fs.readFileSync(path.join(__dirname,'../migrations/002_ticket_notification_reads.sql'),'utf8'));
  await require('../services/notificationSchemaCheck').check(client);
  assert.equal((await pg.query('SELECT body FROM ticket_events')).rows[0].body,'synthetic private event');
  await pg.exec("SET ROLE unilus_backend;INSERT INTO ticket_notification_reads VALUES('user:synthetic',1);");
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM ticket_notification_reads')).rows[0].n,1);
  await assert.rejects(pg.exec('DELETE FROM ticket_notification_reads'));
  await assert.rejects(pg.exec("INSERT INTO ticket_notification_reads VALUES('user:synthetic',1)"));
  await pg.exec('RESET ROLE;SET ROLE anon');await assert.rejects(pg.query('SELECT * FROM ticket_notification_reads'));
 }finally{await pg.close();}
});
