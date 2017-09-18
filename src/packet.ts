import { EventEmitter } from 'events';

import { BSON } from 'bson';
import { crc16, crc32 } from 'crc';

const bson = new BSON();

const HEAD_LENGTH = 20;
const MAGIC = Buffer.from('jet!');
const VERSION = 1;

// magic        4 bytes   'jet!'
// head crc16   2 bytes   uint16be
// version      1 bytes   uint8
// type         1 bytes   uint8
// id           4 bytes   uint32be
// body crc32   4 bytes   uint32be
// body length  4 bytes   uint32be

const enum HeadOffset {
  magic = 0,
  crc = 4,
  version = 6,
  type = 7,
  id = 8,
  bodyCRC = 12,
  bodyLength = 16,
}

const enum State {
  head,
  body,
}

export const enum Type {
  ack = 0x00,
  raw = 0x01,
  json = 0x02,
  bson = 0x03,
}

interface Head {
  version: number;
  type: Type;
  id: number;
  bodyCRC: number;
  bodyLength: number;
}

export interface Packet<T> {
  id: number;
  data: T;
}

export interface Ack {
  id: number;
}

export class Parser<T> extends EventEmitter {
  private state = State.head;

  private head: Head | undefined;

  private buffer = Buffer.from([]);

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

    let content = buffer.slice(HeadOffset.version, HEAD_LENGTH);
    let crc = buffer.readUInt16BE(HeadOffset.crc);

    if (crc !== crc16(content)) {
      this.buffer = buffer.slice(MAGIC.length);
      return true;
    }

    let version = buffer.readUInt8(HeadOffset.version);
    let type = buffer.readUInt8(HeadOffset.type) as Type;
    let id = buffer.readUInt32BE(HeadOffset.id);
    let bodyCRC = buffer.readUInt32BE(HeadOffset.bodyCRC);
    let bodyLength = buffer.readUInt32BE(HeadOffset.bodyLength);

    this.buffer = buffer.slice(HEAD_LENGTH);
    this.head = {version, type, id, bodyCRC, bodyLength};
    this.state = State.body;

    return true;
  }

  private parseBody(): boolean {
    let buffer = this.buffer;
    let {type, id, bodyCRC, bodyLength} = this.head!;

    if (buffer.length < bodyLength) {
      return false;
    }

    this.state = State.head;
    this.head = undefined;

    let body = buffer.slice(0, bodyLength);

    if (bodyCRC !== crc32(body)) {
      return true;
    }

    this.buffer = buffer.slice(bodyLength);

    try {
      switch (type) {
        case Type.ack:
          this.emit('ack', {id});
          break;
        case Type.raw:
          this.emit('packet', {id, data: body as any});
          break;
        case Type.json:
          this.emit('packet', {
            id,
            data: JSON.parse(buffer.toString()),
          });
          break;
        case Type.bson:
          this.emit('packet', {
            id,
            data: bson.deserialize(buffer, {
              promoteBuffers: true,
            }),
          });
          break;
      }
    } catch (error) {
      this.emit('error', error);
    }

    return true;
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
  data?: any;
  type?: Type;
}

export function build(id: number, {data, type}: BuildOptions): Buffer {
  if (type === undefined) {
    type = Buffer.isBuffer(data) ?
      Type.raw : isPrimitive(data) ?
      Type.json : Type.bson;
  }

  let body: Buffer;

  switch (type) {
    case Type.ack:
      body = Buffer.from([]);
      break;
    case Type.raw:
      body = data;
      break;
    case Type.json:
      body = Buffer.from(JSON.stringify(data));
      break;
    case Type.bson:
      body = bson.serialize(data);
      break;
    default:
      throw new Error(`Invalid packet type ${type}`);
  }

  let bodyCRC = crc32(body);

  let head = new Buffer(HEAD_LENGTH);

  MAGIC.copy(head);

  head.writeUInt8(VERSION, HeadOffset.version);
  head.writeUInt8(type, HeadOffset.type);
  head.writeUInt32BE(id, HeadOffset.id);
  head.writeUInt32BE(bodyCRC, HeadOffset.bodyCRC);
  head.writeUInt32BE(body.length, HeadOffset.bodyLength);

  let crc = crc16(head.slice(HeadOffset.version));

  head.writeUInt16BE(crc, HeadOffset.crc);

  return Buffer.concat([head, body]);
}

export function buildAck(id: number): Buffer {
  return build(id, {type: Type.ack});
}

function isPrimitive(value: any): boolean {
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'undefined':
      return true;
  }

  return value === null;
}
