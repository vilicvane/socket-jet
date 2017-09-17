import { EventEmitter } from 'events';
import { Socket } from 'net';

import { Ack, Packet, Parser, build, buildAck } from './packet';

type Resolver = () => void;

export interface JetOptions {
  timeout?: number;
}

export class Jet<T> extends EventEmitter {
  private parser: Parser<T>;

  private lastId = 0;
  private resolverMap = new Map<number, Resolver>();

  private timeout: number;

  constructor(
    public socket: Socket,
    {
      timeout = 30 * 1000,
    }: JetOptions = {},
  ) {
    super();

    let parser = new Parser<T>();

    socket.on('data', data => parser.append(data));

    parser.on('packet', packet => this.handlePacket(packet));
    parser.on('ack', ack => this.handleAck(ack));
    parser.on('error', error => this.emit('error', error));

    this.parser = parser;

    this.timeout = timeout;
  }

  async send(data: T): Promise<void> {
    let id = ++this.lastId;
    let packetBuffer = build(id, data);

    await new Promise<void>((resolve, reject) => {
      this.socket.write(packetBuffer, (error: any) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    let timer: NodeJS.Timer;

    let sentPromise = new Promise<void>(resolve => {
      this.resolverMap.set(id, () => {
        clearTimeout(timer);
        resolve();
      });
    });

    let timeoutPromise = new Promise<void>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error('Jet sending timed out'));
      }, this.timeout);
    });

    await Promise.race([
      sentPromise,
      timeoutPromise,
    ]);
  }

  private handlePacket({id, data}: Packet<T>): void {
    let ackBuffer = buildAck(id);

    this.socket.write(ackBuffer);

    this.emit('data', data);
  }

  private handleAck({id}: Ack): void {
    let resolver = this.resolverMap.get(id);

    if (resolver) {
      resolver();
    }
  }
}

export interface Jet<T> {
  on(event: 'data', listener: (data: T) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;

  emit(event: 'data', data: T): boolean;
  emit(event: 'error', error: Error): boolean;
}
