import {Duplex} from 'stream';

import {CryptoOptions, Packet, Parser, Type, build} from './packet';

export interface StreamJetOptions {
  crypto?: CryptoOptions;
}

export class StreamJet<TIn, TOut, TSocket extends Duplex> extends Duplex {
  private parser: Parser<unknown>;

  private cryptoOptions: CryptoOptions | undefined;

  private initialized = false;

  constructor(
    readonly socket: TSocket,
    readonly options: StreamJetOptions = {},
  ) {
    super({
      objectMode: true,
    });

    let {crypto: cryptoOptions} = options;

    socket.on('error', this.onError);

    let parser = new Parser({crypto: cryptoOptions});

    parser.on('packet', this.onParserPacket);
    parser.on('error', this.onError);

    this.parser = parser;

    this.cryptoOptions = cryptoOptions;
  }

  _write(
    chunk: TIn,
    _encoding: unknown,
    callback: (error?: Error) => void,
  ): void {
    this.socket.write(
      build(Type.packet, 0, chunk, {
        crypto: this.cryptoOptions,
      }),
      callback,
    );
  }

  _read(): void {
    if (this.initialized) {
      this.socket.resume();
    } else {
      this.initialized = true;
      this.socket.on('data', this.onSocketData);
    }
  }

  private onSocketData = (data: Buffer): void => {
    this.parser.append(data);
  };

  private onParserPacket = ({data}: Packet<TIn>): void => {
    if (!this.push(data)) {
      this.socket.pause();
    }
  };

  private onError = (error: Error): void => {
    this.emit('error', error);
  };
}

export interface StreamJet<TIn, TOut, TSocket extends Duplex> {
  write(
    chunk: TOut,
    encoding?: BufferEncoding,
    callback?: (error: Error | null | undefined) => void,
  ): boolean;
  write(
    chunk: TOut,
    callback?: (error: Error | null | undefined) => void,
  ): boolean;

  on(event: string, listener: (...args: any[]) => void): this;
  on(event: 'data', listener: (data: TIn) => void): this;

  once(event: string, listener: (...args: any[]) => void): this;
  once(event: 'data', listener: (data: TIn) => void): this;
}
