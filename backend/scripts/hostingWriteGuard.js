// Acceptance-test preloader only; never used by the deployed command.
const db=require('../services/db'),run=db.run;
db.run=(sql,params)=>{
 if(/^UPDATE staff_answers SET times_used/i.test(sql)&&Number(params?.[0])<=1)throw Error('Original staff answer mutation blocked by test guard');
 return run(sql,params);
};
