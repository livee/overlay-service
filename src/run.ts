// tslint:disable-next-line no-var-requires no-require-imports
require('source-map-support').install({ environment: 'node' });

import { util as configUtil } from 'config';

import { Application } from '@src/Application';

const config = configUtil.toObject();

const application = new Application(config);

application.start().catch((error: Error) => {
    application.getLogger().error(error.message, error);

    application.cleanUp();
});

application.on('error', async (error: Error) => {
    application.getLogger().error(`Application error: ${error.message}`, error);

    const errors = await application.stop();

    errors.forEach((err: Error) => {
        application.getLogger().error(`Application stop error: ${err.message}`, err);
    });

    application.cleanUp();
});

process.on('SIGINT', async () => {
    const errors = await application.stop();

    errors.forEach((error: Error) => {
        application.getLogger().error(`Application stop error: ${error.message}`, error);
    });

    application.cleanUp();
});

process.on('SIGTERM', async () => {
    const errors = await application.stop();

    errors.forEach((error: Error) => {
        application.getLogger().error(`Application stop error: ${error.message}`, error);
    });

    application.cleanUp();
});

process.on('uncaughtException', error => {
    application.getLogger().error('uncaughtException: ', error.message + '. Stack: ' + error.stack);
});

process.on('unhandledRejection', reason => {
    application.getLogger().error('unhandledRejection: ', reason.message + '. Stack: ' + reason.stack);
});
