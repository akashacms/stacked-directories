import { dirToWatch } from './watcher.js';
import EventEmitter from 'events';
/**
 * Configuration for a VFStack
 */
export type VFSConfiguration = {};
/**
 * An object which listens to a DirsWatcher configuration,
 * and stores data about the files within the
 * defined virtual filespace.
 *
 * TBD - Overridable functions for persisting the data.
 *    The default will be storing in a Map<string, VPathData>
 */
export declare class VFStacked extends EventEmitter {
    #private;
    constructor(name?: string, dirs?: dirToWatch[]);
    get name(): string;
    get dirs(): dirToWatch[];
    close(): Promise<void>;
    /**
     * Set up receiving events from DirsWatcher, and dispatching to
     * the handler methods.
     */
    setup(): Promise<void>;
    /**
     * Should this file be ignored, based on the `ignore` field
     * in the matching `dir` mount entry.
     *
     * @param {*} info
     * @returns
     */
    ignoreFile(info: any): boolean;
}
/**
 * Define operations on a virtual filespace defined
 * by a StackedDirs configuration.  The operations
 * are to match a subset of what's in node:fs/promises.
 *
 * TBD - in node:fs the `path` argument is a string or Buffer or URL.
 *     For this purpose support only string, as a virtual path
 *     within the VFStack.
 */
export type vfs = {
    access(path: string | Buffer | URL, mode: number): Promise<number>;
    appendFile(path: string | Buffer | URL, data: string | Buffer, options: string | {
        encoding?: string;
        mode?: number;
        flag?: string;
        flush?: boolean;
    }): Promise<number>;
    chmod(path: string | Buffer | URL, mode: string | number): Promise<number>;
    copyFile(src: string | Buffer | URL, dest: string | Buffer | URL, mode: number): Promise<number>;
    mkdir(path: string | Buffer | URL, options: string | {
        recursive?: boolean;
        mode: number | string;
    }): Promise<number>;
    readFile(path: string | Buffer | URL, options: string | {
        encoding?: string;
        flag?: string;
        signal?: any;
    }): Promise<number>;
};
//# sourceMappingURL=vfs-stacked.d.ts.map