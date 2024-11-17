
import {
    promises as fs,
    statSync as fsStatSync,
    Stats
} from 'node:fs';
import chokidar, { FSWatcher, ChokidarOptions } from 'chokidar';

import { Mime } from 'mime/lite';
import standardTypes from 'mime/types/standard.js';
import otherTypes from 'mime/types/other.js';

const mime = new Mime(standardTypes, otherTypes);

import * as util from 'node:util';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import { minimatch } from 'minimatch';

/**
 * Configure the MIME package with additional content
 * types.  This is meant to handle files for which
 * no official registration has been made.  For example,
 * AsciiDoc files are useful but do not have registered
 * MIME types.
 * 
 * per: https://asciidoctor.org/docs/faq/
 * per: https://github.com/asciidoctor/asciidoctor/issues/2502
 * 
 * For AsciiDoc, the mapping might be:
 * {'text/x-asciidoc': ['adoc', 'asciidoc']}
 * 
 * @param mapping 
 * @param force 
 */
export function mimedefine(mapping, force ?: boolean) {
    mime.define(mapping, force);
}

export type VPathData = {

    /**
     * The full file-system path for the file.
     * e.g. /home/path/to/article-name.html.md
     */
    fspath: string;

    /**
     * The virtual path, rooted at the top
     * directory of the filesystem, with no
     * leading slash.
     */
    vpath: string;

    /**
     * The mime type of the file.  The mime types
     * are determined from the file extension
     * using the 'mime' package.
     */
    mime ?: string;

    /**
     * The file-system path which is mounted
     * into the virtual file space.
     */
    mounted: string;

    /**
     * The virtual directory of the mount
     * entry in the directory stack.
     */
    mountPoint: string;

    /**
     * The relative path underneath the mountPoint.
     */
    pathInMounted: string;

    /**
     * The mTime value from Stats
     */
    statsMtime: number;

    /**
     * The file-system stack related to the file.
     */
    stack ?: VPathData[];
}

/**
 * Typeguard function ensuring that an object
 * is a VPathData object.
 * @param vpinfo The object to check
 * @returns true if it is a VPathData, false otherwise
 */
export const isVPathData = (vpinfo): vpinfo is VPathData => {
    if (typeof vpinfo === 'undefined') return false;
    if (typeof vpinfo !== 'object') return false;
    if (typeof vpinfo.mime !== 'undefined'
     && vpinfo.mime !== null
     && typeof vpinfo.mime !== 'string') {
        return false;
    }
    if (typeof vpinfo.fspath !== 'string'
     || typeof vpinfo.vpath !== 'string'
     || typeof vpinfo.mounted !== 'string'
     || typeof vpinfo.mountPoint !== 'string'
     || typeof vpinfo.pathInMounted !== 'string') {
        return false;
    }
    if (typeof vpinfo.stack === 'undefined') return true;
    if (Array.isArray(vpinfo.stack)) {
        for (const inf of vpinfo.stack) {
            if (!isVPathData(inf)) return false;
        }
    }
    return true;
};

export type dirToWatch = {
    /**
     * The filesystem path to "mount".
     */
    mounted: string;

    /**
     * The path within the virtual filesystem where this will appear.
     */
    mountPoint: string;

    /**
     * Metadata object to use within the
     * sub-hierarchy.
     */
    baseMetadata?: any;

    /**
     * Optional array of strings containing globs for matching
     * files to ignore.
     */
    ignore?: string[];
}

/**
 * Determine whether the {@code dir} is a {@code dirToWatch}.
 */
export const isDirToWatch = (dir: any): dir is dirToWatch => {
    if (typeof dir === 'undefined') return false;
    if (typeof dir !== 'object') return false;

    if ('mounted' in dir && typeof dir.mounted !== 'string') return false;
    if ('mountPoint' in dir && typeof dir.mountPoint !== 'string') return false;
    if ('ignore' in dir && typeof dir.ignore !== 'undefined') {
        if (
            typeof dir.ignore !== 'string'
         && !Array.isArray(dir.ignore)
        ) {
            return false;
        }
        if (
            typeof dir.ignore === 'string'
         && Array.isArray(dir.ignore)
        ) {
            return false;
        }
    }

    // It must at least have the 'mounted' field.
    if (!(
        'mounted' in dir
     && typeof dir.mounted === 'string'
    )) {
        return false;
    }

    return true;
}

