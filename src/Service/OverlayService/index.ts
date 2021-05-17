import * as assert from 'assert';
import * as https from 'https';

import axios from 'axios';
import * as _ from 'lodash';

import { LoggerWithContext } from '@src/Logger/LoggerWithContext';

import { OverlayServiceError } from './Error/OverlayServiceError';
import { Overlay, IOverlayData } from './Overlay';

export interface IConfig {
    callbackURLStopEvent: string;
};

class OverlayService {
    private _overlays = new Map<string, Overlay>();
    private readonly _MAX_AMOUNT_OF_TRIES_TO_NOTIFY_ABOUT_STOP_EVENT = 10;

    constructor(
        private readonly _config: IConfig,
        private readonly _logger: LoggerWithContext
    ) {}

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
        return this.doNotifyAboutOverlayStopEvent(corrId);
    }

    private async doNotifyAboutOverlayStopEvent(corrId: string, tryCounter: number = 0): Promise<void> {
        const logger = this._logger.create(`[OverlayService::doNotifyAboutOverlayStopEvent]({ corrId: ${corrId}, tryCounter: ${tryCounter} })`);

        logger.debug(`Start notify about overlay stop event. Try number: ${tryCounter}`);

        if (tryCounter >= this._MAX_AMOUNT_OF_TRIES_TO_NOTIFY_ABOUT_STOP_EVENT) {
            logger.error(`Reached max amount of tries on notifying about overlay process stop event: ${tryCounter}`);

            return;
        }

        try {
            await axios({
                method: 'DELETE',
                url: this._config.callbackURLStopEvent,
                data: { corrId }
            });
        } catch (error) {
            logger.error(`Error on notifying about overlay process stop event: ${error.message}`, error);

            await this.sleep(tryCounter * 1000);

            return await this.doNotifyAboutOverlayStopEvent(corrId, tryCounter + 1);
        }
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
    private async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export { OverlayService };
