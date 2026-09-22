const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = path.join(os.tmpdir(), 'lama_tnl');
try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
const log = path.join(dir, 'out.log');
const err = path.join(dir, 'err.log');
try { fs.unlinkSync(log); } catch (e) {}
try { fs.unlinkSync(err); } catch (e) {}

const out = fs.openSync(log, 'w');
const er = fs.openSync(err, 'w');
const child = spawn(process.execPath, [path.join('C:\\Users\\Lenovo\\Desktop\\LAMA', 'online.js')], {
  cwd: 'C:\\Users\\Lenovo\\Desktop\\LAMA',
  detached: true,
  stdio: ['ignore', out, er],
});
child.unref();
console.log('PID=' + child.pid);
console.log('LOG=' + log);

setTimeout(() => {}, 50);
