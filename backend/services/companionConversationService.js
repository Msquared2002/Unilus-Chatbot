// Conversational context is short-lived and owner/profile-scoped, never a transcript/RAG source.
const {createStore}=require('./programmeAdvisorState');
const turns=createStore({max:500,ttl:15*60*1000});
function route(text){const q=String(text).replace(/[’]/g,"'");
 if(/\b(?:kill myself|end my life|hurt myself|suicid\w*|immediate danger)\b/i.test(q))return 'safety';
 const operation=/\b(?:show|retrieve|compare|what were|when is|when are|next class|timetable|find.*tutor|help.*(?:study|revise|understand)|report.*problem|create.*(?:ticket|request)|remind me)\b/i.test(q);
 if(!operation&&(/\b(?:stressed|stressing|devastated|lonely|bad day|rough day|terrible day|overwhelmed|struggling mentally|burnout|being difficult|frustrated|exhausted|unhappy|anxious|depressed|sad|burned out|nervous|disappointed|vent|proud|tired of|worried)\b/i.test(q)||/\bI (?:failed|didn't pass)\b/i.test(q)))return 'wellbeing';
 if(/\b(?:joke|can we.*talk|how'?s your day|how are you|what'?s up|cute|favorite programming language)\b/i.test(q)||/^(?:hey|hello|hi)\b[^a-z]*$|^hey love\b/i.test(q)&&!operation)return 'casual';
 if(/my (?:academic|student) profile|what year am i in|happening today|catch me up on today|need to know today|schedule this morning/i.test(q))return null;
 if(operation||/\b(?:unilus|university|admissions?|programme|fees?|tuition|payment|accounts?|registration|results?|grades?|marks?|courses?|semester|exams?|brief|reminders?|tutor|library|hospital|hostel|cafeteria|campus|policy|policies|lecturer|office|ecz|grade ?12|qualify|scholarship|career|interests?|application|deadline|support)\b|\b[A-Z]{2,6}\d{3}\b|love.*(?:business|computers)|^(?:explain|summari[sz]e|generate|help me revise|find study resources)/i.test(q))return null;
 if(/\b(?:life advice|relationships?|friendship|cooking|why is the sky|favorite|favourite|personal advice)\b/i.test(q))return 'casual';
 if(/^(?:yes|no|cancel|confirm|thanks|hello|hi|goodbye|bye|what about|and |which |that |it |the |continue|more |[0-9])|\b(?:documents?|requirements?|rules?|staff|response|replied|lecture|classes|notifications?|distance learning|apply|BIT|BCS|LLB)\b/i.test(q))return null;
 return 'general';
}
async function chat(question,user,profile,sessionId){
 const kind=route(question);if(!kind)return null;
 const identity=(user?.username||'guest')+':'+(profile?.id||'')+':'+sessionId;
 const history=turns.get(identity)||[];
 let answer,usedFallback=false;
 if(kind==='safety')answer="I'm glad you told me. Are you in immediate danger or thinking of acting on these feelings now? If you might act, please move away from anything you could use to hurt yourself and reach a trusted person nearby or local emergency help now. I cannot contact anyone for you. You can keep talking with me while you seek human support.";
 else try{answer=await require('./aiService').askAI(question,'',{conversationMode:true,history});}
 catch{usedFallback=true;answer=kind==='wellbeing'?"I'm sorry this feels so difficult. I'm having trouble connecting for a fuller conversation, but you don't need to turn this into a support ticket. If you'd like, tell me what has been hardest today.":"I'm having trouble connecting for a conversation right now. Please try again shortly; you can still use the available student tools.";}
 // Wellbeing/safety text is not retained, even in the ephemeral ordinary-conversation buffer.
 if(kind==='casual'||kind==='general')turns.set(identity,[...history,{role:'user',content:question.slice(0,600)},{role:'assistant',content:answer.slice(0,1000)}].slice(-4));
 else if(kind==='wellbeing')turns.set(identity,[{role:'assistant',content:'The user chose a supportive conversation; respond empathetically without assuming personal records or institutional services.'}]);else turns.clear(identity);
 return {answer,queryType:{isConversation:true,isWellbeing:kind==='wellbeing',isSafety:kind==='safety'},sources:[],resources:[],recommendedResources:[],suggestedActions:[],timetableMatches:0,usedFallback,sessionId};
}
module.exports={route,chat};
