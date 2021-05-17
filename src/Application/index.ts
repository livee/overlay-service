/* tslint:disable:max-classes-per-file */

import { EventEmitter } from 'events';

import { ApplicationError } from '@src/Application/Error';
import { IConfig as ILoggerServiceConfig, Logger } from '@src/Logger/Logger';
import { LoggerWithContext } from '@src/Logger/LoggerWithContext';
import { IConfig as IServerConfig, Server } from '@src/Server';
import { configValidator } from '@src/Tools';
import { OverlayService, IConfig as IOverlayConfig } from '@src/Service/OverlayService';

interface IConfig {
    name: string;
    server: IServerConfig;
    logger: ILoggerServiceConfig;
    overlay: IOverlayConfig;
}

class ApplicationStatus {
    constructor(private readonly representation: string) {}

    public toJSON(): string {
        return this.representation;
    }
}

class Application extends EventEmitter {
    public static get STATUS() {
        return {
            INITIALIZED: new ApplicationStatus('initialized'),
            STARTING: new ApplicationStatus('starting'),
            STARTED: new ApplicationStatus('started'),
            STOPPING: new ApplicationStatus('stopping'),
            STOPPED: new ApplicationStatus('stopped'),
        };
    }

    private status: ApplicationStatus;

    private readonly server: Server;
    private readonly logger: LoggerWithContext;

    private readonly overlayService: OverlayService;

    constructor(private readonly config: IConfig) {
        super();

        configValidator(this.config);

        this.logger = new LoggerWithContext(
            new Logger(Object.assign({ appName: config.name }, config.logger)),
            `[overlay-service application ${process.pid}]`
        );

        this.overlayService = new OverlayService(
            this.config.overlay,
            this.logger.create('[overlay-service]')
        );

        this.server = new Server(config.server, this.logger.create('[server]'), this.overlayService);

        this.server.on('error', this.onServerError);

        this.status = Application.STATUS.INITIALIZED;
    }

    public async start(): Promise<void> {
        this.status = Application.STATUS.STARTING;

        try {
            await this.server.start();
        } catch (error) {
            this.status = Application.STATUS.STOPPED;

            throw new ApplicationError(
                `Error during starting server while starting application: ${error.message}`,
                error
            );
        }

        this.status = Application.STATUS.STARTED;
    }

    public async stop(): Promise<Error[]> {
        this.status = Application.STATUS.STOPPING;

        const errors: Error[] = [];

        try {
            await this.server.stop();
        } catch (error) {
            errors.push(
                new ApplicationError(`Error during stopping server while stopping application: ${error.message}`, error)
            );
        }

        try {
            await this.overlayService.deinit();
        } catch (error) {
            errors.push(
                new ApplicationError(
                    `Error during stopping overlay service while stopping application: ${error.message}`,
                    error
                )
            );
        }

        this.status = Application.STATUS.STOPPED;

        return errors;
    }

    public cleanUp(): void {
        this.logger.close();
    }

    public getLogger(): LoggerWithContext {
        return this.logger;
    }

    public getStatus = (): ApplicationStatus => {
        return this.status;
    };

    private readonly onServerError = (error: Error) => {
        this.emit('error', error);
    };
}

export { Application, ApplicationStatus };
