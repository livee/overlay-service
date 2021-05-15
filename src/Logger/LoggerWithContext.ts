import { EventEmitter } from 'events';

import { Logger } from '@src/Logger/Logger';

class LoggerWithContext extends EventEmitter {
    public constructor(private readonly logger: Logger, private readonly context: string) {
        super();

        if (this.logger.transports.dailyRotateFile) {
            if (this.logger.transports.dailyRotateFile.listenerCount('flush') > 0) {
                return;
            }

            this.logger.transports.dailyRotateFile.on('flush', () => {
                this.emit('flush');
            });
        }
    }

    public create(newContext: string): LoggerWithContext {
        return new LoggerWithContext(this.logger, `${this.context}${newContext}`);
    }

    public debug(...params: any[]) {
        this.logger.debug(this.context, ...params);
    }

    public error(...params: any[]) {
        this.logger.error(this.context, ...params);
    }

    public info(...params: any[]) {
        this.logger.info(this.context, ...params);
    }

    public warn(...params: any[]) {
        this.logger.warn(this.context, ...params);
    }

    public close() {
        this.logger.close();
    }
}

export { LoggerWithContext };
