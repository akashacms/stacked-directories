


import {
    DirsWatcher, dirToWatch, VPathData
} from './watcher.js';
import fastq from 'fastq';
import type { queueAsPromised } from "fastq";

type Task = {
    code: string,
    info: any
};

const EVENT_CHANGE = 'change';
const EVENT_ADD    = 'add';
const EVENT_UNLINK = 'unlink';
const EVENT_READY = 'ready';

export default class QueueNotifier {

    #watcher?: DirsWatcher;
    #queue?: queueAsPromised<Task>;

    constructor(
        watcher: DirsWatcher,
        concurrency: number
    ) {
        this.#watcher = watcher;

        const fcache = this;
        this.#queue = fastq.promise(async function (event) {
            if (event.code === EVENT_CHANGE) {
                await fcache.handleChanged(event.info);
            } else if (event.code === EVENT_ADD) {
                await fcache.handleAdded(event.info);
            } else if (event.code === EVENT_UNLINK) {
                await fcache.handleUnlinked(event.info);
            } else if (event.code === EVENT_READY) {
                await fcache.handleReady();
            }
        }, concurrency);

        this.#watcher.on(EVENT_CHANGE, async (info: VPathData) => {
            this.#queue.push({
                code: EVENT_CHANGE,
                info
            })
            .catch(err => {
                console.error(err.stack);
            });
        })
        .on(EVENT_ADD, async (info: VPathData) => {
            this.#queue.push({
                code: EVENT_ADD,
                info
            })
            .catch(err => {
                console.error(err.stack);
            });
        })
        .on(EVENT_UNLINK, async (info: VPathData) => {
            this.#queue.push({
                code: EVENT_UNLINK,
                info
            })
            .catch(err => {
                console.error(err.stack);
            });
        })
        .on(EVENT_READY, async (info) => {
            this.#queue.push({
                code: EVENT_READY,
                info
            })
            .catch(err => {
                console.error(err.stack);
            });
        });

    }

    close() {
        if (this.#watcher) this.#watcher.close();
        this.#watcher = undefined;
        if (this.#queue) {
            this.#queue.killAndDrain();
        }
        this.#queue = undefined;
    }

    async handleChanged(info) {
        // Override
    }

    async handleAdded(info) {
        // Override
    }

    async handleUnlinked(info) {
        // Override
    }

    async handleReady() {
        // Override
    }
}
