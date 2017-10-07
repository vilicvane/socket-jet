[![NPM Package](https://badge.fury.io/js/socket-jet.svg)](https://www.npmjs.com/package/socket-jet)
[![Build Status](https://travis-ci.org/vilic/socket-jet.svg)](https://travis-ci.org/vilic/socket-jet)

# Socket Jet

Minimalist package for data packets over socket connections.

## Features

### Implemented

- `Jet#send()` returns a promise that will wait for ack.
- `PowerJet#call()` to call methods defined on a remote `PowerJet`.
- Encryption support based on Node.js `Cipher` and `Decipher`.

## Installation

```sh
yarn add socket-jet
# or
npm install socket-jet --save
```

## Usage

### Basic Jet

**Server**

```ts
let server = Net.createServer(socket => {
  let jet = new Jet(socket);

  jet.on('data', data => {
    console.log(data); // {thank: 'you'} from client.
  });

  jet
    .send('hello')
    .then(
      () => console.log('"hello" sent'),
      error => console.error(error),
    );
});

server.listen(10047);
```

**Client**

```ts
let socket = Net.connect(10047, () => {
  let jet = new Jet(socket);

  jet.on('data', data => {
    console.log(data); // 'hello' from server.
  });

  jet
    .send({thank: 'you'})
    .then(
      () => console.log('data sent'),
      error => console.error(error),
    );
});
```

### Power Jet

**Server**

```ts
class ServerPowerJet extends PowerJet {
  async test(timeout: number): Promise<string> {
    return await new Promise<string>(resolve => {
      setTimeout(resolve, timeout, 'hello, jet!');
    });
  }
}

let server = Net.createServer(socket => {
  new ServerPowerJet(socket);
});

server.listen(10047);
```

**Client**

```ts
let socket = Net.connect(10047, () => {
  // Note: Client can also have derived `PowerJet` with methods to be called by server.
  let jet = new PowerJet(socket);

  jet
    .call('test', 1000)
    .then(console.log); // 'hello, jet!' after 1000ms.
});
```

### Encrypted Jet

**Server**

```ts
let server = Net.createServer(socket => {
  let jet = new Jet(socket, {
    crypto: {
      algorithm: 'aes-256-cfb',
      password: 'some password',
    },
  });

  jet.on('data', data => {
    console.log(data); // {thank: 'you'} from client.
  });

  jet
    .send('hello')
    .then(
      () => console.log('"hello" sent'),
      error => console.error(error),
    );
});

server.listen(10047);
```

**Client**

```ts
let socket = Net.connect(10047, () => {
  let jet = new Jet(socket, {
    crypto: {
      algorithm: 'aes-256-cfb',
      password: 'some password',
    },
  });

  jet.on('data', data => {
    console.log(data); // 'hello' from server.
  });

  jet
    .send({thank: 'you'})
    .then(
      () => console.log('data sent'),
      error => console.error(error),
    );
});
```

## License

MIT License.
