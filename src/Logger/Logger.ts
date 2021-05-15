import { accessSync, constants } from 'fs';
import { join } from 'path';

import * as _ from 'lodash';

import * as winston from 'winston';
import 'winston-daily-rotate-file';

interface IConfig {
    appName: string;
    level: string;
    transports: ['dailyRotateFile' | 'console'];
    path: string;
}

class Logger extends winston.Logger {
    private static checkPathAccessRigths(path: string) {
        try {
            accessSync(path, constants.W_OK);
        } catch (error) {
            throw new Error(`Cannot write to logger dir: ${error.message}`);
        }
    }

    public constructor(config: IConfig) {
        Logger.checkPathAccessRigths(config.path);

        const transports = {
            console: new winston.transports.Console({
                colorize: true,
                timestamp: true
            }),
            dailyRotateFile: new winston.transports.DailyRotateFile({
                datePattern: 'YYYY-MM-DD-HH',
                filename: join(config.path, `${config.appName}-${process.pid}-%DATE%.log`),
                timestamp: true
            })
        };

        super({
            level: config.level,
            transports: Object.values(_.pick(transports, config.transports))
        });
    }
}

export { IConfig, Logger };
