import * as Crypto from 'crypto';
import { EventEmitter } from 'events';

import { BSON } from 'bson';

const bson = new BSON();

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
}

export interface Packet<T> {
  type: Type.packet;
  id: number;
  data: T;
}

export interface Ack {
  type: Type.ack;
  id: number;
}

export interface CryptoOptions {
  algorithm: string;
  password: string | Buffer;
}

export interface ParserOptions {
  crypto?: CryptoOptions;
}

export class Parser<T> extends EventEmitter {
  private state = State.head;

  private head: Head | undefined;

  private buffer = Buffer.from([]);

  constructor(
    private options: ParserOptions = {},
  ) {
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
    while (this._parse()) { }
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
      }
    } catch (error) {
      this.emit('error', error);
    }

    return true;
  }

  private _parseBody(body: Buffer): Packet<T> | Ack {
    let cryptoOptions = this.options.crypto;

    if (cryptoOptions) {
      let decipher = Crypto.createDecipher(cryptoOptions.algorithm, cryptoOptions.password);
      body = Buffer.concat([decipher.update(body), decipher.final()]);
    }

    return bson.deserialize(body, {promoteBuffers: true}) as Packet<T> | Ack;
  }
}

export interface Parser<T> {
  on(event: 'packet', listener: (packet: Packet<T>) => void): this;
  on(event: 'ack', listener: (ack: Ack) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;

  emit(event: 'packet', packet: Packet<T>): boolean;
  emit(event: 'ack', ack: Ack): boolean;
  emit(event: 'error', error: Error): boolean;
}

export interface BuildOptions {
  crypto?: CryptoOptions;
}

export function build(id: number, type: Type.ack, options?: BuildOptions): Buffer;
export function build(id: number, type: Type.packet, data?: any, options?: BuildOptions): Buffer;
export function build(
  id: number,
  type: Type,
  data?: any,
  options?: BuildOptions,
): Buffer {
  let object: Packet<any> | Ack;

  switch (type) {
    case Type.ack:
      object = {
        type,
        id,
      };
      options = data;
      break;
    case Type.packet:
      object = {
        type,
        id,
        data,
      };
      break;
    default:
      throw new Error(`Invalid type ${type}`);
  }

  let body = bson.serialize(object);

  let cryptoOptions = options && options.crypto;

  if (cryptoOptions) {
    let cipher = Crypto.createCipher(cryptoOptions.algorithm, cryptoOptions.password);
    body = Buffer.concat([cipher.update(body), cipher.final()]);
  }

  let head = new Buffer(HEAD_LENGTH);

  MAGIC.copy(head);

  head.writeUInt32BE(body.length, HeadOffset.bodyLength);

  return Buffer.concat([head, body]);
}
