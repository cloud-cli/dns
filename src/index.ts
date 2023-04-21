import fs from 'fs';
import { join } from 'path';
import { exec } from '@cloud-cli/exec';
import { init } from '@cloud-cli/cli';

interface DNSConfig {
  defaultTarget?: string;
}

const lineParse = /^address=\/(.+)\/(.+)$/;
const filePath = join(process.cwd(), 'configuration', 'apps.conf');
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

async function reload() {
  const cmd = await exec('systemctl', ['restart', 'dnsmasq']);
  return cmd.ok || Promise.reject(new Error('Failed to reload'));
}

function addDnsConfig(options: DNSConfig) {
  if (options && options.defaultTarget) {
    dnsConfig.defaultTarget = options.defaultTarget;
  }
}

function save(list: DomainAndTarget[]) {
  const txt = list.map(line => `address=/${line.domain}/${line.target}`);
  console.log('save', filePath, txt);
  fs.writeFileSync(filePath, txt.join('\n'));
}

export function parseDNSLine(line: string) {
  const parts = line.match(lineParse);
  return { domain: parts[1], target: parts[2] }
}

export default { add, remove, list, reload, [init]: addDnsConfig }
