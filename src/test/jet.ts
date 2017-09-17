import * as Net from 'net';

import test from 'ava';

import { Jet } from '../jet';

let testData = {test: 123};

test.cb('should send and receive packet', t => {
  let received = false;

  let server = Net.createServer(socket => {
    let jet = new Jet<any>(socket);

    jet.on('data', data => {
      t.deepEqual(data, testData);
      received = true;
    });
  });

  server.listen(() => {
    let port = server.address().port;
    let socket = Net.connect(port);
    let jet = new Jet<any>(socket);

    jet
      .send(testData)
      .then(
        () => {
          t.true(received);
          t.end();
        },
        t.fail,
      );
  });
});
