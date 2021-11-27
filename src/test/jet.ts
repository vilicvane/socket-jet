import * as Crypto from 'crypto';
import * as Net from 'net';

import {Jet} from '../library/jet';
import {CryptoOptions} from '../library/packet';

let testData = {test: 123};

test('should send and receive packet', done => {
  let received = false;

  let server = Net.createServer(socket => {
    let jet = new Jet<typeof testData, never, Net.Socket>(socket);

    jet.on('data', data => {
      expect(data).toEqual(testData);
      received = true;
    });
  });

  server.listen(() => {
    let port = (server.address() as Net.AddressInfo).port;
    let socket = Net.connect({port}, () => {
      let jet = new Jet<never, typeof testData, Net.Socket>(socket);

      jet.send(testData).then(() => {
        expect(received).toBe(true);
        done();
      }, done);
    });
  });
});

test('should send and receive encrypted packet', done => {
  let cryptoOptions: CryptoOptions = {
    algorithm: 'aes-256-cfb',
    key: Crypto.randomBytes(32),
    iv: Crypto.randomBytes(16),
  };

  let received = false;

  let server = Net.createServer(socket => {
    let jet = new Jet<typeof testData, never, Net.Socket>(socket, {
      crypto: cryptoOptions,
    });

    jet.on('data', data => {
      expect(data).toEqual(testData);
      received = true;
    });
  });

  server.listen(() => {
    let port = (server.address() as Net.AddressInfo).port;
    let socket = Net.connect({port}, () => {
      let jet = new Jet<never, typeof testData, Net.Socket>(socket, {
        crypto: cryptoOptions,
      });

      jet.send(testData).then(() => {
        expect(received).toBe(true);
        done();
      }, done);
    });
  });
});
