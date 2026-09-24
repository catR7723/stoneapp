const test = require('node:test');
const assert = require('node:assert/strict');
const { createCircleLogoUpdate } = require('../circleLogoUpdate');
const { canChangeCircleLogo } = require('../../stonApp/utils/circlePermissions');
const OWNER='111111111111111111111111', MEMBER='222222222222222222222222', ID='333333333333333333333333', PENDING='444444444444444444444444';
function matches(circle, query) {
  return Object.entries(query).every(([key,value])=> {
    if(key==='$or') return value.some(q=>matches(circle,q));
    if(key==='members') return circle.members.some(m=>Object.entries(value.$elemMatch).every(([field,wanted])=>m[field]===wanted));
    return circle[key]===value;
  });
}
function setup({userId=OWNER,role='UTENTE',status='ACCEPTED',passwordOK=true,type='GRUPPO'}={}) {
  const circle={_id:ID,adminId:OWNER,type,logo:{kind:'preset',value:'star'},members:[{userId:OWNER,role:'AMMINISTRATORE',status:'ACCEPTED'},{userId:MEMBER,role,status},{userId:PENDING,role:'AMMINISTRATORE',status:'PENDING'}]};
  const events=[];let writes=0;
  const handler=createCircleLogoUpdate({User:{findById:async()=>({password:'hash'})},bcrypt:{compare:async()=>passwordOK},Circle:{findOneAndUpdate:async(query,update,options)=>{assert.equal(options.runValidators,true);if(!matches(circle,query))return null;writes++;circle.logo=update.$set.logo;return circle;}},io:{to:rooms=>({emit:(event,payload)=>events.push({rooms,event,payload})})}});
  const req={params:{circleId:ID},body:{userId,password:'secret',logo:{kind:'preset',value:'sport'}}};
  const res={statusCode:200,status(code){this.statusCode=code;return this;},json(data){this.data=data;return this;}};
  return {handler,req,res,circle,events,writes:()=>writes};
}
test('Il proprietario cambia il logo e il server avvisa solo i membri accettati',async()=>{
 const h=setup();await h.handler(h.req,h.res);assert.equal(h.res.statusCode,200);assert.equal(h.circle.logo.value,'sport');assert.equal(h.events[0].event,'circle_logo_updated');assert.deepEqual(h.events[0].rooms,[`user_${OWNER}`,`user_${MEMBER}`]);assert.equal(h.res.data.circleId,ID);
});
test('Un membro ordinario non cambia il logo, anche se falsifica il ruolo nel corpo richiesta',async()=>{
 const h=setup({userId:MEMBER});h.req.body.role='AMMINISTRATORE';await h.handler(h.req,h.res);assert.equal(h.res.statusCode,403);assert.equal(h.writes(),0);assert.equal(canChangeCircleLogo(h.circle,MEMBER),false);
});
test('Un amministratore accettato può cambiare il logo anche senza essere il creatore',async()=>{
 const h=setup({userId:MEMBER,role:'AMMINISTRATORE'});await h.handler(h.req,h.res);assert.equal(h.res.statusCode,200);assert.equal(canChangeCircleLogo(h.circle,MEMBER),true);
});
test('Un invito amministratore non ancora accettato non conferisce il permesso',async()=>{
 const h=setup({userId:PENDING});await h.handler(h.req,h.res);assert.equal(h.res.statusCode,403);assert.equal(canChangeCircleLogo(h.circle,PENDING),false);
});
test('Il ruolo di gestione deve corrispondere alla tipologia della cerchia',async()=>{
 for(const [type,role,allowed] of [['SCUOLA','DIRIGENZA',true],['SQUADRA','DIRIGENTE',true],['GRUPPO','AMMINISTRAZIONE',true],['COOPERATIVA','DIRIGENZA',false]]) {
  const h=setup({userId:MEMBER,type,role});await h.handler(h.req,h.res);assert.equal(h.res.statusCode,allowed?200:403);assert.equal(canChangeCircleLogo(h.circle,MEMBER),allowed);
 }
});
test('Password errata e logo non valido non modificano il documento',async()=>{
 const wrong=setup({passwordOK:false});await wrong.handler(wrong.req,wrong.res);assert.equal(wrong.res.statusCode,401);assert.equal(wrong.writes(),0);
 const invalid=setup();invalid.req.body.logo={kind:'image',value:'https://google.com/imgres'};await invalid.handler(invalid.req,invalid.res);assert.equal(invalid.res.statusCode,400);assert.equal(invalid.writes(),0);
});
test('Il caricamento JPEG sostituisce il valore precedente senza cambiare membri o nome',async()=>{
 const h=setup();const originalMembers=JSON.stringify(h.circle.members);const value='data:image/jpeg;base64,'+Buffer.from([255,216,255,224,0,255,217]).toString('base64');h.req.body.logo={kind:'image',value};await h.handler(h.req,h.res);assert.equal(h.res.statusCode,200);assert.equal(h.circle.logo.value,value);assert.equal(JSON.stringify(h.circle.members),originalMembers);
});
