const lt=require("localtunnel");
(async()=>{
 try{
  const t=await lt({port:3000});
  console.log("TUNNEL_URL="+t.url);
  t.on("close",()=>{console.log("TUNNEL_CLOSED");process.exit(0)});
 }catch(e){console.log("TUNNEL_ERR="+(e&&e.message?e.message:String(e)));process.exit(1)}
})();
