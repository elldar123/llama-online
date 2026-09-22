const lt=require("localtunnel");
(async()=>{
 let t;
 try{ t=await lt({port:3000}); }
 catch(e){ console.log("TUN_ERR="+(e&&e.message?e.message:String(e))); process.exit(1); }
 console.log("LIVE_URL="+t.url);
 t.on("close",()=>{ console.log("TUN_CLOSED"); });
})();
setInterval(()=>{}, 1e9);
