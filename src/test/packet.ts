import test from 'ava';

import { Parser, build, buildAck } from '../packet';

let primitivePacket = {
  id: 1,
  data: 'foobar',
};

let objectPacket = {
  id: 1,
  data: {foo: 123, bar: Buffer.from('abc')},
};

let rawPacket = {
  id: 2,
  data: Buffer.from('hello, thank you!'),
};

let primitivePacketBuffer = build(primitivePacket.id, {data: primitivePacket.data});
let objectPacketBuffer = build(objectPacket.id, {data: objectPacket.data});
let rawPacketBuffer = build(rawPacket.id, {data: rawPacket.data});

test.cb('should build and parse primitive packet', t => {
  let parser = new Parser<typeof primitivePacket.data>();

  parser.on('packet', packet => {
    t.deepEqual(packet, primitivePacket);
    t.end();
  });

  parser.append(primitivePacketBuffer);
});

test.cb('should build and parse object packet', t => {
  let parser = new Parser<typeof objectPacket.data>();

  parser.on('packet', packet => {
    t.deepEqual(packet, objectPacket);
    t.end();
  });

  parser.append(objectPacketBuffer);
});

test.cb('should build and parse object packet segments', t => {
  let parser = new Parser<typeof objectPacket.data>();

  parser.on('packet', packet => {
    t.deepEqual(packet, objectPacket);
    t.end();
  });

  parser.append(objectPacketBuffer.slice(0, 2));
  parser.append(objectPacketBuffer.slice(2, 10));
  parser.append(objectPacketBuffer.slice(10, 16));
  parser.append(objectPacketBuffer.slice(16));

  t.is(parser.pending, 0);
});

test.cb('should build and parse object packet even in dirty state', t => {
  let parser = new Parser<typeof objectPacket.data>();

  parser.on('packet', packet => {
    t.deepEqual(packet, objectPacket);
    t.end();
  });

  parser.append(Buffer.from('hello, thank you!'));
  parser.append(objectPacketBuffer);
});

test.cb('should build and parse raw packet', t => {
  let parser = new Parser<Buffer>();

  parser.on('packet', packet => {
    t.deepEqual(packet, rawPacket);
    t.end();
  });

  parser.append(rawPacketBuffer);
});

test.cb('should build and parse ack', t => {
  let parser = new Parser<any>();

  let id = 123;
  let ackBuffer = buildAck(id);

  parser.on('ack', ack => {
    t.deepEqual(ack, {id});
    t.end();
  });

  parser.append(ackBuffer);
});
