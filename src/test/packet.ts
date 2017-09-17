import test from 'ava';

import { Parser, build } from '../packet';

let jsonData = {foo: 123, bar: 'abc'};
let rawData = Buffer.from('hello, thank you!');

let jsonPacket = build(jsonData);
let rawPacket = build(rawData);

test.cb('should build and parse json packet', t => {
  let parser = new Parser<typeof jsonData>();

  parser.on('data', data => {
    t.deepEqual(data, jsonData);
    t.end();
  });

  parser.append(jsonPacket);
});

test.cb('should build and parse json packet segments', t => {
  let parser = new Parser<typeof jsonData>();

  parser.on('data', data => {
    t.deepEqual(data, jsonData);
    t.end();
  });

  parser.append(jsonPacket.slice(0, 2));
  parser.append(jsonPacket.slice(2, 10));
  parser.append(jsonPacket.slice(10, 16));
  parser.append(jsonPacket.slice(16));

  t.is(parser.pending, 0);
});

test.cb('should build and parse json even in dirty state', t => {
  let parser = new Parser<typeof jsonData>();

  parser.on('data', data => {
    t.deepEqual(data, jsonData);
    t.end();
  });

  parser.append(Buffer.from('hello, thank you!'));
  parser.append(jsonPacket);
});

test.cb('should build and parse raw packet', t => {
  let parser = new Parser<Buffer>();

  parser.on('data', data => {
    t.deepEqual(data, rawData);
    t.end();
  });

  parser.append(rawPacket);
});
