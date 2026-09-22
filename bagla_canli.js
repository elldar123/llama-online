const fs=require("fs"),lt=require("localtunnel");
const DOSYA="C:\\Users\\Lenovo\\Desktop\\LAMA\\canli_url.txt";
(async()=>{
 let t;
 try{
  t=await lt({port:3000});
 }catch(e){
  fs.writeFileSync(DOSYA,"HATA:"+(e&&e.message?e.message:String(e)));
  process.exit(1);
 }
 fs.writeFileSync(DOSYA,"CANLI_LINK="+t.url);
 t.on("error",e=>fs.writeFileSync(DOSYA,"TUN_ERR:"+(e&&e.message?e.message:String(e))));
 t.on("close",()=>{ process.exit(0); });
})();
setInterval(()=>{},3600000);
