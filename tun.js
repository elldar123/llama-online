const lt=require('localtunnel');
(async()=>{let tunn=await lt({port:3000});console.log('TUNNEL_URL='+tunn.url);} )();
process.on('exit',()=>{});
