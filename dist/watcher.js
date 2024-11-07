var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _DirsWatcher_dirs, _DirsWatcher_watcher, _DirsWatcher_name, _DirsWatcher_options, _DirsWatcher_basedir, _DirsWatcher_queue;
import { promises as fs, Stats } from 'node:fs';
import chokidar from 'chokidar';
import { Mime } from 'mime/lite';
import standardTypes from 'mime/types/standard.js';
import otherTypes from 'mime/types/other.js';
const mime = new Mime(standardTypes, otherTypes);
import * as util from 'node:util';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import { minimatch } from 'minimatch';
import * as fastq from 'fastq';
// NOTE We should not do this here.  It had been copied over from
// AkashaRender, but this is duplicative, and it's possible there
// will be other users of DirsWatcher who do not want this.
//
// There doesn't seem to be an official registration
// per: https://asciidoctor.org/docs/faq/
// per: https://github.com/asciidoctor/asciidoctor/issues/2502
// mime.define({'text/x-asciidoc': ['adoc', 'asciidoc']});
//
// Instead of defining MIME types here, we added a method "mimedefine"
// to allow DirsWatcher users to define MIME types.
export function mimedefine(mapping, force) {
    mime.define(mapping, force);
}
/**
 * Typeguard function ensuring that an object
 * is a VPathData object.
 * @param vpinfo The object to check
 * @returns true if it is a VPathData, false otherwise
 */
export const isVPathData = (vpinfo) => {
    if (typeof vpinfo === 'undefined')
        return false;
    if (typeof vpinfo !== 'object')
        return false;
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
    if (typeof vpinfo.stack === 'undefined')
        return true;
    if (Array.isArray(vpinfo.stack)) {
        for (const inf of vpinfo.stack) {
            if (!isVPathData(inf))
                return false;
        }
    }
    return true;
};
const isQueueEvent = (event) => {
    if (typeof event === 'undefined')
        return false;
    if (typeof event !== 'object')
        return false;
    if (typeof event.code === 'string'
        && typeof event.fpath === 'string'
        && (event.stats instanceof Stats)) {
        return true;
    }
    if (typeof event.code === 'string'
        && event.code === 'ready') {
        return true;
    }
    if (typeof event.code === 'string'
        && event.code === 'unlink'
        && typeof event.fpath === 'string') {
        return true;
    }
    return false;
};
/**
 * Determine whether the {@code dir} is a {@code dirToWatch}.
 */
