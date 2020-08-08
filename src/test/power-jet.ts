import * as Net from 'net';

import {Parser, Type} from '../library/packet';
import {PowerJet} from '../library/power-jet';

class TestJet extends PowerJet {
  protected async test(str: string, index: number): Promise<string> {
    return new Promise<string>(resolve => {
      setTimeout(resolve, 100, str.substr(index));
    });
  }

  protected async fail(message: string): Promise<void> {
    throw new Error(message);
  }

  protected async echo(value: any, delay: number): Promise<any> {
    return new Promise<string>(resolve => {
      setTimeout(resolve, delay, value);
    });
  }
}

test('should handle successful call', done => {
  let server = Net.createServer(socket => {
    let jet = new TestJet(socket);
    jet.on('error', done);
  });

  server.listen(() => {
    let port = (server.address() as Net.AddressInfo).port;
    let socket = Net.connect({port}, () => {
      let jet = new TestJet(socket);

      jet.call<string>('test', 'foobar', 3).then(value => {
        expect(value).toBe('bar');
        done();
      }, done);
    });
  });
});

test('should handle failing call', done => {
  let server = Net.createServer(socket => {
    let jet = new TestJet(socket);
    jet.on('error', done);
  });

  server.listen(() => {
    let port = (server.address() as Net.AddressInfo).port;
    let socket = Net.connect({port}, () => {
      let jet = new TestJet(socket);

      jet.call<void>('fail', 'error message').then(
        () => done('Expecting error'),
        (error: Error) => {
          expect(error.message).toBe('error message');
          done();
        },
      );
    });
  });
});

test('should handle parallel calls', done => {
  let server = Net.createServer(socket => {
    let jet = new TestJet(socket);
    jet.on('error', done);
  });

  server.listen(() => {
    let port = (server.address() as Net.AddressInfo).port;
    let socket = Net.connect({port}, () => {
      let jet = new TestJet(socket);

      Promise.all([
        expect(jet.call('echo', 123, 100)).resolves.toBe(123),
        expect(jet.call('echo', 456, 10)).resolves.toBe(456),
      ]).then(() => done(), done);
    });
  });
});

test('should handle socket close after receiving ack', done => {
  let server = Net.createServer(socket => {
    let jet = new TestJet(socket);

    jet.on('error', console.error);

    setTimeout(() => {
      socket.end();
    }, 50);
  });

  server.listen(() => {
    let port = (server.address() as Net.AddressInfo).port;
    let socket = Net.connect({port}, () => {
      let jet = new TestJet(socket);

      jet.call('echo', 123, 100).catch(error => {
        expect(error.message).toBe('Call reset due to socket close');
        done();
      });
    });
  });
});

test('should handle socket close before receiving ack', done => {
  let server = Net.createServer(socket => {
    let jet = new TestJet(socket);

    ((jet as any) as {parser: Parser<any>}).parser.on('packet', packet => {
      if (packet.type === Type.packet && packet.data.type === 'call') {
        socket.end();
      }
    });

    jet.on('error', console.error);
  });

  server.listen(() => {
    let port = (server.address() as Net.AddressInfo).port;
    let socket = Net.connect({port}, () => {
      let jet = new TestJet(socket);

      jet.call('echo', 123, 100).catch(error => {
        expect(error.message).toBe('Call reset due to socket close');
        done();
      });
    });
  });
});
