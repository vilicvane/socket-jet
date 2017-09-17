import { EventEmitter } from 'events';

import { crc8 } from 'crc';

const HEAD_LENGTH = 12;
const MAGIC = Buffer.from('jet!');
const VERSION = 1;

// magic        4 bytes   'jet!'
// head crc     1 bytes   uint8
// version      1 bytes   uint8
// type         1 bytes   uint8
// body crc     1 bytes   uint8
// body length  4 bytes   uint32be

const enum HeadOffset {
  magic = 0,
  crc = 4,
  version = 5,
  type = 6,
  bodyCRC = 7,
  bodyLength = 8,
}

const enum State {
  head,
  body,
}

const enum Type {
  raw = 0x01,
  json = 0x02,
}

interface Head {
  version: number;
  type: Type;
  bodyCRC: number;
  bodyLength: number;
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
    let crc = buffer.readUInt8(HeadOffset.crc);

    if (crc !== crc8(content)) {
      this.buffer = buffer.slice(MAGIC.length);
      return true;
    }

    let version = buffer.readUInt8(HeadOffset.version);
    let type = buffer.readUInt8(HeadOffset.type) as Type;
    let bodyCRC = buffer.readUInt8(HeadOffset.bodyCRC);
    let bodyLength = buffer.readUInt32BE(HeadOffset.bodyLength);

    this.buffer = buffer.slice(HEAD_LENGTH);
    this.head = {version, type, bodyCRC, bodyLength};
    this.state = State.body;

    return true;
  }

  private parseBody(): boolean {
    let buffer = this.buffer;
    let {type, bodyCRC, bodyLength} = this.head!;

    if (buffer.length < bodyLength) {
      return false;
    }

    this.state = State.head;
    this.head = undefined;

    let body = buffer.slice(0, bodyLength);

    if (bodyCRC !== crc8(body)) {
      return true;
    }

    this.buffer = buffer.slice(bodyLength);

    switch (type) {
      case Type.raw:
        this.emit('data', body);
        break;
      case Type.json:
        this.parseJSON(body);
        break;
    }

    return true;
  }

  private parseJSON(buffer: Buffer): void {
    try {
      let data = JSON.parse(buffer.toString());
      this.emit('data', data);
    } catch (error) {
      this.emit('error', error);
    }
  }
}

export interface Parser<T> {
  on(event: 'data', listener: (data: T) => void): this;
}

export function build(data: any): Buffer {
  let type = Buffer.isBuffer(data) ? Type.raw : Type.json;
  let body = type === Type.raw ?
    data as Buffer : Buffer.from(JSON.stringify(data));

  let bodyCRC = crc8(body);

  let head = new Buffer(HEAD_LENGTH);

  MAGIC.copy(head);

  head.writeUInt8(VERSION, HeadOffset.version);
  head.writeUInt8(type, HeadOffset.type);
  head.writeUInt8(bodyCRC, HeadOffset.bodyCRC);
  head.writeUInt32BE(body.length, HeadOffset.bodyLength);

  let crc = crc8(head.slice(HeadOffset.version));

  head.writeUInt8(crc, HeadOffset.crc);

  return Buffer.concat([head, body]);
}
