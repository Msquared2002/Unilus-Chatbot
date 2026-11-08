const notice='Meeting checked published conditions does not guarantee admission. Confirm all requirements with UNILUS Admissions.';
function evaluateEligibility(programme,results=[],options={}) {
 const rule=programme.rules?.[0];
 const base={programmeId:programme.id,notice,sources:rule ? [{url:rule.url,section:rule.section,verifiedAt:programme.verifiedAt}] : programme.evidence.map(({text,...s})=>s)};
 if(!rule)return {...base,status:'requirements_not_sufficiently_documented',reason:'No verified structured rule is configured.'};
 if(rule.status==='conflicting')return {...base,status:'conflicting_requirements',reason:'Published Law requirements differ on Mathematics. Admissions confirmation is required.',conflict:rule.conflict};
 // Only explicit credit/merit/distinction classifications are comparable. No numeric or letter conversions.
 if(options.requiresVerification)return {...base,status:'qualification_verification_required',reason:'Mixed qualification types or sittings must be verified by Admissions.'};
 const rank={fail:0,satisfactory:0,credit:1,merit:2,distinction:3};
 const normalized=results.map(r=>({...r,subject:String(r.subject).toLowerCase().replace('english language','english').replace('maths','mathematics'),grade:(/^ecz_/.test(options.qualification || '') && (!r.qualification || r.qualification===options.qualification) ? require('./eczGradeService').classify(r.grade)?.category : null) || String(r.grade).toLowerCase()}));
 const missing=[],failed=[],checks=[];
 for(const [subject,minimum] of Object.entries(rule.required)) {
 const r=normalized.find(r=>r.subject===subject);
 checks.push({subject,required:minimum,reported:results.find(x=>String(x.subject).toLowerCase().replace('maths','mathematics').replace('english language','english')===subject)?.grade ?? null,status:!r||!Object.hasOwn(rank,r.grade)?'missing_or_unrecognized':rank[r.grade]>=rank[minimum]?'satisfied':'not_satisfied'});
 if(!r||!Object.hasOwn(rank,r.grade))missing.push(subject+' with explicit credit/merit/distinction classification');
 else if(rank[r.grade]<rank[minimum])failed.push(subject+' requires '+minimum);
 }
 for(const group of rule.alternativeGroups || []){
 const candidates=normalized.filter(r=>group.subjects.includes(r.subject));
 const satisfied=candidates.some(r=>Object.hasOwn(rank,r.grade)&&rank[r.grade]>=rank[group.minimum]);
 checks.push({subject:group.label,required:group.minimum,reported:candidates.map(r=>r.subject+': '+r.grade).join(', ') || null,status:satisfied?'satisfied':'missing_or_not_satisfied'});
 if(!satisfied){if(options.resultsComplete)failed.push(group.label+' requires '+group.minimum);else missing.push(group.label+' at '+group.minimum+' or better');}
 }
 const credits=new Set(normalized.filter(r=>rank[r.grade]).map(r=>r.subject)).size;
 checks.push({requirement:'distinct credit-level subjects',required:rule.minimumCredits,reported:credits,status:credits>=rule.minimumCredits?'satisfied':options.resultsComplete?'not_satisfied':'missing'});
 base.checks=checks; base.coverage=rule.status; base.manualConditions=rule.manualConditions || ['Only configured academic conditions were checked; remaining admissions conditions require confirmation.'];
 if(credits<rule.minimumCredits && options.resultsComplete)failed.push('Only '+credits+' distinct credited subjects reported; '+rule.minimumCredits+' required');
 if(credits<rule.minimumCredits)missing.push('at least '+rule.minimumCredits+' distinct credited subjects');
 if(failed.length)return {...base,status:'does_not_meet_checked_condition',reason:failed.join('; ')};
 if(missing.length)return {...base,status:'additional_grade_information_required',reason:missing.join('; ')};
 return {...base,status:'meets_checked_published_conditions',reason:'The supplied classifications meet the configured webpage conditions; other qualification and application conditions remain subject to Admissions review.'};
}
module.exports={evaluateEligibility};
