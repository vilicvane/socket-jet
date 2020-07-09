import { EventEmitter } from 'events';
import { Socket } from 'net';

import { Ack, CryptoOptions, Packet, Parser, Type, build } from './packet';

type Resolver = () => void;

export interface JetOptions {
  crypto?: CryptoOptions;
  timeout?: number;
}

export class Jet<T> extends EventEmitter {
  private parser: Parser<T>;

  private lastId = 0;
  private resolverMap = new Map<number, Resolver>();

  private timeout: number;
  private cryptoOptions: CryptoOptions | undefined;

  constructor(
    public socket: Socket,
    {
      crypto: cryptoOptions,
      timeout = 30 * 1000,
    }: JetOptions = {},
  ) {
    super();

    let parser = new Parser<T>({crypto: cryptoOptions});

    socket.on('data', data => parser.append(data));
    socket.on('error', error => this.emit('error', error));

    parser.on('packet', packet => this.handlePacket(packet));
    parser.on('ack', ack => this.handleAck(ack));
    parser.on('error', error => this.emit('error', error));

    this.parser = parser;

    this.cryptoOptions = cryptoOptions;
    this.timeout = timeout;
  }

  async send(data: T): Promise<number> {
    let id = ++this.lastId;
    let packetBuffer = build(id, Type.packet, data, {crypto: this.cryptoOptions});

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
      let timer = setTimeout(() => {
        reject(new Error('Jet sending timed out'));
      }, this.timeout);

      this.resolverMap.set(id, () => {
        clearTimeout(timer);
        resolve();
      });
    });

    return id;
  }

  private handlePacket({id, data}: Packet<T>): void {
    let ackBuffer = build(id, Type.ack, {crypto: this.cryptoOptions});

    if (this.socket.writable) {
      this.socket.write(ackBuffer);
    }

    // Give ack higher priority.
    setImmediate(() => {
      this.emit('data', data, id);
    });
  }

  private handleAck({id}: Ack): void {
    let resolver = this.resolverMap.get(id);

    if (resolver) {
      resolver();
    }
  }
}

export interface Jet<T> {
  on(event: 'data', listener: (data: T, id: number) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;

  emit(event: 'data', data: T, id: number): boolean;
  emit(event: 'error', error: Error): boolean;
}
