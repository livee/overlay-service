import * as assert from 'assert';

import * as _ from 'lodash';

import { LoggerWithContext } from '@src/Logger/LoggerWithContext';

import { OverlayServiceError } from './Error/OverlayServiceError';
import { Overlay, IOverlayData } from './Overlay';

class OverlayService {
    private _overlays = new Map<string, Overlay>();

    constructor(private readonly _logger: LoggerWithContext) {}

    public async deinit() {
        const logger = this._logger.create('[OverlayService::deinit]');

        const overlays = this._overlays.values();

        await Promise.all(
            [...overlays].map(async (overlay) => {
                try {
                    await overlay.stop();
                } catch (error) {
                    logger.error(`Error on deinit overlays: ${error.message}`, error);
                }
            })
        );
    }

    public async run(request: { url: string; corrId: string }): Promise<IOverlayData> {
        const logger = this._logger.create(`[OverlayService::run]({ url: ${request.url}, corrId: ${request.corrId} })`);

        logger.debug('Start running overlay');

        let overlay: null | Overlay = null;

        if (this._overlays.has(request.corrId)) {
            throw new OverlayServiceError(`Already running overlay for this corrId: ${request.corrId}`);
        }

        try {
            overlay = new Overlay(
                request.url,
                this._logger.create(`[overlay]({ url: ${request.url}, corrId: ${request.corrId} })`)
            );

            this._overlays.set(request.corrId, overlay);

            const started = new Promise<void>((resolve, reject) => {
                assert(overlay, 'Invalid overlay instance');

                overlay!.once('started', () => {
                    logger.debug('overlay process started');

                    assert(overlay, 'Invalid overlay instance');
                    overlay!.removeAllListeners();
                    overlay!.once('exit', (error?: Error) => {
                        assert(overlay, 'Invalid overlay instance');
                        this.onOverlayExit(overlay!, request, error);
                    });

                    resolve();
                });

                overlay!.once('exit', (error: Error = new Error('Cannot start overlay instance')) => {
                    assert(overlay, 'Invalid overlay instance');
                    overlay!.removeAllListeners();

                    logger.error(`overlay process start error: ${error.message}`, error);

                    reject(error);
                });
            });

            const overlayData = await overlay.run();

            await started;

            logger.debug(`Overlay for ${request.url} has been started`);

            return overlayData;
        } catch (error) {
            assert(overlay, 'Invalid overlay instance');
            overlay!.removeAllListeners();

            this._overlays.delete(request.corrId);

            logger.error(`Error during running overlay: ${error.message}`, error);

            throw new OverlayServiceError(`Error during running overlay for ${request.url}: ${error.message}`, error);
        }
    }

    public async stop(request: { corrId: string }): Promise<void> {
        const logger = this._logger.create(`[OverlayService::stop] ({ corrId: ${request.corrId} })`);

        logger.debug('Start stopping overlay');

        try {
            const overlay = this._overlays.get(request.corrId);
            if (!overlay) {
                logger.info('No overlay');

                return;
            }

            overlay.removeAllListeners();

            overlay.once('exit', (error?: Error) => {
                assert(overlay, 'Invalid overlay instance');
                this.onOverlayExit(overlay!, request, error);
            });

            await overlay.stop();
        } catch (error) {
            logger.debug(`Error during de-registering from consul: ${error.message}`, error);

            throw new OverlayServiceError(`Error during stopping overlay: ${error.message}`, error);
        }

        logger.debug(`Has been correctly stopped overlay`);
    }

    private async notifyAboutOverlayStopEvent(corrId: string) {
        const logger = this._logger.create(`[OverlayService::notifyAboutOverlayStopEvent]({ corrId: ${corrId} })`);

        logger.debug('Start notify about overlay stop event');

        // send callback request
    }

    private async onOverlayExit(overlay: Overlay, request: { corrId: string }, error?: Error) {
        const logger = this._logger.create(`[onOverlayExit]({ corrId: ${request.corrId} })`);
        logger.debug('overlay instance exit');

        assert(overlay, 'Invalid overlay instance');
        overlay!.removeAllListeners();

        if (error) {
            logger.warn(`overlay instance exit with error: ${error.message}`, error);
        }

        this._overlays.delete(request.corrId);

        await this.notifyAboutOverlayStopEvent(request.corrId);
    }
}

export { OverlayService };
