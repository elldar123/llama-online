const fs=require("fs"),lt=require("localtunnel");
const B="C:\\Users\\Lenovo\\Desktop\\LAMA\\son_link.txt";
let t=null,kapali=false;
async function bagla(){
 try{
  if(t){try{t.close();}catch(e1){}}
  t=await lt({port:3000});
  fs.writeFileSync(B,"LINK="+t.url);
  t.on("close",()=>{ if(!kapali){ setTimeout(bagla,3000); } });
  t.on("error",()=>{ if(!kapali){ setTimeout(bagla,3000); } });
 }catch(e){
  fs.writeFileSync(B,"TUN_ERR="+(e&&e.message?e.message:String(e)));
  if(!kapali){ setTimeout(bagla,3000); }
 }
}
function kapat(){ kapali=true; if(t){try{t.close();}catch(e2){}} process.exit(0); }
process.on("SIGINT",kapat);process.on("SIGTERM",kapat);
bagla();
setInterval(()=>{},3600000);
