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
        return;
    if ('ignore' in dir) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2F0Y2hlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2xpYi93YXRjaGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUNBLE9BQU8sRUFDSCxRQUFRLElBQUksRUFBRSxFQUNkLEtBQUssRUFDUixNQUFNLFNBQVMsQ0FBQztBQUNqQixPQUFPLFFBQXdDLE1BQU0sVUFBVSxDQUFDO0FBRWhFLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFDakMsT0FBTyxhQUFhLE1BQU0sd0JBQXdCLENBQUM7QUFDbkQsT0FBTyxVQUFVLE1BQU0scUJBQXFCLENBQUM7QUFFN0MsTUFBTSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBRWpELE9BQU8sS0FBSyxJQUFJLE1BQU0sV0FBVyxDQUFDO0FBQ2xDLE9BQU8sS0FBSyxJQUFJLE1BQU0sV0FBVyxDQUFDO0FBQ2xDLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDM0MsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUN0QyxPQUFPLEtBQUssS0FBSyxNQUFNLE9BQU8sQ0FBQztBQUkvQixpRUFBaUU7QUFDakUsaUVBQWlFO0FBQ2pFLDJEQUEyRDtBQUMzRCxFQUFFO0FBQ0Ysb0RBQW9EO0FBQ3BELHlDQUF5QztBQUN6Qyw4REFBOEQ7QUFDOUQsMERBQTBEO0FBQzFELEVBQUU7QUFDRixzRUFBc0U7QUFDdEUsbURBQW1EO0FBRW5ELE1BQU0sVUFBVSxVQUFVLENBQUMsT0FBTyxFQUFFLEtBQWdCO0lBQ2hELElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ2hDLENBQUM7QUFnREQ7Ozs7O0dBS0c7QUFDSCxNQUFNLENBQUMsTUFBTSxXQUFXLEdBQUcsQ0FBQyxNQUFNLEVBQXVCLEVBQUU7SUFDdkQsSUFBSSxPQUFPLE1BQU0sS0FBSyxX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UUFDRCxpRUFBaUU7UUFDakUsc0NBQXNDO1FBQ3RDLE9BQU8sR0FBRyxDQUFDO0lBQ2YsQ0FBQztJQUVELEtBQUssQ0FBQyxLQUFLO1FBQ1AsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ2xDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMvQixJQUFJLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDbEMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2pDLElBQUksdUJBQUEsSUFBSSw0QkFBUyxFQUFFLENBQUM7WUFDaEIsK0NBQStDO1lBQy9DLE1BQU0sdUJBQUEsSUFBSSw0QkFBUyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQzVCLHVCQUFBLElBQUksd0JBQVksU0FBUyxNQUFBLENBQUM7UUFDOUIsQ0FBQztJQUNMLENBQUM7Q0FDSiIsInNvdXJjZXNDb250ZW50IjpbIlxuaW1wb3J0IHtcbiAgICBwcm9taXNlcyBhcyBmcyxcbiAgICBTdGF0c1xufSBmcm9tICdub2RlOmZzJztcbmltcG9ydCBjaG9raWRhciwgeyBGU1dhdGNoZXIsIENob2tpZGFyT3B0aW9ucyB9IGZyb20gJ2Nob2tpZGFyJztcblxuaW1wb3J0IHsgTWltZSB9IGZyb20gJ21pbWUvbGl0ZSc7XG5pbXBvcnQgc3RhbmRhcmRUeXBlcyBmcm9tICdtaW1lL3R5cGVzL3N0YW5kYXJkLmpzJztcbmltcG9ydCBvdGhlclR5cGVzIGZyb20gJ21pbWUvdHlwZXMvb3RoZXIuanMnO1xuXG5jb25zdCBtaW1lID0gbmV3IE1pbWUoc3RhbmRhcmRUeXBlcywgb3RoZXJUeXBlcyk7XG5cbmltcG9ydCAqIGFzIHV0aWwgZnJvbSAnbm9kZTp1dGlsJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ25vZGU6ZXZlbnRzJztcbmltcG9ydCB7IG1pbmltYXRjaCB9IGZyb20gJ21pbmltYXRjaCc7XG5pbXBvcnQgKiBhcyBmYXN0cSBmcm9tICdmYXN0cSc7XG5pbXBvcnQgdHlwZSB7IHF1ZXVlQXNQcm9taXNlZCB9IGZyb20gXCJmYXN0cVwiO1xuXG5cbi8vIE5PVEUgV2Ugc2hvdWxkIG5vdCBkbyB0aGlzIGhlcmUuICBJdCBoYWQgYmVlbiBjb3BpZWQgb3ZlciBmcm9tXG4vLyBBa2FzaGFSZW5kZXIsIGJ1dCB0aGlzIGlzIGR1cGxpY2F0aXZlLCBhbmQgaXQncyBwb3NzaWJsZSB0aGVyZVxuLy8gd2lsbCBiZSBvdGhlciB1c2VycyBvZiBEaXJzV2F0Y2hlciB3aG8gZG8gbm90IHdhbnQgdGhpcy5cbi8vXG4vLyBUaGVyZSBkb2Vzbid0IHNlZW0gdG8gYmUgYW4gb2ZmaWNpYWwgcmVnaXN0cmF0aW9uXG4vLyBwZXI6IGh0dHBzOi8vYXNjaWlkb2N0b3Iub3JnL2RvY3MvZmFxL1xuLy8gcGVyOiBodHRwczovL2dpdGh1Yi5jb20vYXNjaWlkb2N0b3IvYXNjaWlkb2N0b3IvaXNzdWVzLzI1MDJcbi8vIG1pbWUuZGVmaW5lKHsndGV4dC94LWFzY2lpZG9jJzogWydhZG9jJywgJ2FzY2lpZG9jJ119KTtcbi8vXG4vLyBJbnN0ZWFkIG9mIGRlZmluaW5nIE1JTUUgdHlwZXMgaGVyZSwgd2UgYWRkZWQgYSBtZXRob2QgXCJtaW1lZGVmaW5lXCJcbi8vIHRvIGFsbG93IERpcnNXYXRjaGVyIHVzZXJzIHRvIGRlZmluZSBNSU1FIHR5cGVzLlxuXG5leHBvcnQgZnVuY3Rpb24gbWltZWRlZmluZShtYXBwaW5nLCBmb3JjZSA/OiBib29sZWFuKSB7XG4gICAgbWltZS5kZWZpbmUobWFwcGluZywgZm9yY2UpO1xufVxuXG5cbmV4cG9ydCB0eXBlIFZQYXRoRGF0YSA9IHtcblxuICAgIC8qKlxuICAgICAqIFRoZSBmdWxsIGZpbGUtc3lzdGVtIHBhdGggZm9yIHRoZSBmaWxlLlxuICAgICAqIGUuZy4gL2hvbWUvcGF0aC90by9hcnRpY2xlLW5hbWUuaHRtbC5tZFxuICAgICAqL1xuICAgIGZzcGF0aDogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHZpcnR1YWwgcGF0aCwgcm9vdGVkIGF0IHRoZSB0b3BcbiAgICAgKiBkaXJlY3Rvcnkgb2YgdGhlIGZpbGVzeXN0ZW0sIHdpdGggbm9cbiAgICAgKiBsZWFkaW5nIHNsYXNoLlxuICAgICAqL1xuICAgIHZwYXRoOiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWltZSB0eXBlIG9mIHRoZSBmaWxlLiAgVGhlIG1pbWUgdHlwZXNcbiAgICAgKiBhcmUgZGV0ZXJtaW5lZCBmcm9tIHRoZSBmaWxlIGV4dGVuc2lvblxuICAgICAqIHVzaW5nIHRoZSAnbWltZScgcGFja2FnZS5cbiAgICAgKi9cbiAgICBtaW1lID86IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIFRoZSBmaWxlLXN5c3RlbSBwYXRoIHdoaWNoIGlzIG1vdW50ZWRcbiAgICAgKiBpbnRvIHRoZSB2aXJ0dWFsIGZpbGUgc3BhY2UuXG4gICAgICovXG4gICAgbW91bnRlZDogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHZpcnR1YWwgZGlyZWN0b3J5IG9mIHRoZSBtb3VudFxuICAgICAqIGVudHJ5IGluIHRoZSBkaXJlY3Rvcnkgc3RhY2suXG4gICAgICovXG4gICAgbW91bnRQb2ludDogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHJlbGF0aXZlIHBhdGggdW5kZXJuZWF0aCB0aGUgbW91bnRQb2ludC5cbiAgICAgKi9cbiAgICBwYXRoSW5Nb3VudGVkOiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZmlsZS1zeXN0ZW0gc3RhY2sgcmVsYXRlZCB0byB0aGUgZmlsZS5cbiAgICAgKi9cbiAgICBzdGFjayA/OiBWUGF0aERhdGFbXTtcbn1cblxuLyoqXG4gKiBUeXBlZ3VhcmQgZnVuY3Rpb24gZW5zdXJpbmcgdGhhdCBhbiBvYmplY3RcbiAqIGlzIGEgVlBhdGhEYXRhIG9iamVjdC5cbiAqIEBwYXJhbSB2cGluZm8gVGhlIG9iamVjdCB0byBjaGVja1xuICogQHJldHVybnMgdHJ1ZSBpZiBpdCBpcyBhIFZQYXRoRGF0YSwgZmFsc2Ugb3RoZXJ3aXNlXG4gKi9cbmV4cG9ydCBjb25zdCBpc1ZQYXRoRGF0YSA9ICh2cGluZm8pOiB2cGluZm8gaXMgVlBhdGhEYXRhID0+IHtcbiAgICBpZiAodHlwZW9mIHZwaW5mbyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodHlwZW9mIHZwaW5mbyAhPT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodHlwZW9mIHZwaW5mby5taW1lICE9PSAndW5kZWZpbmVkJ1xuICAgICAmJiB2cGluZm8ubWltZSAhPT0gbnVsbFxuICAgICAmJiB0eXBlb2YgdnBpbmZvLm1pbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB2cGluZm8uZnNwYXRoICE9PSAnc3RyaW5nJ1xuICAgICB8fCB0eXBlb2YgdnBpbmZvLnZwYXRoICE9PSAnc3RyaW5nJ1xuICAgICB8fCB0eXBlb2YgdnBpbmZvLm1vdW50ZWQgIT09ICdzdHJpbmcnXG4gICAgIHx8IHR5cGVvZiB2cGluZm8ubW91bnRQb2ludCAhPT0gJ3N0cmluZydcbiAgICAgfHwgdHlwZW9mIHZwaW5mby5wYXRoSW5Nb3VudGVkICE9PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgdnBpbmZvLnN0YWNrID09PSAndW5kZWZpbmVkJykgcmV0dXJuIHRydWU7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodnBpbmZvLnN0YWNrKSkge1xuICAgICAgICBmb3IgKGNvbnN0IGluZiBvZiB2cGluZm8uc3RhY2spIHtcbiAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEoaW5mKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufTtcblxudHlwZSBxdWV1ZUV2ZW50ID0ge1xuICAgIGNvZGU6IHN0cmluZztcbiAgICBmcGF0aD86IHN0cmluZztcbiAgICBzdGF0cz86IFN0YXRzO1xufTtcblxuY29uc3QgaXNRdWV1ZUV2ZW50ID0gKGV2ZW50KTogZXZlbnQgaXMgcXVldWVFdmVudCA9PiB7XG4gICAgaWYgKHR5cGVvZiBldmVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodHlwZW9mIGV2ZW50ICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuXG4gICAgaWYgKHR5cGVvZiBldmVudC5jb2RlID09PSAnc3RyaW5nJ1xuICAgICAmJiB0eXBlb2YgZXZlbnQuZnBhdGggPT09ICdzdHJpbmcnXG4gICAgICYmIChldmVudC5zdGF0cyBpbnN0YW5jZW9mIFN0YXRzKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBldmVudC5jb2RlID09PSAnc3RyaW5nJ1xuICAgICAmJiBldmVudC5jb2RlID09PSAncmVhZHknKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGV2ZW50LmNvZGUgPT09ICdzdHJpbmcnXG4gICAgICYmIGV2ZW50LmNvZGUgPT09ICd1bmxpbmsnXG4gICAgICYmIHR5cGVvZiBldmVudC5mcGF0aCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuZXhwb3J0IHR5cGUgZGlyVG9XYXRjaCA9IHtcbiAgICAvKipcbiAgICAgKiBUaGUgZmlsZXN5c3RlbSBwYXRoIHRvIFwibW91bnRcIi5cbiAgICAgKi9cbiAgICBtb3VudGVkOiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcGF0aCB3aXRoaW4gdGhlIHZpcnR1YWwgZmlsZXN5c3RlbSB3aGVyZSB0aGlzIHdpbGwgYXBwZWFyLlxuICAgICAqL1xuICAgIG1vdW50UG9pbnQ6IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIE9wdGlvbmFsIGFycmF5IG9mIHN0cmluZ3MgY29udGFpbmluZyBnbG9icyBmb3IgbWF0Y2hpbmdcbiAgICAgKiBmaWxlcyB0byBpZ25vcmUuXG4gICAgICovXG4gICAgaWdub3JlPzogc3RyaW5nW107XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIHdoZXRoZXIgdGhlIHtAY29kZSBkaXJ9IGlzIGEge0Bjb2RlIGRpclRvV2F0Y2h9LlxuICovXG5leHBvcnQgY29uc3QgaXNEaXJUb1dhdGNoID0gKGRpcjogYW55KTogZGlyIGlzIGRpclRvV2F0Y2ggPT4ge1xuICAgIGlmICh0eXBlb2YgZGlyID09PSAndW5kZWZpbmVkJykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2YgZGlyICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuXG4gICAgaWYgKCdtb3VudGVkJyBpbiBkaXIgJiYgdHlwZW9mIGRpci5tb3VudGVkICE9PSAnc3RyaW5nJykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICgnbW91bnRQb2ludCcgaW4gZGlyICYmIHR5cGVvZiBkaXIubW91bnRQb2ludCAhPT0gJ3N0cmluZycpIHJldHVybjtcbiAgICBpZiAoJ2lnbm9yZScgaW4gZGlyKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgIHR5cGVvZiBkaXIuaWdub3JlICE9PSAnc3RyaW5nJ1xuICAgICAgICAgJiYgIUFycmF5LmlzQXJyYXkoZGlyLmlnbm9yZSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgdHlwZW9mIGRpci5pZ25vcmUgPT09ICdzdHJpbmcnXG4gICAgICAgICAmJiBBcnJheS5pc0FycmF5KGRpci5pZ25vcmUpXG4gICAgICAgICkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG59XG5cbi8vIGNvbnN0IF9zeW1iX2RpcnMgPSBTeW1ib2woJ2RpcnMnKTtcbi8vIGNvbnN0IF9zeW1iX3dhdGNoZXIgPSBTeW1ib2woJ3dhdGNoZXInKTtcbi8vIGNvbnN0IF9zeW1iX25hbWUgPSBTeW1ib2woJ25hbWUnKTtcbi8vIGNvbnN0IF9zeW1iX29wdGlvbnMgPSBTeW1ib2woJ29wdGlvbnMnKTtcbi8vIGNvbnN0IF9zeW1iX2N3ZCA9IFN5bWJvbCgnYmFzZWRpcicpO1xuLy8gY29uc3QgX3N5bWJfcXVldWUgPSBTeW1ib2woJ3F1ZXVlJyk7XG5cbmV4cG9ydCBjbGFzcyBEaXJzV2F0Y2hlciBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG5cbiAgICAjZGlyczogZGlyVG9XYXRjaFtdO1xuICAgICN3YXRjaGVyPzogRlNXYXRjaGVyO1xuICAgICNuYW1lOiBzdHJpbmc7XG4gICAgI29wdGlvbnM6IENob2tpZGFyT3B0aW9ucztcbiAgICAjYmFzZWRpcjtcbiAgICAjcXVldWU7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0gbmFtZSBzdHJpbmcgZ2l2aW5nIHRoZSBuYW1lIGZvciB0aGlzIHdhdGNoZXJcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyICR7bmFtZX0gY29uc3RydWN0b3JgKTtcbiAgICAgICAgdGhpcy4jbmFtZSA9IG5hbWU7XG4gICAgICAgIC8vIFRPRE8gaXMgdGhlcmUgYSBuZWVkIHRvIG1ha2UgdGhpcyBjdXN0b21pemFibGU/XG4gICAgICAgIHRoaXMuI29wdGlvbnMgPSB7XG4gICAgICAgICAgICBwZXJzaXN0ZW50OiB0cnVlLCBpZ25vcmVJbml0aWFsOiBmYWxzZSwgYXdhaXRXcml0ZUZpbmlzaDogdHJ1ZSwgYWx3YXlzU3RhdDogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLiNiYXNlZGlyID0gdW5kZWZpbmVkO1xuICAgICAgICBjb25zdCB0aGF0ID0gdGhpcztcbiAgICAgICAgY29uc3QgcTogcXVldWVBc1Byb21pc2VkPHF1ZXVlRXZlbnQ+ID0gZmFzdHEucHJvbWlzZShcbiAgICAgICAgICAgIGFzeW5jIGZ1bmN0aW9uKGV2ZW50OiBxdWV1ZUV2ZW50KSB7XG4gICAgICAgICAgICAgICAgaWYgKCFpc1F1ZXVlRXZlbnQoZXZlbnQpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSU5URVJOQUwgRVJST1Igbm90IGEgcXVldWVFdmVudCAke3V0aWwuaW5zcGVjdChldmVudCl9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChldmVudC5jb2RlID09PSAnY2hhbmdlJykge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGF0Lm9uQ2hhbmdlKGV2ZW50LmZwYXRoIC8qLCBldmVudC5zdGF0cyAqLyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC5jb2RlID09PSAnYWRkJykge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGF0Lm9uQWRkKGV2ZW50LmZwYXRoIC8qLCBldmVudC5zdGF0cyAqLyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC5jb2RlID09PSAndW5saW5rJykge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGF0Lm9uVW5saW5rKGV2ZW50LmZwYXRoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LmNvZGUgPT09ICdyZWFkeScpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhhdC5vblJlYWR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgMSk7XG4gICAgICAgIHRoaXMuI3F1ZXVlID0gcTtcbiAgICAgICAgdGhpcy4jcXVldWUuZXJyb3IoZnVuY3Rpb24oZXJyLCB0YXNrKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgRGlyc1dhdGNoZXIgJHtuYW1lfSAke3Rhc2suY29kZX0gJHt0YXNrLmZwYXRofSBjYXVnaHQgZXJyb3IgJHtlcnJ9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyB0aGUgZGlyZWN0b3J5IHN0YWNrIGZvclxuICAgICAqIHRoaXMgV2F0Y2hlci5cbiAgICAgKi9cbiAgICBnZXQgZGlycygpOiBkaXJUb1dhdGNoW10gfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy4jZGlyczsgfVxuXG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIHRoZSBuYW1lIGZvciB0aGlzIFdhdGNoZXJcbiAgICAgKi9cbiAgICBnZXQgbmFtZSgpIHsgcmV0dXJuIHRoaXMuI25hbWU7IH1cblxuICAgIC8qKlxuICAgICAqIENoYW5nZXMgdGhlIHVzZSBvZiBhYnNvbHV0ZSBwYXRobmFtZXMsIHRvIHBhdGhzIHJlbGF0dmUgdG8gdGhlIGdpdmVuIGRpcmVjdG9yeS5cbiAgICAgKiBUaGlzIG11c3QgYmUgY2FsbGVkIGJlZm9yZSB0aGUgPGVtPndhdGNoPC9lbT4gbWV0aG9kIGlzIGNhbGxlZC4gIFRoZSBwYXRoc1xuICAgICAqIHlvdSBzcGVjaWZ5IHRvIHdhdGNoIG11c3QgYmUgcmVsYXRpdmUgdG8gdGhlIGdpdmVuIGRpcmVjdG9yeS5cbiAgICAgKi9cbiAgICBzZXQgYmFzZWRpcihjd2QpIHsgdGhpcy4jYmFzZWRpciA9IGN3ZDsgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyB0aGUgQ2hva2lkYXIgd2F0Y2hlciwgYmFzZWMgb24gdGhlIGRpcmVjdG9yaWVzIHRvIHdhdGNoLiAgVGhlIDxlbT5kaXJzcGVjPC9lbT4gb3B0aW9uIGNhbiBiZSBhIHN0cmluZyxcbiAgICAgKiBvciBhbiBvYmplY3QuICBJZiBpdCBpcyBhIHN0cmluZywgaXQgaXMgYSBmaWxlc3lzdGVtIHBhdGhuYW1lIHRoYXQgd2lsbCBiZVxuICAgICAqIGFzc29jaWF0ZWQgd2l0aCB0aGUgcm9vdCBvZiB0aGUgdmlydHVhbCBmaWxlc3lzdGVtLiAgQW4gb2JqZWN0IHdpbGwgbG9va1xuICAgICAqIGxpa2UgdGhpczpcbiAgICAgKiBcbiAgICAgKiA8Y29kZT5cbiAgICAgKiB7XG4gICAgICogICBtb3VudGVkOiAnL3BhdGgvdG8vbW91bnRlZCcsXG4gICAgICogICBtb3VudFBvaW50OiAnbW91bnRlZCdcbiAgICAgKiB9XG4gICAgICogPC9jb2RlPlxuICAgICAqIFxuICAgICAqIFRoZSA8dHQ+bW91bnRQb2ludDwvdHQ+IGZpZWxkIGlzIGEgZnVsbCBwYXRoIHRvIHRoZSBkaXJlY3Rvcnkgb2YgaW50ZXJlc3QuICBUaGVcbiAgICAgKiA8dHQ+bW91bnRQb2ludDwvdHQ+IGZpZWxkIGRlc2NyaWJlcyBhIHByZWZpeCB3aXRoaW4gdGhlIHZpcnR1YWwgZmlsZXN5c3RlbS5cbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gZGlyc3BlYyBcbiAgICAgKi9cbiAgICBhc3luYyB3YXRjaChkaXJzOiBkaXJUb1dhdGNoW10gfCBzdHJpbmcpIHtcbiAgICAgICAgaWYgKHRoaXMuI3dhdGNoZXIpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgV2F0Y2hlciBhbHJlYWR5IHN0YXJ0ZWQgZm9yICR7dGhpcy4jd2F0Y2hlcn1gKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIGRpcnMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBkaXJzID0gWyB7XG4gICAgICAgICAgICAgICAgbW91bnRlZDogZGlycywgbW91bnRQb2ludDogJy8nXG4gICAgICAgICAgICB9IF07XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGRpcnMgPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KGRpcnMpKSB7XG4gICAgICAgICAgICBpZiAoIWlzRGlyVG9XYXRjaChkaXJzKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2F0Y2ggLSBkaXJlY3Rvcnkgc3BlYyBub3QgYSBkaXJUb1dhdGNoIC0gJHt1dGlsLmluc3BlY3QoZGlycyl9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkaXJzID0gWyBkaXJzIF07XG4gICAgICAgIH0gZWxzZSBpZiAoIUFycmF5LmlzQXJyYXkoZGlycykpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2F0Y2ggLSB0aGUgZGlycyBhcmd1bWVudCBpcyBpbmNvcnJlY3QgJHt1dGlsLmluc3BlY3QoZGlycyl9YCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gY29uc29sZS5sb2coYHdhdGNoIGRpcnM9YCwgZGlycyk7XG4gICAgICAgIGNvbnN0IHRvd2F0Y2ggPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCBkaXIgb2YgZGlycykge1xuICAgICAgICAgICAgaWYgKCFpc0RpclRvV2F0Y2goZGlyKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2F0Y2ggZGlyZWN0b3J5IHNwZWMgaW4gZGlycyBub3QgYSBkaXJUb1dhdGNoIC0gJHt1dGlsLmluc3BlY3QoZGlyKX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgZnMuc3RhdChkaXIubW91bnRlZCk7XG4gICAgICAgICAgICBpZiAoIXN0YXRzLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHdhdGNoIC0gbm9uLWRpcmVjdG9yeSBzcGVjaWZpZWQgaW4gJHt1dGlsLmluc3BlY3QoZGlyKX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRvd2F0Y2gucHVzaChkaXIubW91bnRlZCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy4jZGlycyA9IGRpcnM7XG5cbiAgICAgICAgaWYgKHRoaXMuI2Jhc2VkaXIpIHtcbiAgICAgICAgICAgIHRoaXMuI29wdGlvbnMuY3dkID0gdGhpcy4jYmFzZWRpcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuI29wdGlvbnMuY3dkID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy4jd2F0Y2hlciA9IGNob2tpZGFyLndhdGNoKHRvd2F0Y2gsIHRoaXMuI29wdGlvbnMpO1xuXG4gICAgICAgIC8vIEluIHRoZSBldmVudCBoYW5kbGVycywgd2UgY3JlYXRlIHRoZSBGaWxlSW5mbyBvYmplY3QgbWF0Y2hpbmdcbiAgICAgICAgLy8gdGhlIHBhdGguICBUaGUgRmlsZUluZm8gaXMgbWF0Y2hlZCB0byBhIF9zeW1iX2RpcnMgZW50cnkuXG4gICAgICAgIC8vIElmIHRoZSBfc3ltYl9kaXJzIGVudHJ5IGhhcyA8ZW0+aWdub3JlPC9lbT4gb3IgPGVtPmluY2x1ZGU8L2VtPlxuICAgICAgICAvLyBmaWVsZHMsIHRoZSBwYXR0ZXJucyBpbiB0aG9zZSBmaWVsZHMgYXJlIHVzZWQgdG8gZGV0ZXJtaW5lIHdoZXRoZXJcbiAgICAgICAgLy8gdG8gaW5jbHVkZSBvciBpZ25vcmUgdGhpcyBmaWxlLiAgSWYgd2UgYXJlIHRvIGlnbm9yZSBpdCwgdGhlblxuICAgICAgICAvLyBmaWxlSW5mbyByZXR1cm5zIHVuZGVmaW5lZC4gIEhlbmNlLCBpbiBlYWNoIGNhc2Ugd2UgdGVzdCB3aGV0aGVyXG4gICAgICAgIC8vIDxlbT5pbmZvPC9lbT4gaGFzIGEgdmFsdWUgYmVmb3JlIGVtaXR0aW5nIHRoZSBldmVudC5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gQWxsIHRoaXMgZnVuY3Rpb24gZG9lcyBpcyB0byByZWNlaXZlIGV2ZW50cyBmcm9tIENob2tpZGFyLFxuICAgICAgICAvLyBjb25zdHJ1Y3QgRmlsZUluZm8gb2JqZWN0cywgYW5kIGVtaXQgbWF0Y2hpbmcgZXZlbnRzLlxuXG4gICAgICAgIC8vIGNvbnN0IHdhdGNoZXJfbmFtZSA9IHRoaXMubmFtZTtcblxuICAgICAgICB0aGlzLiN3YXRjaGVyXG4gICAgICAgICAgICAub24oJ2NoYW5nZScsIGFzeW5jIChmcGF0aCwgc3RhdHMpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLiNxdWV1ZS5wdXNoKDxxdWV1ZUV2ZW50PntcbiAgICAgICAgICAgICAgICAgICAgY29kZTogJ2NoYW5nZScsIGZwYXRoLCBzdGF0c1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB3YXRjaGVyICR7d2F0Y2hlcl9uYW1lfSBjaGFuZ2UgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAub24oJ2FkZCcsIGFzeW5jIChmcGF0aCwgc3RhdHMpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLiNxdWV1ZS5wdXNoKDxxdWV1ZUV2ZW50PntcbiAgICAgICAgICAgICAgICAgICAgY29kZTogJ2FkZCcsIGZwYXRoLCBzdGF0c1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB3YXRjaGVyICR7d2F0Y2hlcl9uYW1lfSBhZGQgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAvKiAub24oJ2FkZERpcicsIGFzeW5jIChmcGF0aCwgc3RhdHMpID0+IHsgXG4gICAgICAgICAgICAgICAgLy8gPz8gbGV0IGluZm8gPSB0aGlzLmZpbGVJbmZvKGZwYXRoLCBzdGF0cyk7XG4gICAgICAgICAgICAgICAgLy8gPz8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIGFkZERpcmAsIGluZm8pO1xuICAgICAgICAgICAgICAgIC8vID8/IHRoaXMuZW1pdCgnYWRkRGlyJywgaW5mbyk7XG4gICAgICAgICAgICB9KSAqL1xuICAgICAgICAgICAgLm9uKCd1bmxpbmsnLCBhc3luYyBmcGF0aCA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy4jcXVldWUucHVzaCg8cXVldWVFdmVudD57XG4gICAgICAgICAgICAgICAgICAgIGNvZGU6ICd1bmxpbmsnLCBmcGF0aFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB3YXRjaGVyICR7d2F0Y2hlcl9uYW1lfSB1bmxpbmsgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAvKiAub24oJ3VubGlua0RpcicsIGFzeW5jIGZwYXRoID0+IHsgXG4gICAgICAgICAgICAgICAgLy8gPz8gbGV0IGluZm8gPSB0aGlzLmZpbGVJbmZvKGZwYXRoLCBzdGF0cyk7XG4gICAgICAgICAgICAgICAgLy8gPz8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIHVubGlua0RpciAke2ZwYXRofWApO1xuICAgICAgICAgICAgICAgIC8vID8/IHRoaXMuZW1pdCgndW5saW5rRGlyJywgaW5mbyk7XG4gICAgICAgICAgICB9KSAqL1xuICAgICAgICAgICAgLm9uKCdyZWFkeScsICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLiNxdWV1ZS5wdXNoKDxxdWV1ZUV2ZW50PntcbiAgICAgICAgICAgICAgICAgICAgY29kZTogJ3JlYWR5J1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB3YXRjaGVyICR7d2F0Y2hlcl9uYW1lfSByZWFkeWApO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gdGhpcy5pc1JlYWR5ID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAvLyAgICAgdGhpc1tfc3ltYl93YXRjaGVyXS5vbigncmVhZHknLCAoKSA9PiB7IHJlc29sdmUodHJ1ZSk7IH0pO1xuICAgICAgICAvLyB9KTtcbiAgICAgICAgLy8gY29uc29sZS5sb2codGhpcy5pc1JlYWR5KTtcbiAgICB9XG5cbiAgICAvKiBDYWxjdWxhdGUgdGhlIHN0YWNrIGZvciBhIGZpbGVzeXN0ZW0gcGF0aFxuXG4gICAgT25seSBlbWl0IGlmIHRoZSBjaGFuZ2Ugd2FzIHRvIHRoZSBmcm9udC1tb3N0IGZpbGUgKi8gXG4gICAgYXN5bmMgb25DaGFuZ2UoZnBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCB2cGluZm8gPSB0aGlzLnZwYXRoRm9yRlNQYXRoKGZwYXRoKTtcbiAgICAgICAgaWYgKCF2cGluZm8pIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBvbkNoYW5nZSBjb3VsZCBub3QgZmluZCBtb3VudCBwb2ludCBvciB2cGF0aCBmb3IgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzdGFjazogVlBhdGhEYXRhW10gPSBhd2FpdCB0aGlzLnN0YWNrRm9yVlBhdGgodnBpbmZvLnZwYXRoKTtcbiAgICAgICAgaWYgKHN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBvbkNoYW5nZSBjb3VsZCBub3QgZmluZCBtb3VudCBwb2ludHMgZm9yICR7ZnBhdGh9YCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGkgPSAwO1xuICAgICAgICBsZXQgZGVwdGg7XG4gICAgICAgIGxldCBlbnRyeTtcbiAgICAgICAgZm9yIChjb25zdCBzIG9mIHN0YWNrKSB7XG4gICAgICAgICAgICBpZiAocy5mc3BhdGggPT09IGZwYXRoKSB7XG4gICAgICAgICAgICAgICAgZW50cnkgPSBzO1xuICAgICAgICAgICAgICAgIGRlcHRoID0gaTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWVudHJ5KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYG9uQ2hhbmdlIG5vIHN0YWNrIGVudHJ5IGZvciAke2ZwYXRofSAoJHt2cGluZm8udnBhdGh9KWApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChkZXB0aCA9PT0gMCkge1xuICAgICAgICAgICAgdnBpbmZvLnN0YWNrID0gc3RhY2s7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgY2hhbmdlICR7ZnBhdGh9YCk7XG4gICAgICAgICAgICBpZiAoIWlzVlBhdGhEYXRhKHZwaW5mbykpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgVlBhdGhEYXRhICR7dXRpbC5pbnNwZWN0KHZwaW5mbyl9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2NoYW5nZScsIHRoaXMubmFtZSwgdnBpbmZvKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBsZXQgaW5mbyA9IHRoaXMuZmlsZUluZm8oZnBhdGgsIHN0YXRzKTtcbiAgICAgICAgLy8gaWYgKGluZm8pIHRoaXMuZW1pdCgnY2hhbmdlJywgdGhpcy5uYW1lLCBpbmZvKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIGNoYW5nZSAke2ZwYXRofWAsIGluZm8pO1xuICAgIH1cblxuICAgIC8vIE9ubHkgZW1pdCBpZiB0aGUgYWRkIHdhcyB0aGUgZnJvbnQtbW9zdCBmaWxlXG4gICAgYXN5bmMgb25BZGQoZnBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCB2cGluZm8gPSB0aGlzLnZwYXRoRm9yRlNQYXRoKGZwYXRoKTtcbiAgICAgICAgaWYgKCF2cGluZm8pIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBvbkFkZCBjb3VsZCBub3QgZmluZCBtb3VudCBwb2ludCBvciB2cGF0aCBmb3IgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvLyBjb25zb2xlLmxvZyhgb25BZGQgJHtmcGF0aH1gLCB2cGluZm8pO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhgb25BZGQgJHtmcGF0aH0gJHt2cGluZm8udnBhdGh9YCk7XG4gICAgICAgIGNvbnN0IHN0YWNrOiBWUGF0aERhdGFbXSA9IGF3YWl0IHRoaXMuc3RhY2tGb3JWUGF0aCh2cGluZm8udnBhdGgpO1xuICAgICAgICBpZiAoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYG9uQWRkIGNvdWxkIG5vdCBmaW5kIG1vdW50IHBvaW50cyBmb3IgJHtmcGF0aH1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBjb25zb2xlLmxvZyhgb25BZGQgJHtmcGF0aH1gLCBzdGFjayk7XG4gICAgICAgIGxldCBpID0gMDtcbiAgICAgICAgbGV0IGRlcHRoO1xuICAgICAgICBsZXQgZW50cnk7XG4gICAgICAgIGZvciAoY29uc3QgcyBvZiBzdGFjaykge1xuICAgICAgICAgICAgaWYgKHMuZnNwYXRoID09PSBmcGF0aCkge1xuICAgICAgICAgICAgICAgIGVudHJ5ID0gcztcbiAgICAgICAgICAgICAgICBkZXB0aCA9IGk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpKys7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFlbnRyeSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBvbkFkZCBubyBzdGFjayBlbnRyeSBmb3IgJHtmcGF0aH0gKCR7dnBpbmZvLnZwYXRofSlgKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBjb25zb2xlLmxvZyhgb25BZGQgJHtmcGF0aH0gZGVwdGg9JHtkZXB0aH1gLCBlbnRyeSk7XG4gICAgICAgIGlmIChkZXB0aCA9PT0gMCkge1xuICAgICAgICAgICAgdnBpbmZvLnN0YWNrID0gc3RhY2s7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgb25BZGQgRU1JVCBhZGQgJHt2cGluZm8udnBhdGh9YCk7XG4gICAgICAgICAgICAvLyBmb3IgKGxldCBzIG9mIHN0YWNrKSB7XG4gICAgICAgICAgICAvLyAgICBjb25zb2xlLmxvZyhgLi4uLiAke3MudnBhdGh9ID09PiAke3MuZnNwYXRofWApO1xuICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YSh2cGluZm8pKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFZQYXRoRGF0YSAke3V0aWwuaW5zcGVjdCh2cGluZm8pfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5lbWl0KCdhZGQnLCB0aGlzLm5hbWUsIHZwaW5mbyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgb25BZGQgU0tJUFBFRCBlbWl0IGV2ZW50IGZvciAke2ZwYXRofWApO1xuICAgICAgICB9XG4gICAgICAgIC8vIGxldCBpbmZvID0gdGhpcy5maWxlSW5mbyhmcGF0aCwgc3RhdHMpO1xuICAgICAgICAvLyBpZiAoaW5mbykgdGhpcy5lbWl0KCdhZGQnLCB0aGlzLm5hbWUsIGluZm8pO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgYWRkYCwgaW5mbyk7XG4gICAgICAgIFxuICAgIH1cblxuICAgIC8qIE9ubHkgZW1pdCBpZiBpdCB3YXMgdGhlIGZyb250LW1vc3QgZmlsZSBkZWxldGVkXG4gICAgSWYgdGhlcmUgaXMgYSBmaWxlIHVuY292ZXJlZCBieSB0aGlzLCB0aGVuIGVtaXQgYW4gYWRkIGV2ZW50IGZvciB0aGF0ICovXG4gICAgYXN5bmMgb25VbmxpbmsoZnBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCB2cGluZm8gPSB0aGlzLnZwYXRoRm9yRlNQYXRoKGZwYXRoKTtcbiAgICAgICAgaWYgKCF2cGluZm8pIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBvblVubGluayBjb3VsZCBub3QgZmluZCBtb3VudCBwb2ludCBvciB2cGF0aCBmb3IgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzdGFjazogVlBhdGhEYXRhW10gPSBhd2FpdCB0aGlzLnN0YWNrRm9yVlBhdGgodnBpbmZvLnZwYXRoKTtcbiAgICAgICAgaWYgKHN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgLyogSWYgbm8gZmlsZXMgcmVtYWluIGluIHRoZSBzdGFjayBmb3IgdGhpcyB2aXJ0dWFsIHBhdGgsIHRoZW5cbiAgICAgICAgICAgICAqIHdlIG11c3QgZGVjbGFyZSBpdCB1bmxpbmtlZC5cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YSh2cGluZm8pKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFZQYXRoRGF0YSAke3V0aWwuaW5zcGVjdCh2cGluZm8pfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5lbWl0KCd1bmxpbmsnLCB0aGlzLm5hbWUsIHZwaW5mbyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvKiBPbiB0aGUgb3RoZXIgaGFuZCwgaWYgdGhlcmUgaXMgYW4gZW50cnkgd2Ugc2hvdWxkbid0IHNlbmRcbiAgICAgICAgICAgICAqIGFuIHVubGluayBldmVudC4gIEluc3RlYWQgaXQgc2VlbXMgbW9zdCBhcHByb3ByaWF0ZSB0byBzZW5kXG4gICAgICAgICAgICAgKiBhIGNoYW5nZSBldmVudC5cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgY29uc3Qgc2ZpcnN0ID0gc3RhY2tbMF07XG4gICAgICAgICAgICBjb25zdCB0b2VtaXQgPSA8VlBhdGhEYXRhPntcbiAgICAgICAgICAgICAgICBmc3BhdGg6IHNmaXJzdC5mc3BhdGgsXG4gICAgICAgICAgICAgICAgdnBhdGg6IHNmaXJzdC52cGF0aCxcbiAgICAgICAgICAgICAgICBtaW1lOiBtaW1lLmdldFR5cGUoc2ZpcnN0LmZzcGF0aCksXG4gICAgICAgICAgICAgICAgbW91bnRlZDogc2ZpcnN0Lm1vdW50ZWQsXG4gICAgICAgICAgICAgICAgbW91bnRQb2ludDogc2ZpcnN0Lm1vdW50UG9pbnQsXG4gICAgICAgICAgICAgICAgcGF0aEluTW91bnRlZDogc2ZpcnN0LnBhdGhJbk1vdW50ZWQsXG4gICAgICAgICAgICAgICAgc3RhY2tcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAoIWlzVlBhdGhEYXRhKHRvZW1pdCkpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgVlBhdGhEYXRhICR7dXRpbC5pbnNwZWN0KHRvZW1pdCl9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2NoYW5nZScsIHRoaXMubmFtZSwgdG9lbWl0KTtcbiAgICAgICAgfVxuICAgICAgICAvLyBsZXQgaW5mbyA9IHRoaXMuZmlsZUluZm8oZnBhdGgsIHVuZGVmaW5lZCk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBEaXJzV2F0Y2hlciB1bmxpbmsgJHtmcGF0aH1gKTtcbiAgICAgICAgLy8gaWYgKGluZm8pIHRoaXMuZW1pdCgndW5saW5rJywgdGhpcy5uYW1lLCBpbmZvKTtcbiAgICB9XG5cbiAgICBvblJlYWR5KCk6IHZvaWQge1xuICAgICAgICAvLyBjb25zb2xlLmxvZygnRGlyc1dhdGNoZXI6IEluaXRpYWwgc2NhbiBjb21wbGV0ZS4gUmVhZHkgZm9yIGNoYW5nZXMnKTtcbiAgICAgICAgdGhpcy5lbWl0KCdyZWFkeScsIHRoaXMubmFtZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhbiBvYmplY3QgcmVwcmVzZW50aW5nIGFsbCB0aGUgcGF0aHMgb24gdGhlIGZpbGUgc3lzdGVtIGJlaW5nXG4gICAgICogd2F0Y2hlZCBieSB0aGlzIEZTV2F0Y2hlciBpbnN0YW5jZS4gVGhlIG9iamVjdCdzIGtleXMgYXJlIGFsbCB0aGUgXG4gICAgICogZGlyZWN0b3JpZXMgKHVzaW5nIGFic29sdXRlIHBhdGhzIHVubGVzcyB0aGUgY3dkIG9wdGlvbiB3YXMgdXNlZCksXG4gICAgICogYW5kIHRoZSB2YWx1ZXMgYXJlIGFycmF5cyBvZiB0aGUgbmFtZXMgb2YgdGhlIGl0ZW1zIGNvbnRhaW5lZCBpbiBlYWNoIGRpcmVjdG9yeS5cbiAgICAgKi9cbiAgICBnZXRXYXRjaGVkKCkge1xuICAgICAgICBpZiAodGhpcy4jd2F0Y2hlcikgcmV0dXJuIHRoaXMuI3dhdGNoZXIuZ2V0V2F0Y2hlZCgpO1xuICAgIH1cblxuICAgIHZwYXRoRm9yRlNQYXRoKGZzcGF0aDogc3RyaW5nKTogVlBhdGhEYXRhIHtcbiAgICAgICAgZm9yIChjb25zdCBkaXIgb2YgdGhpcy5kaXJzKSB7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIHRvIHNlZSBpZiB3ZSdyZSBzdXBwb3NlZCB0byBpZ25vcmUgdGhlIGZpbGVcbiAgICAgICAgICAgIGlmIChkaXIuaWdub3JlKSB7XG4gICAgICAgICAgICAgICAgbGV0IGlnbm9yZXM7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBkaXIuaWdub3JlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBpZ25vcmVzID0gWyBkaXIuaWdub3JlIF07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWdub3JlcyA9IGRpci5pZ25vcmU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxldCBpZ25vcmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGkgb2YgaWdub3Jlcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAobWluaW1hdGNoKGZzcGF0aCwgaSkpIGlnbm9yZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBkaXIuaWdub3JlICR7ZnNwYXRofSAke2l9ID0+ICR7aWdub3JlfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoaWdub3JlKSBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gVGhpcyBlbnN1cmVzIHdlIGFyZSBtYXRjaGluZyBvbiBkaXJlY3RvcnkgYm91bmRhcmllc1xuICAgICAgICAgICAgLy8gT3RoZXJ3aXNlIGZzcGF0aCBcIi9wYXRoL3RvL2xheW91dHMtZXh0cmEvbGF5b3V0Lm5qa1wiIG1pZ2h0XG4gICAgICAgICAgICAvLyBtYXRjaCBkaXIubW91bnRlZCBcIi9wYXRoL3RvL2xheW91dHNcIi5cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgdnBhdGhGb3JGU1BhdGggJHtkaXIubW91bnRlZH0gJHt0eXBlb2YgZGlyLm1vdW50ZWR9YCwgZGlyKTtcbiAgICAgICAgICAgIGNvbnN0IGRpcm1vdW50ZWQgPVxuICAgICAgICAgICAgICAgIChkaXIgJiYgZGlyLm1vdW50ZWQpXG4gICAgICAgICAgICAgICAgICAgID8gKGRpci5tb3VudGVkLmNoYXJBdChkaXIubW91bnRlZC5sZW5ndGggLSAxKSA9PSAnLycpXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGRpci5tb3VudGVkXG4gICAgICAgICAgICAgICAgICAgICAgICA6IChkaXIubW91bnRlZCArICcvJylcbiAgICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICBpZiAoZGlybW91bnRlZCAmJiBmc3BhdGguaW5kZXhPZihkaXJtb3VudGVkKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhdGhJbk1vdW50ZWQgPSBmc3BhdGguc3Vic3RyaW5nKGRpci5tb3VudGVkLmxlbmd0aCkuc3Vic3RyaW5nKDEpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHZwYXRoID0gZGlyLm1vdW50UG9pbnQgPT09ICcvJ1xuICAgICAgICAgICAgICAgICAgICAgICAgPyBwYXRoSW5Nb3VudGVkXG4gICAgICAgICAgICAgICAgICAgICAgICA6IHBhdGguam9pbihkaXIubW91bnRQb2ludCwgcGF0aEluTW91bnRlZCk7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHZwYXRoRm9yRlNQYXRoIGZzcGF0aCAke2ZzcGF0aH0gZGlyLm1vdW50UG9pbnQgJHtkaXIubW91bnRQb2ludH0gcGF0aEluTW91bnRlZCAke3BhdGhJbk1vdW50ZWR9IHZwYXRoICR7dnBhdGh9YCk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmV0ID0gPFZQYXRoRGF0YT57XG4gICAgICAgICAgICAgICAgICAgIGZzcGF0aDogZnNwYXRoLFxuICAgICAgICAgICAgICAgICAgICB2cGF0aDogdnBhdGgsXG4gICAgICAgICAgICAgICAgICAgIG1pbWU6IG1pbWUuZ2V0VHlwZShmc3BhdGgpLFxuICAgICAgICAgICAgICAgICAgICBtb3VudGVkOiBkaXIubW91bnRlZCxcbiAgICAgICAgICAgICAgICAgICAgbW91bnRQb2ludDogZGlyLm1vdW50UG9pbnQsXG4gICAgICAgICAgICAgICAgICAgIHBhdGhJbk1vdW50ZWRcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEocmV0KSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgVlBhdGhEYXRhICR7dXRpbC5pbnNwZWN0KHJldCl9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiByZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gTm8gZGlyZWN0b3J5IGZvdW5kIGZvciB0aGlzIGZpbGVcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBhc3luYyBzdGFja0ZvclZQYXRoKHZwYXRoOiBzdHJpbmcpOiBQcm9taXNlPFZQYXRoRGF0YVtdPiB7XG4gICAgICAgIGNvbnN0IHJldDogVlBhdGhEYXRhW10gPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCBkaXIgb2YgdGhpcy5kaXJzKSB7XG4gICAgICAgICAgICBpZiAoZGlyLm1vdW50UG9pbnQgPT09ICcvJykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhdGhJbk1vdW50ZWQgPSB2cGF0aDtcbiAgICAgICAgICAgICAgICBjb25zdCBmc3BhdGggPSBwYXRoLmpvaW4oZGlyLm1vdW50ZWQsIHBhdGhJbk1vdW50ZWQpO1xuICAgICAgICAgICAgICAgIGxldCBzdGF0cztcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBzdGF0cyA9IGF3YWl0IGZzLnN0YXQoZnNwYXRoKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHMgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghc3RhdHMpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRvcHVzaCA9IDxWUGF0aERhdGE+e1xuICAgICAgICAgICAgICAgICAgICBmc3BhdGg6IGZzcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgdnBhdGg6IHZwYXRoLFxuICAgICAgICAgICAgICAgICAgICBtaW1lOiBtaW1lLmdldFR5cGUoZnNwYXRoKSxcbiAgICAgICAgICAgICAgICAgICAgbW91bnRlZDogZGlyLm1vdW50ZWQsXG4gICAgICAgICAgICAgICAgICAgIG1vdW50UG9pbnQ6IGRpci5tb3VudFBvaW50LFxuICAgICAgICAgICAgICAgICAgICBwYXRoSW5Nb3VudGVkOiBwYXRoSW5Nb3VudGVkXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBpZiAoIWlzVlBhdGhEYXRhKHRvcHVzaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFZQYXRoRGF0YSAke3V0aWwuaW5zcGVjdCh0b3B1c2gpfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXQucHVzaCh0b3B1c2gpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkaXJtb3VudHB0ID1cbiAgICAgICAgICAgICAgICAgICAgKGRpciAmJiBkaXIubW91bnRQb2ludClcbiAgICAgICAgICAgICAgICAgICAgICAgID8gKGRpci5tb3VudFBvaW50LmNoYXJBdChkaXIubW91bnRQb2ludC5sZW5ndGggLSAxKSA9PT0gJy8nKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gZGlyLm1vdW50UG9pbnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IChkaXIubW91bnRQb2ludCArICcvJylcbiAgICAgICAgICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBzdGFja0ZvclZQYXRoIHZwYXRoICR7dnBhdGh9IGRpci5tb3VudGVkICR7ZGlyLm1vdW50UG9pbnR9IGRpcm1vdW50cHQgJHtkaXJtb3VudHB0fWApO1xuICAgICAgICAgICAgICAgIGlmIChkaXJtb3VudHB0ICYmIHZwYXRoLmluZGV4T2YoZGlybW91bnRwdCkgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gPiBjb25zdCB2cGF0aCA9ICdmb28vYmFyL2Jhei5odG1sJztcbiAgICAgICAgICAgICAgICAgICAgLy8gPiBjb25zdCBtID0gJ2Zvby9iYXInO1xuICAgICAgICAgICAgICAgICAgICAvLyA+IGxldCBwYXRoSW5Nb3VudGVkID0gdnBhdGguc3Vic3RyaW5nKG0ubGVuZ3RoICsgMSk7XG4gICAgICAgICAgICAgICAgICAgIC8vID4gcGF0aEluTW91bnRlZFxuICAgICAgICAgICAgICAgICAgICAvLyAnYmF6Lmh0bWwnXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhdGhJbk1vdW50ZWQgPSB2cGF0aC5zdWJzdHJpbmcoZGlybW91bnRwdC5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmc3BhdGggPSBwYXRoLmpvaW4oZGlyLm1vdW50ZWQsIHBhdGhJbk1vdW50ZWQpO1xuICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgc3RhY2tGb3JWUGF0aCB2cGF0aCAke3ZwYXRofSBwYXRoSW5Nb3VudGVkICR7cGF0aEluTW91bnRlZH0gZnNwYXRoICR7ZnNwYXRofWApO1xuICAgICAgICAgICAgICAgICAgICBsZXQgc3RhdHM7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA9IGF3YWl0IGZzLnN0YXQoZnNwYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoIXN0YXRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgc3RhY2tGb3JWUGF0aCB2cGF0aCAke3ZwYXRofSBkaWQgbm90IGZpbmQgZnMuc3RhdHMgZm9yICR7ZnNwYXRofWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdG9wdXNoID0gPFZQYXRoRGF0YT57XG4gICAgICAgICAgICAgICAgICAgICAgICBmc3BhdGg6IGZzcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZwYXRoOiB2cGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pbWU6IG1pbWUuZ2V0VHlwZShmc3BhdGgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbW91bnRlZDogZGlyLm1vdW50ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBtb3VudFBvaW50OiBkaXIubW91bnRQb2ludCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGhJbk1vdW50ZWQ6IHBhdGhJbk1vdW50ZWRcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YSh0b3B1c2gpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgVlBhdGhEYXRhICR7dXRpbC5pbnNwZWN0KHRvcHVzaCl9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0LnB1c2godG9wdXNoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgc3RhY2tGb3JWUGF0aCB2cGF0aCAke3ZwYXRofSBkaWQgbm90IG1hdGNoICR7ZGlybW91bnRwdH1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gKGtub2NrIG9uIHdvb2QpIEV2ZXJ5IGVudHJ5IGluIGByZXRgIGhhcyBhbHJlYWR5IGJlZW4gdmVyaWZpZWRcbiAgICAgICAgLy8gYXMgYmVpbmcgYSBjb3JyZWN0IFZQYXRoRGF0YSBvYmplY3RcbiAgICAgICAgcmV0dXJuIHJldDtcbiAgICB9XG5cbiAgICBhc3luYyBjbG9zZSgpIHtcbiAgICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2NoYW5nZScpO1xuICAgICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygnYWRkJyk7XG4gICAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCd1bmxpbmsnKTtcbiAgICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlYWR5Jyk7XG4gICAgICAgIGlmICh0aGlzLiN3YXRjaGVyKSB7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgQ2xvc2luZyB3YXRjaGVyICR7dGhpcy5uYW1lfWApO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy4jd2F0Y2hlci5jbG9zZSgpO1xuICAgICAgICAgICAgdGhpcy4jd2F0Y2hlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIH1cbn1cbiJdfQ==