export const isDirToWatch = (dir) => {
    if (typeof dir === 'undefined')
        return false;
    if (typeof dir !== 'object')
        return false;
    if ('mounted' in dir && typeof dir.mounted !== 'string')
        return false;
    if ('mountPoint' in dir && typeof dir.mountPoint !== 'string')
        return false;
    if ('ignore' in dir && typeof dir.ignore !== 'undefined') {
        if (typeof dir.ignore !== 'string'
            && !Array.isArray(dir.ignore)) {
            return false;
        }
        if (typeof dir.ignore === 'string'
            && Array.isArray(dir.ignore)) {
            return false;
        }
    }
    return true;
};
// const _symb_dirs = Symbol('dirs');
// const _symb_watcher = Symbol('watcher');
// const _symb_name = Symbol('name');
// const _symb_options = Symbol('options');
// const _symb_cwd = Symbol('basedir');
// const _symb_queue = Symbol('queue');
export class DirsWatcher extends EventEmitter {
    /**
     * @param name string giving the name for this watcher
     */
    constructor(name) {
        super();
        _DirsWatcher_dirs.set(this, void 0);
        _DirsWatcher_watcher.set(this, void 0);
        _DirsWatcher_name.set(this, void 0);
        _DirsWatcher_options.set(this, void 0);
        _DirsWatcher_basedir.set(this, void 0);
        _DirsWatcher_queue.set(this, void 0);
        // console.log(`DirsWatcher ${name} constructor`);
        __classPrivateFieldSet(this, _DirsWatcher_name, name, "f");
        // TODO is there a need to make this customizable?
        __classPrivateFieldSet(this, _DirsWatcher_options, {
            persistent: true, ignoreInitial: false, awaitWriteFinish: true, alwaysStat: true
        }, "f");
        __classPrivateFieldSet(this, _DirsWatcher_basedir, undefined, "f");
        const that = this;
        const q = fastq.promise(async function (event) {
            if (!isQueueEvent(event)) {
                throw new Error(`INTERNAL ERROR not a queueEvent ${util.inspect(event)}`);
            }
            if (event.code === 'change') {
                await that.onChange(event.fpath /*, event.stats */);
            }
            else if (event.code === 'add') {
                await that.onAdd(event.fpath /*, event.stats */);
            }
            else if (event.code === 'unlink') {
                await that.onUnlink(event.fpath);
            }
            else if (event.code === 'ready') {
                await that.onReady();
            }
        }, 1);
        __classPrivateFieldSet(this, _DirsWatcher_queue, q, "f");
        __classPrivateFieldGet(this, _DirsWatcher_queue, "f").error(function (err, task) {
            if (err) {
                console.error(`DirsWatcher ${name} ${task.code} ${task.fpath} caught error ${err}`);
            }
        });
    }
    /**
     * Retrieves the directory stack for
     * this Watcher.
     */
    get dirs() { return __classPrivateFieldGet(this, _DirsWatcher_dirs, "f"); }
    /**
     * Retrieves the name for this Watcher
     */
    get name() { return __classPrivateFieldGet(this, _DirsWatcher_name, "f"); }
    /**
     * Changes the use of absolute pathnames, to paths relatve to the given directory.
     * This must be called before the <em>watch</em> method is called.  The paths
     * you specify to watch must be relative to the given directory.
     */
    set basedir(cwd) { __classPrivateFieldSet(this, _DirsWatcher_basedir, cwd, "f"); }
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
    async watch(dirs) {
        if (__classPrivateFieldGet(this, _DirsWatcher_watcher, "f")) {
            throw new Error(`Watcher already started for ${__classPrivateFieldGet(this, _DirsWatcher_watcher, "f")}`);
        }
        if (typeof dirs === 'string') {
            dirs = [{
                    mounted: dirs, mountPoint: '/'
                }];
        }
        else if (typeof dirs === 'object' && !Array.isArray(dirs)) {
            if (!isDirToWatch(dirs)) {
                throw new Error(`watch - directory spec not a dirToWatch - ${util.inspect(dirs)}`);
            }
            dirs = [dirs];
        }
        else if (!Array.isArray(dirs)) {
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
        __classPrivateFieldSet(this, _DirsWatcher_dirs, dirs, "f");
        if (__classPrivateFieldGet(this, _DirsWatcher_basedir, "f")) {
            __classPrivateFieldGet(this, _DirsWatcher_options, "f").cwd = __classPrivateFieldGet(this, _DirsWatcher_basedir, "f");
        }
        else {
            __classPrivateFieldGet(this, _DirsWatcher_options, "f").cwd = undefined;
        }
        __classPrivateFieldSet(this, _DirsWatcher_watcher, chokidar.watch(towatch, __classPrivateFieldGet(this, _DirsWatcher_options, "f")), "f");
        // In the event handlers, we create the FileInfo object matching
        // the path.  The FileInfo is matched to a _symb_dirs entry.
        // If the _symb_dirs entry has <em>ignore</em> or <em>include</em>
        // fields, the patterns in those fields are used to determine whether
        // to include or ignore this file.  If we are to ignore it, then
        // fileInfo returns undefined.  Hence, in each case we test whether
        // <em>info</em> has a value before emitting the event.
        //
        // All this function does is to receive events from Chokidar,
        // construct FileInfo objects, and emit matching events.
        // const watcher_name = this.name;
        __classPrivateFieldGet(this, _DirsWatcher_watcher, "f")
            .on('change', async (fpath, stats) => {
            __classPrivateFieldGet(this, _DirsWatcher_queue, "f").push({
                code: 'change', fpath, stats
            });
            // console.log(`watcher ${watcher_name} change ${fpath}`);
        })
            .on('add', async (fpath, stats) => {
            __classPrivateFieldGet(this, _DirsWatcher_queue, "f").push({
                code: 'add', fpath, stats
            });
            // console.log(`watcher ${watcher_name} add ${fpath}`);
        })
            /* .on('addDir', async (fpath, stats) => {
                // ?? let info = this.fileInfo(fpath, stats);
                // ?? console.log(`DirsWatcher addDir`, info);
                // ?? this.emit('addDir', info);
            }) */
            .on('unlink', async (fpath) => {
            __classPrivateFieldGet(this, _DirsWatcher_queue, "f").push({
                code: 'unlink', fpath
            });
            // console.log(`watcher ${watcher_name} unlink ${fpath}`);
        })
            /* .on('unlinkDir', async fpath => {
                // ?? let info = this.fileInfo(fpath, stats);
                // ?? console.log(`DirsWatcher unlinkDir ${fpath}`);
                // ?? this.emit('unlinkDir', info);
            }) */
            .on('ready', () => {
            __classPrivateFieldGet(this, _DirsWatcher_queue, "f").push({
                code: 'ready'
            });
            // console.log(`watcher ${watcher_name} ready`);
        });
        // this.isReady = new Promise((resolve, reject) => {
        //     this[_symb_watcher].on('ready', () => { resolve(true); });
        // });
        // console.log(this.isReady);
    }
    /* Calculate the stack for a filesystem path

    Only emit if the change was to the front-most file */
    async onChange(fpath) {
        const vpinfo = this.vpathForFSPath(fpath);
        if (!vpinfo) {
            console.log(`onChange could not find mount point or vpath for ${fpath}`);
            return;
        }
        const stack = await this.stackForVPath(vpinfo.vpath);
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
    async onAdd(fpath) {
        const vpinfo = this.vpathForFSPath(fpath);
        if (!vpinfo) {
            console.log(`onAdd could not find mount point or vpath for ${fpath}`);
            return;
        }
        // console.log(`onAdd ${fpath}`, vpinfo);
        // console.log(`onAdd ${fpath} ${vpinfo.vpath}`);
        const stack = await this.stackForVPath(vpinfo.vpath);
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
        }
        else {
            // console.log(`onAdd SKIPPED emit event for ${fpath}`);
        }
        // let info = this.fileInfo(fpath, stats);
        // if (info) this.emit('add', this.name, info);
        // console.log(`DirsWatcher add`, info);
    }
    /* Only emit if it was the front-most file deleted
    If there is a file uncovered by this, then emit an add event for that */
    async onUnlink(fpath) {
        const vpinfo = this.vpathForFSPath(fpath);
        if (!vpinfo) {
            console.log(`onUnlink could not find mount point or vpath for ${fpath}`);
            return;
        }
        const stack = await this.stackForVPath(vpinfo.vpath);
        if (stack.length === 0) {
            /* If no files remain in the stack for this virtual path, then
             * we must declare it unlinked.
             */
            if (!isVPathData(vpinfo)) {
                throw new Error(`Invalid VPathData ${util.inspect(vpinfo)}`);
            }
            this.emit('unlink', this.name, vpinfo);
        }
        else {
            /* On the other hand, if there is an entry we shouldn't send
             * an unlink event.  Instead it seems most appropriate to send
             * a change event.
             */
            const sfirst = stack[0];
            const toemit = {
                fspath: sfirst.fspath,
                vpath: sfirst.vpath,
                mime: mime.getType(sfirst.fspath),
                mounted: sfirst.mounted,
                mountPoint: sfirst.mountPoint,
                pathInMounted: sfirst.pathInMounted,
                stack
            };
            if (!isVPathData(toemit)) {
                throw new Error(`Invalid VPathData ${util.inspect(toemit)}`);
            }
            this.emit('change', this.name, toemit);
        }
        // let info = this.fileInfo(fpath, undefined);
        // console.log(`DirsWatcher unlink ${fpath}`);
        // if (info) this.emit('unlink', this.name, info);
    }
    onReady() {
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
        if (__classPrivateFieldGet(this, _DirsWatcher_watcher, "f"))
            return __classPrivateFieldGet(this, _DirsWatcher_watcher, "f").getWatched();
    }
    vpathForFSPath(fspath) {
        for (const dir of this.dirs) {
            // Check to see if we're supposed to ignore the file
            if (dir.ignore) {
                let ignores;
                if (typeof dir.ignore === 'string') {
                    ignores = [dir.ignore];
                }
                else {
                    ignores = dir.ignore;
                }
                let ignore = false;
                for (const i of ignores) {
                    if (minimatch(fspath, i))
                        ignore = true;
                    // console.log(`dir.ignore ${fspath} ${i} => ${ignore}`);
                }
                if (ignore)
                    continue;
            }
            // This ensures we are matching on directory boundaries
            // Otherwise fspath "/path/to/layouts-extra/layout.njk" might
            // match dir.mounted "/path/to/layouts".
            //
            // console.log(`vpathForFSPath ${dir.mounted} ${typeof dir.mounted}`, dir);
            const dirmounted = (dir && dir.mounted)
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
                const ret = {
                    fspath: fspath,
                    vpath: vpath,
                    mime: mime.getType(fspath),
                    mounted: dir.mounted,
                    mountPoint: dir.mountPoint,
                    pathInMounted
                };
                if (!isVPathData(ret)) {
                    throw new Error(`Invalid VPathData ${util.inspect(ret)}`);
                }
                return ret;
            }
        }
        // No directory found for this file
        return undefined;
    }
    async stackForVPath(vpath) {
        const ret = [];
        for (const dir of this.dirs) {
            if (dir.mountPoint === '/') {
                const pathInMounted = vpath;
                const fspath = path.join(dir.mounted, pathInMounted);
                let stats;
                try {
                    stats = await fs.stat(fspath);
                }
                catch (err) {
                    stats = undefined;
                }
                if (!stats)
                    continue;
                const topush = {
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
            }
            else {
                const dirmountpt = (dir && dir.mountPoint)
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
                    }
                    catch (err) {
                        stats = undefined;
                    }
                    if (!stats) {
                        // console.log(`stackForVPath vpath ${vpath} did not find fs.stats for ${fspath}`);
                        continue;
                    }
                    const topush = {
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
                }
                else {
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
        if (__classPrivateFieldGet(this, _DirsWatcher_watcher, "f")) {
            // console.log(`Closing watcher ${this.name}`);
            await __classPrivateFieldGet(this, _DirsWatcher_watcher, "f").close();
            __classPrivateFieldSet(this, _DirsWatcher_watcher, undefined, "f");
        }
    }
}
_DirsWatcher_dirs = new WeakMap(), _DirsWatcher_watcher = new WeakMap(), _DirsWatcher_name = new WeakMap(), _DirsWatcher_options = new WeakMap(), _DirsWatcher_basedir = new WeakMap(), _DirsWatcher_queue = new WeakMap();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2F0Y2hlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2xpYi93YXRjaGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUNBLE9BQU8sRUFDSCxRQUFRLElBQUksRUFBRSxFQUNkLEtBQUssRUFDUixNQUFNLFNBQVMsQ0FBQztBQUNqQixPQUFPLFFBQXdDLE1BQU0sVUFBVSxDQUFDO0FBRWhFLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFDakMsT0FBTyxhQUFhLE1BQU0sd0JBQXdCLENBQUM7QUFDbkQsT0FBTyxVQUFVLE1BQU0scUJBQXFCLENBQUM7QUFFN0MsTUFBTSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBRWpELE9BQU8sS0FBSyxJQUFJLE1BQU0sV0FBVyxDQUFDO0FBQ2xDLE9BQU8sS0FBSyxJQUFJLE1BQU0sV0FBVyxDQUFDO0FBQ2xDLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDM0MsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUN0QyxPQUFPLEtBQUssS0FBSyxNQUFNLE9BQU8sQ0FBQztBQUkvQixpRUFBaUU7QUFDakUsaUVBQWlFO0FBQ2pFLDJEQUEyRDtBQUMzRCxFQUFFO0FBQ0Ysb0RBQW9EO0FBQ3BELHlDQUF5QztBQUN6Qyw4REFBOEQ7QUFDOUQsMERBQTBEO0FBQzFELEVBQUU7QUFDRixzRUFBc0U7QUFDdEUsbURBQW1EO0FBRW5ELE1BQU0sVUFBVSxVQUFVLENBQUMsT0FBTyxFQUFFLEtBQWdCO0lBQ2hELElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ2hDLENBQUM7QUErQ0Q7Ozs7O0dBS0c7QUFDSCxNQUFNLENBQUMsTUFBTSxXQUFXLEdBQUcsQ0FBQyxNQUFNLEVBQXVCLEVBQUU7SUFDdkQsSUFBSSxPQUFPLE1BQU0sS0FBSyxX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b0JBQ0osMkVBQTJFO2dCQUMvRSxDQUFDO1lBQ0wsQ0FBQztRQUNMLENBQUM7UUFDRCxpRUFBaUU7UUFDakUsc0NBQXNDO1FBQ3RDLE9BQU8sR0FBRyxDQUFDO0lBQ2YsQ0FBQztJQUVELEtBQUssQ0FBQyxLQUFLO1FBQ1AsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ2xDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMvQixJQUFJLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDbEMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2pDLElBQUksdUJBQUEsSUFBSSw0QkFBUyxFQUFFLENBQUM7WUFDaEIsK0NBQStDO1lBQy9DLE1BQU0sdUJBQUEsSUFBSSw0QkFBUyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQzVCLHVCQUFBLElBQUksd0JBQVksU0FBUyxNQUFBLENBQUM7UUFDOUIsQ0FBQztJQUNMLENBQUM7Q0FDSiIsInNvdXJjZXNDb250ZW50IjpbIlxuaW1wb3J0IHtcbiAgICBwcm9taXNlcyBhcyBmcyxcbiAgICBTdGF0c1xufSBmcm9tICdub2RlOmZzJztcbmltcG9ydCBjaG9raWRhciwgeyBGU1dhdGNoZXIsIENob2tpZGFyT3B0aW9ucyB9IGZyb20gJ2Nob2tpZGFyJztcblxuaW1wb3J0IHsgTWltZSB9IGZyb20gJ21pbWUvbGl0ZSc7XG5pbXBvcnQgc3RhbmRhcmRUeXBlcyBmcm9tICdtaW1lL3R5cGVzL3N0YW5kYXJkLmpzJztcbmltcG9ydCBvdGhlclR5cGVzIGZyb20gJ21pbWUvdHlwZXMvb3RoZXIuanMnO1xuXG5jb25zdCBtaW1lID0gbmV3IE1pbWUoc3RhbmRhcmRUeXBlcywgb3RoZXJUeXBlcyk7XG5cbmltcG9ydCAqIGFzIHV0aWwgZnJvbSAnbm9kZTp1dGlsJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ25vZGU6ZXZlbnRzJztcbmltcG9ydCB7IG1pbmltYXRjaCB9IGZyb20gJ21pbmltYXRjaCc7XG5pbXBvcnQgKiBhcyBmYXN0cSBmcm9tICdmYXN0cSc7XG5pbXBvcnQgdHlwZSB7IHF1ZXVlQXNQcm9taXNlZCB9IGZyb20gXCJmYXN0cVwiO1xuXG5cbi8vIE5PVEUgV2Ugc2hvdWxkIG5vdCBkbyB0aGlzIGhlcmUuICBJdCBoYWQgYmVlbiBjb3BpZWQgb3ZlciBmcm9tXG4vLyBBa2FzaGFSZW5kZXIsIGJ1dCB0aGlzIGlzIGR1cGxpY2F0aXZlLCBhbmQgaXQncyBwb3NzaWJsZSB0aGVyZVxuLy8gd2lsbCBiZSBvdGhlciB1c2VycyBvZiBEaXJzV2F0Y2hlciB3aG8gZG8gbm90IHdhbnQgdGhpcy5cbi8vXG4vLyBUaGVyZSBkb2Vzbid0IHNlZW0gdG8gYmUgYW4gb2ZmaWNpYWwgcmVnaXN0cmF0aW9uXG4vLyBwZXI6IGh0dHBzOi8vYXNjaWlkb2N0b3Iub3JnL2RvY3MvZmFxL1xuLy8gcGVyOiBodHRwczovL2dpdGh1Yi5jb20vYXNjaWlkb2N0b3IvYXNjaWlkb2N0b3IvaXNzdWVzLzI1MDJcbi8vIG1pbWUuZGVmaW5lKHsndGV4dC94LWFzY2lpZG9jJzogWydhZG9jJywgJ2FzY2lpZG9jJ119KTtcbi8vXG4vLyBJbnN0ZWFkIG9mIGRlZmluaW5nIE1JTUUgdHlwZXMgaGVyZSwgd2UgYWRkZWQgYSBtZXRob2QgXCJtaW1lZGVmaW5lXCJcbi8vIHRvIGFsbG93IERpcnNXYXRjaGVyIHVzZXJzIHRvIGRlZmluZSBNSU1FIHR5cGVzLlxuXG5leHBvcnQgZnVuY3Rpb24gbWltZWRlZmluZShtYXBwaW5nLCBmb3JjZSA/OiBib29sZWFuKSB7XG4gICAgbWltZS5kZWZpbmUobWFwcGluZywgZm9yY2UpO1xufVxuXG5leHBvcnQgdHlwZSBWUGF0aERhdGEgPSB7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZnVsbCBmaWxlLXN5c3RlbSBwYXRoIGZvciB0aGUgZmlsZS5cbiAgICAgKiBlLmcuIC9ob21lL3BhdGgvdG8vYXJ0aWNsZS1uYW1lLmh0bWwubWRcbiAgICAgKi9cbiAgICBmc3BhdGg6IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIFRoZSB2aXJ0dWFsIHBhdGgsIHJvb3RlZCBhdCB0aGUgdG9wXG4gICAgICogZGlyZWN0b3J5IG9mIHRoZSBmaWxlc3lzdGVtLCB3aXRoIG5vXG4gICAgICogbGVhZGluZyBzbGFzaC5cbiAgICAgKi9cbiAgICB2cGF0aDogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG1pbWUgdHlwZSBvZiB0aGUgZmlsZS4gIFRoZSBtaW1lIHR5cGVzXG4gICAgICogYXJlIGRldGVybWluZWQgZnJvbSB0aGUgZmlsZSBleHRlbnNpb25cbiAgICAgKiB1c2luZyB0aGUgJ21pbWUnIHBhY2thZ2UuXG4gICAgICovXG4gICAgbWltZSA/OiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZmlsZS1zeXN0ZW0gcGF0aCB3aGljaCBpcyBtb3VudGVkXG4gICAgICogaW50byB0aGUgdmlydHVhbCBmaWxlIHNwYWNlLlxuICAgICAqL1xuICAgIG1vdW50ZWQ6IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIFRoZSB2aXJ0dWFsIGRpcmVjdG9yeSBvZiB0aGUgbW91bnRcbiAgICAgKiBlbnRyeSBpbiB0aGUgZGlyZWN0b3J5IHN0YWNrLlxuICAgICAqL1xuICAgIG1vdW50UG9pbnQ6IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIFRoZSByZWxhdGl2ZSBwYXRoIHVuZGVybmVhdGggdGhlIG1vdW50UG9pbnQuXG4gICAgICovXG4gICAgcGF0aEluTW91bnRlZDogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZpbGUtc3lzdGVtIHN0YWNrIHJlbGF0ZWQgdG8gdGhlIGZpbGUuXG4gICAgICovXG4gICAgc3RhY2sgPzogVlBhdGhEYXRhW107XG59XG5cbi8qKlxuICogVHlwZWd1YXJkIGZ1bmN0aW9uIGVuc3VyaW5nIHRoYXQgYW4gb2JqZWN0XG4gKiBpcyBhIFZQYXRoRGF0YSBvYmplY3QuXG4gKiBAcGFyYW0gdnBpbmZvIFRoZSBvYmplY3QgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHRydWUgaWYgaXQgaXMgYSBWUGF0aERhdGEsIGZhbHNlIG90aGVyd2lzZVxuICovXG5leHBvcnQgY29uc3QgaXNWUGF0aERhdGEgPSAodnBpbmZvKTogdnBpbmZvIGlzIFZQYXRoRGF0YSA9PiB7XG4gICAgaWYgKHR5cGVvZiB2cGluZm8gPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiB2cGluZm8gIT09ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiB2cGluZm8ubWltZSAhPT0gJ3VuZGVmaW5lZCdcbiAgICAgJiYgdnBpbmZvLm1pbWUgIT09IG51bGxcbiAgICAgJiYgdHlwZW9mIHZwaW5mby5taW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgdnBpbmZvLmZzcGF0aCAhPT0gJ3N0cmluZydcbiAgICAgfHwgdHlwZW9mIHZwaW5mby52cGF0aCAhPT0gJ3N0cmluZydcbiAgICAgfHwgdHlwZW9mIHZwaW5mby5tb3VudGVkICE9PSAnc3RyaW5nJ1xuICAgICB8fCB0eXBlb2YgdnBpbmZvLm1vdW50UG9pbnQgIT09ICdzdHJpbmcnXG4gICAgIHx8IHR5cGVvZiB2cGluZm8ucGF0aEluTW91bnRlZCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHZwaW5mby5zdGFjayA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiB0cnVlO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHZwaW5mby5zdGFjaykpIHtcbiAgICAgICAgZm9yIChjb25zdCBpbmYgb2YgdnBpbmZvLnN0YWNrKSB7XG4gICAgICAgICAgICBpZiAoIWlzVlBhdGhEYXRhKGluZikpIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbnR5cGUgcXVldWVFdmVudCA9IHtcbiAgICBjb2RlOiBzdHJpbmc7XG4gICAgZnBhdGg/OiBzdHJpbmc7XG4gICAgc3RhdHM/OiBTdGF0cztcbn07XG5cbmNvbnN0IGlzUXVldWVFdmVudCA9IChldmVudCk6IGV2ZW50IGlzIHF1ZXVlRXZlbnQgPT4ge1xuICAgIGlmICh0eXBlb2YgZXZlbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiBldmVudCAhPT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcblxuICAgIGlmICh0eXBlb2YgZXZlbnQuY29kZSA9PT0gJ3N0cmluZydcbiAgICAgJiYgdHlwZW9mIGV2ZW50LmZwYXRoID09PSAnc3RyaW5nJ1xuICAgICAmJiAoZXZlbnQuc3RhdHMgaW5zdGFuY2VvZiBTdGF0cykpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgZXZlbnQuY29kZSA9PT0gJ3N0cmluZydcbiAgICAgJiYgZXZlbnQuY29kZSA9PT0gJ3JlYWR5Jykge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBldmVudC5jb2RlID09PSAnc3RyaW5nJ1xuICAgICAmJiBldmVudC5jb2RlID09PSAndW5saW5rJ1xuICAgICAmJiB0eXBlb2YgZXZlbnQuZnBhdGggPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCB0eXBlIGRpclRvV2F0Y2ggPSB7XG4gICAgLyoqXG4gICAgICogVGhlIGZpbGVzeXN0ZW0gcGF0aCB0byBcIm1vdW50XCIuXG4gICAgICovXG4gICAgbW91bnRlZDogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHBhdGggd2l0aGluIHRoZSB2aXJ0dWFsIGZpbGVzeXN0ZW0gd2hlcmUgdGhpcyB3aWxsIGFwcGVhci5cbiAgICAgKi9cbiAgICBtb3VudFBvaW50OiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBPcHRpb25hbCBhcnJheSBvZiBzdHJpbmdzIGNvbnRhaW5pbmcgZ2xvYnMgZm9yIG1hdGNoaW5nXG4gICAgICogZmlsZXMgdG8gaWdub3JlLlxuICAgICAqL1xuICAgIGlnbm9yZT86IHN0cmluZ1tdO1xufVxuXG4vKipcbiAqIERldGVybWluZSB3aGV0aGVyIHRoZSB7QGNvZGUgZGlyfSBpcyBhIHtAY29kZSBkaXJUb1dhdGNofS5cbiAqL1xuZXhwb3J0IGNvbnN0IGlzRGlyVG9XYXRjaCA9IChkaXI6IGFueSk6IGRpciBpcyBkaXJUb1dhdGNoID0+IHtcbiAgICBpZiAodHlwZW9mIGRpciA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodHlwZW9mIGRpciAhPT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcblxuICAgIGlmICgnbW91bnRlZCcgaW4gZGlyICYmIHR5cGVvZiBkaXIubW91bnRlZCAhPT0gJ3N0cmluZycpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoJ21vdW50UG9pbnQnIGluIGRpciAmJiB0eXBlb2YgZGlyLm1vdW50UG9pbnQgIT09ICdzdHJpbmcnKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKCdpZ25vcmUnIGluIGRpciAmJiB0eXBlb2YgZGlyLmlnbm9yZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgdHlwZW9mIGRpci5pZ25vcmUgIT09ICdzdHJpbmcnXG4gICAgICAgICAmJiAhQXJyYXkuaXNBcnJheShkaXIuaWdub3JlKVxuICAgICAgICApIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoXG4gICAgICAgICAgICB0eXBlb2YgZGlyLmlnbm9yZSA9PT0gJ3N0cmluZydcbiAgICAgICAgICYmIEFycmF5LmlzQXJyYXkoZGlyLmlnbm9yZSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn1cblxuLy8gY29uc3QgX3N5bWJfZGlycyA9IFN5bWJvbCgnZGlycycpO1xuLy8gY29uc3QgX3N5bWJfd2F0Y2hlciA9IFN5bWJvbCgnd2F0Y2hlcicpO1xuLy8gY29uc3QgX3N5bWJfbmFtZSA9IFN5bWJvbCgnbmFtZScpO1xuLy8gY29uc3QgX3N5bWJfb3B0aW9ucyA9IFN5bWJvbCgnb3B0aW9ucycpO1xuLy8gY29uc3QgX3N5bWJfY3dkID0gU3ltYm9sKCdiYXNlZGlyJyk7XG4vLyBjb25zdCBfc3ltYl9xdWV1ZSA9IFN5bWJvbCgncXVldWUnKTtcblxuZXhwb3J0IGNsYXNzIERpcnNXYXRjaGVyIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcblxuICAgICNkaXJzOiBkaXJUb1dhdGNoW107XG4gICAgI3dhdGNoZXI/OiBGU1dhdGNoZXI7XG4gICAgI25hbWU6IHN0cmluZztcbiAgICAjb3B0aW9uczogQ2hva2lkYXJPcHRpb25zO1xuICAgICNiYXNlZGlyO1xuICAgICNxdWV1ZTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSBuYW1lIHN0cmluZyBnaXZpbmcgdGhlIG5hbWUgZm9yIHRoaXMgd2F0Y2hlclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgJHtuYW1lfSBjb25zdHJ1Y3RvcmApO1xuICAgICAgICB0aGlzLiNuYW1lID0gbmFtZTtcbiAgICAgICAgLy8gVE9ETyBpcyB0aGVyZSBhIG5lZWQgdG8gbWFrZSB0aGlzIGN1c3RvbWl6YWJsZT9cbiAgICAgICAgdGhpcy4jb3B0aW9ucyA9IHtcbiAgICAgICAgICAgIHBlcnNpc3RlbnQ6IHRydWUsIGlnbm9yZUluaXRpYWw6IGZhbHNlLCBhd2FpdFdyaXRlRmluaXNoOiB0cnVlLCBhbHdheXNTdGF0OiB0cnVlXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuI2Jhc2VkaXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnN0IHRoYXQgPSB0aGlzO1xuICAgICAgICBjb25zdCBxOiBxdWV1ZUFzUHJvbWlzZWQ8cXVldWVFdmVudD4gPSBmYXN0cS5wcm9taXNlKFxuICAgICAgICAgICAgYXN5bmMgZnVuY3Rpb24oZXZlbnQ6IHF1ZXVlRXZlbnQpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWlzUXVldWVFdmVudChldmVudCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJTlRFUk5BTCBFUlJPUiBub3QgYSBxdWV1ZUV2ZW50ICR7dXRpbC5pbnNwZWN0KGV2ZW50KX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGV2ZW50LmNvZGUgPT09ICdjaGFuZ2UnKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoYXQub25DaGFuZ2UoZXZlbnQuZnBhdGggLyosIGV2ZW50LnN0YXRzICovKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LmNvZGUgPT09ICdhZGQnKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoYXQub25BZGQoZXZlbnQuZnBhdGggLyosIGV2ZW50LnN0YXRzICovKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LmNvZGUgPT09ICd1bmxpbmsnKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoYXQub25VbmxpbmsoZXZlbnQuZnBhdGgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZXZlbnQuY29kZSA9PT0gJ3JlYWR5Jykge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGF0Lm9uUmVhZHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCAxKTtcbiAgICAgICAgdGhpcy4jcXVldWUgPSBxO1xuICAgICAgICB0aGlzLiNxdWV1ZS5lcnJvcihmdW5jdGlvbihlcnIsIHRhc2spIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBEaXJzV2F0Y2hlciAke25hbWV9ICR7dGFzay5jb2RlfSAke3Rhc2suZnBhdGh9IGNhdWdodCBlcnJvciAke2Vycn1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIHRoZSBkaXJlY3Rvcnkgc3RhY2sgZm9yXG4gICAgICogdGhpcyBXYXRjaGVyLlxuICAgICAqL1xuICAgIGdldCBkaXJzKCk6IGRpclRvV2F0Y2hbXSB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLiNkaXJzOyB9XG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIG5hbWUgZm9yIHRoaXMgV2F0Y2hlclxuICAgICAqL1xuICAgIGdldCBuYW1lKCkgeyByZXR1cm4gdGhpcy4jbmFtZTsgfVxuXG4gICAgLyoqXG4gICAgICogQ2hhbmdlcyB0aGUgdXNlIG9mIGFic29sdXRlIHBhdGhuYW1lcywgdG8gcGF0aHMgcmVsYXR2ZSB0byB0aGUgZ2l2ZW4gZGlyZWN0b3J5LlxuICAgICAqIFRoaXMgbXVzdCBiZSBjYWxsZWQgYmVmb3JlIHRoZSA8ZW0+d2F0Y2g8L2VtPiBtZXRob2QgaXMgY2FsbGVkLiAgVGhlIHBhdGhzXG4gICAgICogeW91IHNwZWNpZnkgdG8gd2F0Y2ggbXVzdCBiZSByZWxhdGl2ZSB0byB0aGUgZ2l2ZW4gZGlyZWN0b3J5LlxuICAgICAqL1xuICAgIHNldCBiYXNlZGlyKGN3ZCkgeyB0aGlzLiNiYXNlZGlyID0gY3dkOyB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIHRoZSBDaG9raWRhciB3YXRjaGVyLCBiYXNlYyBvbiB0aGUgZGlyZWN0b3JpZXMgdG8gd2F0Y2guICBUaGUgPGVtPmRpcnNwZWM8L2VtPiBvcHRpb24gY2FuIGJlIGEgc3RyaW5nLFxuICAgICAqIG9yIGFuIG9iamVjdC4gIElmIGl0IGlzIGEgc3RyaW5nLCBpdCBpcyBhIGZpbGVzeXN0ZW0gcGF0aG5hbWUgdGhhdCB3aWxsIGJlXG4gICAgICogYXNzb2NpYXRlZCB3aXRoIHRoZSByb290IG9mIHRoZSB2aXJ0dWFsIGZpbGVzeXN0ZW0uICBBbiBvYmplY3Qgd2lsbCBsb29rXG4gICAgICogbGlrZSB0aGlzOlxuICAgICAqIFxuICAgICAqIDxjb2RlPlxuICAgICAqIHtcbiAgICAgKiAgIG1vdW50ZWQ6ICcvcGF0aC90by9tb3VudGVkJyxcbiAgICAgKiAgIG1vdW50UG9pbnQ6ICdtb3VudGVkJ1xuICAgICAqIH1cbiAgICAgKiA8L2NvZGU+XG4gICAgICogXG4gICAgICogVGhlIDx0dD5tb3VudFBvaW50PC90dD4gZmllbGQgaXMgYSBmdWxsIHBhdGggdG8gdGhlIGRpcmVjdG9yeSBvZiBpbnRlcmVzdC4gIFRoZVxuICAgICAqIDx0dD5tb3VudFBvaW50PC90dD4gZmllbGQgZGVzY3JpYmVzIGEgcHJlZml4IHdpdGhpbiB0aGUgdmlydHVhbCBmaWxlc3lzdGVtLlxuICAgICAqIFxuICAgICAqIEBwYXJhbSBkaXJzcGVjIFxuICAgICAqL1xuICAgIGFzeW5jIHdhdGNoKGRpcnM6IGRpclRvV2F0Y2hbXSB8IHN0cmluZykge1xuICAgICAgICBpZiAodGhpcy4jd2F0Y2hlcikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBXYXRjaGVyIGFscmVhZHkgc3RhcnRlZCBmb3IgJHt0aGlzLiN3YXRjaGVyfWApO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgZGlycyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGRpcnMgPSBbIHtcbiAgICAgICAgICAgICAgICBtb3VudGVkOiBkaXJzLCBtb3VudFBvaW50OiAnLydcbiAgICAgICAgICAgIH0gXTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZGlycyA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkoZGlycykpIHtcbiAgICAgICAgICAgIGlmICghaXNEaXJUb1dhdGNoKGRpcnMpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXRjaCAtIGRpcmVjdG9yeSBzcGVjIG5vdCBhIGRpclRvV2F0Y2ggLSAke3V0aWwuaW5zcGVjdChkaXJzKX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRpcnMgPSBbIGRpcnMgXTtcbiAgICAgICAgfSBlbHNlIGlmICghQXJyYXkuaXNBcnJheShkaXJzKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXRjaCAtIHRoZSBkaXJzIGFyZ3VtZW50IGlzIGluY29ycmVjdCAke3V0aWwuaW5zcGVjdChkaXJzKX1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBjb25zb2xlLmxvZyhgd2F0Y2ggZGlycz1gLCBkaXJzKTtcbiAgICAgICAgY29uc3QgdG93YXRjaCA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IGRpciBvZiBkaXJzKSB7XG4gICAgICAgICAgICBpZiAoIWlzRGlyVG9XYXRjaChkaXIpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXRjaCBkaXJlY3Rvcnkgc3BlYyBpbiBkaXJzIG5vdCBhIGRpclRvV2F0Y2ggLSAke3V0aWwuaW5zcGVjdChkaXIpfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KGRpci5tb3VudGVkKTtcbiAgICAgICAgICAgIGlmICghc3RhdHMuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2F0Y2ggLSBub24tZGlyZWN0b3J5IHNwZWNpZmllZCBpbiAke3V0aWwuaW5zcGVjdChkaXIpfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdG93YXRjaC5wdXNoKGRpci5tb3VudGVkKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLiNkaXJzID0gZGlycztcblxuICAgICAgICBpZiAodGhpcy4jYmFzZWRpcikge1xuICAgICAgICAgICAgdGhpcy4jb3B0aW9ucy5jd2QgPSB0aGlzLiNiYXNlZGlyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy4jb3B0aW9ucy5jd2QgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLiN3YXRjaGVyID0gY2hva2lkYXIud2F0Y2godG93YXRjaCwgdGhpcy4jb3B0aW9ucyk7XG5cbiAgICAgICAgLy8gSW4gdGhlIGV2ZW50IGhhbmRsZXJzLCB3ZSBjcmVhdGUgdGhlIEZpbGVJbmZvIG9iamVjdCBtYXRjaGluZ1xuICAgICAgICAvLyB0aGUgcGF0aC4gIFRoZSBGaWxlSW5mbyBpcyBtYXRjaGVkIHRvIGEgX3N5bWJfZGlycyBlbnRyeS5cbiAgICAgICAgLy8gSWYgdGhlIF9zeW1iX2RpcnMgZW50cnkgaGFzIDxlbT5pZ25vcmU8L2VtPiBvciA8ZW0+aW5jbHVkZTwvZW0+XG4gICAgICAgIC8vIGZpZWxkcywgdGhlIHBhdHRlcm5zIGluIHRob3NlIGZpZWxkcyBhcmUgdXNlZCB0byBkZXRlcm1pbmUgd2hldGhlclxuICAgICAgICAvLyB0byBpbmNsdWRlIG9yIGlnbm9yZSB0aGlzIGZpbGUuICBJZiB3ZSBhcmUgdG8gaWdub3JlIGl0LCB0aGVuXG4gICAgICAgIC8vIGZpbGVJbmZvIHJldHVybnMgdW5kZWZpbmVkLiAgSGVuY2UsIGluIGVhY2ggY2FzZSB3ZSB0ZXN0IHdoZXRoZXJcbiAgICAgICAgLy8gPGVtPmluZm88L2VtPiBoYXMgYSB2YWx1ZSBiZWZvcmUgZW1pdHRpbmcgdGhlIGV2ZW50LlxuICAgICAgICAvL1xuICAgICAgICAvLyBBbGwgdGhpcyBmdW5jdGlvbiBkb2VzIGlzIHRvIHJlY2VpdmUgZXZlbnRzIGZyb20gQ2hva2lkYXIsXG4gICAgICAgIC8vIGNvbnN0cnVjdCBGaWxlSW5mbyBvYmplY3RzLCBhbmQgZW1pdCBtYXRjaGluZyBldmVudHMuXG5cbiAgICAgICAgLy8gY29uc3Qgd2F0Y2hlcl9uYW1lID0gdGhpcy5uYW1lO1xuXG4gICAgICAgIHRoaXMuI3dhdGNoZXJcbiAgICAgICAgICAgIC5vbignY2hhbmdlJywgYXN5bmMgKGZwYXRoLCBzdGF0cykgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuI3F1ZXVlLnB1c2goPHF1ZXVlRXZlbnQ+e1xuICAgICAgICAgICAgICAgICAgICBjb2RlOiAnY2hhbmdlJywgZnBhdGgsIHN0YXRzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHdhdGNoZXIgJHt3YXRjaGVyX25hbWV9IGNoYW5nZSAke2ZwYXRofWApO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5vbignYWRkJywgYXN5bmMgKGZwYXRoLCBzdGF0cykgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuI3F1ZXVlLnB1c2goPHF1ZXVlRXZlbnQ+e1xuICAgICAgICAgICAgICAgICAgICBjb2RlOiAnYWRkJywgZnBhdGgsIHN0YXRzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHdhdGNoZXIgJHt3YXRjaGVyX25hbWV9IGFkZCAke2ZwYXRofWApO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC8qIC5vbignYWRkRGlyJywgYXN5bmMgKGZwYXRoLCBzdGF0cykgPT4geyBcbiAgICAgICAgICAgICAgICAvLyA/PyBsZXQgaW5mbyA9IHRoaXMuZmlsZUluZm8oZnBhdGgsIHN0YXRzKTtcbiAgICAgICAgICAgICAgICAvLyA/PyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgYWRkRGlyYCwgaW5mbyk7XG4gICAgICAgICAgICAgICAgLy8gPz8gdGhpcy5lbWl0KCdhZGREaXInLCBpbmZvKTtcbiAgICAgICAgICAgIH0pICovXG4gICAgICAgICAgICAub24oJ3VubGluaycsIGFzeW5jIGZwYXRoID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLiNxdWV1ZS5wdXNoKDxxdWV1ZUV2ZW50PntcbiAgICAgICAgICAgICAgICAgICAgY29kZTogJ3VubGluaycsIGZwYXRoXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHdhdGNoZXIgJHt3YXRjaGVyX25hbWV9IHVubGluayAke2ZwYXRofWApO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC8qIC5vbigndW5saW5rRGlyJywgYXN5bmMgZnBhdGggPT4geyBcbiAgICAgICAgICAgICAgICAvLyA/PyBsZXQgaW5mbyA9IHRoaXMuZmlsZUluZm8oZnBhdGgsIHN0YXRzKTtcbiAgICAgICAgICAgICAgICAvLyA/PyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgdW5saW5rRGlyICR7ZnBhdGh9YCk7XG4gICAgICAgICAgICAgICAgLy8gPz8gdGhpcy5lbWl0KCd1bmxpbmtEaXInLCBpbmZvKTtcbiAgICAgICAgICAgIH0pICovXG4gICAgICAgICAgICAub24oJ3JlYWR5JywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuI3F1ZXVlLnB1c2goPHF1ZXVlRXZlbnQ+e1xuICAgICAgICAgICAgICAgICAgICBjb2RlOiAncmVhZHknXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHdhdGNoZXIgJHt3YXRjaGVyX25hbWV9IHJlYWR5YCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAvLyB0aGlzLmlzUmVhZHkgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIC8vICAgICB0aGlzW19zeW1iX3dhdGNoZXJdLm9uKCdyZWFkeScsICgpID0+IHsgcmVzb2x2ZSh0cnVlKTsgfSk7XG4gICAgICAgIC8vIH0pO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyh0aGlzLmlzUmVhZHkpO1xuICAgIH1cblxuICAgIC8qIENhbGN1bGF0ZSB0aGUgc3RhY2sgZm9yIGEgZmlsZXN5c3RlbSBwYXRoXG5cbiAgICBPbmx5IGVtaXQgaWYgdGhlIGNoYW5nZSB3YXMgdG8gdGhlIGZyb250LW1vc3QgZmlsZSAqLyBcbiAgICBhc3luYyBvbkNoYW5nZShmcGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IHZwaW5mbyA9IHRoaXMudnBhdGhGb3JGU1BhdGgoZnBhdGgpO1xuICAgICAgICBpZiAoIXZwaW5mbykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYG9uQ2hhbmdlIGNvdWxkIG5vdCBmaW5kIG1vdW50IHBvaW50IG9yIHZwYXRoIGZvciAke2ZwYXRofWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHN0YWNrOiBWUGF0aERhdGFbXSA9IGF3YWl0IHRoaXMuc3RhY2tGb3JWUGF0aCh2cGluZm8udnBhdGgpO1xuICAgICAgICBpZiAoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYG9uQ2hhbmdlIGNvdWxkIG5vdCBmaW5kIG1vdW50IHBvaW50cyBmb3IgJHtmcGF0aH1gKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgaSA9IDA7XG4gICAgICAgIGxldCBkZXB0aDtcbiAgICAgICAgbGV0IGVudHJ5O1xuICAgICAgICBmb3IgKGNvbnN0IHMgb2Ygc3RhY2spIHtcbiAgICAgICAgICAgIGlmIChzLmZzcGF0aCA9PT0gZnBhdGgpIHtcbiAgICAgICAgICAgICAgICBlbnRyeSA9IHM7XG4gICAgICAgICAgICAgICAgZGVwdGggPSBpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaSsrO1xuICAgICAgICB9XG4gICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgb25DaGFuZ2Ugbm8gc3RhY2sgZW50cnkgZm9yICR7ZnBhdGh9ICgke3ZwaW5mby52cGF0aH0pYCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRlcHRoID09PSAwKSB7XG4gICAgICAgICAgICB2cGluZm8uc3RhY2sgPSBzdGFjaztcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBEaXJzV2F0Y2hlciBjaGFuZ2UgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEodnBpbmZvKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QodnBpbmZvKX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywgdGhpcy5uYW1lLCB2cGluZm8pO1xuICAgICAgICB9XG4gICAgICAgIC8vIGxldCBpbmZvID0gdGhpcy5maWxlSW5mbyhmcGF0aCwgc3RhdHMpO1xuICAgICAgICAvLyBpZiAoaW5mbykgdGhpcy5lbWl0KCdjaGFuZ2UnLCB0aGlzLm5hbWUsIGluZm8pO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgY2hhbmdlICR7ZnBhdGh9YCwgaW5mbyk7XG4gICAgfVxuXG4gICAgLy8gT25seSBlbWl0IGlmIHRoZSBhZGQgd2FzIHRoZSBmcm9udC1tb3N0IGZpbGVcbiAgICBhc3luYyBvbkFkZChmcGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IHZwaW5mbyA9IHRoaXMudnBhdGhGb3JGU1BhdGgoZnBhdGgpO1xuICAgICAgICBpZiAoIXZwaW5mbykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYG9uQWRkIGNvdWxkIG5vdCBmaW5kIG1vdW50IHBvaW50IG9yIHZwYXRoIGZvciAke2ZwYXRofWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBvbkFkZCAke2ZwYXRofWAsIHZwaW5mbyk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBvbkFkZCAke2ZwYXRofSAke3ZwaW5mby52cGF0aH1gKTtcbiAgICAgICAgY29uc3Qgc3RhY2s6IFZQYXRoRGF0YVtdID0gYXdhaXQgdGhpcy5zdGFja0ZvclZQYXRoKHZwaW5mby52cGF0aCk7XG4gICAgICAgIGlmIChzdGFjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgb25BZGQgY291bGQgbm90IGZpbmQgbW91bnQgcG9pbnRzIGZvciAke2ZwYXRofWApO1xuICAgICAgICB9XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBvbkFkZCAke2ZwYXRofWAsIHN0YWNrKTtcbiAgICAgICAgbGV0IGkgPSAwO1xuICAgICAgICBsZXQgZGVwdGg7XG4gICAgICAgIGxldCBlbnRyeTtcbiAgICAgICAgZm9yIChjb25zdCBzIG9mIHN0YWNrKSB7XG4gICAgICAgICAgICBpZiAocy5mc3BhdGggPT09IGZwYXRoKSB7XG4gICAgICAgICAgICAgICAgZW50cnkgPSBzO1xuICAgICAgICAgICAgICAgIGRlcHRoID0gaTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWVudHJ5KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYG9uQWRkIG5vIHN0YWNrIGVudHJ5IGZvciAke2ZwYXRofSAoJHt2cGluZm8udnBhdGh9KWApO1xuICAgICAgICB9XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBvbkFkZCAke2ZwYXRofSBkZXB0aD0ke2RlcHRofWAsIGVudHJ5KTtcbiAgICAgICAgaWYgKGRlcHRoID09PSAwKSB7XG4gICAgICAgICAgICB2cGluZm8uc3RhY2sgPSBzdGFjaztcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBvbkFkZCBFTUlUIGFkZCAke3ZwaW5mby52cGF0aH1gKTtcbiAgICAgICAgICAgIC8vIGZvciAobGV0IHMgb2Ygc3RhY2spIHtcbiAgICAgICAgICAgIC8vICAgIGNvbnNvbGUubG9nKGAuLi4uICR7cy52cGF0aH0gPT0+ICR7cy5mc3BhdGh9YCk7XG4gICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICBpZiAoIWlzVlBhdGhEYXRhKHZwaW5mbykpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgVlBhdGhEYXRhICR7dXRpbC5pbnNwZWN0KHZwaW5mbyl9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2FkZCcsIHRoaXMubmFtZSwgdnBpbmZvKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBvbkFkZCBTS0lQUEVEIGVtaXQgZXZlbnQgZm9yICR7ZnBhdGh9YCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gbGV0IGluZm8gPSB0aGlzLmZpbGVJbmZvKGZwYXRoLCBzdGF0cyk7XG4gICAgICAgIC8vIGlmIChpbmZvKSB0aGlzLmVtaXQoJ2FkZCcsIHRoaXMubmFtZSwgaW5mbyk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBEaXJzV2F0Y2hlciBhZGRgLCBpbmZvKTtcbiAgICAgICAgXG4gICAgfVxuXG4gICAgLyogT25seSBlbWl0IGlmIGl0IHdhcyB0aGUgZnJvbnQtbW9zdCBmaWxlIGRlbGV0ZWRcbiAgICBJZiB0aGVyZSBpcyBhIGZpbGUgdW5jb3ZlcmVkIGJ5IHRoaXMsIHRoZW4gZW1pdCBhbiBhZGQgZXZlbnQgZm9yIHRoYXQgKi9cbiAgICBhc3luYyBvblVubGluayhmcGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IHZwaW5mbyA9IHRoaXMudnBhdGhGb3JGU1BhdGgoZnBhdGgpO1xuICAgICAgICBpZiAoIXZwaW5mbykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYG9uVW5saW5rIGNvdWxkIG5vdCBmaW5kIG1vdW50IHBvaW50IG9yIHZwYXRoIGZvciAke2ZwYXRofWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHN0YWNrOiBWUGF0aERhdGFbXSA9IGF3YWl0IHRoaXMuc3RhY2tGb3JWUGF0aCh2cGluZm8udnBhdGgpO1xuICAgICAgICBpZiAoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAvKiBJZiBubyBmaWxlcyByZW1haW4gaW4gdGhlIHN0YWNrIGZvciB0aGlzIHZpcnR1YWwgcGF0aCwgdGhlblxuICAgICAgICAgICAgICogd2UgbXVzdCBkZWNsYXJlIGl0IHVubGlua2VkLlxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBpZiAoIWlzVlBhdGhEYXRhKHZwaW5mbykpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgVlBhdGhEYXRhICR7dXRpbC5pbnNwZWN0KHZwaW5mbyl9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ3VubGluaycsIHRoaXMubmFtZSwgdnBpbmZvKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8qIE9uIHRoZSBvdGhlciBoYW5kLCBpZiB0aGVyZSBpcyBhbiBlbnRyeSB3ZSBzaG91bGRuJ3Qgc2VuZFxuICAgICAgICAgICAgICogYW4gdW5saW5rIGV2ZW50LiAgSW5zdGVhZCBpdCBzZWVtcyBtb3N0IGFwcHJvcHJpYXRlIHRvIHNlbmRcbiAgICAgICAgICAgICAqIGEgY2hhbmdlIGV2ZW50LlxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBjb25zdCBzZmlyc3QgPSBzdGFja1swXTtcbiAgICAgICAgICAgIGNvbnN0IHRvZW1pdCA9IDxWUGF0aERhdGE+e1xuICAgICAgICAgICAgICAgIGZzcGF0aDogc2ZpcnN0LmZzcGF0aCxcbiAgICAgICAgICAgICAgICB2cGF0aDogc2ZpcnN0LnZwYXRoLFxuICAgICAgICAgICAgICAgIG1pbWU6IG1pbWUuZ2V0VHlwZShzZmlyc3QuZnNwYXRoKSxcbiAgICAgICAgICAgICAgICBtb3VudGVkOiBzZmlyc3QubW91bnRlZCxcbiAgICAgICAgICAgICAgICBtb3VudFBvaW50OiBzZmlyc3QubW91bnRQb2ludCxcbiAgICAgICAgICAgICAgICBwYXRoSW5Nb3VudGVkOiBzZmlyc3QucGF0aEluTW91bnRlZCxcbiAgICAgICAgICAgICAgICBzdGFja1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEodG9lbWl0KSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QodG9lbWl0KX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywgdGhpcy5uYW1lLCB0b2VtaXQpO1xuICAgICAgICB9XG4gICAgICAgIC8vIGxldCBpbmZvID0gdGhpcy5maWxlSW5mbyhmcGF0aCwgdW5kZWZpbmVkKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIHVubGluayAke2ZwYXRofWApO1xuICAgICAgICAvLyBpZiAoaW5mbykgdGhpcy5lbWl0KCd1bmxpbmsnLCB0aGlzLm5hbWUsIGluZm8pO1xuICAgIH1cblxuICAgIG9uUmVhZHkoKTogdm9pZCB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdEaXJzV2F0Y2hlcjogSW5pdGlhbCBzY2FuIGNvbXBsZXRlLiBSZWFkeSBmb3IgY2hhbmdlcycpO1xuICAgICAgICB0aGlzLmVtaXQoJ3JlYWR5JywgdGhpcy5uYW1lKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGFuIG9iamVjdCByZXByZXNlbnRpbmcgYWxsIHRoZSBwYXRocyBvbiB0aGUgZmlsZSBzeXN0ZW0gYmVpbmdcbiAgICAgKiB3YXRjaGVkIGJ5IHRoaXMgRlNXYXRjaGVyIGluc3RhbmNlLiBUaGUgb2JqZWN0J3Mga2V5cyBhcmUgYWxsIHRoZSBcbiAgICAgKiBkaXJlY3RvcmllcyAodXNpbmcgYWJzb2x1dGUgcGF0aHMgdW5sZXNzIHRoZSBjd2Qgb3B0aW9uIHdhcyB1c2VkKSxcbiAgICAgKiBhbmQgdGhlIHZhbHVlcyBhcmUgYXJyYXlzIG9mIHRoZSBuYW1lcyBvZiB0aGUgaXRlbXMgY29udGFpbmVkIGluIGVhY2ggZGlyZWN0b3J5LlxuICAgICAqL1xuICAgIGdldFdhdGNoZWQoKSB7XG4gICAgICAgIGlmICh0aGlzLiN3YXRjaGVyKSByZXR1cm4gdGhpcy4jd2F0Y2hlci5nZXRXYXRjaGVkKCk7XG4gICAgfVxuXG4gICAgdnBhdGhGb3JGU1BhdGgoZnNwYXRoOiBzdHJpbmcpOiBWUGF0aERhdGEge1xuICAgICAgICBmb3IgKGNvbnN0IGRpciBvZiB0aGlzLmRpcnMpIHtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgdG8gc2VlIGlmIHdlJ3JlIHN1cHBvc2VkIHRvIGlnbm9yZSB0aGUgZmlsZVxuICAgICAgICAgICAgaWYgKGRpci5pZ25vcmUpIHtcbiAgICAgICAgICAgICAgICBsZXQgaWdub3JlcztcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGRpci5pZ25vcmUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIGlnbm9yZXMgPSBbIGRpci5pZ25vcmUgXTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZ25vcmVzID0gZGlyLmlnbm9yZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGV0IGlnbm9yZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgaSBvZiBpZ25vcmVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtaW5pbWF0Y2goZnNwYXRoLCBpKSkgaWdub3JlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYGRpci5pZ25vcmUgJHtmc3BhdGh9ICR7aX0gPT4gJHtpZ25vcmV9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChpZ25vcmUpIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBUaGlzIGVuc3VyZXMgd2UgYXJlIG1hdGNoaW5nIG9uIGRpcmVjdG9yeSBib3VuZGFyaWVzXG4gICAgICAgICAgICAvLyBPdGhlcndpc2UgZnNwYXRoIFwiL3BhdGgvdG8vbGF5b3V0cy1leHRyYS9sYXlvdXQubmprXCIgbWlnaHRcbiAgICAgICAgICAgIC8vIG1hdGNoIGRpci5tb3VudGVkIFwiL3BhdGgvdG8vbGF5b3V0c1wiLlxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB2cGF0aEZvckZTUGF0aCAke2Rpci5tb3VudGVkfSAke3R5cGVvZiBkaXIubW91bnRlZH1gLCBkaXIpO1xuICAgICAgICAgICAgY29uc3QgZGlybW91bnRlZCA9XG4gICAgICAgICAgICAgICAgKGRpciAmJiBkaXIubW91bnRlZClcbiAgICAgICAgICAgICAgICAgICAgPyAoZGlyLm1vdW50ZWQuY2hhckF0KGRpci5tb3VudGVkLmxlbmd0aCAtIDEpID09ICcvJylcbiAgICAgICAgICAgICAgICAgICAgICAgID8gZGlyLm1vdW50ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIDogKGRpci5tb3VudGVkICsgJy8nKVxuICAgICAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGlmIChkaXJtb3VudGVkICYmIGZzcGF0aC5pbmRleE9mKGRpcm1vdW50ZWQpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGF0aEluTW91bnRlZCA9IGZzcGF0aC5zdWJzdHJpbmcoZGlyLm1vdW50ZWQubGVuZ3RoKS5zdWJzdHJpbmcoMSk7XG4gICAgICAgICAgICAgICAgY29uc3QgdnBhdGggPSBkaXIubW91bnRQb2ludCA9PT0gJy8nXG4gICAgICAgICAgICAgICAgICAgICAgICA/IHBhdGhJbk1vdW50ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIDogcGF0aC5qb2luKGRpci5tb3VudFBvaW50LCBwYXRoSW5Nb3VudGVkKTtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgdnBhdGhGb3JGU1BhdGggZnNwYXRoICR7ZnNwYXRofSBkaXIubW91bnRQb2ludCAke2Rpci5tb3VudFBvaW50fSBwYXRoSW5Nb3VudGVkICR7cGF0aEluTW91bnRlZH0gdnBhdGggJHt2cGF0aH1gKTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXQgPSA8VlBhdGhEYXRhPntcbiAgICAgICAgICAgICAgICAgICAgZnNwYXRoOiBmc3BhdGgsXG4gICAgICAgICAgICAgICAgICAgIHZwYXRoOiB2cGF0aCxcbiAgICAgICAgICAgICAgICAgICAgbWltZTogbWltZS5nZXRUeXBlKGZzcGF0aCksXG4gICAgICAgICAgICAgICAgICAgIG1vdW50ZWQ6IGRpci5tb3VudGVkLFxuICAgICAgICAgICAgICAgICAgICBtb3VudFBvaW50OiBkaXIubW91bnRQb2ludCxcbiAgICAgICAgICAgICAgICAgICAgcGF0aEluTW91bnRlZFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YShyZXQpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QocmV0KX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBObyBkaXJlY3RvcnkgZm91bmQgZm9yIHRoaXMgZmlsZVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGFzeW5jIHN0YWNrRm9yVlBhdGgodnBhdGg6IHN0cmluZyk6IFByb21pc2U8VlBhdGhEYXRhW10+IHtcbiAgICAgICAgY29uc3QgcmV0OiBWUGF0aERhdGFbXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IGRpciBvZiB0aGlzLmRpcnMpIHtcbiAgICAgICAgICAgIGlmIChkaXIubW91bnRQb2ludCA9PT0gJy8nKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGF0aEluTW91bnRlZCA9IHZwYXRoO1xuICAgICAgICAgICAgICAgIGNvbnN0IGZzcGF0aCA9IHBhdGguam9pbihkaXIubW91bnRlZCwgcGF0aEluTW91bnRlZCk7XG4gICAgICAgICAgICAgICAgbGV0IHN0YXRzO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRzID0gYXdhaXQgZnMuc3RhdChmc3BhdGgpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBzdGF0cyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFzdGF0cykgY29udGludWU7XG4gICAgICAgICAgICAgICAgY29uc3QgdG9wdXNoID0gPFZQYXRoRGF0YT57XG4gICAgICAgICAgICAgICAgICAgIGZzcGF0aDogZnNwYXRoLFxuICAgICAgICAgICAgICAgICAgICB2cGF0aDogdnBhdGgsXG4gICAgICAgICAgICAgICAgICAgIG1pbWU6IG1pbWUuZ2V0VHlwZShmc3BhdGgpLFxuICAgICAgICAgICAgICAgICAgICBtb3VudGVkOiBkaXIubW91bnRlZCxcbiAgICAgICAgICAgICAgICAgICAgbW91bnRQb2ludDogZGlyLm1vdW50UG9pbnQsXG4gICAgICAgICAgICAgICAgICAgIHBhdGhJbk1vdW50ZWQ6IHBhdGhJbk1vdW50ZWRcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEodG9wdXNoKSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgVlBhdGhEYXRhICR7dXRpbC5pbnNwZWN0KHRvcHVzaCl9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldC5wdXNoKHRvcHVzaCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRpcm1vdW50cHQgPVxuICAgICAgICAgICAgICAgICAgICAoZGlyICYmIGRpci5tb3VudFBvaW50KVxuICAgICAgICAgICAgICAgICAgICAgICAgPyAoZGlyLm1vdW50UG9pbnQuY2hhckF0KGRpci5tb3VudFBvaW50Lmxlbmd0aCAtIDEpID09PSAnLycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBkaXIubW91bnRQb2ludFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogKGRpci5tb3VudFBvaW50ICsgJy8nKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHN0YWNrRm9yVlBhdGggdnBhdGggJHt2cGF0aH0gZGlyLm1vdW50ZWQgJHtkaXIubW91bnRQb2ludH0gZGlybW91bnRwdCAke2Rpcm1vdW50cHR9YCk7XG4gICAgICAgICAgICAgICAgaWYgKGRpcm1vdW50cHQgJiYgdnBhdGguaW5kZXhPZihkaXJtb3VudHB0KSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyA+IGNvbnN0IHZwYXRoID0gJ2Zvby9iYXIvYmF6Lmh0bWwnO1xuICAgICAgICAgICAgICAgICAgICAvLyA+IGNvbnN0IG0gPSAnZm9vL2Jhcic7XG4gICAgICAgICAgICAgICAgICAgIC8vID4gbGV0IHBhdGhJbk1vdW50ZWQgPSB2cGF0aC5zdWJzdHJpbmcobS5sZW5ndGggKyAxKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gPiBwYXRoSW5Nb3VudGVkXG4gICAgICAgICAgICAgICAgICAgIC8vICdiYXouaHRtbCdcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGF0aEluTW91bnRlZCA9IHZwYXRoLnN1YnN0cmluZyhkaXJtb3VudHB0Lmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZzcGF0aCA9IHBhdGguam9pbihkaXIubW91bnRlZCwgcGF0aEluTW91bnRlZCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBzdGFja0ZvclZQYXRoIHZwYXRoICR7dnBhdGh9IHBhdGhJbk1vdW50ZWQgJHtwYXRoSW5Nb3VudGVkfSBmc3BhdGggJHtmc3BhdGh9YCk7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzdGF0cztcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzID0gYXdhaXQgZnMuc3RhdChmc3BhdGgpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICghc3RhdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBzdGFja0ZvclZQYXRoIHZwYXRoICR7dnBhdGh9IGRpZCBub3QgZmluZCBmcy5zdGF0cyBmb3IgJHtmc3BhdGh9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0b3B1c2ggPSA8VlBhdGhEYXRhPntcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzcGF0aDogZnNwYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgdnBhdGg6IHZwYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWltZTogbWltZS5nZXRUeXBlKGZzcGF0aCksXG4gICAgICAgICAgICAgICAgICAgICAgICBtb3VudGVkOiBkaXIubW91bnRlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vdW50UG9pbnQ6IGRpci5tb3VudFBvaW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aEluTW91bnRlZDogcGF0aEluTW91bnRlZFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWlzVlBhdGhEYXRhKHRvcHVzaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QodG9wdXNoKX1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXQucHVzaCh0b3B1c2gpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBzdGFja0ZvclZQYXRoIHZwYXRoICR7dnBhdGh9IGRpZCBub3QgbWF0Y2ggJHtkaXJtb3VudHB0fWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyAoa25vY2sgb24gd29vZCkgRXZlcnkgZW50cnkgaW4gYHJldGAgaGFzIGFscmVhZHkgYmVlbiB2ZXJpZmllZFxuICAgICAgICAvLyBhcyBiZWluZyBhIGNvcnJlY3QgVlBhdGhEYXRhIG9iamVjdFxuICAgICAgICByZXR1cm4gcmV0O1xuICAgIH1cblxuICAgIGFzeW5jIGNsb3NlKCkge1xuICAgICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygnY2hhbmdlJyk7XG4gICAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdhZGQnKTtcbiAgICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3VubGluaycpO1xuICAgICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVhZHknKTtcbiAgICAgICAgaWYgKHRoaXMuI3dhdGNoZXIpIHtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBDbG9zaW5nIHdhdGNoZXIgJHt0aGlzLm5hbWV9YCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLiN3YXRjaGVyLmNsb3NlKCk7XG4gICAgICAgICAgICB0aGlzLiN3YXRjaGVyID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgfVxufVxuIl19