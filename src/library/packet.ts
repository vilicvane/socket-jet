import * as Crypto from 'crypto';
import {EventEmitter} from 'events';

import * as BSON from 'bson';

const HEAD_LENGTH = 8;
const MAGIC = Buffer.from('jet!');

// magic        4 bytes   'jet!'
// body length  4 bytes   uint32be
// body

const enum HeadOffset {
  magic = 0,
  bodyLength = 4,
}

const enum State {
  head,
  body,
}

interface Head {
  bodyLength: number;
}

export const enum Type {
  ack = 0,
  packet = 1,
  ping = 3,
  pong = 4,
}

export type GeneralPacket<T> = Ack | Packet<T> | Ping | Pong;

export interface Ack {
  type: Type.ack;
  id: number;
}

export interface Packet<T> {
  type: Type.packet;
  id: number;
  data: T;
}

export interface Ping {
  type: Type.ping;
}

export interface Pong {
  type: Type.pong;
}

export interface CryptoOptions {
  algorithm: string;
  key: string | Buffer;
  iv: any;
}

export interface ParserOptions {
  crypto?: CryptoOptions;
}

export class Parser<T> extends EventEmitter {
  private state = State.head;

  private head: Head | undefined;

  private buffer = Buffer.from([]);

  constructor(private options: ParserOptions = {}) {
    super();
  }

  get pending(): number {
    return this.buffer.length;
  }

  append(segment: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, segment]);
    this.parse();
  }

  private parse(): void {
    while (this._parse()) {}
  }

  private _parse(): boolean {
    switch (this.state) {
      case State.head:
        return this.parseHead();
      case State.body:
        return this.parseBody();
    }
  }

  private parseHead(): boolean {
    let buffer = this.buffer;

    if (buffer.length < HEAD_LENGTH) {
      return false;
    }

    let start = buffer.indexOf(MAGIC);

    if (start < 0) {
      if (buffer.length >= MAGIC.length) {
        this.buffer = buffer.slice(buffer.length - (MAGIC.length - 1));
      }

      return false;
    }

    if (start > 0) {
      this.buffer = buffer = buffer.slice(start);

      if (buffer.length < HEAD_LENGTH) {
        return false;
      }
    }

    let bodyLength = buffer.readUInt32BE(HeadOffset.bodyLength);

    this.buffer = buffer.slice(HEAD_LENGTH);
    this.head = {bodyLength};
    this.state = State.body;

    return true;
  }

  private parseBody(): boolean {
    let buffer = this.buffer;
    let {bodyLength} = this.head!;

    if (buffer.length < bodyLength) {
      return false;
    }

    this.state = State.head;
    this.head = undefined;

    let body = buffer.slice(0, bodyLength);

    this.buffer = buffer.slice(bodyLength);

    try {
      let object = this._parseBody(body);

      switch (object.type) {
        case Type.ack:
          this.emit('ack', object);
          break;
        case Type.packet:
          this.emit('packet', object);
          break;
        case Type.ping:
          this.emit('ping');
          break;
        case Type.pong:
          this.emit('pong');
          break;
      }
    } catch (error) {
      this.emit('error', error);
    }

    return true;
  }

  private _parseBody(body: Buffer): GeneralPacket<T> {
    let cryptoOptions = this.options.crypto;

    if (cryptoOptions) {
      let decipher = Crypto.createDecipheriv(
        cryptoOptions.algorithm,
        cryptoOptions.key,
        cryptoOptions.iv,
      );
      body = Buffer.concat([decipher.update(body), decipher.final()]);
    }

    return BSON.deserialize(body, {promoteBuffers: true}) as GeneralPacket<T>;
  }
}

export interface Parser<T> {
  on(event: 'ack', listener: (ack: Ack) => void): this;
  on(event: 'packet', listener: (packet: Packet<T>) => void): this;
  on(event: 'ping' | 'pong', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;

  emit(event: 'ack', ack: Ack): boolean;
  emit(event: 'packet', packet: Packet<T>): boolean;
  emit(event: 'ping' | 'pong'): boolean;
  emit(event: 'error', error: Error): boolean;
}

export interface BuildOptions {
  crypto?: CryptoOptions;
}

export function build(
  type: Type.ack,
  id: number,
  options?: BuildOptions,
): Buffer;
export function build(
  type: Type.packet,
  id: number,
  data?: any,
  options?: BuildOptions,
): Buffer;
export function build(
  type: Type.ping | Type.pong,
  options?: BuildOptions,
): Buffer;
export function build(type: Type, ...args: any[]): Buffer {
  let object: GeneralPacket<any>;
  let options: BuildOptions;

  switch (type) {
    case Type.ack:
      object = {
        type,
        id: args[0],
      };
      options = args[1];
      break;
    case Type.packet:
      object = {
        type,
        id: args[0],
        data: args[1],
      };
      options = args[2];
      break;
    case Type.ping:
    case Type.pong:
      object = {
        type,
      };
      options = args[0];
      break;
    default:
      throw new Error(`Invalid type ${type}`);
  }

  let body = BSON.serialize(object);

  let cryptoOptions = options && options.crypto;

  if (cryptoOptions) {
    let cipher = Crypto.createCipheriv(
      cryptoOptions.algorithm,
      cryptoOptions.key,
      cryptoOptions.iv,
    );
    body = Buffer.concat([cipher.update(body), cipher.final()]);
  }

  let head = Buffer.alloc(HEAD_LENGTH);

  MAGIC.copy(head);

  head.writeUInt32BE(body.length, HeadOffset.bodyLength);

  return Buffer.concat([head, body]);
}
