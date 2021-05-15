import * as express from 'express';

import { LoggerWithContext } from '@src/Logger/LoggerWithContext';

import { overlay } from '@src/Server/Route/v1/overlay';
import { OverlayService } from '@src/Service/OverlayService';

function v1(
    logger: LoggerWithContext,
    overlayService: OverlayService
) {
    const version = 'v1';

    const log = logger.create(`[Version: 1]`);

    const router = express.Router();

    router.use(`/${version}`, overlay(log, overlayService));

    return router;
}

export { v1 };
