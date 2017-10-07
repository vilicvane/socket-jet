import test from 'ava';

import { CryptoOptions, Parser, Type, build } from '../packet';

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
  password: 'some password',
};

let primitivePacketBuffer = build(primitivePacket.id, Type.packet, primitivePacket.data);
let objectPacketBuffer = build(objectPacket.id, Type.packet, objectPacket.data);
let rawPacketBuffer = build(rawPacket.id, Type.packet, rawPacket.data);
let encryptedPacketBuffer = build(packetToEncrypt.id, Type.packet, packetToEncrypt.data, {crypto: cryptoOptions});
let ackBuffer = build(ack.id, Type.ack);
let encryptedAckBuffer = build(ack.id, Type.ack, {crypto: cryptoOptions});

test.cb('should parse primitive packet', t => {
  let parser = new Parser<typeof primitivePacket.data>();

  parser.on('packet', packet => {
    t.deepEqual(packet, primitivePacket);
    t.end();
  });

  parser.append(primitivePacketBuffer);
});

test.cb('should parse object packet', t => {
  let parser = new Parser<typeof objectPacket.data>();

  parser.on('packet', packet => {
    t.deepEqual(packet, objectPacket);
    t.end();
  });

  parser.append(objectPacketBuffer);
});

test.cb('should parse object packet segments', t => {
  let parser = new Parser<typeof objectPacket.data>();

  parser.on('packet', packet => {
    t.deepEqual(packet, objectPacket);
    t.end();
  });

  parser.append(objectPacketBuffer.slice(0, 2));
  parser.append(objectPacketBuffer.slice(2, 6));
  parser.append(objectPacketBuffer.slice(6));

  t.is(parser.pending, 0);
});

test.cb('should parse object packet even in dirty state', t => {
  let parser = new Parser<typeof objectPacket.data>();

  parser.on('packet', packet => {
    t.deepEqual(packet, objectPacket);
    t.end();
  });

  parser.append(Buffer.from('hello, thank you!'));
  parser.append(objectPacketBuffer);
});

test.cb('should parse raw packet', t => {
  let parser = new Parser<Buffer>();

  parser.on('packet', packet => {
    t.deepEqual(packet, rawPacket);
    t.end();
  });

  parser.append(rawPacketBuffer);
});

test.cb('should parse encrypted packet', t => {
  let parser = new Parser<typeof objectPacket.data>({crypto: cryptoOptions});

  parser.on('packet', packet => {
    t.deepEqual(packet, packetToEncrypt);
    t.end();
  });

  parser.append(encryptedPacketBuffer);
});

test.cb('should parse ack', t => {
  let parser = new Parser<any>();

  parser.on('ack', receivedAck => {
    t.deepEqual(receivedAck, ack);
    t.end();
  });

  parser.append(ackBuffer);
});

test.cb('should parse encrypted ack', t => {
  let parser = new Parser<any>({crypto: cryptoOptions});

  parser.on('ack', receivedAck => {
    t.deepEqual(receivedAck, ack);
    t.end();
  });

  parser.append(encryptedAckBuffer);
});
