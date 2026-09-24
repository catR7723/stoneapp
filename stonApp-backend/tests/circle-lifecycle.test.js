const test = require('node:test');
const assert = require('node:assert/strict');
const { createCircleLifecycle } = require('../circleLifecycle');
const USER='111111111111111111111111', CIRCLE='222222222222222222222222';
function setup({ correctPassword=true, owner=true, fail=false, canLeave=true }={}) {
  const deleted=[], events=[];let ended=false, query;
  const document={adminId:USER,members:[{userId:USER,status:'ACCEPTED'}]};
  const session={withTransaction:async fn=>{await fn();},endSession:async()=>{ended=true;}};
  const model=name=>({deleteMany:async (filter,options)=>{assert.equal(options.session,session);if(fail)throw new Error('Database failure');deleted.push({name,filter});}});
  const Circle={findOne:filter=>{query=filter;return {session:async()=>owner?document:null};},deleteOne:async(filter,options)=>{assert.equal(options.session,session);deleted.push({name:'Circle',filter});},findOneAndUpdate:async(filter,update)=>{query={filter,update};return canLeave?document:null;}};
  const io={to:rooms=>({emit:(event,payload)=>events.push({rooms,event,payload})}),in:()=>({socketsLeave:()=>{}})};
  const handlers=createCircleLifecycle({mongoose:{startSession:async()=>session},User:{findById:async()=>({password:'hash'})},Circle,Message:model('Message'),Announcement:model('Announcement'),DocumentModel:model('Document'),WorkShift:model('WorkShift'),bcrypt:{compare:async()=>correctPassword},io});
  const res={statusCode:200,status(code){this.statusCode=code;return this;},json(data){this.data=data;return this;}};
  const req={params:{circleId:CIRCLE},body:{userId:USER,password:'password'}};
  return {handlers,req,res,deleted,events,ended:()=>ended,query:()=>query};
}
test('Una password errata impedisce cancellazione e uscita',async()=>{
  for(const action of ['remove','leave']){const h=setup({correctPassword:false});await h.handlers[action](h.req,h.res);assert.equal(h.res.statusCode,401);assert.equal(h.deleted.length,0);assert.equal(h.events.length,0);}
});
test('Un membro non proprietario non elimina la cerchia',async()=>{
  const h=setup({owner:false});await h.handlers.remove(h.req,h.res);assert.equal(h.res.statusCode,403);assert.equal(h.deleted.length,0);assert.equal(h.query().adminId,USER);assert.ok(h.ended());
});
test('Eliminazione cancella la chat comune e i dati della cerchia, non le chat private',async()=>{
  const h=setup();await h.handlers.remove(h.req,h.res);assert.equal(h.res.statusCode,200);assert.equal(h.deleted.length,5);assert.deepEqual(h.deleted.find(x=>x.name==='Message').filter,{roomId:`circle_${CIRCLE}`});assert.equal(h.events[0].event,'circle_removed');assert.equal(h.events[0].payload.deleted,true);assert.ok(h.ended());
});
test('Un fallimento della transazione non trasmette una falsa eliminazione',async()=>{
  const h=setup({fail:true});await h.handlers.remove(h.req,h.res);assert.equal(h.res.statusCode,500);assert.equal(h.events.length,0);assert.ok(h.ended());
});
test('Uscita rimuove solo il membro e vieta l’uscita del proprietario',async()=>{
  const h=setup();await h.handlers.leave(h.req,h.res);assert.equal(h.res.statusCode,200);assert.deepEqual(h.query().filter.adminId,{$ne:USER});assert.deepEqual(h.query().update,{$pull:{members:{userId:USER}}});assert.equal(h.deleted.length,0);assert.equal(h.events[0].rooms,`user_${USER}`);
  const denied=setup({canLeave:false});await denied.handlers.leave(denied.req,denied.res);assert.equal(denied.res.statusCode,403);
});
