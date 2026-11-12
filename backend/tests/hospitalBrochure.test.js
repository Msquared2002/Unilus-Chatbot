const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
test('every indexed brochure chunk preserves unknown date, source images, public access and availability qualification',async()=>{
 const chunks=await require('../scripts/ingestDocuments').ingestFile(path.join(__dirname,'../data/documents/campus/hospital-brochure.txt'));
 assert.ok(chunks.length>0);for(const c of chunks){assert.equal(c.metadata.source_file,'hospital-brochure.txt');assert.equal(c.metadata.publication_date,null);assert.equal(c.metadata.access,'public');assert.equal(c.metadata.source_images.length,7);assert.match(c.text,/Undated printed brochure; current/);assert.doesNotMatch(c.text,/23472|23072/);}
 const text=chunks.map(c=>c.text).join('\n');for(const fact of ['dialysis','physiotherapy','MRI','ambulance','NHIMA','Prudential','hospital@unilus.ac.zm'])assert.ok(text.includes(fact),fact);
});
