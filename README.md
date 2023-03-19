# Local DNS resolution

## Usage

Install and add to [Cloudy](cloud-cli/cli):

```sh
npm i @cloud-cli/dns
```

```js
import dns from '@cloud-cli/dns';

export default { dns }
```

## Available Commands

### Add

Target is optional. Defaults to `127.0.0.1`

```sh
cy dns.add --domain foo --target 1.2.3.4
cy dns.add --domain bar{ domain: test, target: '1.2.3.4' },
```

## Remove

```sh
cy dns.remove --domain foo
```