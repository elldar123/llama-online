const lt=require("localtunnel"),http=require("http");
const t=lt(3000,{subdomain:""});
t.on("url",u=>{console.log("TUNNEL_URL="+u)});
t.on("error",e=>console.log("TUNNEL_ERR="+e.message));
const ping=setInterval(()=>{http.get("http://localhost:3000/socket.io/socket.io.js",r=>{console.log("SOCK_OK="+r.statusCode);clearInterval(ping);process.exit(0)}).on("error",()=>{})},3000);
setTimeout(()=>process.exit(0),40000);
