const lt=require('localtunnel');
(async()=>{
  let t;
  try{ t=await lt({port:3000}); }
  catch(e){ console.log('TUN_ERR '+e.message); process.exit(1); }
  console.log('LIVE_URL '+t.url);
})();
