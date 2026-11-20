import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function lanHost() {
  const addresses = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if ((net.family === 'IPv4' || net.family === 4) && !net.internal) addresses.push(net.address);
    }
  }
  return addresses.find((address) => address.startsWith('192.168.'))
    || addresses.find((address) => address.startsWith('10.'))
    || addresses[0]
    || '127.0.0.1';
}

function run(command, args, cwd = clientRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

const jdkRoot = path.join(os.homedir(), '.jdk');
if (!process.env.JAVA_HOME && fs.existsSync(jdkRoot)) {
  const found = fs.readdirSync(jdkRoot).find((name) => name.startsWith('jdk-21'));
  if (found) process.env.JAVA_HOME = path.join(jdkRoot, found);
}

const host = lanHost();
const apiUrl = `http://${host}:4000`;
const androidHome = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
process.env.ANDROID_HOME = androidHome;
process.env.ANDROID_SDK_ROOT = androidHome;
process.env.VITE_API_URL = apiUrl;
console.log(`Building DARK MEDIA ERP APK for ${apiUrl}`);

await run('npx', ['vite', 'build']);
if (!fs.existsSync(path.join(clientRoot, 'android'))) {
  await run('npx', ['cap', 'add', 'android']);
}
await run('npx', ['cap', 'sync', 'android']);
await run('gradlew.bat', ['assembleDebug'], path.join(clientRoot, 'android'));
console.log('APK ready: android/app/build/outputs/apk/debug/app-debug.apk');
