[![NPM Package](https://badge.fury.io/js/socket-jet.svg)](https://www.npmjs.com/package/socket-jet)
[![Build Status](https://travis-ci.org/vilic/socket-jet.svg)](https://travis-ci.org/vilic/socket-jet)

# Socket Jet

Minimalist package for data packets over socket connections.

## Installation

```sh
yarn add socket-jet
# or
npm install socket-jet --save
```

## Usage

**Server**

```ts
let server = Net.createServer(socket => {
  let jet = new Jet(socket);

  jet.on('data', data => {
    console.log(data);
  });

  jet
    .send('hello')
    .then(
      () => console.log('"hello" sent'),
      error => console.log(error),
    );
});

server.listen(10047);
```

**Client**

```ts
let socket = Net.connect(10047, () => {
  let jet = new Jet(socket);

  jet
    .send({thank: 'you'})
    .then(
      () => console.log('data sent'),
      error => console.log(error),
    );
});
```

## License

MIT License.
