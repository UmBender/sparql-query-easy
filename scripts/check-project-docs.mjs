import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const vault = resolve(root, 'tcc');
const taskDir = resolve(vault, '90 - Tasks/items');
const errors = [];
const read = (path) => readFileSync(path, 'utf8');
const tasks = readdirSync(taskDir).filter((name) => name.endsWith('.md')).map((name) => {
  const path = resolve(taskDir, name);
  const text = read(path);
  const front = text.match(/^---\n([\s\S]*?)\n---/);
  if (!front) { errors.push(`${name}: missing task frontmatter`); return null; }
  const field = (key) => front[1].match(new RegExp(`^${key}: (.*)$`, 'm'))?.[1];
  for (const key of ['id', 'title', 'status', 'priority', 'type', 'depends_on', 'human_gate', 'created', 'updated']) {
    if (field(key) === undefined) errors.push(`${name}: missing ${key}`);
  }
  const dependencies = (field('depends_on') ?? '').replace(/[\[\]]/g, '').split(',').map((x) => x.trim()).filter(Boolean);
  return { path, id: field('id'), title: field('title'), status: field('status'), priority: field('priority'), type: field('type'), dependencies };
}).filter(Boolean);
const byId = new Map();
for (const task of tasks) {
  if (byId.has(task.id)) errors.push(`Duplicate task ID ${task.id}`);
  byId.set(task.id, task);
  if (!['BACKLOG', 'READY', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'DONE', 'CANCELLED'].includes(task.status)) errors.push(`Invalid status ${task.id}`);
}
const ordered = [], visiting = new Set(), visited = new Set();
function visit(task) {
  if (visited.has(task.id)) return;
  if (visiting.has(task.id)) { errors.push(`Dependency cycle at ${task.id}`); return; }
  visiting.add(task.id);
  for (const id of task.dependencies) {
    if (!byId.has(id)) errors.push(`${task.id}: missing dependency ${id}`);
    else visit(byId.get(id));
  }
  visiting.delete(task.id); visited.add(task.id); ordered.push(task);
}
tasks.sort((a, b) => a.priority.localeCompare(b.priority) || a.id.localeCompare(b.id)).forEach(visit);
if (process.argv.includes('--index')) {
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('# Task Index\n\nOrdered by dependencies, then priority among selection candidates. See [worker rules](WORKER_PROMPT.md). BACKLOG is not execution authorization.\n\n| ID | Status | Priority | Type | Title |\n|---|---|---|---|---|');
  for (const t of ordered) console.log(`| ${t.id} | ${t.status} | ${t.priority} | ${t.type} | [${t.title}](<items/${basename(t.path)}>) |`);
  process.exit(0);
}
const index = read(resolve(vault, '90 - Tasks/TASKS.md'));
for (const t of tasks) if (!index.includes(`| ${t.id} | ${t.status} |`)) errors.push(`Index missing/current status mismatch: ${t.id}`);
const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const changed = [...new Set([...git(['diff', '--name-only', '-z', 'HEAD']), ...git(['ls-files', '--others', '--exclude-standard', '-z'])])]
  .filter((p) => p.endsWith('.md') && !p.startsWith('.idea/') && existsSync(resolve(root, p)));
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() && !e.name.startsWith('.') ? walk(resolve(dir, e.name)) : e.isFile() && e.name.endsWith('.md') ? [resolve(dir, e.name)] : []); }
const notes = walk(vault);
for (const path of changed) {
  const absolute = resolve(root, path), text = read(absolute);
  const body = text.replace(/```[\s\S]*?```/g, '');
  for (const match of body.matchAll(/\[\[([^\]|#]+)(?:[^\]]*)\]\]/g)) {
    const target = match[1];
    const suffix = target.endsWith('.md') ? '' : '.md';
    const candidates = [resolve(dirname(absolute), target + suffix), resolve(vault, target + suffix)];
    if (!candidates.some(existsSync) && !notes.some((p) => basename(p, '.md') === target)) errors.push(`${path}: broken wiki link ${target}`);
  }
  for (const match of body.matchAll(/\]\((?:<([^>]+)>|([^\s)]+))\)/g)) {
    const target = (match[1] ?? match[2]).split('#')[0];
    if (!target || /^[a-z]+:|^\//i.test(target)) continue;
    if (!existsSync(resolve(dirname(absolute), decodeURIComponent(target)))) errors.push(`${path}: broken Markdown link ${target}`);
  }
}
for (const name of readdirSync(resolve(root, '.agents/skills'))) {
  const path = resolve(root, '.agents/skills', name, 'SKILL.md');
  if (!existsSync(path)) { errors.push(`Missing skill ${name}`); continue; }
  const text = read(path);
  if (!text.startsWith(`---\nname: ${name}\n`) || !/^description: .+$/m.test(text)) errors.push(`Invalid skill metadata ${name}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Checked ${tasks.length} task records/dependencies/index entries, links in ${changed.length} changed Markdown files, and repository skill metadata.`);
