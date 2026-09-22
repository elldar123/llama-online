const lt=require("localtunnel");
(async()=>{
 try{
  const tun=await lt({port:3000});
  console.log("LIVE_URL="+tun.url);
  tun.on("close",function(){console.log("TUNNEL_CLOSED");process.exit(0);});
 }catch(e){
  console.log("TUNNEL_ERR="+(e&&e.message?e.message:String(e)));
  process.exit(1);
 }
})();
setInterval(function(){},60000);
