// Offline component/end-to-end benchmark with authentic retained university data.
// Final LLM generation is deliberately not scored; no dotenv or remote services.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
process.env.DATABASE_URL='';process.env.SQLITE_FILE=':memory:';process.env.NODE_ENV='test';process.env.QUERY_PLANNER_ENABLED='false';process.env.GROQ_API_KEY='';process.env.VECTOR_BACKEND='json';process.env.DEMO_ACADEMIC_ENABLED='no';
let generationCalls=0,retrievalCalls=0,lastEvidence='';
require('../services/embeddingService').createEmbedding=async()=>{throw Error('Offline benchmark: lexical retrieval only');};
require('../services/aiService').askAI=async(q,context)=>{generationCalls++;lastEvidence=context;return '[Unscored final-generation boundary: evidence captured]';};
const knowledge=require('../services/knowledgeService'),search=knowledge.searchKnowledge;
knowledge.searchKnowledge=async(...args)=>{retrievalCalls++;return search(...args);};
const chat=require('../services/chatService'),rows=require('../data/timetable/timetable.json');
const version=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../data/timetable/timetable.json'))).digest('hex');
const cases=[
 {name:'ambiguous room',questions:['When is Room 10 free tomorrow?'],role:'student',schedule:'clarification'},
 {name:'same campus ambiguous building',questions:['When is Room 3 available at Silverest on Monday?'],role:'student',schedule:'clarification'},
 {name:'unknown room',questions:['When is Room 999 free on Monday?'],role:'student',schedule:'unavailable'},
 {name:'unknown lecturer identity',questions:['When is my lecturer free on Wednesday?'],role:'student',schedule:'clarification'},
 {name:'lecturer calculation',questions:['When is Mr D. Tembo free on Wednesday?'],role:'student',schedule:'calculated',answer:/14:00–17:30/},
 {name:'lecturer day follow-up',questions:['When is Mr D. Tembo free on Wednesday?','What about Thursday?'],role:'student',schedule:'calculated',day:'Thursday'},
 {name:'room clarification follow-up',questions:['When is Room 10 free tomorrow?','Silverest.','Knowledge Field 2'],role:'student',schedule:'calculated'},
 {name:'cohort identity missing',questions:['What is my longest break between classes on Monday?'],role:'student',schedule:'clarification'},
 {name:'cohort selection follow-up',questions:['What is my longest break between classes on Monday?','BIT32'],role:'student',schedule:'calculated',answer:/12:00–16:00/},
 {name:'longest cohort break',questions:['What is the longest break between classes for BIT32 on Monday?'],role:'student',schedule:'calculated',answer:/12:00–16:00/},
 {name:'daily load comparison',questions:['Which day has the fewest classes for BIT32?'],role:'student',schedule:'calculated'},
 {name:'consecutive sessions',questions:['Do I have back-to-back classes for BIT32 on Monday?'],role:'student',schedule:'calculated'},
 {name:'last lecture end',questions:['What time does my last lecture end for BIT32 on Friday?'],role:'student',schedule:'calculated'},
 {name:'room occupancy',questions:['Is Room 10 occupied at Silverest Knowledge Field 2 on Monday at 11 AM?'],role:'student',schedule:'calculated'},
 {name:'two-hour follow-up',questions:['What is the longest break between classes for BIT32 on Monday?','Is there a two-hour gap?'],role:'student',schedule:'calculated',answer:/Yes, a gap/},
 {name:'next-class source join',questions:['Where is my next class for BIT32 on Monday at 8 AM?'],role:'student',schedule:'calculated'},
 {name:'guest timetable privacy',questions:['When is Room 10 free tomorrow?'],role:'public',check:r=>r.signInRequired&&!r.schedule},
 {name:'BIT tuition identity and value',questions:['BIT fees local 2026 year 3 semester 2'],role:'public',answer:/15,050/,source:/PROSPECTUS/},
 {name:'foreign medicine tuition',questions:['Medicine tuition foreign 2026 year 1 semester 1'],role:'public',answer:/2,080/,check:r=>!/ZMW/.test(r.answer)},
 {name:'unknown tuition year',questions:['BIT fees local 2099'],role:'public',check:r=>r.tuition?.status==='unavailable'},
 {name:'hospital MRI evidence',questions:['Does UNILUS Hospital offer MRI and dialysis?'],role:'public',answer:/MRI/,source:/hospital-brochure/},
 {name:'hospital uncertainty',questions:['What insurance does UNILUS Hospital accept?'],role:'public',answer:/not.*current|not independently verified|unknown/i,source:/hospital-brochure/},
 {name:'programme interest and requirements',questions:['Help me choose a programme. I like history. What grades would I need?'],role:'public',check:r=>Boolean(r.queryType?.isProgrammeAdvisor)},
 {name:'academic versus programme routing',questions:['Compare my academic performance across all semesters'],role:'public',check:r=>!r.advisor&&!r.academic?.records&&/cannot access|sign in|signed.in/i.test(r.answer)},
 {name:'unknown operational evidence',questions:['What prices are on the cafeteria menu?'],role:'public',answer:/no current verified|not.*current|confirm/i},
 {name:'university policy retrieval',questions:['What is the programme deferment procedure at UNILUS?'],role:'public',evidence:/defer/i},
];
function verifyCalculation(result){
 const s=result.schedule;if(!s||s.status!=='calculated')return null;
 if(!s.provenance.every(p=>rows.some(r=>r.day===p.day&&r.time===p.time&&r.course_code===p.course_code)))return false;
 for(const summary of s.summaries){if(summary.invalidIntervals)continue;const w=summary.window;if(!w)continue;
  // Exhaustive minute membership independently checks the returned partition.
  for(let minute=w.start;minute<w.end;minute++){
   const occupied=summary.occupied.some(i=>i.start<=minute&&minute<i.end),gap=summary.gaps.some(i=>i.start<=minute&&minute<i.end);
   if(occupied===gap)return false;
  }
 }
 return true;
}
(async()=>{
 const results=[];
 for(const c of cases){const id=crypto.randomUUID(),start=performance.now(),g0=generationCalls,t0=retrievalCalls;let r;lastEvidence='';
  try{for(const question of c.questions)r=await chat.answerQuestion(question,id,c.role);
   const calculated=verifyCalculation(r),supported=(!c.answer||c.answer.test(r.answer))&&(!c.source||c.source.test(JSON.stringify(r.sources)))&&(!c.evidence||c.evidence.test(lastEvidence));
   const pass=(!c.schedule||r.schedule?.status===c.schedule)&&(!c.day||r.schedule?.plan.day===c.day)&&(!c.check||c.check(r))&&supported&&calculated!==false;
   results.push({name:c.name,question:c.questions.at(-1),context:c.questions.slice(0,-1),role:c.role,dataVersion:version,expectedService:c.schedule?'schedule.read':c.source?'source-backed structured service':'existing authenticated/knowledge route',requiredEvidence:c.schedule?'Retained timetable with record provenance':c.source?.source||'Existing service or filtered knowledge evidence',expectedConstraints:{scheduleStatus:c.schedule,answerPattern:c.answer?.source,sourcePattern:c.source?.source,day:c.day},acceptableUncertainty:'Current validity and incomplete coverage must be qualified; model-generated text is unscored',unacceptableClaims:['confirmed room booking','confirmed consultation availability','guessed student group','private records for guest'],pass,actualStatus:r.schedule?.status||r.tuition?.status||r.queryType,answer:r.answer,calculationVerified:calculated,latencyMs:performance.now()-start,inferenceCalls:generationCalls-g0,toolCalls:retrievalCalls-t0,unscoredGeneration:generationCalls>g0});
  }catch(e){results.push({name:c.name,pass:false,error:e.message});}
 }
 const report={generatedAt:new Date().toISOString(),methodology:'Offline local benchmark: authentic timetable and structured sources; lexical-only RAG; final LLM generation stubbed and explicitly unscored. Status detection is not a comprehensive fluent-answer metric. Cross-user HTTP privacy is covered separately by security tests.',passed:results.filter(r=>r.pass).length,total:results.length,metrics:{calculationFailures:results.filter(r=>r.calculationVerified===false).length,unscoredGenerationCases:results.filter(r=>r.unscoredGeneration).length,liveGroqCost:null,unnecessaryClarificationRate:null,falseUnavailableRate:null,privacyViolations:null},results};
 const output=process.argv[2]||path.join(__dirname,'../../docs/retrieval-audit/quality-after.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(`${report.passed}/${report.total}`);console.log(results.filter(r=>!r.pass).map(r=>r.name+': '+(r.error||r.actualStatus)).join('\n'));await require('../services/db').close();
})().catch(e=>{console.error(e);process.exitCode=1;});
