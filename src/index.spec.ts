import dns, { parseDNSLine } from './index';
import fs from 'fs';
import { init } from '@cloud-cli/cli';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const execMocks = vi.hoisted(() => ({
  exec: vi.fn(),
  getConfig: vi.fn(),
}));

vi.mock('get-port', () => ({ default: vi.fn().mockReturnValue(1234) }));
vi.mock('@cloud-cli/exec', () => ({ exec: execMocks.exec }));
vi.mock('@cloud-cli/cli', async (original) => {
  const mod: any = await original();
  return {
    ...mod,
    getConfig: execMocks.getConfig,
  };
});

beforeEach(() => {
  vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
  vi.spyOn(fs, 'readFileSync').mockImplementation(() => '');
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
    vi.spyOn(fs, 'existsSync').mockImplementation(() => fileExists);
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => buffer);

    expect(dns.list()).toEqual([]);

    fileExists = true;
    const list = dns.list();
    expect(list).toEqual([
      { domain: 'test', target: '1.2.3.4' },
      { domain: 'foo', target: '5.6.7.8' },
    ]);
  });

  it('should get a DNS entry by domain', () => {
    let fileExists = false;
    const buffer = `1.2.3.4 test.com\n5.6.7.8 foo.com`;
    vi.spyOn(fs, 'existsSync').mockImplementation(() => fileExists);
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => buffer);

    expect(dns.get({ domain: 'foo.com' })).toBe(null);

    fileExists = true;
    expect(dns.get({ domain: 'foo.com' })).toEqual({ domain: 'foo.com', target: '5.6.7.8' });
  });

  it('should add and remove local DNS entries', () => {
    let text = '';
    vi.spyOn(fs, 'writeFileSync').mockImplementation((_file, value: string) => {
      text = value;
    });
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => text);

    dns.add({ domain: 'foo', target: '2.3.4.5' });
    dns.add({ domain: 'bar', target: '2.3.4.5' });
    dns.add({ domain: 'baz' });

    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), '2.3.4.5 foo');
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), '2.3.4.5 foo\n2.3.4.5 bar');
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), '2.3.4.5 foo\n2.3.4.5 bar\n127.0.0.1 baz');

    dns.remove({ domain: 'baz' });
    expect(text).toBe('2.3.4.5 foo\n2.3.4.5 bar');
  });

  describe('reload', () => {
    it('should reload the DNS service', async () => {
      execMocks.exec.mockResolvedValueOnce({ ok: true, stdout: '123' } as any);
      execMocks.exec.mockResolvedValueOnce({ ok: true } as any);

      await expect(dns.reload()).resolves.toBe(true);
      expect(execMocks.exec).toHaveBeenCalledWith('pidof', ['dnsmasq']);
      expect(execMocks.exec).toHaveBeenCalledWith('kill', ['-s', 'HUP', '123']);
    });

    it('should show error on reload', async () => {
      execMocks.exec.mockResolvedValueOnce({ ok: true, stdout: '123' } as any);
      execMocks.exec.mockResolvedValueOnce({ ok: false, stderr: 'error' } as any);

      await expect(dns.reload()).rejects.toEqual(new Error('Failed to reload'));
    });
  });

  describe('dns configuration', () => {
    it('should configure the default target', () => {
      execMocks.getConfig.mockReturnValue({ defaultTarget: '1.1.2.2' });
      dns[init]();
      dns.add({ domain: 'bar' });

      expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), '1.1.2.2 bar');
    });
  });
});
