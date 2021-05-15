import * as assert from 'assert';
import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';

import { Browser, Page, launch } from 'puppeteer';
// @ts-ignore
import { PNG } from 'pngjs';

import { LoggerWithContext } from '@src/Logger/LoggerWithContext';

class Overlay extends EventEmitter {
    private readonly _DEFAULT_WIDTH = 1280;
    private readonly _DEFAULT_HEIGHT = 720;
    private readonly _LAUNCH_TIMEOUT_MS = 60 * 1000;
    private readonly _MAX_AMOUNT_OF_TRIES_TO_STOP_BROWSER = 10;

    private _ffmpeg: null | ChildProcess = null;
    private _launchTimeout: null | ReturnType<typeof setTimeout> = null;
    private _listenIp = '127.0.0.1';
    private _port: null | number = null;
    private _browser: null | Browser = null;
    private _page: null | Page = null;
    private _readyToStopBrowser = false;
    private _stopped = false;

    constructor(
        private readonly _url: string,
        private readonly _logger: LoggerWithContext
    ) {
        super();
    }

    async run(): Promise<{ port: number }> {
        this._browser = await launch({
            defaultViewport: {
                width: this._DEFAULT_WIDTH,
                height: this._DEFAULT_HEIGHT,
                isLandscape: true
            }

        });
        this._page = await this._browser.newPage();

        await this._page.goto(this._url);

        this._launchTimeout = setTimeout(async () => {
            await this._stop();

            this.emit('exit', new Error('Launch timeout'));
        }, this._LAUNCH_TIMEOUT_MS);

        // TODO: use config for ffmpeg path
        this._ffmpeg = spawn('ffmpeg', this.ffmpegOptions(), { detached: false });
        this._ffmpeg.on('exit', this.onFFMPEGExit);
        this._ffmpeg.on('error', this.onFFMPEGError);

        this._ffmpeg.stderr.on('data', this.debug);
        this._ffmpeg.stderr.on('data', this.isReady);

        this.updateStreamWithBrowserData();

        assert(this._port!, 'Invalid port');
        return { port: this._port! };
    }

    async stop() {
        try {
            await this._stop();

            this.emit('exit');
        } catch (error) {
            this.emit('exit', error);

            throw error;
        }
    }

    private debug = (data: Buffer) => {
        this._logger.debug('[ffmpeg] output: ', data.toString());
    }

    private isReady = (data: Buffer) => {
        // TODO: fix to another pattern
        if (!data.toString().match(/ rawvideo/)) {
            return;
        }

        assert(this._ffmpeg, 'Invalid ffmpeg instance');
        this._ffmpeg!.stderr.removeListener('data', this.isReady);

        assert(this._launchTimeout, 'Invalid launchTimeout');
        clearTimeout(this._launchTimeout!);

        this.emit('started');
    }

    private onFFMPEGError = async (error: Error) => {
        await this._stop();

        this.emit('exit', error);
    };

    private onFFMPEGExit = async (code?: number, signal?: string) => {
        await this._stop();

        const isNormalExit = code === 0 || ['SIGINT', 'SIGTERM'].includes(signal!);

        this.emit('exit', isNormalExit ? null : new Error(`Abnormal exit: ${code} ${signal}`));
    };

    private async _stop(tryNumber: number = 0): Promise<void> {
        const logger = this._logger.create('[_stop]');

        logger.debug(`going to try stop ${tryNumber} time`);

        this._ffmpeg!.removeListener('exit', this.onFFMPEGExit);
        this._ffmpeg!.removeListener('error', this.onFFMPEGError);

        this._stopped = true;

        if (!this._readyToStopBrowser && tryNumber < this._MAX_AMOUNT_OF_TRIES_TO_STOP_BROWSER) {
            await this.sleep(1000);

            return await this._stop(tryNumber + 1);
        }

        assert(this._browser, 'Invalid browser instance');
        // sleep before close browser (some puppeteer bug)
        await this.sleep(5 * 1000);
        await this._browser!.close();
        this._browser = null;

        assert(this._ffmpeg, 'Invalid ffmpeg instance');
        this._ffmpeg!.removeAllListeners();
        this._ffmpeg!.stdin.removeAllListeners();
        this._ffmpeg!.stdout.removeAllListeners();
        this._ffmpeg!.stderr.removeAllListeners();
        this._ffmpeg!.stdin.destroy();
        this._ffmpeg!.kill();
        this._ffmpeg = null;
    }

