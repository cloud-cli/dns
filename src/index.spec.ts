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
    const line = '1.2.3.4     foo bar';
    const output = parseDNSLine(line);

    expect(output).toEqual([
      { target: '1.2.3.4', domain: 'foo' },
      { target: '1.2.3.4', domain: 'bar' },
    ]);
  });

  it('should load entries from file', () => {
    let fileExists = false;
    const buffer = `1.2.3.4 test\n5.6.7.8 foo`;
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
    const buffer = `1.2.3.4 test.com\n5.6.7.8 foo.com`;
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
    dns.add({ domain: 'bar', target: '2.3.4.5' });
    dns.add({ domain: 'baz' });

    const lines = ['2.3.4.5 foo bar', '127.0.0.1 baz'];

    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), '2.3.4.5 foo');
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), '2.3.4.5 foo bar');
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), lines.join('\n'));

    dns.remove({ domain: 'baz' });
    expect(text).toBe(lines[0]);
  });

  describe('reload', () => {
    it('should reload the DNS service', async () => {
      jest.spyOn(exec, 'exec').mockResolvedValueOnce({ ok: true, stdout: '123' } as any);
      jest.spyOn(exec, 'exec').mockResolvedValueOnce({ ok: true } as any);

      await expect(dns.reload()).resolves.toBe(true);
      expect(exec.exec).toHaveBeenCalledWith('pidof', ['dnsmasq']);
      expect(exec.exec).toHaveBeenCalledWith('kill', ['-s', 'HUP', '123']);
    });

    it('should show error on reload', async () => {
      jest.spyOn(exec, 'exec').mockResolvedValueOnce({ ok: true, stderr: '123' } as any);
      jest.spyOn(exec, 'exec').mockResolvedValueOnce({ ok: false, stderr: 'error' } as any);

      await expect(dns.reload()).rejects.toEqual(new Error('Failed to reload'));
    });
  });

  describe('dns configuration', () => {
    it('should configure the default target', () => {
      dns[init]({ defaultTarget: '1.1.2.2' });
      dns.add({ domain: 'bar' });

      expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), '1.1.2.2 bar');
    });
  })
});
