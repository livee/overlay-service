import { EventEmitter } from 'events';
import * as http from 'http';

import * as bodyParser from 'body-parser';
import * as express from 'express';

import { LoggerWithContext } from '@src/Logger/LoggerWithContext';
import { v1 } from '@src/Server/Route/';
import { OverlayService } from '@src/Service/OverlayService';

interface IConfig {
    host: string;
    port: number;
}

class Server extends EventEmitter {
    private readonly app: express.Application;
    private readonly server: http.Server;

    public constructor(
        private readonly config: IConfig,
        private readonly logger: LoggerWithContext,
        overlayService: OverlayService
    ) {
        super();

        this.app = express();

        this.server = http.createServer(this.app);

        this.app.disable('etag');

        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.use(bodyParser.json());

        this.app.use(this.checkRequestContentType);
        this.app.use(this.checkAcceptRequestType);

        this.app.use(v1(this.logger.create('[api]'), overlayService));

        this.app.use(this.invalidPathHandler);

        this.app.use(this.errorHandler);
    }

    public start(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server.on('error', (error) => {
                reject(error);
            });

            this.server.listen(
                {
                    host: this.config.host,
                    port: this.config.port,
                },
                () => {
                    this.logger.info(`server is listening on port ${this.config.port}...`);

                    this.server.removeAllListeners('error');

                    this.server.on('error', this.onServerError);

                    resolve();
                }
            );
        });
    }

    public stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server.close((error: Error) => {
                this.server.removeAllListeners();

                if (error) {
                    this.logger.error('server close error: ', error);

                    return reject(error);
                }

                this.logger.info('server has been closed.');

                return resolve();
            });
        });
    }

    private readonly onServerError = (error: Error): void => {
        this.emit('error', error);
    };

    private readonly checkRequestContentType = (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        const contentType = req.headers['content-type'];

        this.logger.debug(`Request content-type: ${contentType}`);

        if (!contentType || contentType.indexOf('application/json') === -1) {
            this.logger.debug('Invalid request content-type header field. Must be "application/json"');

            return res
                .status(400)
                .json({ code: 1000, message: 'Invalid request content-type header field. Must be "application/json"' });
        }

        next();
    };

    private readonly checkAcceptRequestType = (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        const acceptType = req.headers.accept;

        this.logger.debug(`Request accept-type: ${acceptType}`);

        if (!acceptType || acceptType.indexOf('application/json') === -1) {
            this.logger.debug('Invalid request accept header field. Must be "application/json"');

            return res
                .status(400)
                .json({ code: 1000, message: 'Invalid request accept header field. Must be "application/json"' });
        }

        next();
    };

    private readonly invalidPathHandler = (req: express.Request, res: express.Response, next: express.NextFunction) => {
        this.logger.debug('Invalid path', req.originalUrl);

        return res.status(400).json({ code: 1000, message: 'Invalid path' });
    };

    private readonly errorHandler = (
        error: Error,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        this.logger.error(`Internal error: ${error.message}`, error);

        return res.status(400).json({ code: 1000, message: 'Internal error' });
    };
}

export { IConfig, Server };
