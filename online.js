const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT) || 3000;

const LT = require('localtunnel');

function lanIps() {
  const out = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const a of iface || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

const server = spawn(process.execPath, [path.join(__dirname, 'server.js')], { stdio: 'inherit' });
server.on('exit', (code) => {
  try { if (tunnel) tunnel.close(); } catch (e) {}
  process.exit(code == null ? 0 : code);
});

let tunnel = null;

(async () => {
  tunnel = await LT({ port: PORT });
  console.log('==============================================');
  console.log('  L.L.A.M.A — ONLINE TUNEL LINKI');
  console.log('');
  console.log('  HERYERDEN BAGLAN  : ' + tunnel.url);
  console.log('  Bu linki arkadaslarinla paylas. Onlar da');
  console.log('  baska ulkeden/telefonda bu adresten girer.');
  console.log('');
  console.log('  Ayni ag (LAN)     :');
  for (const ip of lanIps()) console.log('    http://' + ip + ':' + PORT);
  console.log('  Localhost         : http://localhost:' + PORT);
  console.log('');
  console.log('  Durdurmak: Ctrl+C');
  console.log('==============================================');
  tunnel.on('error', (e) => console.error('Tunel hatasi:', e.message));
  process.on('SIGINT', () => { try { tunnel.close(); } catch (e) {} server.kill(); process.exit(0); });
  process.on('SIGTERM', () => { try { tunnel.close(); } catch (e) {} server.kill(); process.exit(0); });
})().catch((e) => {
  console.error('Tunel acilamadi (internet kisitli olabilir).');
  console.error('Yine de ayni agdan veya localhosttan oynanabilir.');
});
