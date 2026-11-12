const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
test('prepared timetable migration limits grants, enables policies, and preserves foreign keys',async()=>{
 const pg=new PGlite();try{
  await pg.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE unilus_backend;ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;');
  await pg.exec(fs.readFileSync(path.join(__dirname,'../migrations/003_timetable_notifications.sql'),'utf8'));
  await require('../services/timetableNotificationSchemaCheck').check({query:(sql,p)=>pg.query(sql,p)});
  await pg.exec("SET ROLE unilus_backend;INSERT INTO timetable_publications VALUES('synthetic',1,'2099-sem1','hash','{}',null,'2099-01-01','synthetic');");
  await assert.rejects(pg.exec('DELETE FROM timetable_publications'));
  await assert.rejects(pg.exec("INSERT INTO timetable_changes VALUES('change','unknown','[]','{}','2099-01-01')"));
  await pg.exec('RESET ROLE;SET ROLE anon');await assert.rejects(pg.query('SELECT * FROM timetable_changes'));
 }finally{await pg.close();}
});
