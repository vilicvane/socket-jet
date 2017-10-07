import * as Net from 'net';

import test from 'ava';

import { PowerJet } from '../power-jet';

class TestJet extends PowerJet {
  protected async test(str: string, index: number): Promise<string> {
    return await new Promise<string>(resolve => {
      setTimeout(resolve, 100, str.substr(index));
    });
  }

  protected async fail(message: string): Promise<void> {
    throw new Error(message);
  }
}

test.cb('should handle successful call', t => {
  let server = Net.createServer(socket => {
    let jet = new TestJet(socket);
    jet.on('error', t.ifError);
  });

  server.listen(() => {
    let port = server.address().port;
    let socket = Net.connect({port}, () => {
      let jet = new TestJet(socket);

      jet
        .call<string>('test', 'foobar', 3)
        .then(
          value => {
            t.is(value, 'bar');
            t.end();
          },
          t.ifError,
        );
    });
  });
});

test.cb('should handle failing call', t => {
  let server = Net.createServer(socket => {
    let jet = new TestJet(socket);
    jet.on('error', t.ifError);
  });

  server.listen(() => {
    let port = server.address().port;
    let socket = Net.connect({port}, () => {
      let jet = new TestJet(socket);

      jet
        .call<void>('fail', 'error message')
        .then(
          () => t.fail(),
          (error: Error) => {
            t.is(error.message, 'error message');
            t.end();
          },
        );
    });
  });
});
