import {Duplex} from 'stream';

import {CryptoOptions, Packet, Parser, Type, build} from './packet';

export const HEARTBEAT_INTERVAL_DEFAULT = 5_000;

export interface StreamJetOptions {
  crypto?: CryptoOptions;
  heartbeat?:
    | {
        interval?: number;
      }
    | boolean;
}

export class StreamJet<TIn, TOut, TSocket extends Duplex> extends Duplex {
  private parser: Parser<unknown>;

  private cryptoOptions: CryptoOptions | undefined;

  private initialized = false;

  private heartbeatTimer: NodeJS.Timer | undefined;
  private heartbeatInterval: number | undefined;

  constructor(
    readonly socket: TSocket,
    readonly options: StreamJetOptions = {},
  ) {
    super({
      objectMode: true,
    });

    let {crypto: cryptoOptions, heartbeat} = options;

    this.on('close', this.onClose);

    socket.on('close', this.onSocketClose);
    socket.on('end', this.onSocketEnd);
    socket.on('error', this.onSocketError);

    let parser = new Parser({crypto: cryptoOptions});

    parser.on('packet', this.onParserPacket);
    parser.on('error', this.onParserError);

    this.parser = parser;

    this.cryptoOptions = cryptoOptions;

    if (heartbeat) {
      let {interval = HEARTBEAT_INTERVAL_DEFAULT} =
        heartbeat === true ? {} : heartbeat;

      this.heartbeatInterval = interval;

      this.setUpHeartbeat();
    }
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

  private onClose = (): void => {
    let socket = this.socket;
    let parser = this.parser;

    socket.destroy();

    socket.off('data', this.onSocketData);
    socket.off('close', this.onSocketClose);
    socket.off('end', this.onSocketEnd);
    socket.off('error', this.onSocketError);

    parser.off('packet', this.onParserPacket);
    parser.off('error', this.onParserError);
  };

  private onSocketClose = (): void => {
    this.destroy();
  };

  private onSocketEnd = (): void => {
    this.tearDownHeartbeat();
    this.destroy();
  };

  private onSocketError = (error: Error): void => {
    this.tearDownHeartbeat();
    this.destroy(error);
  };

  private onSocketData = (data: Buffer): void => {
    this.parser.append(data);
  };

  private onParserPacket = ({data}: Packet<TIn>): void => {
    if (!this.push(data)) {
      this.socket.pause();
    }
  };

  private onParserError = (error: Error): void => {
    this.socket.destroy();
    this.destroy(error);
  };

  private setUpHeartbeat(): void {
    if (!this.heartbeatInterval) {
      return;
    }

    this.tearDownHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      this.socket.write(build(Type.ping, {crypto: this.cryptoOptions}));
    }, this.heartbeatInterval);
  }

  private tearDownHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
  }
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

  end(callback?: () => void): void;
  end(chunk: TOut, callback?: () => void): void;

  on(event: string, listener: (...args: any[]) => void): this;
  on(event: 'data', listener: (data: TIn) => void): this;

  once(event: string, listener: (...args: any[]) => void): this;
  once(event: 'data', listener: (data: TIn) => void): this;
}
