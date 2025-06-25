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
import micromatch from 'micromatch';
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
                    if (micromatch.isMatch(fspath, i))
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
                    if (micromatch.isMatch(fspath, i))
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2F0Y2hlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2xpYi93YXRjaGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUNBLE9BQU8sRUFDSCxRQUFRLElBQUksRUFBRSxFQUNkLFFBQVEsSUFBSSxVQUFVLEVBRXpCLE1BQU0sU0FBUyxDQUFDO0FBQ2pCLE9BQU8sUUFBd0MsTUFBTSxVQUFVLENBQUM7QUFFaEUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUNqQyxPQUFPLGFBQWEsTUFBTSx3QkFBd0IsQ0FBQztBQUNuRCxPQUFPLFVBQVUsTUFBTSxxQkFBcUIsQ0FBQztBQUU3QyxNQUFNLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFFakQsT0FBTyxLQUFLLElBQUksTUFBTSxXQUFXLENBQUM7QUFDbEMsT0FBTyxLQUFLLElBQUksTUFBTSxXQUFXLENBQUM7QUFDbEMsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUMzQyxPQUFPLFVBQVUsTUFBTSxZQUFZLENBQUM7QUFFcEM7Ozs7Ozs7Ozs7Ozs7OztHQWVHO0FBQ0gsTUFBTSxVQUFVLFVBQVUsQ0FBQyxPQUFPLEVBQUUsS0FBZ0I7SUFDaEQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDaEMsQ0FBQztBQW9ERDs7Ozs7R0FLRztBQUNILE1BQU0sQ0FBQyxNQUFNLFdBQVcsR0FBRyxDQUFDLE1BQU0sRUFBdUIsRUFBRTtJQUN2RCxJQUFJLE9BQU8sTUFBTSxLQUFLLFdBQVc7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUNoRCxJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVE7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUM3QyxJQUFJLE9BQU8sTUFBTSxDQUFDLElBQUksS0FBSyxXQUFXO1dBQ2xDLE1BQU0sQ0FBQyxJQUFJLEtBQUssSUFBSTtX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QztvQkFDRixJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7d0JBQ3ZCLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQXFCLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO29CQUNqRSxDQUFDO29CQUNELEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ3JCLENBQUM7cUJBQU0sQ0FBQztvQkFDSiwyRUFBMkU7Z0JBQy9FLENBQUM7WUFDTCxDQUFDO1FBQ0wsQ0FBQztRQUNELGlFQUFpRTtRQUNqRSxzQ0FBc0M7UUFDdEMsT0FBTyxHQUFHLENBQUM7SUFDZixDQUFDO0lBRUQsS0FBSyxDQUFDLEtBQUs7UUFDUCxJQUFJLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDbEMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQy9CLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNsQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDakMsSUFBSSx1QkFBQSxJQUFJLDRCQUFTLEVBQUUsQ0FBQztZQUNoQiwrQ0FBK0M7WUFDL0MsTUFBTSx1QkFBQSxJQUFJLDRCQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDNUIsdUJBQUEsSUFBSSx3QkFBWSxTQUFTLE1BQUEsQ0FBQztRQUM5QixDQUFDO0lBQ0wsQ0FBQztDQUNKIiwic291cmNlc0NvbnRlbnQiOlsiXG5pbXBvcnQge1xuICAgIHByb21pc2VzIGFzIGZzLFxuICAgIHN0YXRTeW5jIGFzIGZzU3RhdFN5bmMsXG4gICAgU3RhdHNcbn0gZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgY2hva2lkYXIsIHsgRlNXYXRjaGVyLCBDaG9raWRhck9wdGlvbnMgfSBmcm9tICdjaG9raWRhcic7XG5cbmltcG9ydCB7IE1pbWUgfSBmcm9tICdtaW1lL2xpdGUnO1xuaW1wb3J0IHN0YW5kYXJkVHlwZXMgZnJvbSAnbWltZS90eXBlcy9zdGFuZGFyZC5qcyc7XG5pbXBvcnQgb3RoZXJUeXBlcyBmcm9tICdtaW1lL3R5cGVzL290aGVyLmpzJztcblxuY29uc3QgbWltZSA9IG5ldyBNaW1lKHN0YW5kYXJkVHlwZXMsIG90aGVyVHlwZXMpO1xuXG5pbXBvcnQgKiBhcyB1dGlsIGZyb20gJ25vZGU6dXRpbCc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdub2RlOmV2ZW50cyc7XG5pbXBvcnQgbWljcm9tYXRjaCBmcm9tICdtaWNyb21hdGNoJztcblxuLyoqXG4gKiBDb25maWd1cmUgdGhlIE1JTUUgcGFja2FnZSB3aXRoIGFkZGl0aW9uYWwgY29udGVudFxuICogdHlwZXMuICBUaGlzIGlzIG1lYW50IHRvIGhhbmRsZSBmaWxlcyBmb3Igd2hpY2hcbiAqIG5vIG9mZmljaWFsIHJlZ2lzdHJhdGlvbiBoYXMgYmVlbiBtYWRlLiAgRm9yIGV4YW1wbGUsXG4gKiBBc2NpaURvYyBmaWxlcyBhcmUgdXNlZnVsIGJ1dCBkbyBub3QgaGF2ZSByZWdpc3RlcmVkXG4gKiBNSU1FIHR5cGVzLlxuICogXG4gKiBwZXI6IGh0dHBzOi8vYXNjaWlkb2N0b3Iub3JnL2RvY3MvZmFxL1xuICogcGVyOiBodHRwczovL2dpdGh1Yi5jb20vYXNjaWlkb2N0b3IvYXNjaWlkb2N0b3IvaXNzdWVzLzI1MDJcbiAqIFxuICogRm9yIEFzY2lpRG9jLCB0aGUgbWFwcGluZyBtaWdodCBiZTpcbiAqIHsndGV4dC94LWFzY2lpZG9jJzogWydhZG9jJywgJ2FzY2lpZG9jJ119XG4gKiBcbiAqIEBwYXJhbSBtYXBwaW5nIFxuICogQHBhcmFtIGZvcmNlIFxuICovXG5leHBvcnQgZnVuY3Rpb24gbWltZWRlZmluZShtYXBwaW5nLCBmb3JjZSA/OiBib29sZWFuKSB7XG4gICAgbWltZS5kZWZpbmUobWFwcGluZywgZm9yY2UpO1xufVxuXG5leHBvcnQgdHlwZSBWUGF0aERhdGEgPSB7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZnVsbCBmaWxlLXN5c3RlbSBwYXRoIGZvciB0aGUgZmlsZS5cbiAgICAgKiBlLmcuIC9ob21lL3BhdGgvdG8vYXJ0aWNsZS1uYW1lLmh0bWwubWRcbiAgICAgKi9cbiAgICBmc3BhdGg6IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIFRoZSB2aXJ0dWFsIHBhdGgsIHJvb3RlZCBhdCB0aGUgdG9wXG4gICAgICogZGlyZWN0b3J5IG9mIHRoZSBmaWxlc3lzdGVtLCB3aXRoIG5vXG4gICAgICogbGVhZGluZyBzbGFzaC5cbiAgICAgKi9cbiAgICB2cGF0aDogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG1pbWUgdHlwZSBvZiB0aGUgZmlsZS4gIFRoZSBtaW1lIHR5cGVzXG4gICAgICogYXJlIGRldGVybWluZWQgZnJvbSB0aGUgZmlsZSBleHRlbnNpb25cbiAgICAgKiB1c2luZyB0aGUgJ21pbWUnIHBhY2thZ2UuXG4gICAgICovXG4gICAgbWltZSA/OiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZmlsZS1zeXN0ZW0gcGF0aCB3aGljaCBpcyBtb3VudGVkXG4gICAgICogaW50byB0aGUgdmlydHVhbCBmaWxlIHNwYWNlLlxuICAgICAqL1xuICAgIG1vdW50ZWQ6IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIFRoZSB2aXJ0dWFsIGRpcmVjdG9yeSBvZiB0aGUgbW91bnRcbiAgICAgKiBlbnRyeSBpbiB0aGUgZGlyZWN0b3J5IHN0YWNrLlxuICAgICAqL1xuICAgIG1vdW50UG9pbnQ6IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIFRoZSByZWxhdGl2ZSBwYXRoIHVuZGVybmVhdGggdGhlIG1vdW50UG9pbnQuXG4gICAgICovXG4gICAgcGF0aEluTW91bnRlZDogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG1UaW1lIHZhbHVlIGZyb20gU3RhdHNcbiAgICAgKi9cbiAgICBzdGF0c010aW1lOiBudW1iZXI7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZmlsZS1zeXN0ZW0gc3RhY2sgcmVsYXRlZCB0byB0aGUgZmlsZS5cbiAgICAgKi9cbiAgICBzdGFjayA/OiBWUGF0aERhdGFbXTtcbn1cblxuLyoqXG4gKiBUeXBlZ3VhcmQgZnVuY3Rpb24gZW5zdXJpbmcgdGhhdCBhbiBvYmplY3RcbiAqIGlzIGEgVlBhdGhEYXRhIG9iamVjdC5cbiAqIEBwYXJhbSB2cGluZm8gVGhlIG9iamVjdCB0byBjaGVja1xuICogQHJldHVybnMgdHJ1ZSBpZiBpdCBpcyBhIFZQYXRoRGF0YSwgZmFsc2Ugb3RoZXJ3aXNlXG4gKi9cbmV4cG9ydCBjb25zdCBpc1ZQYXRoRGF0YSA9ICh2cGluZm8pOiB2cGluZm8gaXMgVlBhdGhEYXRhID0+IHtcbiAgICBpZiAodHlwZW9mIHZwaW5mbyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodHlwZW9mIHZwaW5mbyAhPT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodHlwZW9mIHZwaW5mby5taW1lICE9PSAndW5kZWZpbmVkJ1xuICAgICAmJiB2cGluZm8ubWltZSAhPT0gbnVsbFxuICAgICAmJiB0eXBlb2YgdnBpbmZvLm1pbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB2cGluZm8uZnNwYXRoICE9PSAnc3RyaW5nJ1xuICAgICB8fCB0eXBlb2YgdnBpbmZvLnZwYXRoICE9PSAnc3RyaW5nJ1xuICAgICB8fCB0eXBlb2YgdnBpbmZvLm1vdW50ZWQgIT09ICdzdHJpbmcnXG4gICAgIHx8IHR5cGVvZiB2cGluZm8ubW91bnRQb2ludCAhPT0gJ3N0cmluZydcbiAgICAgfHwgdHlwZW9mIHZwaW5mby5wYXRoSW5Nb3VudGVkICE9PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgdnBpbmZvLnN0YWNrID09PSAndW5kZWZpbmVkJykgcmV0dXJuIHRydWU7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodnBpbmZvLnN0YWNrKSkge1xuICAgICAgICBmb3IgKGNvbnN0IGluZiBvZiB2cGluZm8uc3RhY2spIHtcbiAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEoaW5mKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufTtcblxuZXhwb3J0IHR5cGUgZGlyVG9XYXRjaCA9IHtcbiAgICAvKipcbiAgICAgKiBUaGUgZmlsZXN5c3RlbSBwYXRoIHRvIFwibW91bnRcIi5cbiAgICAgKi9cbiAgICBtb3VudGVkOiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcGF0aCB3aXRoaW4gdGhlIHZpcnR1YWwgZmlsZXN5c3RlbSB3aGVyZSB0aGlzIHdpbGwgYXBwZWFyLlxuICAgICAqL1xuICAgIG1vdW50UG9pbnQ6IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIE1ldGFkYXRhIG9iamVjdCB0byB1c2Ugd2l0aGluIHRoZVxuICAgICAqIHN1Yi1oaWVyYXJjaHkuXG4gICAgICovXG4gICAgYmFzZU1ldGFkYXRhPzogYW55O1xuXG4gICAgLyoqXG4gICAgICogT3B0aW9uYWwgYXJyYXkgb2Ygc3RyaW5ncyBjb250YWluaW5nIGdsb2JzIGZvciBtYXRjaGluZ1xuICAgICAqIGZpbGVzIHRvIGlnbm9yZS5cbiAgICAgKi9cbiAgICBpZ25vcmU/OiBzdHJpbmdbXTtcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgd2hldGhlciB0aGUge0Bjb2RlIGRpcn0gaXMgYSB7QGNvZGUgZGlyVG9XYXRjaH0uXG4gKi9cbmV4cG9ydCBjb25zdCBpc0RpclRvV2F0Y2ggPSAoZGlyOiBhbnkpOiBkaXIgaXMgZGlyVG9XYXRjaCA9PiB7XG4gICAgaWYgKHR5cGVvZiBkaXIgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiBkaXIgIT09ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG5cbiAgICBpZiAoJ21vdW50ZWQnIGluIGRpciAmJiB0eXBlb2YgZGlyLm1vdW50ZWQgIT09ICdzdHJpbmcnKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKCdtb3VudFBvaW50JyBpbiBkaXIgJiYgdHlwZW9mIGRpci5tb3VudFBvaW50ICE9PSAnc3RyaW5nJykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICgnaWdub3JlJyBpbiBkaXIgJiYgdHlwZW9mIGRpci5pZ25vcmUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIHR5cGVvZiBkaXIuaWdub3JlICE9PSAnc3RyaW5nJ1xuICAgICAgICAgJiYgIUFycmF5LmlzQXJyYXkoZGlyLmlnbm9yZSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgdHlwZW9mIGRpci5pZ25vcmUgPT09ICdzdHJpbmcnXG4gICAgICAgICAmJiBBcnJheS5pc0FycmF5KGRpci5pZ25vcmUpXG4gICAgICAgICkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gSXQgbXVzdCBhdCBsZWFzdCBoYXZlIHRoZSAnbW91bnRlZCcgZmllbGQuXG4gICAgaWYgKCEoXG4gICAgICAgICdtb3VudGVkJyBpbiBkaXJcbiAgICAgJiYgdHlwZW9mIGRpci5tb3VudGVkID09PSAnc3RyaW5nJ1xuICAgICkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xufVxuXG5leHBvcnQgY2xhc3MgRGlyc1dhdGNoZXIgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuXG4gICAgI2RpcnM6IGRpclRvV2F0Y2hbXTtcbiAgICAjd2F0Y2hlcj86IEZTV2F0Y2hlcjtcbiAgICAjbmFtZTogc3RyaW5nO1xuICAgICNvcHRpb25zOiBDaG9raWRhck9wdGlvbnM7XG4gICAgI2Jhc2VkaXI7XG4gICAgLy8gI3F1ZXVlO1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIG5hbWUgc3RyaW5nIGdpdmluZyB0aGUgbmFtZSBmb3IgdGhpcyB3YXRjaGVyXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBEaXJzV2F0Y2hlciAke25hbWV9IGNvbnN0cnVjdG9yYCk7XG4gICAgICAgIHRoaXMuI25hbWUgPSBuYW1lO1xuICAgICAgICAvLyBUT0RPIGlzIHRoZXJlIGEgbmVlZCB0byBtYWtlIHRoaXMgY3VzdG9taXphYmxlP1xuICAgICAgICB0aGlzLiNvcHRpb25zID0ge1xuICAgICAgICAgICAgcGVyc2lzdGVudDogdHJ1ZSwgaWdub3JlSW5pdGlhbDogZmFsc2UsIGF3YWl0V3JpdGVGaW5pc2g6IHRydWUsIGFsd2F5c1N0YXQ6IHRydWUsXG4gICAgICAgICAgICBpZ25vcmVkOlxuICAgICAgICAgICAgICAgIChfZnNwYXRoOiBzdHJpbmcsIHN0YXRzPzogU3RhdHMpOiBib29sZWFuID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy50b0lnbm9yZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy50b0lnbm9yZShfZnNwYXRoLCBzdGF0cyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy4jYmFzZWRpciA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGRpcmVjdG9yeSBzdGFjayBmb3JcbiAgICAgKiB0aGlzIFdhdGNoZXIuXG4gICAgICovXG4gICAgZ2V0IGRpcnMoKTogZGlyVG9XYXRjaFtdIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuI2RpcnM7IH1cblxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyB0aGUgbmFtZSBmb3IgdGhpcyBXYXRjaGVyXG4gICAgICovXG4gICAgZ2V0IG5hbWUoKSB7IHJldHVybiB0aGlzLiNuYW1lOyB9XG5cbiAgICAvKipcbiAgICAgKiBDaGFuZ2VzIHRoZSB1c2Ugb2YgYWJzb2x1dGUgcGF0aG5hbWVzLCB0byBwYXRocyByZWxhdHZlIHRvIHRoZSBnaXZlbiBkaXJlY3RvcnkuXG4gICAgICogVGhpcyBtdXN0IGJlIGNhbGxlZCBiZWZvcmUgdGhlIDxlbT53YXRjaDwvZW0+IG1ldGhvZCBpcyBjYWxsZWQuICBUaGUgcGF0aHNcbiAgICAgKiB5b3Ugc3BlY2lmeSB0byB3YXRjaCBtdXN0IGJlIHJlbGF0aXZlIHRvIHRoZSBnaXZlbiBkaXJlY3RvcnkuXG4gICAgICovXG4gICAgc2V0IGJhc2VkaXIoY3dkKSB7IHRoaXMuI2Jhc2VkaXIgPSBjd2Q7IH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgdGhlIENob2tpZGFyIHdhdGNoZXIsIGJhc2VjIG9uIHRoZSBkaXJlY3RvcmllcyB0byB3YXRjaC4gIFRoZSA8ZW0+ZGlyc3BlYzwvZW0+IG9wdGlvbiBjYW4gYmUgYSBzdHJpbmcsXG4gICAgICogb3IgYW4gb2JqZWN0LiAgSWYgaXQgaXMgYSBzdHJpbmcsIGl0IGlzIGEgZmlsZXN5c3RlbSBwYXRobmFtZSB0aGF0IHdpbGwgYmVcbiAgICAgKiBhc3NvY2lhdGVkIHdpdGggdGhlIHJvb3Qgb2YgdGhlIHZpcnR1YWwgZmlsZXN5c3RlbS4gIEFuIG9iamVjdCB3aWxsIGxvb2tcbiAgICAgKiBsaWtlIHRoaXM6XG4gICAgICogXG4gICAgICogPGNvZGU+XG4gICAgICoge1xuICAgICAqICAgbW91bnRlZDogJy9wYXRoL3RvL21vdW50ZWQnLFxuICAgICAqICAgbW91bnRQb2ludDogJ21vdW50ZWQnXG4gICAgICogfVxuICAgICAqIDwvY29kZT5cbiAgICAgKiBcbiAgICAgKiBUaGUgPHR0Pm1vdW50UG9pbnQ8L3R0PiBmaWVsZCBpcyBhIGZ1bGwgcGF0aCB0byB0aGUgZGlyZWN0b3J5IG9mIGludGVyZXN0LiAgVGhlXG4gICAgICogPHR0Pm1vdW50UG9pbnQ8L3R0PiBmaWVsZCBkZXNjcmliZXMgYSBwcmVmaXggd2l0aGluIHRoZSB2aXJ0dWFsIGZpbGVzeXN0ZW0uXG4gICAgICogXG4gICAgICogQHBhcmFtIGRpcnNwZWMgXG4gICAgICovXG4gICAgYXN5bmMgd2F0Y2goZGlyczogZGlyVG9XYXRjaFtdIHwgc3RyaW5nKSB7XG4gICAgICAgIGlmICh0aGlzLiN3YXRjaGVyKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFdhdGNoZXIgYWxyZWFkeSBzdGFydGVkIGZvciAke3RoaXMuI3dhdGNoZXJ9YCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBkaXJzID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgZGlycyA9IFsge1xuICAgICAgICAgICAgICAgIG1vdW50ZWQ6IGRpcnMsIG1vdW50UG9pbnQ6ICcvJ1xuICAgICAgICAgICAgfSBdO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkaXJzID09PSAnb2JqZWN0J1xuICAgICAgICAgICAgICAgJiYgIUFycmF5LmlzQXJyYXkoZGlycykpIHtcbiAgICAgICAgICAgIGlmICghaXNEaXJUb1dhdGNoKGRpcnMpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXRjaCAtIGRpcmVjdG9yeSBzcGVjIG5vdCBhIGRpclRvV2F0Y2ggLSAke3V0aWwuaW5zcGVjdChkaXJzKX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRpcnMgPSBbIGRpcnMgXTtcbiAgICAgICAgfSBlbHNlIGlmICghQXJyYXkuaXNBcnJheShkaXJzKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXRjaCAtIHRoZSBkaXJzIGFyZ3VtZW50IGlzIGluY29ycmVjdCAke3V0aWwuaW5zcGVjdChkaXJzKX1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBjb25zb2xlLmxvZyhgd2F0Y2ggZGlycz1gLCBkaXJzKTtcbiAgICAgICAgY29uc3QgdG93YXRjaCA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IGRpciBvZiBkaXJzKSB7XG4gICAgICAgICAgICBpZiAoIWlzRGlyVG9XYXRjaChkaXIpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXRjaCBkaXJlY3Rvcnkgc3BlYyBpbiBkaXJzIG5vdCBhIGRpclRvV2F0Y2ggLSAke3V0aWwuaW5zcGVjdChkaXIpfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KGRpci5tb3VudGVkKTtcbiAgICAgICAgICAgIGlmICghc3RhdHMuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2F0Y2ggLSBub24tZGlyZWN0b3J5IHNwZWNpZmllZCBpbiAke3V0aWwuaW5zcGVjdChkaXIpfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdG93YXRjaC5wdXNoKGRpci5tb3VudGVkKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLiNkaXJzID0gZGlycztcblxuICAgICAgICBpZiAodGhpcy4jYmFzZWRpcikge1xuICAgICAgICAgICAgdGhpcy4jb3B0aW9ucy5jd2QgPSB0aGlzLiNiYXNlZGlyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy4jb3B0aW9ucy5jd2QgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLiN3YXRjaGVyID0gY2hva2lkYXIud2F0Y2godG93YXRjaCwgdGhpcy4jb3B0aW9ucyk7XG5cbiAgICAgICAgLy8gU2VuZCBldmVudHMgZnJvbSBjaG9raWRhciBpbnRvIHRoZSBvblhZWlpZXG4gICAgICAgIC8vIGhhbmRsZXIgZnVuY3Rpb25zLiAgVGhlc2UgcGVyZm9ybSBhZGRpdGlvbmFsXG4gICAgICAgIC8vIHByb2Nlc3Npbmcgd2hpY2ggaW4gdHVybiBpcyBlbWl0dGVkIGZyb21cbiAgICAgICAgLy8gdGhlIERpcnNXYXRjaGVyIG9iamVjdC5cblxuICAgICAgICBjb25zdCB0aGF0ID0gdGhpcztcbiAgICAgICAgdGhpcy4jd2F0Y2hlclxuICAgICAgICAgICAgLm9uKCdjaGFuZ2UnLCBhc3luYyAoZnBhdGgsIHN0YXRzKSA9PiB7XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGF0Lm9uQ2hhbmdlKGZwYXRoLCBzdGF0cyk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIHRoaXMubmFtZSwgZnBhdGgsIGBEaXJzV2F0Y2hlciB3YXRjaGVyICR7dGhpcy5uYW1lfSBldmVudD1jaGFuZ2UgJHtmcGF0aH0gY2F1Z2h0ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIHRoaXMuI3F1ZXVlLnB1c2goPHF1ZXVlRXZlbnQ+e1xuICAgICAgICAgICAgICAgIC8vICAgICBjb2RlOiAnY2hhbmdlJywgZnBhdGgsIHN0YXRzXG4gICAgICAgICAgICAgICAgLy8gfSk7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHdhdGNoZXIgJHt3YXRjaGVyX25hbWV9IGNoYW5nZSAke2ZwYXRofWApO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5vbignYWRkJywgYXN5bmMgKGZwYXRoLCBzdGF0cykgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoYXQub25BZGQoZnBhdGgsIHN0YXRzKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgdGhpcy5uYW1lLCBmcGF0aCwgYERpcnNXYXRjaGVyIHdhdGNoZXIgJHt0aGlzLm5hbWV9IGV2ZW50PWFkZCAke2ZwYXRofSBjYXVnaHQgJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gdGhpcy4jcXVldWUucHVzaCg8cXVldWVFdmVudD57XG4gICAgICAgICAgICAgICAgLy8gICAgIGNvZGU6ICdhZGQnLCBmcGF0aCwgc3RhdHNcbiAgICAgICAgICAgICAgICAvLyB9KTtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgd2F0Y2hlciAke3dhdGNoZXJfbmFtZX0gYWRkICR7ZnBhdGh9YCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLyogLm9uKCdhZGREaXInLCBhc3luYyAoZnBhdGgsIHN0YXRzKSA9PiB7IFxuICAgICAgICAgICAgICAgIC8vID8/IGxldCBpbmZvID0gdGhpcy5maWxlSW5mbyhmcGF0aCwgc3RhdHMpO1xuICAgICAgICAgICAgICAgIC8vID8/IGNvbnNvbGUubG9nKGBEaXJzV2F0Y2hlciBhZGREaXJgLCBpbmZvKTtcbiAgICAgICAgICAgICAgICAvLyA/PyB0aGlzLmVtaXQoJ2FkZERpcicsIGluZm8pO1xuICAgICAgICAgICAgfSkgKi9cbiAgICAgICAgICAgIC5vbigndW5saW5rJywgYXN5bmMgZnBhdGggPT4ge1xuICAgICAgICAgICAgICAgIC8vIHRoaXMuI3F1ZXVlLnB1c2goPHF1ZXVlRXZlbnQ+e1xuICAgICAgICAgICAgICAgIC8vICAgICBjb2RlOiAndW5saW5rJywgZnBhdGhcbiAgICAgICAgICAgICAgICAvLyB9KTtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGF0Lm9uVW5saW5rKGZwYXRoKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLndhcm4oYEVNSVRUSU5HIEVSUk9SIERpcnNXYXRjaGVyIHdhdGNoZXIgJHt0aGlzLm5hbWV9IGV2ZW50PXVubGluayAke2ZwYXRofSBjYXVnaHQgJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIHRoaXMubmFtZSwgZnBhdGgsIGBEaXJzV2F0Y2hlciB3YXRjaGVyICR7dGhpcy5uYW1lfSBldmVudD11bmxpbmsgJHtmcGF0aH0gY2F1Z2h0ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB3YXRjaGVyICR7d2F0Y2hlcl9uYW1lfSB1bmxpbmsgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAvKiAub24oJ3VubGlua0RpcicsIGFzeW5jIGZwYXRoID0+IHsgXG4gICAgICAgICAgICAgICAgLy8gPz8gbGV0IGluZm8gPSB0aGlzLmZpbGVJbmZvKGZwYXRoLCBzdGF0cyk7XG4gICAgICAgICAgICAgICAgLy8gPz8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIHVubGlua0RpciAke2ZwYXRofWApO1xuICAgICAgICAgICAgICAgIC8vID8/IHRoaXMuZW1pdCgndW5saW5rRGlyJywgaW5mbyk7XG4gICAgICAgICAgICB9KSAqL1xuICAgICAgICAgICAgLm9uKCdyZWFkeScsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICAvLyB0aGlzLiNxdWV1ZS5wdXNoKDxxdWV1ZUV2ZW50PntcbiAgICAgICAgICAgICAgICAvLyAgICAgY29kZTogJ3JlYWR5J1xuICAgICAgICAgICAgICAgIC8vIH0pO1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoYXQub25SZWFkeSgpO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB3YXRjaGVyICR7d2F0Y2hlcl9uYW1lfSByZWFkeWApO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5vbignZXJyb3InLCBhc3luYyAoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGF0Lm9uRXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gdGhpcy5pc1JlYWR5ID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAvLyAgICAgdGhpc1tfc3ltYl93YXRjaGVyXS5vbigncmVhZHknLCAoKSA9PiB7IHJlc29sdmUodHJ1ZSk7IH0pO1xuICAgICAgICAvLyB9KTtcbiAgICAgICAgLy8gY29uc29sZS5sb2codGhpcy5pc1JlYWR5KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbWl0IENob2tpZGFyIGVycm9yIGV2ZW50cyBhcyBhIERpcnNXYXR0Y2hlciBlcnJvci5cbiAgICAgKiBAcGFyYW0gZXJyb3IgXG4gICAgICovXG4gICAgYXN5bmMgb25FcnJvcihlcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oYERpcnNXYXRjaGVyICR7dGhpcy5uYW1lfSBFUlJPUiBgLCBlcnJvcik7XG4gICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCB0aGlzLm5hbWUsIHVuZGVmaW5lZCwgYERpcnNXYXRjaGVyICR7dGhpcy5uYW1lfSBFUlJPUiAke2Vycm9yfWApO1xuICAgIH1cblxuICAgIC8qIENhbGN1bGF0ZSB0aGUgc3RhY2sgZm9yIGEgZmlsZXN5c3RlbSBwYXRoXG5cbiAgICBPbmx5IGVtaXQgaWYgdGhlIGNoYW5nZSB3YXMgdG8gdGhlIGZyb250LW1vc3QgZmlsZSAqLyBcbiAgICBhc3luYyBvbkNoYW5nZShmcGF0aDogc3RyaW5nLCBzdGF0czogU3RhdHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgLy8gQ2hlY2tpbmcgdGhpcyBlYXJseSBhdm9pZHMgcHJpbnRpbmcgdGhlXG4gICAgICAgIC8vIG1lc3NhZ2UgaWYgdnBhdGhGb3JGU1BhdGggaXMgdW5kZWZpbmVkXG4gICAgICAgIC8vIGlmICh0aGlzLnRvSWdub3JlKGZwYXRoLCBzdGF0cykpIHtcbiAgICAgICAgLy8gICAgIHJldHVybjtcbiAgICAgICAgLy8gfVxuICAgICAgICBjb25zdCB2cGluZm8gPSB0aGlzLnZwYXRoRm9yRlNQYXRoKGZwYXRoLCBzdGF0cyk7XG4gICAgICAgIGlmICghdnBpbmZvKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgb25DaGFuZ2UgY291bGQgbm90IGZpbmQgbW91bnQgcG9pbnQgb3IgdnBhdGggZm9yICR7ZnBhdGh9YCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc3RhY2s6IFZQYXRoRGF0YVtdID0gYXdhaXQgdGhpcy5zdGFja0ZvclZQYXRoKHZwaW5mby52cGF0aCk7XG4gICAgICAgIGlmIChzdGFjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgb25DaGFuZ2UgY291bGQgbm90IGZpbmQgbW91bnQgcG9pbnRzIGZvciAke2ZwYXRofWApO1xuICAgICAgICB9XG4gICAgICAgIGxldCBpID0gMDtcbiAgICAgICAgbGV0IGRlcHRoO1xuICAgICAgICBsZXQgZW50cnk7XG4gICAgICAgIGZvciAoY29uc3QgcyBvZiBzdGFjaykge1xuICAgICAgICAgICAgaWYgKHMuZnNwYXRoID09PSBmcGF0aCkge1xuICAgICAgICAgICAgICAgIGVudHJ5ID0gcztcbiAgICAgICAgICAgICAgICBkZXB0aCA9IGk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpKys7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFlbnRyeSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBvbkNoYW5nZSBubyBzdGFjayBlbnRyeSBmb3IgJHtmcGF0aH0gKCR7dnBpbmZvLnZwYXRofSlgKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGVwdGggPT09IDApIHtcbiAgICAgICAgICAgIHZwaW5mby5zdGFjayA9IHN0YWNrO1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIGNoYW5nZSAke2ZwYXRofWApO1xuICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YSh2cGluZm8pKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFZQYXRoRGF0YSAke3V0aWwuaW5zcGVjdCh2cGluZm8pfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5lbWl0KCdjaGFuZ2UnLCB0aGlzLm5hbWUsIHZwaW5mbyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gbGV0IGluZm8gPSB0aGlzLmZpbGVJbmZvKGZwYXRoLCBzdGF0cyk7XG4gICAgICAgIC8vIGlmIChpbmZvKSB0aGlzLmVtaXQoJ2NoYW5nZScsIHRoaXMubmFtZSwgaW5mbyk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBEaXJzV2F0Y2hlciBjaGFuZ2UgJHtmcGF0aH1gLCBpbmZvKTtcbiAgICB9XG5cbiAgICAvLyBPbmx5IGVtaXQgaWYgdGhlIGFkZCB3YXMgdGhlIGZyb250LW1vc3QgZmlsZVxuICAgIGFzeW5jIG9uQWRkKGZwYXRoOiBzdHJpbmcsIHN0YXRzOiBTdGF0cyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICAvLyBDaGVja2luZyB0aGlzIGVhcmx5IGF2b2lkcyBwcmludGluZyB0aGVcbiAgICAgICAgLy8gbWVzc2FnZSBpZiB2cGF0aEZvckZTUGF0aCBpcyB1bmRlZmluZWRcbiAgICAgICAgLy8gaWYgKHRoaXMudG9JZ25vcmUoZnBhdGgsIHN0YXRzKSkge1xuICAgICAgICAvLyAgICAgcmV0dXJuO1xuICAgICAgICAvLyB9XG4gICAgICAgIGNvbnN0IHZwaW5mbyA9IHRoaXMudnBhdGhGb3JGU1BhdGgoZnBhdGgsIHN0YXRzKTtcbiAgICAgICAgaWYgKCF2cGluZm8pIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBvbkFkZCBjb3VsZCBub3QgZmluZCBtb3VudCBwb2ludCBvciB2cGF0aCBmb3IgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvLyBjb25zb2xlLmxvZyhgb25BZGQgJHtmcGF0aH1gLCB2cGluZm8pO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhgb25BZGQgJHtmcGF0aH0gJHt2cGluZm8udnBhdGh9YCk7XG4gICAgICAgIGNvbnN0IHN0YWNrOiBWUGF0aERhdGFbXSA9IGF3YWl0IHRoaXMuc3RhY2tGb3JWUGF0aCh2cGluZm8udnBhdGgpO1xuICAgICAgICBpZiAoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYG9uQWRkIGNvdWxkIG5vdCBmaW5kIG1vdW50IHBvaW50cyBmb3IgJHtmcGF0aH1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBjb25zb2xlLmxvZyhgb25BZGQgJHtmcGF0aH1gLCBzdGFjayk7XG4gICAgICAgIGxldCBpID0gMDtcbiAgICAgICAgbGV0IGRlcHRoO1xuICAgICAgICBsZXQgZW50cnk7XG4gICAgICAgIGZvciAoY29uc3QgcyBvZiBzdGFjaykge1xuICAgICAgICAgICAgaWYgKHMuZnNwYXRoID09PSBmcGF0aCkge1xuICAgICAgICAgICAgICAgIGVudHJ5ID0gcztcbiAgICAgICAgICAgICAgICBkZXB0aCA9IGk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpKys7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFlbnRyeSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBvbkFkZCBubyBzdGFjayBlbnRyeSBmb3IgJHtmcGF0aH0gKCR7dnBpbmZvLnZwYXRofSlgKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBjb25zb2xlLmxvZyhgb25BZGQgJHtmcGF0aH0gZGVwdGg9JHtkZXB0aH1gLCBlbnRyeSk7XG4gICAgICAgIGlmIChkZXB0aCA9PT0gMCkge1xuICAgICAgICAgICAgdnBpbmZvLnN0YWNrID0gc3RhY2s7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgb25BZGQgRU1JVCBhZGQgJHt2cGluZm8udnBhdGh9YCk7XG4gICAgICAgICAgICAvLyBmb3IgKGxldCBzIG9mIHN0YWNrKSB7XG4gICAgICAgICAgICAvLyAgICBjb25zb2xlLmxvZyhgLi4uLiAke3MudnBhdGh9ID09PiAke3MuZnNwYXRofWApO1xuICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YSh2cGluZm8pKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFZQYXRoRGF0YSAke3V0aWwuaW5zcGVjdCh2cGluZm8pfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5lbWl0KCdhZGQnLCB0aGlzLm5hbWUsIHZwaW5mbyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgb25BZGQgU0tJUFBFRCBlbWl0IGV2ZW50IGZvciAke2ZwYXRofWApO1xuICAgICAgICB9XG4gICAgICAgIC8vIGxldCBpbmZvID0gdGhpcy5maWxlSW5mbyhmcGF0aCwgc3RhdHMpO1xuICAgICAgICAvLyBpZiAoaW5mbykgdGhpcy5lbWl0KCdhZGQnLCB0aGlzLm5hbWUsIGluZm8pO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgYWRkYCwgaW5mbyk7XG4gICAgICAgIFxuICAgIH1cblxuICAgIC8qIE9ubHkgZW1pdCBpZiBpdCB3YXMgdGhlIGZyb250LW1vc3QgZmlsZSBkZWxldGVkXG4gICAgSWYgdGhlcmUgaXMgYSBmaWxlIHVuY292ZXJlZCBieSB0aGlzLCB0aGVuIGVtaXQgYW4gYWRkIGV2ZW50IGZvciB0aGF0ICovXG4gICAgYXN5bmMgb25VbmxpbmsoZnBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgb25VbmxpbmsgJHtmcGF0aH1gKTtcbiAgICAgICAgY29uc3QgdnBpbmZvID0gdGhpcy52cGF0aEZvckZTUGF0aChmcGF0aCk7XG4gICAgICAgIGlmICghdnBpbmZvKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgb25VbmxpbmsgY291bGQgbm90IGZpbmQgbW91bnQgcG9pbnQgb3IgdnBhdGggZm9yICR7ZnBhdGh9YCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIG9uVW5saW5rIHZwYXRoRGF0YSAke2ZwYXRofSA9PT5gLCB2cGluZm8pO1xuICAgICAgICBjb25zdCBzdGFjazogVlBhdGhEYXRhW10gPSBhd2FpdCB0aGlzLnN0YWNrRm9yVlBhdGgodnBpbmZvLnZwYXRoKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIG9uVW5saW5rIHN0YWNrICR7ZnBhdGh9ID09PmAsIHN0YWNrKTtcbiAgICAgICAgaWYgKHN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgLyogSWYgbm8gZmlsZXMgcmVtYWluIGluIHRoZSBzdGFjayBmb3IgdGhpcyB2aXJ0dWFsIHBhdGgsIHRoZW5cbiAgICAgICAgICAgICAqIHdlIG11c3QgZGVjbGFyZSBpdCB1bmxpbmtlZC5cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YSh2cGluZm8pKSB7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5lcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QodnBpbmZvKX1gKTtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgVlBhdGhEYXRhICR7dXRpbC5pbnNwZWN0KHZwaW5mbyl9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgb25VbmxpbmsgZW1pdCB1bmxpbmsgJHt0aGlzLm5hbWV9ICR7dnBpbmZvLmZzcGF0aH1gKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdCgndW5saW5rJywgdGhpcy5uYW1lLCB2cGluZm8pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLyogT24gdGhlIG90aGVyIGhhbmQsIGlmIHRoZXJlIGlzIGFuIGVudHJ5IHdlIHNob3VsZG4ndCBzZW5kXG4gICAgICAgICAgICAgKiBhbiB1bmxpbmsgZXZlbnQuICBJbnN0ZWFkIGl0IHNlZW1zIG1vc3QgYXBwcm9wcmlhdGUgdG8gc2VuZFxuICAgICAgICAgICAgICogYSBjaGFuZ2UgZXZlbnQuXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGNvbnN0IHNmaXJzdCA9IHN0YWNrWzBdO1xuICAgICAgICAgICAgY29uc3QgdG9lbWl0ID0gPFZQYXRoRGF0YT57XG4gICAgICAgICAgICAgICAgZnNwYXRoOiBzZmlyc3QuZnNwYXRoLFxuICAgICAgICAgICAgICAgIHZwYXRoOiBzZmlyc3QudnBhdGgsXG4gICAgICAgICAgICAgICAgbWltZTogbWltZS5nZXRUeXBlKHNmaXJzdC5mc3BhdGgpLFxuICAgICAgICAgICAgICAgIG1vdW50ZWQ6IHNmaXJzdC5tb3VudGVkLFxuICAgICAgICAgICAgICAgIG1vdW50UG9pbnQ6IHNmaXJzdC5tb3VudFBvaW50LFxuICAgICAgICAgICAgICAgIHBhdGhJbk1vdW50ZWQ6IHNmaXJzdC5wYXRoSW5Nb3VudGVkLFxuICAgICAgICAgICAgICAgIHN0YWNrXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YSh0b2VtaXQpKSB7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5lcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QodG9lbWl0KX1gKTtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgVlBhdGhEYXRhICR7dXRpbC5pbnNwZWN0KHRvZW1pdCl9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgb25VbmxpbmsgZW1pdCBjaGFuZ2UgJHt0aGlzLm5hbWV9ICR7dG9lbWl0LmZzcGF0aH1gKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywgdGhpcy5uYW1lLCB0b2VtaXQpO1xuICAgICAgICB9XG4gICAgICAgIC8vIGxldCBpbmZvID0gdGhpcy5maWxlSW5mbyhmcGF0aCwgdW5kZWZpbmVkKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIHVubGluayAke2ZwYXRofWApO1xuICAgICAgICAvLyBpZiAoaW5mbykgdGhpcy5lbWl0KCd1bmxpbmsnLCB0aGlzLm5hbWUsIGluZm8pO1xuICAgIH1cblxuICAgIG9uUmVhZHkoKTogdm9pZCB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdEaXJzV2F0Y2hlcjogSW5pdGlhbCBzY2FuIGNvbXBsZXRlLiBSZWFkeSBmb3IgY2hhbmdlcycpO1xuICAgICAgICB0aGlzLmVtaXQoJ3JlYWR5JywgdGhpcy5uYW1lKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGFuIG9iamVjdCByZXByZXNlbnRpbmcgYWxsIHRoZSBwYXRocyBvbiB0aGUgZmlsZSBzeXN0ZW0gYmVpbmdcbiAgICAgKiB3YXRjaGVkIGJ5IHRoaXMgRlNXYXRjaGVyIGluc3RhbmNlLiBUaGUgb2JqZWN0J3Mga2V5cyBhcmUgYWxsIHRoZSBcbiAgICAgKiBkaXJlY3RvcmllcyAodXNpbmcgYWJzb2x1dGUgcGF0aHMgdW5sZXNzIHRoZSBjd2Qgb3B0aW9uIHdhcyB1c2VkKSxcbiAgICAgKiBhbmQgdGhlIHZhbHVlcyBhcmUgYXJyYXlzIG9mIHRoZSBuYW1lcyBvZiB0aGUgaXRlbXMgY29udGFpbmVkIGluIGVhY2ggZGlyZWN0b3J5LlxuICAgICAqL1xuICAgIGdldFdhdGNoZWQoKSB7XG4gICAgICAgIGlmICh0aGlzLiN3YXRjaGVyKSByZXR1cm4gdGhpcy4jd2F0Y2hlci5nZXRXYXRjaGVkKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGV0ZXJtaW5lIGlmIHRoZSBmc3BhdGggaXMgdG8gYmUgaWdub3JlZFxuICAgICAqIEBwYXJhbSBmc3BhdGggXG4gICAgICogQHBhcmFtIHN0YXRzIFxuICAgICAqIEByZXR1cm5zIFxuICAgICAqL1xuICAgIHRvSWdub3JlKGZzcGF0aDogc3RyaW5nLCBzdGF0cz86IFN0YXRzKTogYm9vbGVhbiB7XG5cbiAgICAgICAgZm9yIChjb25zdCBkaXIgb2YgdGhpcy5kaXJzKSB7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoaXMgZGlycyBlbnRyeSBjb3JyZXNwb25kc1xuICAgICAgICAgICAgLy8gdG8gdGhlIGZzcGF0aFxuXG4gICAgICAgICAgICAvLyBUaGlzIHdpbGwgc3RyaXAgb2ZmIGEgbGVhZGluZyBzbGFzaCxcbiAgICAgICAgICAgIC8vIGFuZCBlbnN1cmUgdGhhdCBpdCBlbmRzIHdpdGggYSBzbGFzaC5cblxuICAgICAgICAgICAgY29uc3QgbSA9IGRpci5tb3VudGVkLnN0YXJ0c1dpdGgoJy8nKVxuICAgICAgICAgICAgICAgICAgICA/IGRpci5tb3VudGVkLnN1YnN0cmluZygxKVxuICAgICAgICAgICAgICAgICAgICA6IGRpci5tb3VudGVkO1xuICAgICAgICAgICAgY29uc3QgbTIgPSBtLmVuZHNXaXRoKCcvJylcbiAgICAgICAgICAgICAgICAgICAgID8gbVxuICAgICAgICAgICAgICAgICAgICAgOiAobSsnLycpO1xuICAgICAgICAgICAgaWYgKCFmc3BhdGguc3RhcnRzV2l0aChtMikpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2hlY2sgdG8gc2VlIGlmIHdlJ3JlIHN1cHBvc2VkIHRvIGlnbm9yZSB0aGUgZmlsZVxuICAgICAgICAgICAgaWYgKGRpci5pZ25vcmUpIHtcbiAgICAgICAgICAgICAgICBsZXQgaWdub3JlcztcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGRpci5pZ25vcmUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIGlnbm9yZXMgPSBbIGRpci5pZ25vcmUgXTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZ25vcmVzID0gZGlyLmlnbm9yZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGV0IGlnbm9yZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgaSBvZiBpZ25vcmVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtaWNyb21hdGNoLmlzTWF0Y2goZnNwYXRoLCBpKSkgaWdub3JlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYGRpci5pZ25vcmUgJHtmc3BhdGh9ICR7aX0gPT4gJHtpZ25vcmV9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChpZ25vcmUpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHRvSWdub3JlIGlnbm9yaW5nICR7ZnNwYXRofSAke3V0aWwuaW5zcGVjdCh0aGlzLmRpcnMpfWApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdnBhdGhGb3JGU1BhdGgoZnNwYXRoOiBzdHJpbmcsIHN0YXRzPzogU3RhdHMpOiBWUGF0aERhdGEge1xuICAgICAgICBmb3IgKGNvbnN0IGRpciBvZiB0aGlzLmRpcnMpIHtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgdG8gc2VlIGlmIHdlJ3JlIHN1cHBvc2VkIHRvIGlnbm9yZSB0aGUgZmlsZVxuICAgICAgICAgICAgaWYgKGRpci5pZ25vcmUpIHtcbiAgICAgICAgICAgICAgICBsZXQgaWdub3JlcztcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGRpci5pZ25vcmUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIGlnbm9yZXMgPSBbIGRpci5pZ25vcmUgXTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZ25vcmVzID0gZGlyLmlnbm9yZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGV0IGlnbm9yZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgaSBvZiBpZ25vcmVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtaWNyb21hdGNoLmlzTWF0Y2goZnNwYXRoLCBpKSkgaWdub3JlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYGRpci5pZ25vcmUgJHtmc3BhdGh9ICR7aX0gPT4gJHtpZ25vcmV9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChpZ25vcmUpIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBUaGlzIGVuc3VyZXMgd2UgYXJlIG1hdGNoaW5nIG9uIGRpcmVjdG9yeSBib3VuZGFyaWVzXG4gICAgICAgICAgICAvLyBPdGhlcndpc2UgZnNwYXRoIFwiL3BhdGgvdG8vbGF5b3V0cy1leHRyYS9sYXlvdXQubmprXCIgbWlnaHRcbiAgICAgICAgICAgIC8vIG1hdGNoIGRpci5tb3VudGVkIFwiL3BhdGgvdG8vbGF5b3V0c1wiLlxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB2cGF0aEZvckZTUGF0aCAke2Rpci5tb3VudGVkfSAke3R5cGVvZiBkaXIubW91bnRlZH1gLCBkaXIpO1xuICAgICAgICAgICAgY29uc3QgZGlybW91bnRlZCA9XG4gICAgICAgICAgICAgICAgKGRpciAmJiBkaXIubW91bnRlZClcbiAgICAgICAgICAgICAgICAgICAgPyAoZGlyLm1vdW50ZWQuY2hhckF0KGRpci5tb3VudGVkLmxlbmd0aCAtIDEpID09ICcvJylcbiAgICAgICAgICAgICAgICAgICAgICAgID8gZGlyLm1vdW50ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIDogKGRpci5tb3VudGVkICsgJy8nKVxuICAgICAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGlmIChkaXJtb3VudGVkICYmIGZzcGF0aC5pbmRleE9mKGRpcm1vdW50ZWQpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGF0aEluTW91bnRlZCA9IGZzcGF0aC5zdWJzdHJpbmcoZGlyLm1vdW50ZWQubGVuZ3RoKS5zdWJzdHJpbmcoMSk7XG4gICAgICAgICAgICAgICAgY29uc3QgdnBhdGggPSBkaXIubW91bnRQb2ludCA9PT0gJy8nXG4gICAgICAgICAgICAgICAgICAgICAgICA/IHBhdGhJbk1vdW50ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIDogcGF0aC5qb2luKGRpci5tb3VudFBvaW50LCBwYXRoSW5Nb3VudGVkKTtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgdnBhdGhGb3JGU1BhdGggZnNwYXRoICR7ZnNwYXRofSBkaXIubW91bnRQb2ludCAke2Rpci5tb3VudFBvaW50fSBwYXRoSW5Nb3VudGVkICR7cGF0aEluTW91bnRlZH0gdnBhdGggJHt2cGF0aH1gKTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXQgPSA8VlBhdGhEYXRhPntcbiAgICAgICAgICAgICAgICAgICAgZnNwYXRoOiBmc3BhdGgsXG4gICAgICAgICAgICAgICAgICAgIHZwYXRoOiB2cGF0aCxcbiAgICAgICAgICAgICAgICAgICAgbWltZTogbWltZS5nZXRUeXBlKGZzcGF0aCksXG4gICAgICAgICAgICAgICAgICAgIG1vdW50ZWQ6IGRpci5tb3VudGVkLFxuICAgICAgICAgICAgICAgICAgICBtb3VudFBvaW50OiBkaXIubW91bnRQb2ludCxcbiAgICAgICAgICAgICAgICAgICAgcGF0aEluTW91bnRlZFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKHN0YXRzKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldC5zdGF0c010aW1lID0gc3RhdHMubXRpbWVNcztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBVc2UgdGhlIHN5bmMgdmVyc2lvbiB0b1xuICAgICAgICAgICAgICAgICAgICAvLyBtYWludGFpbiB0aGlzIGZ1bmN0aW9uXG4gICAgICAgICAgICAgICAgICAgIC8vIGFzIG5vbi1hc3luY1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHN0YXRzID0gZnNTdGF0U3luYyhyZXQuZnNwYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldC5zdGF0c010aW1lID0gc3RhdHMubXRpbWVNcztcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBWUGF0aERhdGEgaWdub3JpbmcgU1RBVFMgZXJyb3IgJHtyZXQuZnNwYXRofSAtICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXQuc3RhdHNNdGltZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIWlzVlBhdGhEYXRhKHJldCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFZQYXRoRGF0YSAke3V0aWwuaW5zcGVjdChyZXQpfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIE5vIGRpcmVjdG9yeSBmb3VuZCBmb3IgdGhpcyBmaWxlXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgYXN5bmMgc3RhY2tGb3JWUGF0aCh2cGF0aDogc3RyaW5nKTogUHJvbWlzZTxWUGF0aERhdGFbXT4ge1xuICAgICAgICBjb25zdCByZXQ6IFZQYXRoRGF0YVtdID0gW107XG4gICAgICAgIGZvciAoY29uc3QgZGlyIG9mIHRoaXMuZGlycykge1xuICAgICAgICAgICAgaWYgKGRpci5tb3VudFBvaW50ID09PSAnLycpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXRoSW5Nb3VudGVkID0gdnBhdGg7XG4gICAgICAgICAgICAgICAgY29uc3QgZnNwYXRoID0gcGF0aC5qb2luKGRpci5tb3VudGVkLCBwYXRoSW5Nb3VudGVkKTtcbiAgICAgICAgICAgICAgICBsZXQgc3RhdHM7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KGZzcGF0aCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRzID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIXN0YXRzKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCB0b3B1c2ggPSA8VlBhdGhEYXRhPntcbiAgICAgICAgICAgICAgICAgICAgZnNwYXRoOiBmc3BhdGgsXG4gICAgICAgICAgICAgICAgICAgIHZwYXRoOiB2cGF0aCxcbiAgICAgICAgICAgICAgICAgICAgbWltZTogbWltZS5nZXRUeXBlKGZzcGF0aCksXG4gICAgICAgICAgICAgICAgICAgIG1vdW50ZWQ6IGRpci5tb3VudGVkLFxuICAgICAgICAgICAgICAgICAgICBtb3VudFBvaW50OiBkaXIubW91bnRQb2ludCxcbiAgICAgICAgICAgICAgICAgICAgcGF0aEluTW91bnRlZDogcGF0aEluTW91bnRlZFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YSh0b3B1c2gpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QodG9wdXNoKX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0LnB1c2godG9wdXNoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGlybW91bnRwdCA9XG4gICAgICAgICAgICAgICAgICAgIChkaXIgJiYgZGlyLm1vdW50UG9pbnQpXG4gICAgICAgICAgICAgICAgICAgICAgICA/IChkaXIubW91bnRQb2ludC5jaGFyQXQoZGlyLm1vdW50UG9pbnQubGVuZ3RoIC0gMSkgPT09ICcvJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IGRpci5tb3VudFBvaW50XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOiAoZGlyLm1vdW50UG9pbnQgKyAnLycpXG4gICAgICAgICAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgc3RhY2tGb3JWUGF0aCB2cGF0aCAke3ZwYXRofSBkaXIubW91bnRlZCAke2Rpci5tb3VudFBvaW50fSBkaXJtb3VudHB0ICR7ZGlybW91bnRwdH1gKTtcbiAgICAgICAgICAgICAgICBpZiAoZGlybW91bnRwdCAmJiB2cGF0aC5pbmRleE9mKGRpcm1vdW50cHQpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vID4gY29uc3QgdnBhdGggPSAnZm9vL2Jhci9iYXouaHRtbCc7XG4gICAgICAgICAgICAgICAgICAgIC8vID4gY29uc3QgbSA9ICdmb28vYmFyJztcbiAgICAgICAgICAgICAgICAgICAgLy8gPiBsZXQgcGF0aEluTW91bnRlZCA9IHZwYXRoLnN1YnN0cmluZyhtLmxlbmd0aCArIDEpO1xuICAgICAgICAgICAgICAgICAgICAvLyA+IHBhdGhJbk1vdW50ZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gJ2Jhei5odG1sJ1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXRoSW5Nb3VudGVkID0gdnBhdGguc3Vic3RyaW5nKGRpcm1vdW50cHQubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZnNwYXRoID0gcGF0aC5qb2luKGRpci5tb3VudGVkLCBwYXRoSW5Nb3VudGVkKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHN0YWNrRm9yVlBhdGggdnBhdGggJHt2cGF0aH0gcGF0aEluTW91bnRlZCAke3BhdGhJbk1vdW50ZWR9IGZzcGF0aCAke2ZzcGF0aH1gKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHN0YXRzO1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KGZzcGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHMgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFzdGF0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHN0YWNrRm9yVlBhdGggdnBhdGggJHt2cGF0aH0gZGlkIG5vdCBmaW5kIGZzLnN0YXRzIGZvciAke2ZzcGF0aH1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRvcHVzaCA9IDxWUGF0aERhdGE+e1xuICAgICAgICAgICAgICAgICAgICAgICAgZnNwYXRoOiBmc3BhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICB2cGF0aDogdnBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW1lOiBtaW1lLmdldFR5cGUoZnNwYXRoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vdW50ZWQ6IGRpci5tb3VudGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgbW91bnRQb2ludDogZGlyLm1vdW50UG9pbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoSW5Nb3VudGVkOiBwYXRoSW5Nb3VudGVkXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEodG9wdXNoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFZQYXRoRGF0YSAke3V0aWwuaW5zcGVjdCh0b3B1c2gpfWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldC5wdXNoKHRvcHVzaCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHN0YWNrRm9yVlBhdGggdnBhdGggJHt2cGF0aH0gZGlkIG5vdCBtYXRjaCAke2Rpcm1vdW50cHR9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIChrbm9jayBvbiB3b29kKSBFdmVyeSBlbnRyeSBpbiBgcmV0YCBoYXMgYWxyZWFkeSBiZWVuIHZlcmlmaWVkXG4gICAgICAgIC8vIGFzIGJlaW5nIGEgY29ycmVjdCBWUGF0aERhdGEgb2JqZWN0XG4gICAgICAgIHJldHVybiByZXQ7XG4gICAgfVxuXG4gICAgYXN5bmMgY2xvc2UoKSB7XG4gICAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdjaGFuZ2UnKTtcbiAgICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2FkZCcpO1xuICAgICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygndW5saW5rJyk7XG4gICAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZWFkeScpO1xuICAgICAgICBpZiAodGhpcy4jd2F0Y2hlcikge1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYENsb3Npbmcgd2F0Y2hlciAke3RoaXMubmFtZX1gKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuI3dhdGNoZXIuY2xvc2UoKTtcbiAgICAgICAgICAgIHRoaXMuI3dhdGNoZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICB9XG59XG4iXX0=