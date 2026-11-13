/* Explicit, lossless-by-reference copying of the retired local journal.
   Never writes or deletes a source. Originals stay available for raw export. */
(function(root){
  'use strict';
  const core=typeof module!=='undefined'&&module.exports?require('./journal-core.js'):root.AmalgamJournal;
  const key='amalgam.journal.v1';
  const fields=['id','created','updated','ticker','type','status','reason','evidence','entryRule','size','exitRule','gates','entryPrice','exitPrice','whyExited','followed','lesson'];
  const gates=['g1','g2','g3','g4','g5'];
  const textFields=['reason','evidence','entryRule','exitRule','whyExited','lesson'];
  function read(text){
    if(typeof text!=='string'||new TextEncoder().encode(text).length>core.maxBackupBytes)throw Error('Older journal exceeds the 5 MB copy limit. Export the original for recovery.');
    let data;try{data=JSON.parse(text);}catch{throw Error('Older journal is unreadable. Export the original for recovery; nothing was changed.');}
    let entries;
    if(Array.isArray(data))entries=data;
    // v1 envelopes are journal-stage1 exports. The v2 envelope is from the
    // earlier unpublished ChatGPT integrity prototype, not journal-stage1.
    // See README "Older journal recovery" for its source and limits.
    else if(data&&data.app==='amalgam-journal'&&Array.isArray(data.entries)&&
      ((data.version===1&&Object.keys(data).every(k=>['app','version','exported','entries'].includes(k)))||
       (data.version===2&&core.exactKeys(data,['app','version','journalId','revision','entries'])&&typeof data.journalId==='string'&&Number.isSafeInteger(data.revision)&&data.revision>=1)))entries=data.entries;
    else throw Error('Unsupported older journal format. Export the original for recovery.');
    if(entries.length>500)throw Error('Copy supports up to 500 cards at once. Export the original for recovery; nothing was changed.');
    for(const e of entries){
      if(!core.exactKeys(e,fields)||typeof e.id!=='string'||e.id.length>40||!core.validTime(e.created)||!core.validTime(e.updated)||
        typeof e.ticker!=='string'||!e.ticker.trim()||e.ticker.length>10||!['plan','live','retro'].includes(e.type)||!['open','closed'].includes(e.status)||
        !textFields.every(k=>typeof e[k]==='string'&&e[k].length<=600)||typeof e.size!=='string'||e.size.length>120||
        !['','yes','no','unknown'].includes(e.followed)||!core.exactKeys(e.gates,gates)||!gates.every(k=>['met','notmet','unchecked'].includes(e.gates[k]))||
        !['entryPrice','exitPrice'].every(k=>e[k]===null||(typeof e[k]==='number'&&Number.isFinite(e[k])&&e[k]>0))){
        throw Error('An older card cannot be copied without changing its contents. Export the original for recovery; nothing was changed.');
      }
    }
    return entries;
  }
  function canonical(value){
    if(!value||typeof value!=='object')return JSON.stringify(value);
    if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
    return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  }
  async function convert(text){
    const entries=read(text),occurrences=new Map(),cards=[];
    for(const e of entries){
      const content=canonical(e),occurrence=occurrences.get(content)||0;occurrences.set(content,occurrence+1);
      const bytes=new TextEncoder().encode(content+'\noccurrence:'+occurrence);
      const digest=await root.crypto.subtle.digest('SHA-256',bytes);
      const id='legacy-'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
      const c={id,savedAt:e.created};for(const f of core.fields)c[f]='';
      Object.assign(c,{
        ticker:e.ticker,recordType:'Retrospective',outcome:e.status==='closed'?'Closed':'Open (self-reported)',
        reason:e.reason.trim()?e.reason:'No reason was recorded in the older journal.',
        evidence:e.evidence+'\n\nCopied from an older, editable journal. Original type: '+e.type+'. Original ID: '+e.id+
          '. Original created: '+e.created+'. Original updated: '+e.updated+'. Original rule answer: '+(e.followed||'not recorded')+'. These dates and labels are unverified; this copy is not proof of a pre-trade plan.',
        checklist:gates.map(k=>k.toUpperCase()+': '+e.gates[k]).join('\n'),entryRule:e.entryRule,size:e.size,exitRule:e.exitRule,
        execution:'Older self-reported entry price: '+(e.entryPrice===null?'Unknown':String(e.entryPrice))+
          '\nOlder self-reported exit price: '+(e.exitPrice===null?'Unknown':String(e.exitPrice)),
        exitReason:e.whyExited,adherence:e.followed==='yes'?'Yes (self-reported)':e.followed==='no'?'No (self-reported)':'Unresolved',
        lesson:e.lesson,amendments:[]
      });
      cards.push(c);
    }
    // The complete copy must validate and remain exportable before any write.
    return core.validate(JSON.parse(core.backupText(cards)));
  }
  function mergeCopies(existing,incoming){
    const current=core.validate({schema:core.schema,cards:existing}),copied=core.validate({schema:core.schema,cards:incoming});
    const byId=new Map(current.map(c=>[c.id,c]));
    const checked=copied.map(c=>{
      if(!byId.has(c.id))return c;
      const previous=byId.get(c.id);
      if(c.amendments.length||canonical({...previous,amendments:[]})!==canonical(c))throw Error('A copied older card conflicts with an existing original. Nothing was copied.');
      return previous; // Preserve amendments added after the earlier copy.
    });
    return core.mergeCards(current,checked);
  }
  const api=Object.freeze({key,read,convert,mergeCopies});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AmalgamLegacyJournal=api;
})(globalThis);
