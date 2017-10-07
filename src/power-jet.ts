import { Socket } from 'net';

import { Jet, JetOptions } from './jet';

type CallHandler = (value: any) => void;

export interface Call {
  type: 'call';
  name: string;
  args: any[];
}

export interface CallReturn {
  type: 'return';
  value: any;
}

export interface CallThrow {
  type: 'throw';
  value: string;
}

export type CallResult = CallReturn | CallThrow;

export class PowerJet extends Jet<Call | CallResult> {
  private callHandlersMap = new Map<number, [CallHandler, CallHandler]>();

  constructor(socket: Socket, options?: JetOptions) {
    super(socket, options);

    this.on('data', (data, id) => {
      if (data.type === 'call') {
        this.handleCall(data);
      } else {
        this.handleResult(data, id);
      }
    });
  }

  async call<T>(name: string, ...args: any[]): Promise<T> {
    let call: Call = {
      type: 'call',
      name,
      args,
    };

    let id = await this.send(call);

    return await new Promise<T>((resolve, reject) => {
      this.callHandlersMap.set(id, [resolve, reject]);
    });
  }

  private handleCall(call: Call): void {
    (async () => {
      let result: CallResult;

      try {
        let {name, args} = call;
        let value = await (this as any)[name](...args);

        result = {
          type: 'return',
          value,
        };
      } catch (error) {
        result = {
          type: 'throw',
          value: typeof error === 'string' ? error : `${error && error.message}`,
        };
      }

      await this.send(result);
    })()
      .catch(error => this.emit('error', error));
  }

  private handleResult(result: CallResult, id: number): void {
    let handlers = this.callHandlersMap.get(id);

    if (!handlers) {
      return;
    }

    this.callHandlersMap.delete(id);

    switch (result.type) {
      case 'return':
        handlers[0](result.value);
        break;
      case 'throw':
        handlers[1](new Error(result.value));
        break;
    }
  }
}
