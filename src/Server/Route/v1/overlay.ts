import * as express from 'express';

import { LoggerWithContext } from '@src/Logger/LoggerWithContext';
import { OverlayService } from '@src/Service/OverlayService';

function overlay(logger: LoggerWithContext, overlayService: OverlayService) {
    const router = express.Router();

    router.post(`/overlay`, async (req: express.Request, res: express.Response) => {
        const log = logger.create(`POST /overlay`);

        try {
            await overlayService.run({ url: 'https://meet.staging.livee.com:3001/', corrId: '1' });

            return res.status(200).json({ code: 0 });
        } catch (error) {
            log.error(`Error during running overlay: ${error.message}`, error);

            return res.status(400).json({ code: 1000, message: 'Internal error' });
        }
    });

    router.delete(`/overlay`, async (req: express.Request, res: express.Response) => {
        const log = logger.create(`POST /overlay`);

        try {
            await overlayService.stop({ corrId: '1' });

            return res.status(200).json({ code: 0 });
        } catch (error) {
            log.error(`Error during running overlay: ${error.message}`, error);

            return res.status(400).json({ code: 1000, message: 'Internal error' });
        }
    });

    return router;
}

export { overlay };
