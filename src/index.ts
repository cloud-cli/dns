import fs from 'fs';
import { join } from 'path';
import { exec } from '@cloud-cli/exec';

const lineParse = /^address=\/(.+)\/(.+)$/;
const filePath = join(process.cwd(), 'configuration/apps.conf');

export class DNS {
  static parse(line) {
    const parts = line.match(lineParse);
    return { domain: parts[1], target: parts[2] }
  }
}

interface DomainAndTarget {
  domain: string;
  target?: string;
}

function add(input: DomainAndTarget) {
  let current = list();

  if (!input.target) {
    input.target = '127.0.0.1';
  }

  current = current.filter(item => item.domain !== input.domain);
  current.push(input);
  save(current);

  return true;
}

function remove(input: DomainAndTarget) {
  const current = list();
  const newList = current.filter(item => item.domain !== input.domain)
  save(newList);

  return true;
}

function save(list: DomainAndTarget[]) {
  const txt = list.map(line => 'address=/' + line.domain + '/' + line.target);
  fs.writeFileSync(filePath, txt.join('\n'));
}

function list(): DomainAndTarget[] {
  if (!fs.existsSync(filePath)) { return []; }

  const input = fs.readFileSync(filePath, 'utf8');
  const entries = input
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => DNS.parse(line))

  return entries;
}

async function reload() {
  const cmd = await exec('systemctl', ['restart', 'dnsmasq']);
  return cmd.ok || Promise.reject(new Error('Failed to reload'));
}

export default { add, remove, list, reload }