export class DirsWatcher extends EventEmitter {

    #dirs: dirToWatch[];
    #watcher?: FSWatcher;
    #name: string;
    #options: ChokidarOptions;
    #basedir;
    // #queue;

    /**
     * @param name string giving the name for this watcher
     */
    constructor(name: string) {
        super();
        // console.log(`DirsWatcher ${name} constructor`);
        this.#name = name;
        // TODO is there a need to make this customizable?
        this.#options = {
            persistent: true, ignoreInitial: false, awaitWriteFinish: true, alwaysStat: true,
            ignored:
                (_fspath: string, stats?: Stats): boolean => {
                if (this.toIgnore) {
                    return this.toIgnore(_fspath, stats);
                } else {
                    return false;
                }
            }
        };
        this.#basedir = undefined;
    }

    /**
     * Retrieves the directory stack for
     * this Watcher.
     */
    get dirs(): dirToWatch[] | undefined { return this.#dirs; }

    /**
     * Retrieves the name for this Watcher
     */
    get name() { return this.#name; }

    /**
     * Changes the use of absolute pathnames, to paths relatve to the given directory.
     * This must be called before the <em>watch</em> method is called.  The paths
     * you specify to watch must be relative to the given directory.
     */
    set basedir(cwd) { this.#basedir = cwd; }

    /**
     * Creates the Chokidar watcher, basec on the directories to watch.  The <em>dirspec</em> option can be a string,
     * or an object.  If it is a string, it is a filesystem pathname that will be
     * associated with the root of the virtual filesystem.  An object will look
     * like this:
     * 
     * <code>
     * {
     *   mounted: '/path/to/mounted',
     *   mountPoint: 'mounted'
     * }
     * </code>
     * 
     * The <tt>mountPoint</tt> field is a full path to the directory of interest.  The
     * <tt>mountPoint</tt> field describes a prefix within the virtual filesystem.
     * 
     * @param dirspec 
     */
    async watch(dirs: dirToWatch[] | string) {
        if (this.#watcher) {
            throw new Error(`Watcher already started for ${this.#watcher}`);
        }
        if (typeof dirs === 'string') {
            dirs = [ {
                mounted: dirs, mountPoint: '/'
            } ];
        } else if (typeof dirs === 'object'
               && !Array.isArray(dirs)) {
            if (!isDirToWatch(dirs)) {
                throw new Error(`watch - directory spec not a dirToWatch - ${util.inspect(dirs)}`);
            }
            dirs = [ dirs ];
        } else if (!Array.isArray(dirs)) {
            throw new Error(`watch - the dirs argument is incorrect ${util.inspect(dirs)}`);
        }
        // console.log(`watch dirs=`, dirs);
        const towatch = [];
        for (const dir of dirs) {
            if (!isDirToWatch(dir)) {
                throw new Error(`watch directory spec in dirs not a dirToWatch - ${util.inspect(dir)}`);
            }
            const stats = await fs.stat(dir.mounted);
            if (!stats.isDirectory()) {
                throw new Error(`watch - non-directory specified in ${util.inspect(dir)}`);
            }
            towatch.push(dir.mounted);
        }
        this.#dirs = dirs;

        if (this.#basedir) {
            this.#options.cwd = this.#basedir;
        } else {
            this.#options.cwd = undefined;
        }

        this.#watcher = chokidar.watch(towatch, this.#options);

        // Send events from chokidar into the onXYZZY
        // handler functions.  These perform additional
        // processing which in turn is emitted from
        // the DirsWatcher object.

        const that = this;
        this.#watcher
            .on('change', async (fpath, stats) => {

                try {
                    await that.onChange(fpath, stats);
                } catch (err: any) {
                    this.emit('error', this.name, fpath, `DirsWatcher watcher ${this.name} event=change ${fpath} caught ${err.message}`);
                }
                // this.#queue.push(<queueEvent>{
                //     code: 'change', fpath, stats
                // });
                // console.log(`watcher ${watcher_name} change ${fpath}`);
            })
            .on('add', async (fpath, stats) => {
                try {
                    await that.onAdd(fpath, stats);
                } catch (err: any) {
                    this.emit('error', this.name, fpath, `DirsWatcher watcher ${this.name} event=add ${fpath} caught ${err.message}`);
                }
                // this.#queue.push(<queueEvent>{
                //     code: 'add', fpath, stats
                // });
                // console.log(`watcher ${watcher_name} add ${fpath}`);
            })
            /* .on('addDir', async (fpath, stats) => { 
                // ?? let info = this.fileInfo(fpath, stats);
                // ?? console.log(`DirsWatcher addDir`, info);
                // ?? this.emit('addDir', info);
            }) */
            .on('unlink', async fpath => {
                // this.#queue.push(<queueEvent>{
                //     code: 'unlink', fpath
                // });
                try {
                    await that.onUnlink(fpath);
                } catch (err: any) {
                    // console.warn(`EMITTING ERROR DirsWatcher watcher ${this.name} event=unlink ${fpath} caught ${err.message}`);
                    this.emit('error', this.name, fpath, `DirsWatcher watcher ${this.name} event=unlink ${fpath} caught ${err.message}`);
                }
                // console.log(`watcher ${watcher_name} unlink ${fpath}`);
            })
            /* .on('unlinkDir', async fpath => { 
                // ?? let info = this.fileInfo(fpath, stats);
                // ?? console.log(`DirsWatcher unlinkDir ${fpath}`);
                // ?? this.emit('unlinkDir', info);
            }) */
            .on('ready', async () => {
                // this.#queue.push(<queueEvent>{
                //     code: 'ready'
                // });
                await that.onReady();
                // console.log(`watcher ${watcher_name} ready`);
            })
            .on('error', async (error) => {
                await that.onError(error);
            });

        // this.isReady = new Promise((resolve, reject) => {
        //     this[_symb_watcher].on('ready', () => { resolve(true); });
        // });
        // console.log(this.isReady);
    }

    /**
     * Emit Chokidar error events as a DirsWattcher error.
     * @param error 
     */
    async onError(error) {
        console.warn(`DirsWatcher ${this.name} ERROR `, error);
        this.emit('error', this.name, undefined, `DirsWatcher ${this.name} ERROR ${error}`);
    }

    /* Calculate the stack for a filesystem path

    Only emit if the change was to the front-most file */ 
    async onChange(fpath: string, stats: Stats): Promise<void> {
        // Checking this early avoids printing the
        // message if vpathForFSPath is undefined
        // if (this.toIgnore(fpath, stats)) {
        //     return;
        // }
        const vpinfo = this.vpathForFSPath(fpath, stats);
        if (!vpinfo) {
            console.log(`onChange could not find mount point or vpath for ${fpath}`);
            return;
        }
        const stack: VPathData[] = await this.stackForVPath(vpinfo.vpath);
        if (stack.length === 0) {
            throw new Error(`onChange could not find mount points for ${fpath}`);
        }
        let i = 0;
        let depth;
        let entry;
        for (const s of stack) {
            if (s.fspath === fpath) {
                entry = s;
                depth = i;
                break;
            }
            i++;
        }
        if (!entry) {
            throw new Error(`onChange no stack entry for ${fpath} (${vpinfo.vpath})`);
        }
        if (depth === 0) {
            vpinfo.stack = stack;
            // console.log(`DirsWatcher change ${fpath}`);
            if (!isVPathData(vpinfo)) {
                throw new Error(`Invalid VPathData ${util.inspect(vpinfo)}`);
            }
            this.emit('change', this.name, vpinfo);
        }
        // let info = this.fileInfo(fpath, stats);
        // if (info) this.emit('change', this.name, info);
        // console.log(`DirsWatcher change ${fpath}`, info);
    }

    // Only emit if the add was the front-most file
    async onAdd(fpath: string, stats: Stats): Promise<void> {
        // Checking this early avoids printing the
        // message if vpathForFSPath is undefined
        // if (this.toIgnore(fpath, stats)) {
        //     return;
        // }
        const vpinfo = this.vpathForFSPath(fpath, stats);
        if (!vpinfo) {
            console.log(`onAdd could not find mount point or vpath for ${fpath}`);
            return;
        }
        // console.log(`onAdd ${fpath}`, vpinfo);
        // console.log(`onAdd ${fpath} ${vpinfo.vpath}`);
        const stack: VPathData[] = await this.stackForVPath(vpinfo.vpath);
        if (stack.length === 0) {
            throw new Error(`onAdd could not find mount points for ${fpath}`);
        }
        // console.log(`onAdd ${fpath}`, stack);
        let i = 0;
        let depth;
        let entry;
        for (const s of stack) {
            if (s.fspath === fpath) {
                entry = s;
                depth = i;
                break;
            }
            i++;
        }
        if (!entry) {
            throw new Error(`onAdd no stack entry for ${fpath} (${vpinfo.vpath})`);
        }
        // console.log(`onAdd ${fpath} depth=${depth}`, entry);
        if (depth === 0) {
            vpinfo.stack = stack;
            // console.log(`onAdd EMIT add ${vpinfo.vpath}`);
            // for (let s of stack) {
            //    console.log(`.... ${s.vpath} ==> ${s.fspath}`);
            // }
            if (!isVPathData(vpinfo)) {
                throw new Error(`Invalid VPathData ${util.inspect(vpinfo)}`);
            }
            this.emit('add', this.name, vpinfo);
        } else {
            // console.log(`onAdd SKIPPED emit event for ${fpath}`);
        }
        // let info = this.fileInfo(fpath, stats);
        // if (info) this.emit('add', this.name, info);
        // console.log(`DirsWatcher add`, info);
        
    }

    /* Only emit if it was the front-most file deleted
    If there is a file uncovered by this, then emit an add event for that */
    async onUnlink(fpath: string): Promise<void> {
        // console.log(`DirsWatcher onUnlink ${fpath}`);
        const vpinfo = this.vpathForFSPath(fpath);
        if (!vpinfo) {
            console.log(`onUnlink could not find mount point or vpath for ${fpath}`);
            return;
        }
        // console.log(`DirsWatcher onUnlink vpathData ${fpath} ==>`, vpinfo);
        const stack: VPathData[] = await this.stackForVPath(vpinfo.vpath);
        // console.log(`DirsWatcher onUnlink stack ${fpath} ==>`, stack);
        if (stack.length === 0) {
            /* If no files remain in the stack for this virtual path, then
             * we must declare it unlinked.
             */
            if (!isVPathData(vpinfo)) {
                // console.error(`Invalid VPathData ${util.inspect(vpinfo)}`);
                throw new Error(`Invalid VPathData ${util.inspect(vpinfo)}`);
            }
            // console.log(`DirsWatcher onUnlink emit unlink ${this.name} ${vpinfo.fspath}`);
            this.emit('unlink', this.name, vpinfo);
        } else {
            /* On the other hand, if there is an entry we shouldn't send
             * an unlink event.  Instead it seems most appropriate to send
             * a change event.
             */
            const sfirst = stack[0];
            const toemit = <VPathData>{
                fspath: sfirst.fspath,
                vpath: sfirst.vpath,
                mime: mime.getType(sfirst.fspath),
                mounted: sfirst.mounted,
                mountPoint: sfirst.mountPoint,
                pathInMounted: sfirst.pathInMounted,
                stack
            };
            if (!isVPathData(toemit)) {
                // console.error(`Invalid VPathData ${util.inspect(toemit)}`);
                throw new Error(`Invalid VPathData ${util.inspect(toemit)}`);
            }
            // console.log(`DirsWatcher onUnlink emit change ${this.name} ${toemit.fspath}`);
            this.emit('change', this.name, toemit);
        }
        // let info = this.fileInfo(fpath, undefined);
        // console.log(`DirsWatcher unlink ${fpath}`);
        // if (info) this.emit('unlink', this.name, info);
    }

    onReady(): void {
        // console.log('DirsWatcher: Initial scan complete. Ready for changes');
        this.emit('ready', this.name);
    }

    /**
     * Returns an object representing all the paths on the file system being
     * watched by this FSWatcher instance. The object's keys are all the 
     * directories (using absolute paths unless the cwd option was used),
     * and the values are arrays of the names of the items contained in each directory.
     */
    getWatched() {
        if (this.#watcher) return this.#watcher.getWatched();
    }

    /**
     * Determine if the fspath is to be ignored
     * @param fspath 
     * @param stats 
     * @returns 
     */
    toIgnore(fspath: string, stats?: Stats): boolean {

        for (const dir of this.dirs) {

            // Check if this dirs entry corresponds
            // to the fspath

            // This will strip off a leading slash,
            // and ensure that it ends with a slash.

            const m = dir.mounted.startsWith('/')
                    ? dir.mounted.substring(1)
                    : dir.mounted;
            const m2 = m.endsWith('/')
                     ? m
                     : (m+'/');
            if (!fspath.startsWith(m2)) {
                continue;
            }

            // Check to see if we're supposed to ignore the file
            if (dir.ignore) {
                let ignores;
                if (typeof dir.ignore === 'string') {
                    ignores = [ dir.ignore ];
                } else {
                    ignores = dir.ignore;
                }
                let ignore = false;
                for (const i of ignores) {
                    if (minimatch(fspath, i)) ignore = true;
                    // console.log(`dir.ignore ${fspath} ${i} => ${ignore}`);
                }
                if (ignore) {
                    // console.log(`toIgnore ignoring ${fspath} ${util.inspect(this.dirs)}`);
                    return true;
                }
            }
        }

        return false;
    }

    vpathForFSPath(fspath: string, stats?: Stats): VPathData {
        for (const dir of this.dirs) {

            // Check to see if we're supposed to ignore the file
            if (dir.ignore) {
                let ignores;
                if (typeof dir.ignore === 'string') {
                    ignores = [ dir.ignore ];
                } else {
                    ignores = dir.ignore;
                }
                let ignore = false;
                for (const i of ignores) {
                    if (minimatch(fspath, i)) ignore = true;
                    // console.log(`dir.ignore ${fspath} ${i} => ${ignore}`);
                }
                if (ignore) continue;
            }

            // This ensures we are matching on directory boundaries
            // Otherwise fspath "/path/to/layouts-extra/layout.njk" might
            // match dir.mounted "/path/to/layouts".
            //
            // console.log(`vpathForFSPath ${dir.mounted} ${typeof dir.mounted}`, dir);
            const dirmounted =
                (dir && dir.mounted)
                    ? (dir.mounted.charAt(dir.mounted.length - 1) == '/')
                        ? dir.mounted
                        : (dir.mounted + '/')
                    : undefined;
            if (dirmounted && fspath.indexOf(dirmounted) === 0) {
                const pathInMounted = fspath.substring(dir.mounted.length).substring(1);
                const vpath = dir.mountPoint === '/'
                        ? pathInMounted
                        : path.join(dir.mountPoint, pathInMounted);
                // console.log(`vpathForFSPath fspath ${fspath} dir.mountPoint ${dir.mountPoint} pathInMounted ${pathInMounted} vpath ${vpath}`);
                const ret = <VPathData>{
                    fspath: fspath,
                    vpath: vpath,
                    mime: mime.getType(fspath),
                    mounted: dir.mounted,
                    mountPoint: dir.mountPoint,
                    pathInMounted
                };
                if (stats) {
                    ret.statsMtime = stats.mtimeMs;
                } else {
                    // Use the sync version to
                    // maintain this function
                    // as non-async
                    try {
                        let stats = fsStatSync(ret.fspath);
                        ret.statsMtime = stats.mtimeMs;
                    } catch (err: any) {
                        // console.log(`VPathData ignoring STATS error ${ret.fspath} - ${err.message}`);
                        ret.statsMtime = undefined;
                    }
                }
                if (!isVPathData(ret)) {
                    throw new Error(`Invalid VPathData ${util.inspect(ret)}`);
                }
                return ret;
            }
        }
        // No directory found for this file
        return undefined;
    }

    async stackForVPath(vpath: string): Promise<VPathData[]> {
        const ret: VPathData[] = [];
        for (const dir of this.dirs) {
            if (dir.mountPoint === '/') {
                const pathInMounted = vpath;
                const fspath = path.join(dir.mounted, pathInMounted);
                let stats;
                try {
                    stats = await fs.stat(fspath);
                } catch (err) {
                    stats = undefined;
                }
                if (!stats) continue;
                const topush = <VPathData>{
                    fspath: fspath,
                    vpath: vpath,
                    mime: mime.getType(fspath),
                    mounted: dir.mounted,
                    mountPoint: dir.mountPoint,
                    pathInMounted: pathInMounted
                };
                if (!isVPathData(topush)) {
                    throw new Error(`Invalid VPathData ${util.inspect(topush)}`);
                }
                ret.push(topush);
            } else {
                const dirmountpt =
                    (dir && dir.mountPoint)
                        ? (dir.mountPoint.charAt(dir.mountPoint.length - 1) === '/')
                            ? dir.mountPoint
                            : (dir.mountPoint + '/')
                        : undefined;
                // console.log(`stackForVPath vpath ${vpath} dir.mounted ${dir.mountPoint} dirmountpt ${dirmountpt}`);
                if (dirmountpt && vpath.indexOf(dirmountpt) === 0) {
                    // > const vpath = 'foo/bar/baz.html';
                    // > const m = 'foo/bar';
                    // > let pathInMounted = vpath.substring(m.length + 1);
                    // > pathInMounted
                    // 'baz.html'
                    const pathInMounted = vpath.substring(dirmountpt.length);
                    const fspath = path.join(dir.mounted, pathInMounted);
                    // console.log(`stackForVPath vpath ${vpath} pathInMounted ${pathInMounted} fspath ${fspath}`);
                    let stats;
                    try {
                        stats = await fs.stat(fspath);
                    } catch (err) {
                        stats = undefined;
                    }
                    if (!stats) {
                        // console.log(`stackForVPath vpath ${vpath} did not find fs.stats for ${fspath}`);
                        continue;
                    }
                    const topush = <VPathData>{
                        fspath: fspath,
                        vpath: vpath,
                        mime: mime.getType(fspath),
                        mounted: dir.mounted,
                        mountPoint: dir.mountPoint,
                        pathInMounted: pathInMounted
                    };
                    if (!isVPathData(topush)) {
                        throw new Error(`Invalid VPathData ${util.inspect(topush)}`);
                    }
                    ret.push(topush);
                } else {
                    // console.log(`stackForVPath vpath ${vpath} did not match ${dirmountpt}`);
                }
            }
        }
        // (knock on wood) Every entry in `ret` has already been verified
        // as being a correct VPathData object
        return ret;
    }

    async close() {
        this.removeAllListeners('change');
        this.removeAllListeners('add');
        this.removeAllListeners('unlink');
        this.removeAllListeners('ready');
        if (this.#watcher) {
            // console.log(`Closing watcher ${this.name}`);
            await this.#watcher.close();
            this.#watcher = undefined;
        }
    }
}
