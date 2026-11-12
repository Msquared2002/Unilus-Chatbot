const {catalogue}=require('./programmeCatalogueService');
const preference=require('./programmePreferenceService');
const {evaluateEligibility}=require('./programmeEligibilityService');
const fields = {
 computing:['computer','computers','computing','software','technology','programming'],
 business:['business','management','commerce','entrepreneurship'],
 law:['law','legal','justice','lawyer'],
 health:['health','biology','nursing','medicine'],
 finance:['finance','accounting','accountancy','economics']
};
function parseInput(text) {
 const lower=require('./applicantResultParser').withoutResults(text).toLowerCase();
 const interests=Object.entries(fields).filter(([,words])=>words.some(w=>new RegExp(`\\b${w}\\b`).test(lower))).map(([field])=>field);
 const results=require('./applicantResultParser').extract(text);
 return {interests,results};
}
function recommend(input) {
 return catalogue.filter(p=>(p.level==='undergraduate' || input.exploreDiplomas && p.level==='diploma') && p.offeringStatus==='current_application_catalogue').map(p=>{
 const reasons=preference.matchReasons(p,input);
 return {programme:p,score:preference.score(p,input),reasons,eligibility:evaluateEligibility(p,input.results,input)};
 }).filter(r=>r.score>0&&(r.programme.evidence.length || r.programme.rules.length)).sort((a,b)=>b.score-a.score||a.programme.name.localeCompare(b.programme.name)).slice(0,input.showMore?6:3);
}
const {store}=require('./programmeAdvisorState');
function selectionIntent(q){return /(?:want|would like|wish).*(?:study|pursue).*(?:unilus|university|programmes?|degrees?)|want to pursue a programme|help.*choos.*(?:course|programme)|(?:don't|do not|not).*know.*(?:study|apply|choose)|which programme.*(?:right|advise|recommend|suit)|what could i study|can you recommend something/i.test(q);}
function canHandle(question,sessionId){const q=String(question).replace(/\bprogram\b/gi,'programme'),p=store.get(sessionId);if(require('./conversationService').universityAcademic(q)||/my (?:academic|student) profile|what programme am i|my weakest course|\b(?:timetable|reminders?|morning brief|ticket|fees?|tuition|where is|campus map)\b|struggling (?:emotionally|mentally)|hurt myself|suicid|kill myself/i.test(q))return false;return selectionIntent(q)||!!(p&&p.topicActive!==false&&(/uncertain|confused|not sure|need help|don't know|do not know|tell me more|best matching|what qualifications|share.*results|which would suit|prefer|what could i study/i.test(q)||q.length<200&&preference.preferences(q).fields.length));}
function tryAnswer(question, sessionId) {
 question=String(question).replace(/\bprogram\b/gi,'programme');
 if(require('./conversationService').universityAcademic(question))return null;
 const previous=store.get(sessionId);
 const contextActive=previous && previous.topicActive!==false;
 const resolved=preference.resolve(question);
 const requestedAction=/^Advisor:/i.test(question);
 if(requestedAction&&!previous)return {answer:'Your temporary assessment has expired or was reset. Please share your interests or results to begin again.',queryType:{isProgrammeAdvisor:true},sources:[],resources:[],recommendedResources:[],timetableMatches:0,suggestedActions:[]};
 if (/\b(timetable|campus|where is|fees|payment|ticket)\b/i.test(question)) return null;
 const reset=/forget my previous results|start again|new assessment/i.test(question);
 const extracted=parseInput(/more interested/i.test(question) ? question.split(/\bthan\b/i)[0] : question);
 const personal=/\b(i enjoy|i love|i like|i prefer|interested in|career|my interests|more interested|want to become|want to be|good at|strong in)\b/i.test(question);
 const comparison=/\bcompare\b|\bdifference between\b/i.test(question) || contextActive && (/which one|the (?:first|second) (?:one|programme)|\bboth\b|\beach programme\b|\bwhich has better career|matches my interests better|more business.oriented|more programming/i.test(question) || (previous?.considering?.length>=2 && /what if|which programme best matches|which programme would you recommend|which would suit|i prefer|career opportunities for each|do i qualify|what other information/i.test(question)));
 const intent=/\b(?:qualify|eligible|eligibility|meet (?:the )?(?:entry )?requirements|admi(?:ssion|tted))\b/i.test(question)?'eligibility':/\b(?:entry requirements?|requirements? for|qualifications? would i need)\b/i.test(question)?'requirements':/\b(?:career opportunities|career paths|jobs|work as)\b/i.test(question)?'careers':comparison?(/\b(?:suit|match|prefer|interested|recommend|better for)\b/i.test(question)?'suitability':'comparison'):/\b(?:suit|match|prefer|recommend|why|interested)\b/i.test(question)?'suitability':'discovery';
 const followup=/recommend|why.*suggest|entry requirements|published academic|what about|what other information|recorded results|add another subject|correct a grade|correct my results|finished|all my results/i.test(question);
 if (!canHandle(question,sessionId) && !requestedAction && !resolved.length && !reset && !personal && !comparison && !extracted.results.length && !require("./applicantResultParser").qualification(question) && !/five(?: O.level)? credits/i.test(question) && !(contextActive && followup) && !/what should i study|programme advisor|do i qualify|can i qualify|which one.*(?:programming|software|business)|which.*programme.*suit|help choos(?:e|ing)|help me choos(?:e|ing) (?:a |an |my )?(?:university )?programmes?/i.test(question)) return null;
 if(reset){store.clear(sessionId);return {answer:'Your temporary applicant profile has been cleared. Which subjects or fields interest you?',queryType:{isProgrammeAdvisor:true},sources:[],resources:[],recommendedResources:[],timetableMatches:0,suggestedActions:[]};}
 const profile=previous || {interests:[],results:[],considering:[],qualification:'unknown'};
 profile.currentIntent=intent;
 if(!contextActive && /\b(?:which one|first one|second one|both programmes)\b/i.test(question) && !resolved.length)return {answer:'Which two programmes would you like to compare? Please name them so I can use their verified information.',queryType:{isProgrammeAdvisor:true},sources:[],resources:[],recommendedResources:[],timetableMatches:0,suggestedActions:[]};
 const qualification=require('./applicantResultParser').qualification(question);
 if(qualification && profile.qualification!=='unknown' && qualification!==profile.qualification && profile.results.length)profile.requiresVerification=true;
 if(/combine|multiple sittings|different sittings/i.test(question))profile.requiresVerification=true;
 if(qualification){
   if(profile.qualification==='unknown') profile.results=profile.results.map(r=>({...r,qualification}));
   profile.qualification=qualification;
 }
 if(/finished|all my results/i.test(question))profile.resultsComplete=true;
 profile.outstanding=[];
 const prefs=preference.preferences(require('./applicantResultParser').withoutResults(question));
 const interestReply=contextActive&&!resolved.length&&question.length<200&&!/requirements?|qualifications?|results|compare|difference|tell me more/i.test(question)&&prefs.fields.length>0;
 if(!personal&&!interestReply){extracted.interests=[];for(const key of ['careers','activities','strengths','fields'])prefs[key]=[];prefs.style=null;}
 if(prefs.fields.length&&(personal||interestReply))profile.latestInterest=prefs.fields.at(-1);
 const priorPrefs=profile.preferences || {careers:[],activities:[],strengths:[],fields:[]};
 profile.preferences={...priorPrefs,style:prefs.style||priorPrefs.style};
 for(const key of ['careers','activities','strengths','fields'])profile.preferences[key]=[...new Set([...(priorPrefs[key]||[]),...prefs[key]])].slice(-10);
 if(/more interested|instead|change.*interest/i.test(question))profile.preferences.fields=prefs.fields;
 if(/more interested/i.test(question) && /business systems|managing technology/i.test(question))profile.latestFocus='business systems and technology management';
 else if(/prefers? software development|more interested in software development|practical application development/i.test(question))profile.latestFocus='software development';
 if(/diploma/i.test(question))profile.exploreDiplomas=true;
 if(/other programmes|more programmes|related programmes/i.test(question))profile.showMore=true;

 if(/five credits/i.test(question))profile.reportedCreditTotal=5;
 const ambiguous=extracted.results.filter(r=>r.grade==='AMBIGUOUS');
 if(ambiguous.length)return {answer:'You reported different grades for '+ambiguous.map(r=>r.subject+' ('+r.alternatives.join(' or ')+')').join(', ')+'. Which is correct? No grades from this message have been applied.',queryType:{isProgrammeAdvisor:true},sources:[],resources:[],recommendedResources:[],timetableMatches:0,suggestedActions:[]};
 for(const result of extracted.results){const index=profile.results.findIndex(r=>r.subject===result.subject);if(index<0)profile.results.push({...result,qualification:profile.qualification});else profile.results[index]={...result,qualification:profile.qualification};}
 profile.results=profile.results.slice(-30);
 profile.interests=/more interested|instead|change.*interest/i.test(question)?extracted.interests:[...new Set([...profile.interests,...extracted.interests])];
 store.set(sessionId,profile);

 const input=profile;
 let recommendations=recommend(input);
 const target=resolved.length===1 && !comparison?resolved[0]:contextActive && /\b(?:its|that programme|entry requirements|details|overview|tell me more|best matching programme|qualifications|share my grade 12 results)\b/i.test(question) && profile.lastProgramme && !comparison ? catalogue.find(p=>p.id===profile.lastProgramme) : null;
 if(!target && extracted.results.length && profile.lastProgramme){const p=catalogue.find(p=>p.id===profile.lastProgramme);if(p)recommendations=[{programme:p,reasons:["Reassessed using your updated results."],eligibility:evaluateEligibility(p,input.results,input)}];}
 const priorProgramme=contextActive ? profile.lastProgramme : null;
 if(target){profile.lastProgramme=target.id;store.set(sessionId,profile);}
 if(target)recommendations=[{programme:target,reasons:['You asked about this programme.'],eligibility:evaluateEligibility(target,input.results,input)}];
 let named=[...resolved];
 if(comparison){
  for(const [pattern,id] of [[/\bBBA\b/i,'bachelor-of-business-administration'],[/computer science/i,'bachelor-of-science-in-computer-science']])if(pattern.test(question)){const p=catalogue.find(p=>p.id===id);if(p&&!named.includes(p))named.push(p);}
  if(/\bit\b/i.test(question)&&priorProgramme){const p=catalogue.find(p=>p.id===priorProgramme);if(p&&!named.includes(p))named.push(p);}
  if(profile.considering.length>=2 && named.length<2){
   const prior=profile.considering.map(id=>catalogue.find(p=>p.id===id)).filter(Boolean);
   if(/\b(?:first|second)\b/i.test(question))named=[prior[/\bsecond\b/i.test(question)?1:0]].filter(Boolean);
   else if(!named.length)named=prior;
   else named=[...named,...prior.filter(p=>!named.some(n=>n.id===p.id))];
  }
 }
 if(comparison && named.length<2 && !(named.length===1 && /\b(?:first|second)\b/i.test(question))) return {answer:'Which two programmes would you like to compare? Please name them so I can use their verified information.',queryType:{isProgrammeAdvisor:true},sources:[],resources:[],recommendedResources:[],timetableMatches:0,suggestedActions:[]};
 if(comparison){if(named.length>=2)profile.considering=named.slice(0,3).map(p=>p.id);store.set(sessionId,profile);}
 if(!comparison&&!target&&recommendations.length){profile.lastProgramme=recommendations[0].programme.id;store.set(sessionId,profile);}

 const statusText={additional_grade_information_required:'I would need your subject grades to assess the published requirements.',missing_or_unrecognized:'Some required subjects or grades have not been identified yet.',requirements_not_sufficiently_documented:'The available official information does not document enough admission conditions for an eligibility decision.',meets_checked_published_conditions:'Your reported grades meet the published conditions checked here; UNILUS Admissions makes the final decision.',does_not_meet_checked_condition:'At least one reported grade does not meet a published condition.',conflicting_requirements:'The available admission sources conflict; please confirm with UNILUS Admissions.'};
 const explain=r=>statusText[r.status]||'UNILUS Admissions should verify your qualifications against the published requirements.';
 const requirements=p=>{const r=p.rules[0];if(!r)return 'Detailed entry requirements are not sufficiently documented.';return [r.minimumCredits?`At least ${r.minimumCredits} credits.`:null,...Object.entries(r.required||{}).map(([subject,grade])=>`${subject}: ${grade} or better.`)].filter(Boolean).join(' ')||'Detailed entry requirements are not sufficiently documented.';};
 let answer='Programme Advisor:\n\n';
 if(input.results.length) answer+= 'Recorded results: '+input.results.map(r=>{const c=/^ecz_/.test(input.qualification)?require('./eczGradeService').classify(r.grade):null;return `${r.subject}: ${r.grade}${c?' ('+c.classification+')':''}`;}).join(', ')+'.\n\n';
 if(input.qualification==='unknown' && input.results.length)answer+='Are these ECZ School Certificate, ECZ GCE or another qualification? Numeric grades will not be interpreted until you confirm.\n\n';
 if(input.requiresVerification)answer+='Mixed qualifications or sittings require institutional verification; they are not combined for this assessment.\n\n';
 if(!input.interests.length&&!input.preferences.fields.length && !target && !profile.lastProgramme) answer+='Of course. I can help you explore verified UNILUS programmes based on your interests, career goals and qualifications. Do you have a field in mind, or would you like help discovering one? Which subjects or activities do you enjoy? Grade 12 results are optional until you want an eligibility check.';
 else if(!recommendations.length) answer+='I cannot confidently match that interest to the verified catalogue. Please describe another subject or career interest.';
 else answer+=recommendations.map(r=>{
  const p=r.programme,description=p.description?String(p.description).replace(/\uFFFC/g,'').slice(0,600):'The current catalogue verifies this programme title; a detailed current description is not available in the structured sources.';
  return '**'+p.name+'**\n'+description+'\n'+(intent==='eligibility'?'Eligibility: '+explain(r.eligibility):intent==='requirements'?'Published requirements: '+requirements(p):'Interest fit: '+(r.reasons.join(' ')||'No supported preference overlap identified.'))+'\nSource: '+(p.review?.programmeSource||p.rules[0]?.url||p.applicationSource)+'.';
 }).join('\n\n');
 if(comparison) answer='Programme '+(intent==='requirements'?'entry requirements':intent==='eligibility'?'eligibility':intent==='careers'?'career opportunities':intent==='suitability'?'suitability':'comparison')+' (verified information):\n\n'+named.slice(0,3).map(p=>`**${p.name}**\n${intent==='requirements'?requirements(p):p.description || 'Verified description unavailable.'}\n${intent==='eligibility'?explain(evaluateEligibility(p,input.results,input)):intent==='suitability'?'Interest fit: '+(preference.matchReasons(p,input).join(' ') || 'No supported interest overlap identified.'):''}\nSource: ${p.evidence[0]?.source || p.rules[0]?.url || p.applicationSource}`).join('\n\n');
 if(comparison && intent==='suitability' && /software development|writing software|programming/i.test(question))answer+='\n\nFor the software development preference you stated, Computer Science is the closer match: its verified description explicitly covers programming and software engineering. Information Systems and Technology emphasizes information systems and technology in organizations.';
 if(comparison && intent==='suitability' && /business systems|managing technology/i.test(question))answer+='\n\nFor the business systems preference you stated, Information Systems and Technology is the closer match: its verified description covers information systems and managing information infrastructure.';
 if(comparison && intent==='suitability' && /based on everything/i.test(question) && profile.latestFocus==='business systems and technology management')answer+='\n\nBased on your latest stated preference for business systems and managing technology, I recommend Information Systems and Technology. The verified programme description emphasizes information systems and technology management in organisations.';
 if(intent==='eligibility' && /five O.level credits/i.test(question) && !input.results.length)answer+='\n\nFive credits alone do not establish eligibility for either programme. Please provide the individual subject grades and qualification type.';
 if(intent==='eligibility' && /what other information/i.test(question))answer+='\n\nI would need the individual subject grades, the qualification type and confirmation of any other published admission conditions before assessing eligibility.';
 answer=answer.replace(/additional_grade_information_required|missing_or_unrecognized|requirements_not_sufficiently_documented|conflicting_requirements|meets_checked_published_conditions|does_not_meet_checked_condition/g,code=>statusText[code]);
 if(!target&&!comparison&&profile.latestInterest==='history')answer+='\n\nWhat interests you most about history: politics and international affairs, how societies develop, or government and leadership?';
 else if(!target&&!comparison&&input.preferences.fields.includes('computing'))answer+='\n\nWould you rather build software, secure systems, or manage technology in organisations?';
 if(/can i share.*(?:grade 12|results)/i.test(question))answer='Yes. Share each subject and grade, and tell me whether the qualification is ECZ School Certificate, ECZ GCE or another system. Avoid names, student IDs and certificate numbers.\n\n'+answer;
 answer+='\n\nInterest matches are inferred guidance, not an objective ranking or admission offer. '+(input.results.length||intent==='eligibility'?'ECZ numeric thresholds apply only to confirmed ECZ results; other grades require verified equivalence. ':'')+'Confirm current availability and eligibility with UNILUS Admissions. Your temporary profile expires after 30 minutes of inactivity. Say start again to clear it.';
 if(requestedAction && /add subject|enter results|correct/i.test(question))answer='Enter a subject and its grade, for example Maths 4 or Actually Maths was 5. Existing results are retained until you correct them.\n\n'+answer;
 if(requestedAction && /interests|careers/i.test(question))answer='Tell me which subjects, activities or career areas you enjoy. Practical or theoretical preferences are optional.\n\n'+answer;
 if(requestedAction && /recorded results/i.test(question))answer='Your user-reported results (not verified certificates):\n'+(input.results.map(r=>`${r.subject}: ${r.grade} (${r.qualification})`).join('\n') || 'No results recorded.')+'\n\n'+answer;
 let suggestedActions=recommendations.slice(0,2).map(r=>({id:'programme.requirements',type:'quick_reply',label:`Requirements: ${r.programme.name}`.slice(0,80),payload:{question:`What are the entry requirements for ${r.programme.name}?`}}));
 if(input.qualification==='unknown'&&input.results.length){
  profile.outstanding.push('qualification');
  suggestedActions=['ECZ School Certificate','ECZ GCE','Other qualification'].map(label=>({id:'advisor.qualify',type:'quick_reply',label,payload:{question:label}}));
 }
 const invalid=input.results.filter(r=>/^ecz_/.test(input.qualification)&&!require('./eczGradeService').validate(r.grade)&&!['CREDIT','MERIT','DISTINCTION'].includes(r.grade));
 if(invalid.length){profile.outstanding.push('invalid grades');answer+='\nPlease clarify these ECZ grades (whole numbers 1–9): '+invalid.map(r=>r.subject+' '+r.grade).join(', ')+'.';}
 store.set(sessionId,profile);
 if(!(input.qualification==='unknown'&&input.results.length)){
  const next=[];
  if(!input.results.length)next.push(['Enter Grade 12 results','Advisor: enter results']);
  else next.push(['View my recorded results','Advisor: recorded results']);
  if(!input.interests.length&&!input.preferences.fields.length)next.push(['Add interests or careers','Advisor: interests and careers']);
  else next.push(['Explore related programmes','Advisor: show other programmes']);
  if(recommendations.length>=2)next.push(['Compare recommendations','Compare '+recommendations.slice(0,2).map(r=>r.programme.name).join(' and ')]);
  suggestedActions=next.slice(0,2).map(([label,question])=>({id:'advisor.followup',type:'quick_reply',label,payload:{question}})).concat(suggestedActions.slice(0,1));
 }
 suggestedActions.push({id:'advisor.reset'  ,type:'quick_reply',label:'Start a new assessment',payload:{question:'Start a new assessment'}});
 const sources=[...new Map([...recommendations.map(r=>r.programme),...named].map(p=>[p.id,p])).values()].map(p=>({title:p.name,url:p.review?.programmeSource||p.rules[0]?.url||p.applicationSource,source_type:'verified_programme_catalogue',verified_at:p.verifiedAt,offering_status:p.offeringStatus,requirements_status:p.requirementsStatus}));
 return {answer,queryType:{isProgrammeAdvisor:true},sources,resources:[],recommendedResources:[],timetableMatches:0,usedFallback:false,suggestedActions,advisor:{input,comparison:comparison?named.map(p=>({programmeId:p.id,eligibility:evaluateEligibility(p,input.results,input)})):[],recommendations:recommendations.map(r=>({programmeId:r.programme.id,reasons:r.reasons,eligibility:r.eligibility}))}};
}
module.exports={parseInput,recommend,tryAnswer,canHandle};
