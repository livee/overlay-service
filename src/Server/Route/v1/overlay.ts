import * as express from 'express';
import * as _ from 'lodash';

import { LoggerWithContext } from '@src/Logger/LoggerWithContext';
import { OverlayService } from '@src/Service/OverlayService';

function overlay(logger: LoggerWithContext, overlayService: OverlayService) {
    const router = express.Router();

    router.post(`/overlay`, async (req: express.Request, res: express.Response) => {
        const log = logger.create(`POST /overlay`);

        const { url, corrId } = req.body;

        if (!_.isString(url) || _.isEmpty(url)) {
            return res.status(400).json({ code: 1001, message: 'Invalid request params' });
        }

        if (!_.isString(corrId) || _.isEmpty(corrId)) {
            return res.status(400).json({ code: 1001, message: 'Invalid request params' });
        }

        try {
            await overlayService.run({ url, corrId });

            return res.status(200).json({ code: 0 });
        } catch (error) {
            log.error(`Error during running overlay: ${error.message}`, error);

            return res.status(400).json({ code: 1000, message: 'Internal error' });
        }
    });

    router.delete(`/overlay`, async (req: express.Request, res: express.Response) => {
        const log = logger.create(`POST /overlay`);

        const { corrId } = req.body;

        if (!_.isString(corrId) || _.isEmpty(corrId)) {
            return res.status(400).json({ code: 1001, message: 'Invalid request params' });
        }

        try {
            await overlayService.stop({ corrId });

            return res.status(200).json({ code: 0 });
        } catch (error) {
            log.error(`Error during running overlay: ${error.message}`, error);

            return res.status(400).json({ code: 1000, message: 'Internal error' });
        }
    });

    return router;
}

export { overlay };
