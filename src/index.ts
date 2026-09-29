import fs from 'node:fs';
import { join } from 'node:path';
import { exec } from '@cloud-cli/exec';
import { getConfig, init, help } from '@cloud-cli/cli';

interface DNSConfig {
  defaultTarget?: string;
}

const filePath = join(process.cwd(), 'configuration', 'hosts.conf');
const dnsConfig: DNSConfig = {
  defaultTarget: '127.0.0.1',
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

  current = current.filter((item) => item.domain !== input.domain);
  current.push(input);
  save(current);

  return true;
}

function remove(input: DomainAndTarget) {
  const current = list();
  const newList = current.filter((item) => item.domain !== input.domain);
  save(newList);
  return true;
}

function list(): DomainAndTarget[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const input = fs.readFileSync(filePath, 'utf8');
  const entries = input.trim().split('\n').filter(Boolean).flatMap(parseDNSLine);

  return entries;
}

function get(options: { domain: string }): DomainAndTarget | null {
  return list().filter((d) => d.domain === options.domain)[0] || null;
}

async function reload() {
  const getPid = await exec('pidof', ['dnsmasq']);
  const cmd = await exec('kill', ['-s', 'HUP', getPid.stdout.trim()]);
  return cmd.ok || Promise.reject(new Error('Failed to reload'));
}

function addDnsConfig() {
  Object.assign(dnsConfig, getConfig('dns'));
}

function save(list: DomainAndTarget[]) {
  let lines = list.map((next) => next.target + ' ' + next.domain);
  fs.writeFileSync(filePath, lines.join('\n').trim());
}

export function parseDNSLine(line: string): DomainAndTarget[] {
  const [ip, ...domains] = line.split(/\s+/);
  return domains.map((d) => ({ domain: d, target: ip }));
}

export default {
  add,
  remove,
  list,
  reload,
  get,
  [init]: addDnsConfig,
  [help]: () => `Manage DNS host entries

Available commands:
  add [domain] - Add a DNS entry for a domain (defaults to 127.0.0.1 if no target specified)
  remove [domain] - Remove a DNS entry for a domain
  list - List all DNS entries
  get [domain] - Get DNS entry for a specific domain

Options:
  domain - Domain name
  target - IP address (defaults to 127.0.0.1)`,
};
