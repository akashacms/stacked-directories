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
var _DirsWatcher_dirs, _DirsWatcher_watcher, _DirsWatcher_name, _DirsWatcher_options, _DirsWatcher_basedir;
import { promises as fs, statSync as fsStatSync } from 'node:fs';
import chokidar from 'chokidar';
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
    // It must at least have the 'mounted' field.
    if (!('mounted' in dir
        && typeof dir.mounted === 'string')) {
        return false;
    }
    return true;
};
export class DirsWatcher extends EventEmitter {
    // #queue;
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
        // console.log(`DirsWatcher ${name} constructor`);
        __classPrivateFieldSet(this, _DirsWatcher_name, name, "f");
        // TODO is there a need to make this customizable?
        __classPrivateFieldSet(this, _DirsWatcher_options, {
            persistent: true, ignoreInitial: false, awaitWriteFinish: true, alwaysStat: true,
            ignored: (_fspath, stats) => {
                if (this.toIgnore) {
                    return this.toIgnore(_fspath, stats);
                }
                else {
                    return false;
                }
            }
        }, "f");
        __classPrivateFieldSet(this, _DirsWatcher_basedir, undefined, "f");
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
        else if (typeof dirs === 'object'
            && !Array.isArray(dirs)) {
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
        // Send events from chokidar into the onXYZZY
        // handler functions.  These perform additional
        // processing which in turn is emitted from
        // the DirsWatcher object.
        const that = this;
        __classPrivateFieldGet(this, _DirsWatcher_watcher, "f")
            .on('change', async (fpath, stats) => {
            try {
                await that.onChange(fpath, stats);
            }
            catch (err) {
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
            }
            catch (err) {
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
            .on('unlink', async (fpath) => {
            // this.#queue.push(<queueEvent>{
            //     code: 'unlink', fpath
            // });
            try {
                await that.onUnlink(fpath);
            }
            catch (err) {
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
    async onChange(fpath, stats) {
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
    async onAdd(fpath, stats) {
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
        // console.log(`DirsWatcher onUnlink ${fpath}`);
        const vpinfo = this.vpathForFSPath(fpath);
        if (!vpinfo) {
            console.log(`onUnlink could not find mount point or vpath for ${fpath}`);
            return;
        }
        // console.log(`DirsWatcher onUnlink vpathData ${fpath} ==>`, vpinfo);
        const stack = await this.stackForVPath(vpinfo.vpath);
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
    /**
     * Determine if the fspath is to be ignored
     * @param fspath
     * @param stats
     * @returns
     */
    toIgnore(fspath, stats) {
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
                : (m + '/');
            if (!fspath.startsWith(m2)) {
                continue;
            }
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
                if (ignore) {
                    // console.log(`toIgnore ignoring ${fspath} ${util.inspect(this.dirs)}`);
                    return true;
                }
            }
        }
        return false;
    }
    vpathForFSPath(fspath, stats) {
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
                if (stats) {
                    ret.statsMtime = stats.mtimeMs;
                }
                else {
                    // Use the sync version to
                    // maintain this function
                    // as non-async
                    try {
                        let stats = fsStatSync(ret.fspath);
                        ret.statsMtime = stats.mtimeMs;
                    }
                    catch (err) {
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
_DirsWatcher_dirs = new WeakMap(), _DirsWatcher_watcher = new WeakMap(), _DirsWatcher_name = new WeakMap(), _DirsWatcher_options = new WeakMap(), _DirsWatcher_basedir = new WeakMap();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2F0Y2hlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2xpYi93YXRjaGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUNBLE9BQU8sRUFDSCxRQUFRLElBQUksRUFBRSxFQUNkLFFBQVEsSUFBSSxVQUFVLEVBRXpCLE1BQU0sU0FBUyxDQUFDO0FBQ2pCLE9BQU8sUUFBd0MsTUFBTSxVQUFVLENBQUM7QUFFaEUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUNqQyxPQUFPLGFBQWEsTUFBTSx3QkFBd0IsQ0FBQztBQUNuRCxPQUFPLFVBQVUsTUFBTSxxQkFBcUIsQ0FBQztBQUU3QyxNQUFNLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFFakQsT0FBTyxLQUFLLElBQUksTUFBTSxXQUFXLENBQUM7QUFDbEMsT0FBTyxLQUFLLElBQUksTUFBTSxXQUFXLENBQUM7QUFDbEMsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUMzQyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBRXRDOzs7Ozs7Ozs7Ozs7Ozs7R0FlRztBQUNILE1BQU0sVUFBVSxVQUFVLENBQUMsT0FBTyxFQUFFLEtBQWdCO0lBQ2hELElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ2hDLENBQUM7QUFvREQ7Ozs7O0dBS0c7QUFDSCxNQUFNLENBQUMsTUFBTSxXQUFXLEdBQUcsQ0FBQyxNQUFNLEVBQXVCLEVBQUU7SUFDdkQsSUFBSSxPQUFPLE1BQU0sS0FBSyxXQUFXO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDaEQsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDN0MsSUFBSSxPQUFPLE1BQU0sQ0FBQyxJQUFJLEtBQUssV0FBVztXQUNsQyxNQUFNLENBQUMsSUFBSSxL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QUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQzt3QkFDdkIsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQkFBcUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7b0JBQ2pFLENBQUM7b0JBQ0QsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDckIsQ0FBQztxQkFBTSxDQUFDO29CQUNKLDJFQUEyRTtnQkFDL0UsQ0FBQztZQUNMLENBQUM7UUFDTCxDQUFDO1FBQ0QsaUVBQWlFO1FBQ2pFLHNDQUFzQztRQUN0QyxPQUFPLEdBQUcsQ0FBQztJQUNmLENBQUM7SUFFRCxLQUFLLENBQUMsS0FBSztRQUNQLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNsQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDL0IsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ2xDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNqQyxJQUFJLHVCQUFBLElBQUksNEJBQVMsRUFBRSxDQUFDO1lBQ2hCLCtDQUErQztZQUMvQyxNQUFNLHVCQUFBLElBQUksNEJBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUM1Qix1QkFBQSxJQUFJLHdCQUFZLFNBQVMsTUFBQSxDQUFDO1FBQzlCLENBQUM7SUFDTCxDQUFDO0NBQ0oiLCJzb3VyY2VzQ29udGVudCI6WyJcbmltcG9ydCB7XG4gICAgcHJvbWlzZXMgYXMgZnMsXG4gICAgc3RhdFN5bmMgYXMgZnNTdGF0U3luYyxcbiAgICBTdGF0c1xufSBmcm9tICdub2RlOmZzJztcbmltcG9ydCBjaG9raWRhciwgeyBGU1dhdGNoZXIsIENob2tpZGFyT3B0aW9ucyB9IGZyb20gJ2Nob2tpZGFyJztcblxuaW1wb3J0IHsgTWltZSB9IGZyb20gJ21pbWUvbGl0ZSc7XG5pbXBvcnQgc3RhbmRhcmRUeXBlcyBmcm9tICdtaW1lL3R5cGVzL3N0YW5kYXJkLmpzJztcbmltcG9ydCBvdGhlclR5cGVzIGZyb20gJ21pbWUvdHlwZXMvb3RoZXIuanMnO1xuXG5jb25zdCBtaW1lID0gbmV3IE1pbWUoc3RhbmRhcmRUeXBlcywgb3RoZXJUeXBlcyk7XG5cbmltcG9ydCAqIGFzIHV0aWwgZnJvbSAnbm9kZTp1dGlsJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ25vZGU6ZXZlbnRzJztcbmltcG9ydCB7IG1pbmltYXRjaCB9IGZyb20gJ21pbmltYXRjaCc7XG5cbi8qKlxuICogQ29uZmlndXJlIHRoZSBNSU1FIHBhY2thZ2Ugd2l0aCBhZGRpdGlvbmFsIGNvbnRlbnRcbiAqIHR5cGVzLiAgVGhpcyBpcyBtZWFudCB0byBoYW5kbGUgZmlsZXMgZm9yIHdoaWNoXG4gKiBubyBvZmZpY2lhbCByZWdpc3RyYXRpb24gaGFzIGJlZW4gbWFkZS4gIEZvciBleGFtcGxlLFxuICogQXNjaWlEb2MgZmlsZXMgYXJlIHVzZWZ1bCBidXQgZG8gbm90IGhhdmUgcmVnaXN0ZXJlZFxuICogTUlNRSB0eXBlcy5cbiAqIFxuICogcGVyOiBodHRwczovL2FzY2lpZG9jdG9yLm9yZy9kb2NzL2ZhcS9cbiAqIHBlcjogaHR0cHM6Ly9naXRodWIuY29tL2FzY2lpZG9jdG9yL2FzY2lpZG9jdG9yL2lzc3Vlcy8yNTAyXG4gKiBcbiAqIEZvciBBc2NpaURvYywgdGhlIG1hcHBpbmcgbWlnaHQgYmU6XG4gKiB7J3RleHQveC1hc2NpaWRvYyc6IFsnYWRvYycsICdhc2NpaWRvYyddfVxuICogXG4gKiBAcGFyYW0gbWFwcGluZyBcbiAqIEBwYXJhbSBmb3JjZSBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVkZWZpbmUobWFwcGluZywgZm9yY2UgPzogYm9vbGVhbikge1xuICAgIG1pbWUuZGVmaW5lKG1hcHBpbmcsIGZvcmNlKTtcbn1cblxuZXhwb3J0IHR5cGUgVlBhdGhEYXRhID0ge1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZ1bGwgZmlsZS1zeXN0ZW0gcGF0aCBmb3IgdGhlIGZpbGUuXG4gICAgICogZS5nLiAvaG9tZS9wYXRoL3RvL2FydGljbGUtbmFtZS5odG1sLm1kXG4gICAgICovXG4gICAgZnNwYXRoOiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdmlydHVhbCBwYXRoLCByb290ZWQgYXQgdGhlIHRvcFxuICAgICAqIGRpcmVjdG9yeSBvZiB0aGUgZmlsZXN5c3RlbSwgd2l0aCBub1xuICAgICAqIGxlYWRpbmcgc2xhc2guXG4gICAgICovXG4gICAgdnBhdGg6IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIFRoZSBtaW1lIHR5cGUgb2YgdGhlIGZpbGUuICBUaGUgbWltZSB0eXBlc1xuICAgICAqIGFyZSBkZXRlcm1pbmVkIGZyb20gdGhlIGZpbGUgZXh0ZW5zaW9uXG4gICAgICogdXNpbmcgdGhlICdtaW1lJyBwYWNrYWdlLlxuICAgICAqL1xuICAgIG1pbWUgPzogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZpbGUtc3lzdGVtIHBhdGggd2hpY2ggaXMgbW91bnRlZFxuICAgICAqIGludG8gdGhlIHZpcnR1YWwgZmlsZSBzcGFjZS5cbiAgICAgKi9cbiAgICBtb3VudGVkOiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdmlydHVhbCBkaXJlY3Rvcnkgb2YgdGhlIG1vdW50XG4gICAgICogZW50cnkgaW4gdGhlIGRpcmVjdG9yeSBzdGFjay5cbiAgICAgKi9cbiAgICBtb3VudFBvaW50OiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcmVsYXRpdmUgcGF0aCB1bmRlcm5lYXRoIHRoZSBtb3VudFBvaW50LlxuICAgICAqL1xuICAgIHBhdGhJbk1vdW50ZWQ6IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIFRoZSBtVGltZSB2YWx1ZSBmcm9tIFN0YXRzXG4gICAgICovXG4gICAgc3RhdHNNdGltZTogbnVtYmVyO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZpbGUtc3lzdGVtIHN0YWNrIHJlbGF0ZWQgdG8gdGhlIGZpbGUuXG4gICAgICovXG4gICAgc3RhY2sgPzogVlBhdGhEYXRhW107XG59XG5cbi8qKlxuICogVHlwZWd1YXJkIGZ1bmN0aW9uIGVuc3VyaW5nIHRoYXQgYW4gb2JqZWN0XG4gKiBpcyBhIFZQYXRoRGF0YSBvYmplY3QuXG4gKiBAcGFyYW0gdnBpbmZvIFRoZSBvYmplY3QgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHRydWUgaWYgaXQgaXMgYSBWUGF0aERhdGEsIGZhbHNlIG90aGVyd2lzZVxuICovXG5leHBvcnQgY29uc3QgaXNWUGF0aERhdGEgPSAodnBpbmZvKTogdnBpbmZvIGlzIFZQYXRoRGF0YSA9PiB7XG4gICAgaWYgKHR5cGVvZiB2cGluZm8gPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiB2cGluZm8gIT09ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiB2cGluZm8ubWltZSAhPT0gJ3VuZGVmaW5lZCdcbiAgICAgJiYgdnBpbmZvLm1pbWUgIT09IG51bGxcbiAgICAgJiYgdHlwZW9mIHZwaW5mby5taW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgdnBpbmZvLmZzcGF0aCAhPT0gJ3N0cmluZydcbiAgICAgfHwgdHlwZW9mIHZwaW5mby52cGF0aCAhPT0gJ3N0cmluZydcbiAgICAgfHwgdHlwZW9mIHZwaW5mby5tb3VudGVkICE9PSAnc3RyaW5nJ1xuICAgICB8fCB0eXBlb2YgdnBpbmZvLm1vdW50UG9pbnQgIT09ICdzdHJpbmcnXG4gICAgIHx8IHR5cGVvZiB2cGluZm8ucGF0aEluTW91bnRlZCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHZwaW5mby5zdGFjayA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiB0cnVlO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHZwaW5mby5zdGFjaykpIHtcbiAgICAgICAgZm9yIChjb25zdCBpbmYgb2YgdnBpbmZvLnN0YWNrKSB7XG4gICAgICAgICAgICBpZiAoIWlzVlBhdGhEYXRhKGluZikpIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbmV4cG9ydCB0eXBlIGRpclRvV2F0Y2ggPSB7XG4gICAgLyoqXG4gICAgICogVGhlIGZpbGVzeXN0ZW0gcGF0aCB0byBcIm1vdW50XCIuXG4gICAgICovXG4gICAgbW91bnRlZDogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHBhdGggd2l0aGluIHRoZSB2aXJ0dWFsIGZpbGVzeXN0ZW0gd2hlcmUgdGhpcyB3aWxsIGFwcGVhci5cbiAgICAgKi9cbiAgICBtb3VudFBvaW50OiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBNZXRhZGF0YSBvYmplY3QgdG8gdXNlIHdpdGhpbiB0aGVcbiAgICAgKiBzdWItaGllcmFyY2h5LlxuICAgICAqL1xuICAgIGJhc2VNZXRhZGF0YT86IGFueTtcblxuICAgIC8qKlxuICAgICAqIE9wdGlvbmFsIGFycmF5IG9mIHN0cmluZ3MgY29udGFpbmluZyBnbG9icyBmb3IgbWF0Y2hpbmdcbiAgICAgKiBmaWxlcyB0byBpZ25vcmUuXG4gICAgICovXG4gICAgaWdub3JlPzogc3RyaW5nW107XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIHdoZXRoZXIgdGhlIHtAY29kZSBkaXJ9IGlzIGEge0Bjb2RlIGRpclRvV2F0Y2h9LlxuICovXG5leHBvcnQgY29uc3QgaXNEaXJUb1dhdGNoID0gKGRpcjogYW55KTogZGlyIGlzIGRpclRvV2F0Y2ggPT4ge1xuICAgIGlmICh0eXBlb2YgZGlyID09PSAndW5kZWZpbmVkJykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2YgZGlyICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuXG4gICAgaWYgKCdtb3VudGVkJyBpbiBkaXIgJiYgdHlwZW9mIGRpci5tb3VudGVkICE9PSAnc3RyaW5nJykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICgnbW91bnRQb2ludCcgaW4gZGlyICYmIHR5cGVvZiBkaXIubW91bnRQb2ludCAhPT0gJ3N0cmluZycpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoJ2lnbm9yZScgaW4gZGlyICYmIHR5cGVvZiBkaXIuaWdub3JlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgICB0eXBlb2YgZGlyLmlnbm9yZSAhPT0gJ3N0cmluZydcbiAgICAgICAgICYmICFBcnJheS5pc0FycmF5KGRpci5pZ25vcmUpXG4gICAgICAgICkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIHR5cGVvZiBkaXIuaWdub3JlID09PSAnc3RyaW5nJ1xuICAgICAgICAgJiYgQXJyYXkuaXNBcnJheShkaXIuaWdub3JlKVxuICAgICAgICApIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIEl0IG11c3QgYXQgbGVhc3QgaGF2ZSB0aGUgJ21vdW50ZWQnIGZpZWxkLlxuICAgIGlmICghKFxuICAgICAgICAnbW91bnRlZCcgaW4gZGlyXG4gICAgICYmIHR5cGVvZiBkaXIubW91bnRlZCA9PT0gJ3N0cmluZydcbiAgICApKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn1cblxuZXhwb3J0IGNsYXNzIERpcnNXYXRjaGVyIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcblxuICAgICNkaXJzOiBkaXJUb1dhdGNoW107XG4gICAgI3dhdGNoZXI/OiBGU1dhdGNoZXI7XG4gICAgI25hbWU6IHN0cmluZztcbiAgICAjb3B0aW9uczogQ2hva2lkYXJPcHRpb25zO1xuICAgICNiYXNlZGlyO1xuICAgIC8vICNxdWV1ZTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSBuYW1lIHN0cmluZyBnaXZpbmcgdGhlIG5hbWUgZm9yIHRoaXMgd2F0Y2hlclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgJHtuYW1lfSBjb25zdHJ1Y3RvcmApO1xuICAgICAgICB0aGlzLiNuYW1lID0gbmFtZTtcbiAgICAgICAgLy8gVE9ETyBpcyB0aGVyZSBhIG5lZWQgdG8gbWFrZSB0aGlzIGN1c3RvbWl6YWJsZT9cbiAgICAgICAgdGhpcy4jb3B0aW9ucyA9IHtcbiAgICAgICAgICAgIHBlcnNpc3RlbnQ6IHRydWUsIGlnbm9yZUluaXRpYWw6IGZhbHNlLCBhd2FpdFdyaXRlRmluaXNoOiB0cnVlLCBhbHdheXNTdGF0OiB0cnVlLFxuICAgICAgICAgICAgaWdub3JlZDpcbiAgICAgICAgICAgICAgICAoX2ZzcGF0aDogc3RyaW5nLCBzdGF0cz86IFN0YXRzKTogYm9vbGVhbiA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMudG9JZ25vcmUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMudG9JZ25vcmUoX2ZzcGF0aCwgc3RhdHMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuI2Jhc2VkaXIgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIHRoZSBkaXJlY3Rvcnkgc3RhY2sgZm9yXG4gICAgICogdGhpcyBXYXRjaGVyLlxuICAgICAqL1xuICAgIGdldCBkaXJzKCk6IGRpclRvV2F0Y2hbXSB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLiNkaXJzOyB9XG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIG5hbWUgZm9yIHRoaXMgV2F0Y2hlclxuICAgICAqL1xuICAgIGdldCBuYW1lKCkgeyByZXR1cm4gdGhpcy4jbmFtZTsgfVxuXG4gICAgLyoqXG4gICAgICogQ2hhbmdlcyB0aGUgdXNlIG9mIGFic29sdXRlIHBhdGhuYW1lcywgdG8gcGF0aHMgcmVsYXR2ZSB0byB0aGUgZ2l2ZW4gZGlyZWN0b3J5LlxuICAgICAqIFRoaXMgbXVzdCBiZSBjYWxsZWQgYmVmb3JlIHRoZSA8ZW0+d2F0Y2g8L2VtPiBtZXRob2QgaXMgY2FsbGVkLiAgVGhlIHBhdGhzXG4gICAgICogeW91IHNwZWNpZnkgdG8gd2F0Y2ggbXVzdCBiZSByZWxhdGl2ZSB0byB0aGUgZ2l2ZW4gZGlyZWN0b3J5LlxuICAgICAqL1xuICAgIHNldCBiYXNlZGlyKGN3ZCkgeyB0aGlzLiNiYXNlZGlyID0gY3dkOyB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIHRoZSBDaG9raWRhciB3YXRjaGVyLCBiYXNlYyBvbiB0aGUgZGlyZWN0b3JpZXMgdG8gd2F0Y2guICBUaGUgPGVtPmRpcnNwZWM8L2VtPiBvcHRpb24gY2FuIGJlIGEgc3RyaW5nLFxuICAgICAqIG9yIGFuIG9iamVjdC4gIElmIGl0IGlzIGEgc3RyaW5nLCBpdCBpcyBhIGZpbGVzeXN0ZW0gcGF0aG5hbWUgdGhhdCB3aWxsIGJlXG4gICAgICogYXNzb2NpYXRlZCB3aXRoIHRoZSByb290IG9mIHRoZSB2aXJ0dWFsIGZpbGVzeXN0ZW0uICBBbiBvYmplY3Qgd2lsbCBsb29rXG4gICAgICogbGlrZSB0aGlzOlxuICAgICAqIFxuICAgICAqIDxjb2RlPlxuICAgICAqIHtcbiAgICAgKiAgIG1vdW50ZWQ6ICcvcGF0aC90by9tb3VudGVkJyxcbiAgICAgKiAgIG1vdW50UG9pbnQ6ICdtb3VudGVkJ1xuICAgICAqIH1cbiAgICAgKiA8L2NvZGU+XG4gICAgICogXG4gICAgICogVGhlIDx0dD5tb3VudFBvaW50PC90dD4gZmllbGQgaXMgYSBmdWxsIHBhdGggdG8gdGhlIGRpcmVjdG9yeSBvZiBpbnRlcmVzdC4gIFRoZVxuICAgICAqIDx0dD5tb3VudFBvaW50PC90dD4gZmllbGQgZGVzY3JpYmVzIGEgcHJlZml4IHdpdGhpbiB0aGUgdmlydHVhbCBmaWxlc3lzdGVtLlxuICAgICAqIFxuICAgICAqIEBwYXJhbSBkaXJzcGVjIFxuICAgICAqL1xuICAgIGFzeW5jIHdhdGNoKGRpcnM6IGRpclRvV2F0Y2hbXSB8IHN0cmluZykge1xuICAgICAgICBpZiAodGhpcy4jd2F0Y2hlcikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBXYXRjaGVyIGFscmVhZHkgc3RhcnRlZCBmb3IgJHt0aGlzLiN3YXRjaGVyfWApO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgZGlycyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGRpcnMgPSBbIHtcbiAgICAgICAgICAgICAgICBtb3VudGVkOiBkaXJzLCBtb3VudFBvaW50OiAnLydcbiAgICAgICAgICAgIH0gXTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZGlycyA9PT0gJ29iamVjdCdcbiAgICAgICAgICAgICAgICYmICFBcnJheS5pc0FycmF5KGRpcnMpKSB7XG4gICAgICAgICAgICBpZiAoIWlzRGlyVG9XYXRjaChkaXJzKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2F0Y2ggLSBkaXJlY3Rvcnkgc3BlYyBub3QgYSBkaXJUb1dhdGNoIC0gJHt1dGlsLmluc3BlY3QoZGlycyl9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkaXJzID0gWyBkaXJzIF07XG4gICAgICAgIH0gZWxzZSBpZiAoIUFycmF5LmlzQXJyYXkoZGlycykpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2F0Y2ggLSB0aGUgZGlycyBhcmd1bWVudCBpcyBpbmNvcnJlY3QgJHt1dGlsLmluc3BlY3QoZGlycyl9YCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gY29uc29sZS5sb2coYHdhdGNoIGRpcnM9YCwgZGlycyk7XG4gICAgICAgIGNvbnN0IHRvd2F0Y2ggPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCBkaXIgb2YgZGlycykge1xuICAgICAgICAgICAgaWYgKCFpc0RpclRvV2F0Y2goZGlyKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2F0Y2ggZGlyZWN0b3J5IHNwZWMgaW4gZGlycyBub3QgYSBkaXJUb1dhdGNoIC0gJHt1dGlsLmluc3BlY3QoZGlyKX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgZnMuc3RhdChkaXIubW91bnRlZCk7XG4gICAgICAgICAgICBpZiAoIXN0YXRzLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHdhdGNoIC0gbm9uLWRpcmVjdG9yeSBzcGVjaWZpZWQgaW4gJHt1dGlsLmluc3BlY3QoZGlyKX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRvd2F0Y2gucHVzaChkaXIubW91bnRlZCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy4jZGlycyA9IGRpcnM7XG5cbiAgICAgICAgaWYgKHRoaXMuI2Jhc2VkaXIpIHtcbiAgICAgICAgICAgIHRoaXMuI29wdGlvbnMuY3dkID0gdGhpcy4jYmFzZWRpcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuI29wdGlvbnMuY3dkID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy4jd2F0Y2hlciA9IGNob2tpZGFyLndhdGNoKHRvd2F0Y2gsIHRoaXMuI29wdGlvbnMpO1xuXG4gICAgICAgIC8vIFNlbmQgZXZlbnRzIGZyb20gY2hva2lkYXIgaW50byB0aGUgb25YWVpaWVxuICAgICAgICAvLyBoYW5kbGVyIGZ1bmN0aW9ucy4gIFRoZXNlIHBlcmZvcm0gYWRkaXRpb25hbFxuICAgICAgICAvLyBwcm9jZXNzaW5nIHdoaWNoIGluIHR1cm4gaXMgZW1pdHRlZCBmcm9tXG4gICAgICAgIC8vIHRoZSBEaXJzV2F0Y2hlciBvYmplY3QuXG5cbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XG4gICAgICAgIHRoaXMuI3dhdGNoZXJcbiAgICAgICAgICAgIC5vbignY2hhbmdlJywgYXN5bmMgKGZwYXRoLCBzdGF0cykgPT4ge1xuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhhdC5vbkNoYW5nZShmcGF0aCwgc3RhdHMpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCB0aGlzLm5hbWUsIGZwYXRoLCBgRGlyc1dhdGNoZXIgd2F0Y2hlciAke3RoaXMubmFtZX0gZXZlbnQ9Y2hhbmdlICR7ZnBhdGh9IGNhdWdodCAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyB0aGlzLiNxdWV1ZS5wdXNoKDxxdWV1ZUV2ZW50PntcbiAgICAgICAgICAgICAgICAvLyAgICAgY29kZTogJ2NoYW5nZScsIGZwYXRoLCBzdGF0c1xuICAgICAgICAgICAgICAgIC8vIH0pO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB3YXRjaGVyICR7d2F0Y2hlcl9uYW1lfSBjaGFuZ2UgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAub24oJ2FkZCcsIGFzeW5jIChmcGF0aCwgc3RhdHMpID0+IHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGF0Lm9uQWRkKGZwYXRoLCBzdGF0cyk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIHRoaXMubmFtZSwgZnBhdGgsIGBEaXJzV2F0Y2hlciB3YXRjaGVyICR7dGhpcy5uYW1lfSBldmVudD1hZGQgJHtmcGF0aH0gY2F1Z2h0ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIHRoaXMuI3F1ZXVlLnB1c2goPHF1ZXVlRXZlbnQ+e1xuICAgICAgICAgICAgICAgIC8vICAgICBjb2RlOiAnYWRkJywgZnBhdGgsIHN0YXRzXG4gICAgICAgICAgICAgICAgLy8gfSk7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHdhdGNoZXIgJHt3YXRjaGVyX25hbWV9IGFkZCAke2ZwYXRofWApO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC8qIC5vbignYWRkRGlyJywgYXN5bmMgKGZwYXRoLCBzdGF0cykgPT4geyBcbiAgICAgICAgICAgICAgICAvLyA/PyBsZXQgaW5mbyA9IHRoaXMuZmlsZUluZm8oZnBhdGgsIHN0YXRzKTtcbiAgICAgICAgICAgICAgICAvLyA/PyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgYWRkRGlyYCwgaW5mbyk7XG4gICAgICAgICAgICAgICAgLy8gPz8gdGhpcy5lbWl0KCdhZGREaXInLCBpbmZvKTtcbiAgICAgICAgICAgIH0pICovXG4gICAgICAgICAgICAub24oJ3VubGluaycsIGFzeW5jIGZwYXRoID0+IHtcbiAgICAgICAgICAgICAgICAvLyB0aGlzLiNxdWV1ZS5wdXNoKDxxdWV1ZUV2ZW50PntcbiAgICAgICAgICAgICAgICAvLyAgICAgY29kZTogJ3VubGluaycsIGZwYXRoXG4gICAgICAgICAgICAgICAgLy8gfSk7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhhdC5vblVubGluayhmcGF0aCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS53YXJuKGBFTUlUVElORyBFUlJPUiBEaXJzV2F0Y2hlciB3YXRjaGVyICR7dGhpcy5uYW1lfSBldmVudD11bmxpbmsgJHtmcGF0aH0gY2F1Z2h0ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCB0aGlzLm5hbWUsIGZwYXRoLCBgRGlyc1dhdGNoZXIgd2F0Y2hlciAke3RoaXMubmFtZX0gZXZlbnQ9dW5saW5rICR7ZnBhdGh9IGNhdWdodCAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgd2F0Y2hlciAke3dhdGNoZXJfbmFtZX0gdW5saW5rICR7ZnBhdGh9YCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLyogLm9uKCd1bmxpbmtEaXInLCBhc3luYyBmcGF0aCA9PiB7IFxuICAgICAgICAgICAgICAgIC8vID8/IGxldCBpbmZvID0gdGhpcy5maWxlSW5mbyhmcGF0aCwgc3RhdHMpO1xuICAgICAgICAgICAgICAgIC8vID8/IGNvbnNvbGUubG9nKGBEaXJzV2F0Y2hlciB1bmxpbmtEaXIgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgICAgICAvLyA/PyB0aGlzLmVtaXQoJ3VubGlua0RpcicsIGluZm8pO1xuICAgICAgICAgICAgfSkgKi9cbiAgICAgICAgICAgIC5vbigncmVhZHknLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gdGhpcy4jcXVldWUucHVzaCg8cXVldWVFdmVudD57XG4gICAgICAgICAgICAgICAgLy8gICAgIGNvZGU6ICdyZWFkeSdcbiAgICAgICAgICAgICAgICAvLyB9KTtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGF0Lm9uUmVhZHkoKTtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgd2F0Y2hlciAke3dhdGNoZXJfbmFtZX0gcmVhZHlgKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAub24oJ2Vycm9yJywgYXN5bmMgKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhhdC5vbkVycm9yKGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHRoaXMuaXNSZWFkeSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgLy8gICAgIHRoaXNbX3N5bWJfd2F0Y2hlcl0ub24oJ3JlYWR5JywgKCkgPT4geyByZXNvbHZlKHRydWUpOyB9KTtcbiAgICAgICAgLy8gfSk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKHRoaXMuaXNSZWFkeSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW1pdCBDaG9raWRhciBlcnJvciBldmVudHMgYXMgYSBEaXJzV2F0dGNoZXIgZXJyb3IuXG4gICAgICogQHBhcmFtIGVycm9yIFxuICAgICAqL1xuICAgIGFzeW5jIG9uRXJyb3IoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBEaXJzV2F0Y2hlciAke3RoaXMubmFtZX0gRVJST1IgYCwgZXJyb3IpO1xuICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgdGhpcy5uYW1lLCB1bmRlZmluZWQsIGBEaXJzV2F0Y2hlciAke3RoaXMubmFtZX0gRVJST1IgJHtlcnJvcn1gKTtcbiAgICB9XG5cbiAgICAvKiBDYWxjdWxhdGUgdGhlIHN0YWNrIGZvciBhIGZpbGVzeXN0ZW0gcGF0aFxuXG4gICAgT25seSBlbWl0IGlmIHRoZSBjaGFuZ2Ugd2FzIHRvIHRoZSBmcm9udC1tb3N0IGZpbGUgKi8gXG4gICAgYXN5bmMgb25DaGFuZ2UoZnBhdGg6IHN0cmluZywgc3RhdHM6IFN0YXRzKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIC8vIENoZWNraW5nIHRoaXMgZWFybHkgYXZvaWRzIHByaW50aW5nIHRoZVxuICAgICAgICAvLyBtZXNzYWdlIGlmIHZwYXRoRm9yRlNQYXRoIGlzIHVuZGVmaW5lZFxuICAgICAgICAvLyBpZiAodGhpcy50b0lnbm9yZShmcGF0aCwgc3RhdHMpKSB7XG4gICAgICAgIC8vICAgICByZXR1cm47XG4gICAgICAgIC8vIH1cbiAgICAgICAgY29uc3QgdnBpbmZvID0gdGhpcy52cGF0aEZvckZTUGF0aChmcGF0aCwgc3RhdHMpO1xuICAgICAgICBpZiAoIXZwaW5mbykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYG9uQ2hhbmdlIGNvdWxkIG5vdCBmaW5kIG1vdW50IHBvaW50IG9yIHZwYXRoIGZvciAke2ZwYXRofWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHN0YWNrOiBWUGF0aERhdGFbXSA9IGF3YWl0IHRoaXMuc3RhY2tGb3JWUGF0aCh2cGluZm8udnBhdGgpO1xuICAgICAgICBpZiAoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYG9uQ2hhbmdlIGNvdWxkIG5vdCBmaW5kIG1vdW50IHBvaW50cyBmb3IgJHtmcGF0aH1gKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgaSA9IDA7XG4gICAgICAgIGxldCBkZXB0aDtcbiAgICAgICAgbGV0IGVudHJ5O1xuICAgICAgICBmb3IgKGNvbnN0IHMgb2Ygc3RhY2spIHtcbiAgICAgICAgICAgIGlmIChzLmZzcGF0aCA9PT0gZnBhdGgpIHtcbiAgICAgICAgICAgICAgICBlbnRyeSA9IHM7XG4gICAgICAgICAgICAgICAgZGVwdGggPSBpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaSsrO1xuICAgICAgICB9XG4gICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgb25DaGFuZ2Ugbm8gc3RhY2sgZW50cnkgZm9yICR7ZnBhdGh9ICgke3ZwaW5mby52cGF0aH0pYCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRlcHRoID09PSAwKSB7XG4gICAgICAgICAgICB2cGluZm8uc3RhY2sgPSBzdGFjaztcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBEaXJzV2F0Y2hlciBjaGFuZ2UgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEodnBpbmZvKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QodnBpbmZvKX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywgdGhpcy5uYW1lLCB2cGluZm8pO1xuICAgICAgICB9XG4gICAgICAgIC8vIGxldCBpbmZvID0gdGhpcy5maWxlSW5mbyhmcGF0aCwgc3RhdHMpO1xuICAgICAgICAvLyBpZiAoaW5mbykgdGhpcy5lbWl0KCdjaGFuZ2UnLCB0aGlzLm5hbWUsIGluZm8pO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgY2hhbmdlICR7ZnBhdGh9YCwgaW5mbyk7XG4gICAgfVxuXG4gICAgLy8gT25seSBlbWl0IGlmIHRoZSBhZGQgd2FzIHRoZSBmcm9udC1tb3N0IGZpbGVcbiAgICBhc3luYyBvbkFkZChmcGF0aDogc3RyaW5nLCBzdGF0czogU3RhdHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgLy8gQ2hlY2tpbmcgdGhpcyBlYXJseSBhdm9pZHMgcHJpbnRpbmcgdGhlXG4gICAgICAgIC8vIG1lc3NhZ2UgaWYgdnBhdGhGb3JGU1BhdGggaXMgdW5kZWZpbmVkXG4gICAgICAgIC8vIGlmICh0aGlzLnRvSWdub3JlKGZwYXRoLCBzdGF0cykpIHtcbiAgICAgICAgLy8gICAgIHJldHVybjtcbiAgICAgICAgLy8gfVxuICAgICAgICBjb25zdCB2cGluZm8gPSB0aGlzLnZwYXRoRm9yRlNQYXRoKGZwYXRoLCBzdGF0cyk7XG4gICAgICAgIGlmICghdnBpbmZvKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgb25BZGQgY291bGQgbm90IGZpbmQgbW91bnQgcG9pbnQgb3IgdnBhdGggZm9yICR7ZnBhdGh9YCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkICR7ZnBhdGh9YCwgdnBpbmZvKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkICR7ZnBhdGh9ICR7dnBpbmZvLnZwYXRofWApO1xuICAgICAgICBjb25zdCBzdGFjazogVlBhdGhEYXRhW10gPSBhd2FpdCB0aGlzLnN0YWNrRm9yVlBhdGgodnBpbmZvLnZwYXRoKTtcbiAgICAgICAgaWYgKHN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBvbkFkZCBjb3VsZCBub3QgZmluZCBtb3VudCBwb2ludHMgZm9yICR7ZnBhdGh9YCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkICR7ZnBhdGh9YCwgc3RhY2spO1xuICAgICAgICBsZXQgaSA9IDA7XG4gICAgICAgIGxldCBkZXB0aDtcbiAgICAgICAgbGV0IGVudHJ5O1xuICAgICAgICBmb3IgKGNvbnN0IHMgb2Ygc3RhY2spIHtcbiAgICAgICAgICAgIGlmIChzLmZzcGF0aCA9PT0gZnBhdGgpIHtcbiAgICAgICAgICAgICAgICBlbnRyeSA9IHM7XG4gICAgICAgICAgICAgICAgZGVwdGggPSBpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaSsrO1xuICAgICAgICB9XG4gICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgb25BZGQgbm8gc3RhY2sgZW50cnkgZm9yICR7ZnBhdGh9ICgke3ZwaW5mby52cGF0aH0pYCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkICR7ZnBhdGh9IGRlcHRoPSR7ZGVwdGh9YCwgZW50cnkpO1xuICAgICAgICBpZiAoZGVwdGggPT09IDApIHtcbiAgICAgICAgICAgIHZwaW5mby5zdGFjayA9IHN0YWNrO1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkIEVNSVQgYWRkICR7dnBpbmZvLnZwYXRofWApO1xuICAgICAgICAgICAgLy8gZm9yIChsZXQgcyBvZiBzdGFjaykge1xuICAgICAgICAgICAgLy8gICAgY29uc29sZS5sb2coYC4uLi4gJHtzLnZwYXRofSA9PT4gJHtzLmZzcGF0aH1gKTtcbiAgICAgICAgICAgIC8vIH1cbiAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEodnBpbmZvKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QodnBpbmZvKX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZW1pdCgnYWRkJywgdGhpcy5uYW1lLCB2cGluZm8pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkIFNLSVBQRUQgZW1pdCBldmVudCBmb3IgJHtmcGF0aH1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBsZXQgaW5mbyA9IHRoaXMuZmlsZUluZm8oZnBhdGgsIHN0YXRzKTtcbiAgICAgICAgLy8gaWYgKGluZm8pIHRoaXMuZW1pdCgnYWRkJywgdGhpcy5uYW1lLCBpbmZvKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIGFkZGAsIGluZm8pO1xuICAgICAgICBcbiAgICB9XG5cbiAgICAvKiBPbmx5IGVtaXQgaWYgaXQgd2FzIHRoZSBmcm9udC1tb3N0IGZpbGUgZGVsZXRlZFxuICAgIElmIHRoZXJlIGlzIGEgZmlsZSB1bmNvdmVyZWQgYnkgdGhpcywgdGhlbiBlbWl0IGFuIGFkZCBldmVudCBmb3IgdGhhdCAqL1xuICAgIGFzeW5jIG9uVW5saW5rKGZwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIG9uVW5saW5rICR7ZnBhdGh9YCk7XG4gICAgICAgIGNvbnN0IHZwaW5mbyA9IHRoaXMudnBhdGhGb3JGU1BhdGgoZnBhdGgpO1xuICAgICAgICBpZiAoIXZwaW5mbykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYG9uVW5saW5rIGNvdWxkIG5vdCBmaW5kIG1vdW50IHBvaW50IG9yIHZwYXRoIGZvciAke2ZwYXRofWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBEaXJzV2F0Y2hlciBvblVubGluayB2cGF0aERhdGEgJHtmcGF0aH0gPT0+YCwgdnBpbmZvKTtcbiAgICAgICAgY29uc3Qgc3RhY2s6IFZQYXRoRGF0YVtdID0gYXdhaXQgdGhpcy5zdGFja0ZvclZQYXRoKHZwaW5mby52cGF0aCk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBEaXJzV2F0Y2hlciBvblVubGluayBzdGFjayAke2ZwYXRofSA9PT5gLCBzdGFjayk7XG4gICAgICAgIGlmIChzdGFjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIC8qIElmIG5vIGZpbGVzIHJlbWFpbiBpbiB0aGUgc3RhY2sgZm9yIHRoaXMgdmlydHVhbCBwYXRoLCB0aGVuXG4gICAgICAgICAgICAgKiB3ZSBtdXN0IGRlY2xhcmUgaXQgdW5saW5rZWQuXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEodnBpbmZvKSkge1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUuZXJyb3IoYEludmFsaWQgVlBhdGhEYXRhICR7dXRpbC5pbnNwZWN0KHZwaW5mbyl9YCk7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFZQYXRoRGF0YSAke3V0aWwuaW5zcGVjdCh2cGluZm8pfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIG9uVW5saW5rIGVtaXQgdW5saW5rICR7dGhpcy5uYW1lfSAke3ZwaW5mby5mc3BhdGh9YCk7XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ3VubGluaycsIHRoaXMubmFtZSwgdnBpbmZvKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8qIE9uIHRoZSBvdGhlciBoYW5kLCBpZiB0aGVyZSBpcyBhbiBlbnRyeSB3ZSBzaG91bGRuJ3Qgc2VuZFxuICAgICAgICAgICAgICogYW4gdW5saW5rIGV2ZW50LiAgSW5zdGVhZCBpdCBzZWVtcyBtb3N0IGFwcHJvcHJpYXRlIHRvIHNlbmRcbiAgICAgICAgICAgICAqIGEgY2hhbmdlIGV2ZW50LlxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBjb25zdCBzZmlyc3QgPSBzdGFja1swXTtcbiAgICAgICAgICAgIGNvbnN0IHRvZW1pdCA9IDxWUGF0aERhdGE+e1xuICAgICAgICAgICAgICAgIGZzcGF0aDogc2ZpcnN0LmZzcGF0aCxcbiAgICAgICAgICAgICAgICB2cGF0aDogc2ZpcnN0LnZwYXRoLFxuICAgICAgICAgICAgICAgIG1pbWU6IG1pbWUuZ2V0VHlwZShzZmlyc3QuZnNwYXRoKSxcbiAgICAgICAgICAgICAgICBtb3VudGVkOiBzZmlyc3QubW91bnRlZCxcbiAgICAgICAgICAgICAgICBtb3VudFBvaW50OiBzZmlyc3QubW91bnRQb2ludCxcbiAgICAgICAgICAgICAgICBwYXRoSW5Nb3VudGVkOiBzZmlyc3QucGF0aEluTW91bnRlZCxcbiAgICAgICAgICAgICAgICBzdGFja1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEodG9lbWl0KSkge1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUuZXJyb3IoYEludmFsaWQgVlBhdGhEYXRhICR7dXRpbC5pbnNwZWN0KHRvZW1pdCl9YCk7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFZQYXRoRGF0YSAke3V0aWwuaW5zcGVjdCh0b2VtaXQpfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIG9uVW5saW5rIGVtaXQgY2hhbmdlICR7dGhpcy5uYW1lfSAke3RvZW1pdC5mc3BhdGh9YCk7XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2NoYW5nZScsIHRoaXMubmFtZSwgdG9lbWl0KTtcbiAgICAgICAgfVxuICAgICAgICAvLyBsZXQgaW5mbyA9IHRoaXMuZmlsZUluZm8oZnBhdGgsIHVuZGVmaW5lZCk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBEaXJzV2F0Y2hlciB1bmxpbmsgJHtmcGF0aH1gKTtcbiAgICAgICAgLy8gaWYgKGluZm8pIHRoaXMuZW1pdCgndW5saW5rJywgdGhpcy5uYW1lLCBpbmZvKTtcbiAgICB9XG5cbiAgICBvblJlYWR5KCk6IHZvaWQge1xuICAgICAgICAvLyBjb25zb2xlLmxvZygnRGlyc1dhdGNoZXI6IEluaXRpYWwgc2NhbiBjb21wbGV0ZS4gUmVhZHkgZm9yIGNoYW5nZXMnKTtcbiAgICAgICAgdGhpcy5lbWl0KCdyZWFkeScsIHRoaXMubmFtZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhbiBvYmplY3QgcmVwcmVzZW50aW5nIGFsbCB0aGUgcGF0aHMgb24gdGhlIGZpbGUgc3lzdGVtIGJlaW5nXG4gICAgICogd2F0Y2hlZCBieSB0aGlzIEZTV2F0Y2hlciBpbnN0YW5jZS4gVGhlIG9iamVjdCdzIGtleXMgYXJlIGFsbCB0aGUgXG4gICAgICogZGlyZWN0b3JpZXMgKHVzaW5nIGFic29sdXRlIHBhdGhzIHVubGVzcyB0aGUgY3dkIG9wdGlvbiB3YXMgdXNlZCksXG4gICAgICogYW5kIHRoZSB2YWx1ZXMgYXJlIGFycmF5cyBvZiB0aGUgbmFtZXMgb2YgdGhlIGl0ZW1zIGNvbnRhaW5lZCBpbiBlYWNoIGRpcmVjdG9yeS5cbiAgICAgKi9cbiAgICBnZXRXYXRjaGVkKCkge1xuICAgICAgICBpZiAodGhpcy4jd2F0Y2hlcikgcmV0dXJuIHRoaXMuI3dhdGNoZXIuZ2V0V2F0Y2hlZCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERldGVybWluZSBpZiB0aGUgZnNwYXRoIGlzIHRvIGJlIGlnbm9yZWRcbiAgICAgKiBAcGFyYW0gZnNwYXRoIFxuICAgICAqIEBwYXJhbSBzdGF0cyBcbiAgICAgKiBAcmV0dXJucyBcbiAgICAgKi9cbiAgICB0b0lnbm9yZShmc3BhdGg6IHN0cmluZywgc3RhdHM/OiBTdGF0cyk6IGJvb2xlYW4ge1xuXG4gICAgICAgIGZvciAoY29uc3QgZGlyIG9mIHRoaXMuZGlycykge1xuXG4gICAgICAgICAgICAvLyBDaGVjayBpZiB0aGlzIGRpcnMgZW50cnkgY29ycmVzcG9uZHNcbiAgICAgICAgICAgIC8vIHRvIHRoZSBmc3BhdGhcblxuICAgICAgICAgICAgLy8gVGhpcyB3aWxsIHN0cmlwIG9mZiBhIGxlYWRpbmcgc2xhc2gsXG4gICAgICAgICAgICAvLyBhbmQgZW5zdXJlIHRoYXQgaXQgZW5kcyB3aXRoIGEgc2xhc2guXG5cbiAgICAgICAgICAgIGNvbnN0IG0gPSBkaXIubW91bnRlZC5zdGFydHNXaXRoKCcvJylcbiAgICAgICAgICAgICAgICAgICAgPyBkaXIubW91bnRlZC5zdWJzdHJpbmcoMSlcbiAgICAgICAgICAgICAgICAgICAgOiBkaXIubW91bnRlZDtcbiAgICAgICAgICAgIGNvbnN0IG0yID0gbS5lbmRzV2l0aCgnLycpXG4gICAgICAgICAgICAgICAgICAgICA/IG1cbiAgICAgICAgICAgICAgICAgICAgIDogKG0rJy8nKTtcbiAgICAgICAgICAgIGlmICghZnNwYXRoLnN0YXJ0c1dpdGgobTIpKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENoZWNrIHRvIHNlZSBpZiB3ZSdyZSBzdXBwb3NlZCB0byBpZ25vcmUgdGhlIGZpbGVcbiAgICAgICAgICAgIGlmIChkaXIuaWdub3JlKSB7XG4gICAgICAgICAgICAgICAgbGV0IGlnbm9yZXM7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBkaXIuaWdub3JlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBpZ25vcmVzID0gWyBkaXIuaWdub3JlIF07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWdub3JlcyA9IGRpci5pZ25vcmU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxldCBpZ25vcmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGkgb2YgaWdub3Jlcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAobWluaW1hdGNoKGZzcGF0aCwgaSkpIGlnbm9yZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBkaXIuaWdub3JlICR7ZnNwYXRofSAke2l9ID0+ICR7aWdub3JlfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoaWdub3JlKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB0b0lnbm9yZSBpZ25vcmluZyAke2ZzcGF0aH0gJHt1dGlsLmluc3BlY3QodGhpcy5kaXJzKX1gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHZwYXRoRm9yRlNQYXRoKGZzcGF0aDogc3RyaW5nLCBzdGF0cz86IFN0YXRzKTogVlBhdGhEYXRhIHtcbiAgICAgICAgZm9yIChjb25zdCBkaXIgb2YgdGhpcy5kaXJzKSB7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIHRvIHNlZSBpZiB3ZSdyZSBzdXBwb3NlZCB0byBpZ25vcmUgdGhlIGZpbGVcbiAgICAgICAgICAgIGlmIChkaXIuaWdub3JlKSB7XG4gICAgICAgICAgICAgICAgbGV0IGlnbm9yZXM7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBkaXIuaWdub3JlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBpZ25vcmVzID0gWyBkaXIuaWdub3JlIF07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWdub3JlcyA9IGRpci5pZ25vcmU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxldCBpZ25vcmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGkgb2YgaWdub3Jlcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAobWluaW1hdGNoKGZzcGF0aCwgaSkpIGlnbm9yZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBkaXIuaWdub3JlICR7ZnNwYXRofSAke2l9ID0+ICR7aWdub3JlfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoaWdub3JlKSBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gVGhpcyBlbnN1cmVzIHdlIGFyZSBtYXRjaGluZyBvbiBkaXJlY3RvcnkgYm91bmRhcmllc1xuICAgICAgICAgICAgLy8gT3RoZXJ3aXNlIGZzcGF0aCBcIi9wYXRoL3RvL2xheW91dHMtZXh0cmEvbGF5b3V0Lm5qa1wiIG1pZ2h0XG4gICAgICAgICAgICAvLyBtYXRjaCBkaXIubW91bnRlZCBcIi9wYXRoL3RvL2xheW91dHNcIi5cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgdnBhdGhGb3JGU1BhdGggJHtkaXIubW91bnRlZH0gJHt0eXBlb2YgZGlyLm1vdW50ZWR9YCwgZGlyKTtcbiAgICAgICAgICAgIGNvbnN0IGRpcm1vdW50ZWQgPVxuICAgICAgICAgICAgICAgIChkaXIgJiYgZGlyLm1vdW50ZWQpXG4gICAgICAgICAgICAgICAgICAgID8gKGRpci5tb3VudGVkLmNoYXJBdChkaXIubW91bnRlZC5sZW5ndGggLSAxKSA9PSAnLycpXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGRpci5tb3VudGVkXG4gICAgICAgICAgICAgICAgICAgICAgICA6IChkaXIubW91bnRlZCArICcvJylcbiAgICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICBpZiAoZGlybW91bnRlZCAmJiBmc3BhdGguaW5kZXhPZihkaXJtb3VudGVkKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhdGhJbk1vdW50ZWQgPSBmc3BhdGguc3Vic3RyaW5nKGRpci5tb3VudGVkLmxlbmd0aCkuc3Vic3RyaW5nKDEpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHZwYXRoID0gZGlyLm1vdW50UG9pbnQgPT09ICcvJ1xuICAgICAgICAgICAgICAgICAgICAgICAgPyBwYXRoSW5Nb3VudGVkXG4gICAgICAgICAgICAgICAgICAgICAgICA6IHBhdGguam9pbihkaXIubW91bnRQb2ludCwgcGF0aEluTW91bnRlZCk7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHZwYXRoRm9yRlNQYXRoIGZzcGF0aCAke2ZzcGF0aH0gZGlyLm1vdW50UG9pbnQgJHtkaXIubW91bnRQb2ludH0gcGF0aEluTW91bnRlZCAke3BhdGhJbk1vdW50ZWR9IHZwYXRoICR7dnBhdGh9YCk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmV0ID0gPFZQYXRoRGF0YT57XG4gICAgICAgICAgICAgICAgICAgIGZzcGF0aDogZnNwYXRoLFxuICAgICAgICAgICAgICAgICAgICB2cGF0aDogdnBhdGgsXG4gICAgICAgICAgICAgICAgICAgIG1pbWU6IG1pbWUuZ2V0VHlwZShmc3BhdGgpLFxuICAgICAgICAgICAgICAgICAgICBtb3VudGVkOiBkaXIubW91bnRlZCxcbiAgICAgICAgICAgICAgICAgICAgbW91bnRQb2ludDogZGlyLm1vdW50UG9pbnQsXG4gICAgICAgICAgICAgICAgICAgIHBhdGhJbk1vdW50ZWRcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGlmIChzdGF0cykge1xuICAgICAgICAgICAgICAgICAgICByZXQuc3RhdHNNdGltZSA9IHN0YXRzLm10aW1lTXM7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVXNlIHRoZSBzeW5jIHZlcnNpb24gdG9cbiAgICAgICAgICAgICAgICAgICAgLy8gbWFpbnRhaW4gdGhpcyBmdW5jdGlvblxuICAgICAgICAgICAgICAgICAgICAvLyBhcyBub24tYXN5bmNcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBzdGF0cyA9IGZzU3RhdFN5bmMocmV0LmZzcGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXQuc3RhdHNNdGltZSA9IHN0YXRzLm10aW1lTXM7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgVlBhdGhEYXRhIGlnbm9yaW5nIFNUQVRTIGVycm9yICR7cmV0LmZzcGF0aH0gLSAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0LnN0YXRzTXRpbWUgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YShyZXQpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QocmV0KX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBObyBkaXJlY3RvcnkgZm91bmQgZm9yIHRoaXMgZmlsZVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGFzeW5jIHN0YWNrRm9yVlBhdGgodnBhdGg6IHN0cmluZyk6IFByb21pc2U8VlBhdGhEYXRhW10+IHtcbiAgICAgICAgY29uc3QgcmV0OiBWUGF0aERhdGFbXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IGRpciBvZiB0aGlzLmRpcnMpIHtcbiAgICAgICAgICAgIGlmIChkaXIubW91bnRQb2ludCA9PT0gJy8nKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGF0aEluTW91bnRlZCA9IHZwYXRoO1xuICAgICAgICAgICAgICAgIGNvbnN0IGZzcGF0aCA9IHBhdGguam9pbihkaXIubW91bnRlZCwgcGF0aEluTW91bnRlZCk7XG4gICAgICAgICAgICAgICAgbGV0IHN0YXRzO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRzID0gYXdhaXQgZnMuc3RhdChmc3BhdGgpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBzdGF0cyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFzdGF0cykgY29udGludWU7XG4gICAgICAgICAgICAgICAgY29uc3QgdG9wdXNoID0gPFZQYXRoRGF0YT57XG4gICAgICAgICAgICAgICAgICAgIGZzcGF0aDogZnNwYXRoLFxuICAgICAgICAgICAgICAgICAgICB2cGF0aDogdnBhdGgsXG4gICAgICAgICAgICAgICAgICAgIG1pbWU6IG1pbWUuZ2V0VHlwZShmc3BhdGgpLFxuICAgICAgICAgICAgICAgICAgICBtb3VudGVkOiBkaXIubW91bnRlZCxcbiAgICAgICAgICAgICAgICAgICAgbW91bnRQb2ludDogZGlyLm1vdW50UG9pbnQsXG4gICAgICAgICAgICAgICAgICAgIHBhdGhJbk1vdW50ZWQ6IHBhdGhJbk1vdW50ZWRcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEodG9wdXNoKSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgVlBhdGhEYXRhICR7dXRpbC5pbnNwZWN0KHRvcHVzaCl9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldC5wdXNoKHRvcHVzaCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRpcm1vdW50cHQgPVxuICAgICAgICAgICAgICAgICAgICAoZGlyICYmIGRpci5tb3VudFBvaW50KVxuICAgICAgICAgICAgICAgICAgICAgICAgPyAoZGlyLm1vdW50UG9pbnQuY2hhckF0KGRpci5tb3VudFBvaW50Lmxlbmd0aCAtIDEpID09PSAnLycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBkaXIubW91bnRQb2ludFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogKGRpci5tb3VudFBvaW50ICsgJy8nKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHN0YWNrRm9yVlBhdGggdnBhdGggJHt2cGF0aH0gZGlyLm1vdW50ZWQgJHtkaXIubW91bnRQb2ludH0gZGlybW91bnRwdCAke2Rpcm1vdW50cHR9YCk7XG4gICAgICAgICAgICAgICAgaWYgKGRpcm1vdW50cHQgJiYgdnBhdGguaW5kZXhPZihkaXJtb3VudHB0KSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyA+IGNvbnN0IHZwYXRoID0gJ2Zvby9iYXIvYmF6Lmh0bWwnO1xuICAgICAgICAgICAgICAgICAgICAvLyA+IGNvbnN0IG0gPSAnZm9vL2Jhcic7XG4gICAgICAgICAgICAgICAgICAgIC8vID4gbGV0IHBhdGhJbk1vdW50ZWQgPSB2cGF0aC5zdWJzdHJpbmcobS5sZW5ndGggKyAxKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gPiBwYXRoSW5Nb3VudGVkXG4gICAgICAgICAgICAgICAgICAgIC8vICdiYXouaHRtbCdcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGF0aEluTW91bnRlZCA9IHZwYXRoLnN1YnN0cmluZyhkaXJtb3VudHB0Lmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZzcGF0aCA9IHBhdGguam9pbihkaXIubW91bnRlZCwgcGF0aEluTW91bnRlZCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBzdGFja0ZvclZQYXRoIHZwYXRoICR7dnBhdGh9IHBhdGhJbk1vdW50ZWQgJHtwYXRoSW5Nb3VudGVkfSBmc3BhdGggJHtmc3BhdGh9YCk7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzdGF0cztcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzID0gYXdhaXQgZnMuc3RhdChmc3BhdGgpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICghc3RhdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBzdGFja0ZvclZQYXRoIHZwYXRoICR7dnBhdGh9IGRpZCBub3QgZmluZCBmcy5zdGF0cyBmb3IgJHtmc3BhdGh9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0b3B1c2ggPSA8VlBhdGhEYXRhPntcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzcGF0aDogZnNwYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgdnBhdGg6IHZwYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWltZTogbWltZS5nZXRUeXBlKGZzcGF0aCksXG4gICAgICAgICAgICAgICAgICAgICAgICBtb3VudGVkOiBkaXIubW91bnRlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vdW50UG9pbnQ6IGRpci5tb3VudFBvaW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aEluTW91bnRlZDogcGF0aEluTW91bnRlZFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWlzVlBhdGhEYXRhKHRvcHVzaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QodG9wdXNoKX1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXQucHVzaCh0b3B1c2gpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBzdGFja0ZvclZQYXRoIHZwYXRoICR7dnBhdGh9IGRpZCBub3QgbWF0Y2ggJHtkaXJtb3VudHB0fWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyAoa25vY2sgb24gd29vZCkgRXZlcnkgZW50cnkgaW4gYHJldGAgaGFzIGFscmVhZHkgYmVlbiB2ZXJpZmllZFxuICAgICAgICAvLyBhcyBiZWluZyBhIGNvcnJlY3QgVlBhdGhEYXRhIG9iamVjdFxuICAgICAgICByZXR1cm4gcmV0O1xuICAgIH1cblxuICAgIGFzeW5jIGNsb3NlKCkge1xuICAgICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygnY2hhbmdlJyk7XG4gICAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdhZGQnKTtcbiAgICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3VubGluaycpO1xuICAgICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVhZHknKTtcbiAgICAgICAgaWYgKHRoaXMuI3dhdGNoZXIpIHtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBDbG9zaW5nIHdhdGNoZXIgJHt0aGlzLm5hbWV9YCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLiN3YXRjaGVyLmNsb3NlKCk7XG4gICAgICAgICAgICB0aGlzLiN3YXRjaGVyID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgfVxufVxuIl19