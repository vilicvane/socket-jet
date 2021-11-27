import {EventEmitter} from 'events';
import {Duplex} from 'stream';

import {Ack, CryptoOptions, Packet, Parser, Type, build} from './packet';

export const DEFAULT_KEEP_ALIVE_INTERVAL = 5 * 1000;
export const DEFAULT_KEEP_ALIVE_COUNT = 2;

export interface JetOptions {
  crypto?: CryptoOptions;
  keepAlive?: {
    interval?: number;
    count?: number;
  };
}

export class Jet<TIn, TOut, TSocket extends Duplex> extends EventEmitter {
  private parser: Parser<TIn>;

  private lastId = 0;
  private sendHandlersMap = new Map<
    number,
    [() => void, (error: Error) => void]
  >();

  private cryptoOptions: CryptoOptions | undefined;

  private keepAliveTimer: NodeJS.Timer | undefined;

  constructor(
    readonly socket: TSocket,
    {
      crypto: cryptoOptions,
      keepAlive: {interval: keepAliveInterval, count: keepAliveCount} = {},
    }: JetOptions = {},
  ) {
    super();

    let parser = new Parser<TIn>({crypto: cryptoOptions});

    socket.on('data', this.onSocketData);
    socket.on('close', this.onSocketClose);
    socket.on('error', this.onError);

    parser.on('ack', this.onParserAck);
    parser.on('packet', this.onParserPacket);
    parser.on('ping', this.onParserPing);
    parser.on('error', this.onError);

    this.parser = parser;

    this.cryptoOptions = cryptoOptions;

    if (!socket.destroyed) {
      this.keepAlive(keepAliveInterval, keepAliveCount);
    }
  }

  async send(data: TOut): Promise<number> {
    let id = ++this.lastId;
    let packetBuffer = build(Type.packet, id, data, {
      crypto: this.cryptoOptions,
    });

    await new Promise<void>((resolve, reject) => {
      this.socket.write(packetBuffer, (error: any) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.sendHandlersMap.set(id, [resolve, reject]);
    });

    return id;
  }

  sendOneWay(data: TOut): void {
    let packetBuffer = build(Type.packet, 0, data, {
      crypto: this.cryptoOptions,
    });

    this.socket.write(packetBuffer);
  }

  release(): Buffer {
    let socket = this.socket;

    socket.on('data', this.onSocketData);
    socket.on('close', this.onSocketClose);
    socket.on('error', this.onError);

    return this.parser.pendingBuffer;
  }

  private onSocketData = (data: Buffer): void => {
    this.parser.append(data);
  };

  private onSocketClose = (): void => {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
    }

    let handlersMap = new Map(this.sendHandlersMap);

    this.sendHandlersMap.clear();

    for (let handlers of handlersMap.values()) {
      handlers[1](new Error('Send reset due to socket close'));
    }
  };

  private onParserPacket = ({id, data}: Packet<TIn>): void => {
    if (id > 0) {
      let ackBuffer = build(Type.ack, id, {crypto: this.cryptoOptions});

      if (this.socket.writable) {
        this.socket.write(ackBuffer);
      }
    }

    // Give ack higher priority. If an ack and data is received within the same
    // buffer, this can make sure data event emits after send() resolves.
    setImmediate(() => {
      this.emit('data', data, id);
    });
  };

  private onParserPing = (): void => {
    let pongBuffer = build(Type.pong, {crypto: this.cryptoOptions});

    if (this.socket.writable) {
      this.socket.write(pongBuffer);
    }
  };

  private onParserAck = ({id}: Ack): void => {
    let handlers = this.sendHandlersMap.get(id);

    if (handlers) {
      handlers[0]();
    }
  };

  private onError = (error: Error): void => {
    this.emit('error', error);
  };

  private keepAlive(
    interval = DEFAULT_KEEP_ALIVE_INTERVAL,
    count = DEFAULT_KEEP_ALIVE_COUNT,
  ): void {
    let remainingCount = count;

    this.parser.on('pong', () => {
      // Reset the remaining count whenever receiving a pong.
      remainingCount = count;
    });

    this.keepAliveTimer = setInterval(() => {
      if (remainingCount <= 0) {
        this.socket.destroy();
        return;
      }

      remainingCount--;

      let pingBuffer = build(Type.ping, {crypto: this.cryptoOptions});

      if (this.socket.writable) {
        this.socket.write(pingBuffer);
      }
    }, interval);
  }
}

export interface Jet<TIn, TOut, TSocket extends Duplex> {
  on(event: 'data', listener: (data: TIn, id: number) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;

  once(event: 'data', listener: (data: TIn, id: number) => void): this;
  once(event: 'error', listener: (error: Error) => void): this;

  emit(event: 'data', data: TIn, id: number): boolean;
  emit(event: 'error', error: Error): boolean;
}
