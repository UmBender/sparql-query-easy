import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const names = ['plan-task', 'backend', 'frontend', 'fullstack', 'refactor', 'test', 'frontend-audit'];
const server = spawn('codex', ['app-server', '--stdio'], { cwd: root, stdio: ['pipe', 'pipe', 'ignore'] });
let finished = false;
const timer = setTimeout(() => finish('Codex skills/list timed out'), 30000);
function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  if (error) { console.error(error); process.exitCode = 1; }
  server.stdin.end();
  server.kill();
}
function send(message) { server.stdin.write(JSON.stringify(message) + '\n'); }
server.on('error', (error) => finish(`Codex discovery unavailable: ${error.message}`));
server.on('exit', (code) => { if (!finished) finish(`Codex exited before discovery: ${code}`); });
server.stdin.on('error', (error) => finish(`Codex input unavailable: ${error.message}`));
createInterface({ input: server.stdout }).on('line', (line) => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.error) return finish(`Codex discovery RPC error: ${message.error.code}`);
  if (message.id === 1) {
    send({ method: 'initialized', params: {} });
    send({ id: 2, method: 'skills/list', params: { cwds: [root], forceReload: true } });
  }
  if (message.id === 2) {
    const entries = message.result?.data ?? [];
    const skills = entries.flatMap((entry) => entry.skills ?? []);
    const missing = names.filter((name) => !skills.some((s) => s.name === `tcc-${name}` && s.enabled !== false && s.path?.includes(`.agents/skills/tcc-${name}/SKILL.md`)));
    if (missing.length) return finish(`Not discovered/enabled: ${missing.map((n) => `tcc-${n}`).join(', ')}`);
    console.log('Codex skills/list: all 7 repository skills discovered and enabled. No thread or model request created.');
    finish();
  }
});
send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'tcc-skill-check', version: '1.0' } } });
