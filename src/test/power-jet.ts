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

  protected async echo(value: any, delay: number): Promise<any> {
    return await new Promise<string>(resolve => {
      setTimeout(resolve, delay, value);
    });
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

test.cb('should handle parallel calls', t => {
  let server = Net.createServer(socket => {
    let jet = new TestJet(socket);
    jet.on('error', t.ifError);
  });

  server.listen(() => {
    let port = server.address().port;
    let socket = Net.connect({port}, () => {
      let jet = new TestJet(socket);

      t.plan(2);

      jet.call('echo', 123, 100).then(value => {
        t.is(value, 123);
        t.end();
      }, t.ifError);

      jet.call('echo', 456, 10).then(value => {
        t.is(value, 456);
      }, t.ifError);
    });
  });
});
