import dns, { parseDNSLine } from './index';
import fs from 'fs';
import * as exec from '@cloud-cli/exec';
import { init } from '@cloud-cli/cli';

beforeEach(() => {
  jest.spyOn(fs, 'writeFileSync').mockImplementation();
  jest.spyOn(fs, 'readFileSync').mockImplementation(() => '');
});

describe('dns', () => {
  it('should parse a DNS configuration line', () => {
    const line = 'address=/foo/1.2.3.4';
    const output = parseDNSLine(line);

    expect(output).toEqual({ target: '1.2.3.4', domain: 'foo' });
  });

  it('should load entries from file', () => {
    let fileExists = false;
    const buffer = `address=/test/1.2.3.4\naddress=/foo/5.6.7.8`;
    jest.spyOn(fs, 'existsSync').mockImplementation(() => fileExists);
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => buffer);

    expect(dns.list()).toEqual([]);

    fileExists = true;
    const list = dns.list();
    expect(list).toEqual([
      { domain: 'test', target: '1.2.3.4' },
      { domain: 'foo', target: '5.6.7.8' },
    ])
  });

  it('should get a DNS entry by domain', () => {
    let fileExists = false;
    const buffer = `address=/test.com/1.2.3.4\naddress=/foo.com/5.6.7.8`;
    jest.spyOn(fs, 'existsSync').mockImplementation(() => fileExists);
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => buffer);

    expect(dns.get({ domain: 'foo.com' })).toBe(null);

    fileExists = true;
    expect(dns.get({ domain: 'foo.com' })).toEqual({ domain: 'foo.com', target: '5.6.7.8' });
  });

  it('should add and remove local DNS entries', () => {
    let text = '';
    jest.spyOn(fs, 'writeFileSync').mockImplementation((_file, value: string) => { text = value; });
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => text);

    dns.add({ domain: 'foo', target: '2.3.4.5' });
    dns.add({ domain: 'bar' });

    const lines = ['address=/foo/2.3.4.5', 'address=/bar/127.0.0.1']

    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), lines[0]);
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), lines.join('\n'));

    dns.remove({ domain: 'bar' });
    expect(text).toBe(lines[0]);
  });

  describe('reload', () => {
    it('should reload the DNS service', async () => {
      jest.spyOn(exec, 'exec').mockResolvedValue({ ok: true } as any);

      await expect(dns.reload()).resolves.toBe(true);
      expect(exec.exec).toHaveBeenCalledWith('systemctl', ['restart', 'dnsmasq']);
    });

    it('should show error on reload', async () => {
      jest.spyOn(exec, 'exec').mockResolvedValue({ ok: false, stderr: 'error' } as any);

      await expect(dns.reload()).rejects.toEqual(new Error('Failed to reload'));
    });
  });

  describe('dns configuration', () => {
    it('should configure the default target', () => {
      dns[init]({ defaultTarget: '1.1.2.2' });
      dns.add({ domain: 'bar' });

      expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), 'address=/bar/1.1.2.2');
    });
  })
});