    private updateStreamWithBrowserData = () => {
        const logger = this._logger.create(`[updateStreamWithBrowserData]({ url: ${this._url} })`);

        setTimeout(async () => {
            while (!this._stopped) {
                try {
                    this._readyToStopBrowser = false;

                    await this.makeStreamScreenshotAndWriteToStream();

                    // don't stop browser until it's logic (screenshot, ...) is done
                    this._readyToStopBrowser = true;
                } catch (error) {
                    logger.error(`Error on updating stream with browser data ${error.message}`, error);
                } finally {
                    await this.sleep(10);
                }
            }

            logger.debug('done');
        });
    }

    private makeStreamScreenshotAndWriteToStream = async () => {
        const logger = this._logger.create(`[makeStreamScreenshotAndWriteToStream]({ url: ${this._url} })`);

        logger.debug('going to update stream');

        if (this._stopped) {
            return;
        }

        assert(this._page, 'Invalid browser page');
        const pageScreenshot = await this._page!.screenshot({
            omitBackground: true
        });

        if (this._stopped) {
            return;
        }

        logger.debug('got page screenshot');

        const image = await this.generateImage(pageScreenshot as Buffer)

        if (this._stopped) {
            return;
        }

        logger.debug(`converted it to png: ${image.byteLength}`);

        assert(this._ffmpeg, 'Invalid ffmpeg instance');
        if (!this._ffmpeg!.stdin.write(image)) {
            // @ts-ignore
            logger.debug('need to wait drain event: ', this._ffmpeg?.stdin.writableNeedDrain, this._ffmpeg?.stdin.writableHighWaterMark);

            await this.drain();
        }

        logger.debug('wrote to stream');
    }

    private ffmpegOptions() {
        assert(this._page, 'Invalid browser page');
        const viewport = this._page!.viewport();

        // TODO:
        this._port = 3333;

        const width = this._DEFAULT_WIDTH;
        const height = this._DEFAULT_HEIGHT;

        return [
            '-s',
            [viewport?.width || width, viewport?.height || height].join('x'),
            '-f',
            'rawvideo',
            '-pix_fmt',
            'rgba',
            '-i',
            '-',
            '-f',
            'rawvideo',
            '-r',
            '30',
            '-s',
            [width, height].join('x'),
            '-pix_fmt',
            'yuva420p',
            `tcp://${this._listenIp}:${this._port}?listen=1`
        ];
    }

    private async generateImage(data: Buffer) {
        return new Promise<Buffer>((resolve, reject) => {
            const timeout = setTimeout(() => {
                return reject(new Error('Timeout for generate image process'));
            }, 5000);

            new PNG({ filterType: 4 })
                .on("parsed", (data: Buffer) => {
                    clearTimeout(timeout);

                    return resolve(data);
                })
                .on("error", (error: Error) => {
                    clearTimeout(timeout);

                    return reject(error);
                })
                .write(data);
        });
    }

    private async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async drain() {
        let drainGuardInterval: null | ReturnType<typeof setInterval> = null;

        await Promise.race([
            new Promise<void>(resolve => this._ffmpeg!.stdin.once('drain', resolve)),
            new Promise<void>(resolve => {
                drainGuardInterval = setInterval(() => {
                    if (this._stopped) {
                        resolve();
                    }
                }, 100);
            })
        ]);

        clearInterval(drainGuardInterval!);
    }
}

export { Overlay };
