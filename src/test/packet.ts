import * as Crypto from 'crypto';

import {CryptoOptions, Parser, Type, build} from '../library/packet';

let primitivePacket = {
  type: Type.packet,
  id: 1,
  data: 'foobar',
};

let objectPacket = {
  type: Type.packet,
  id: 1,
  data: {foo: 123, bar: Buffer.from('abc')},
};

let rawPacket = {
  type: Type.packet,
  id: 2,
  data: Buffer.from('hello, thank you!'),
};

let packetToEncrypt = {
  type: Type.packet,
  id: 2,
  data: {foo: 456, bar: Buffer.from('def')},
};

let ack = {
  type: Type.ack,
  id: 123,
};

let cryptoOptions: CryptoOptions = {
  algorithm: 'aes-256-cfb',
  key: Crypto.randomBytes(32),
  iv: Crypto.randomBytes(16),
};

let primitivePacketBuffer = build(
  Type.packet,
  primitivePacket.id,
  primitivePacket.data,
);
let objectPacketBuffer = build(Type.packet, objectPacket.id, objectPacket.data);
let rawPacketBuffer = build(Type.packet, rawPacket.id, rawPacket.data);
let encryptedPacketBuffer = build(
  Type.packet,
  packetToEncrypt.id,
  packetToEncrypt.data,
  {crypto: cryptoOptions},
);
let ackBuffer = build(Type.ack, ack.id);
let encryptedAckBuffer = build(Type.ack, ack.id, {crypto: cryptoOptions});

test('should parse primitive packet', done => {
  let parser = new Parser<typeof primitivePacket.data>();

  parser.on('packet', packet => {
    expect(packet).toEqual(primitivePacket);
    done();
  });

  parser.append(primitivePacketBuffer);
});

test('should parse object packet', done => {
  let parser = new Parser<typeof objectPacket.data>();

  parser.on('packet', packet => {
    expect(packet).toEqual(objectPacket);
    done();
  });

  parser.append(objectPacketBuffer);
});

test('should parse object packet segments', done => {
  let parser = new Parser<typeof objectPacket.data>();

  parser.on('packet', packet => {
    expect(packet).toEqual(objectPacket);
    done();
  });

  parser.append(objectPacketBuffer.slice(0, 2));
  parser.append(objectPacketBuffer.slice(2, 6));
  parser.append(objectPacketBuffer.slice(6));

  expect(parser.pending).toBe(0);
});

test('should parse object packet even in dirty state', done => {
  let parser = new Parser<typeof objectPacket.data>();

  parser.on('packet', packet => {
    expect(packet).toEqual(objectPacket);
    done();
  });

  parser.append(Buffer.from('hello, thank you!'));
  parser.append(objectPacketBuffer);
});

test('should parse raw packet', done => {
  let parser = new Parser<Buffer>();

  parser.on('packet', packet => {
    expect(packet).toEqual(rawPacket);
    done();
  });

  parser.append(rawPacketBuffer);
});

test('should parse encrypted packet', done => {
  let parser = new Parser<typeof objectPacket.data>({crypto: cryptoOptions});

  parser.on('packet', packet => {
    expect(packet).toEqual(packetToEncrypt);
    done();
  });

  parser.append(encryptedPacketBuffer);
});

test('should parse ack', done => {
  let parser = new Parser<any>();

  parser.on('ack', receivedAck => {
    expect(receivedAck).toEqual(ack);
    done();
  });

  parser.append(ackBuffer);
});

test('should parse encrypted ack', done => {
  let parser = new Parser<any>({crypto: cryptoOptions});

  parser.on('ack', receivedAck => {
    expect(receivedAck).toEqual(ack);
    done();
  });

  parser.append(encryptedAckBuffer);
});
