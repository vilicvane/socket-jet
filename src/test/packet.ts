import test from 'ava';

import { Parser, build, buildAck } from '../packet';

let jsonPacket = {
  id: 1,
  data: {foo: 123, bar: 'abc'},
};

let rawPacket = {
  id: 2,
  data: Buffer.from('hello, thank you!'),
};

let jsonPacketBuffer = build(jsonPacket.id, jsonPacket.data);
let rawPacketBuffer = build(rawPacket.id, rawPacket.data);

test.cb('should build and parse json packet', t => {
  let parser = new Parser<typeof jsonPacket.data>();

  parser.on('packet', packet => {
    t.deepEqual(packet, jsonPacket);
    t.end();
  });

  parser.append(jsonPacketBuffer);
});

test.cb('should build and parse json packet segments', t => {
  let parser = new Parser<typeof jsonPacket.data>();

  parser.on('packet', packet => {
    t.deepEqual(packet, jsonPacket);
    t.end();
  });

  parser.append(jsonPacketBuffer.slice(0, 2));
  parser.append(jsonPacketBuffer.slice(2, 10));
  parser.append(jsonPacketBuffer.slice(10, 16));
  parser.append(jsonPacketBuffer.slice(16));

  t.is(parser.pending, 0);
});

test.cb('should build and parse json even in dirty state', t => {
  let parser = new Parser<typeof jsonPacket.data>();

  parser.on('packet', packet => {
    t.deepEqual(packet, jsonPacket);
    t.end();
  });

  parser.append(Buffer.from('hello, thank you!'));
  parser.append(jsonPacketBuffer);
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
