import { DNS } from './index';
import dns from './index';
import fs from 'fs';
import * as exec from '@cloud-cli/exec';

describe('dns', () => {
  it('should parse a DNS configuration line', () => {
    const line = 'address=/foo/1.2.3.4';
    const output = DNS.parse(line);
    expect(output).toEqual({ target: '1.2.3.4', domain: 'foo' });
  });

  it('should load entries from file', () => {
    const buffer = `address=/test/1.2.3.4\naddress=/foo/5.6.7.8`;
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => buffer);

    const list = dns.show();
    expect(list).toEqual([
      { domain: 'test', target: '1.2.3.4' },
      { domain: 'foo', target: '5.6.7.8' },
    ])
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
});