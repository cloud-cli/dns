import fs from 'fs';
import { join } from 'path';
import { exec } from '@cloud-cli/exec';
import { init } from '@cloud-cli/cli';

interface DNSConfig {
  defaultTarget?: string;
}

const filePath = join(process.cwd(), 'configuration', 'hosts.conf');
const dnsConfig: DNSConfig = {
  defaultTarget: '127.0.0.1'
};

interface DomainAndTarget {
  domain: string;
  target?: string;
}

function add(input: DomainAndTarget) {
  let current = list();

  if (!input.target) {
    input.target = dnsConfig.defaultTarget;
  }

  current = current.filter(item => item.domain !== input.domain);
  current.push(input);
  save(current);

  return true;
}

function remove(input: DomainAndTarget) {
  const current = list();
  const newList = current.filter(item => item.domain !== input.domain);
  save(newList);
  return true;
}

function list(): DomainAndTarget[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const input = fs.readFileSync(filePath, 'utf8');
  const entries = input
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(parseDNSLine)

  return entries;
}

function get(options: { domain: string; }): DomainAndTarget | null {
  return list().filter(d => d.domain === options.domain)[0] || null;
}

async function reload() {
  const getPid = await exec('pidof', ['dnsmasq']);
  const cmd = await exec('kill', ['-s', 'HUP', getPid.stdout.trim()]);
  return cmd.ok || Promise.reject(new Error('Failed to reload'));
}

function addDnsConfig(options: DNSConfig) {
  if (options && options.defaultTarget) {
    dnsConfig.defaultTarget = options.defaultTarget;
  }
}

function save(list: DomainAndTarget[]) {
  const txt = list.map(line => `address=/${line.domain}/${line.target}`);
  fs.writeFileSync(filePath, txt.join('\n'));
}

export function parseDNSLine(line: string) {
  const [ip, ...domains] = line.split(' ');
  return domains.map(d => ({ domain: d, target: ip }));
}

export default { add, remove, list, reload, get, [init]: addDnsConfig }
