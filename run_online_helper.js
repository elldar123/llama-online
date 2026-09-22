const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const wd = 'C:/Users/Lenovo/Desktop/LAMA';
const log = process.env.LOG || (process.env.TEMP + '/lama_online_run.log');
const child = spawn(process.execPath, ['online.js'], { cwd: wd, env: process.env });
child.stdout.on('data', (d) => fs.appendFileSync(log, d));
child.stderr.on('data', (d) => fs.appendFileSync(log, '[ERR] ' + d));
child.on('exit', (c) => { fs.appendFileSync(log, '[EXIT ' + c + ']'); process.exit(0); });
process.on('SIGTERM', () => child.kill());
