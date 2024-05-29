"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirsWatcher = exports.isVPathData = exports.VPathData = exports.mimedefine = void 0;
const fs_1 = require("fs");
const chokidar_1 = __importDefault(require("chokidar"));
const mime = __importStar(require("mime"));
/* const mime = {
    getType: mime_pkg.getType,
    getExtension: mime_pkg.getExtension,
    define: mime_pkg.define
}; */
// import { getType, getExtension, define as mime_define } from 'mime';
const util = __importStar(require("util"));
const path = __importStar(require("path"));
const events_1 = require("events");
const minimatch_1 = __importDefault(require("minimatch"));
const fastq = __importStar(require("fastq"));
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
function mimedefine(mapping, force) {
    mime.define(mapping, force);
}
exports.mimedefine = mimedefine;
class VPathData {
}
exports.VPathData = VPathData;
/**
 * Typeguard function ensuring that an object
 * is a VPathData object.
 * @param vpinfo The object to check
 * @returns true if it is a VPathData, false otherwise
 */
const isVPathData = (vpinfo) => {
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
            if (!(0, exports.isVPathData)(inf))
                return false;
        }
    }
    return true;
};
exports.isVPathData = isVPathData;
const isQueueEvent = (event) => {
    if (typeof event === 'undefined')
        return false;
    if (typeof event !== 'object')
        return false;
    if (typeof event.code === 'string'
        && typeof event.fpath === 'string'
        && (event.stats instanceof fs_1.Stats)) {
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
const _symb_dirs = Symbol('dirs');
const _symb_watcher = Symbol('watcher');
const _symb_name = Symbol('name');
const _symb_options = Symbol('options');
const _symb_cwd = Symbol('basedir');
const _symb_queue = Symbol('queue');
class DirsWatcher extends events_1.EventEmitter {
    /**
     * @param name string giving the name for this watcher
     */
    constructor(name) {
        super();
        // console.log(`DirsWatcher ${name} constructor`);
        this[_symb_name] = name;
        // TODO is there a need to make this customizable?
        this[_symb_options] = {
            persistent: true, ignoreInitial: false, awaitWriteFinish: true, alwaysStat: true
        };
        this[_symb_cwd] = undefined;
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
        this[_symb_queue] = q;
        this[_symb_queue].error(function (err, task) {
            if (err) {
                console.error(`DirsWatcher ${name} ${task.code} ${task.fpath} caught error ${err}`);
            }
        });
    }
    /**
     * Retrieves the directory stack for
     * this Watcher.
     */
    get dirs() { return this[_symb_dirs]; }
    /**
     * Retrieves the name for this Watcher
     */
    get name() { return this[_symb_name]; }
    /**
     * Changes the use of absolute pathnames, to paths relatve to the given directory.
     * This must be called before the <em>watch</em> method is called.  The paths
     * you specify to watch must be relative to the given directory.
     */
    set basedir(cwd) { this[_symb_cwd] = cwd; }
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
        if (this[_symb_watcher]) {
            throw new Error(`Watcher already started for ${this[_symb_watcher]}`);
        }
        if (typeof dirs === 'string') {
            dirs = [{
                    src: dirs, dest: '/'
                }];
        }
        else if (typeof dirs === 'object' && !Array.isArray(dirs)) {
            dirs = [dirs];
        }
        else if (!Array.isArray(dirs)) {
            throw new Error(`watch - the dirs argument is incorrect ${util.inspect(dirs)}`);
        }
        // console.log(`watch dirs=`, dirs);
        const towatch = [];
        for (const dir of dirs) {
            const stats = await fs_1.promises.stat(dir.mounted);
            if (!stats.isDirectory()) {
                throw new Error(`watch - non-directory specified in ${util.inspect(dir)}`);
            }
            towatch.push(dir.mounted);
        }
        this[_symb_dirs] = dirs;
        if (this[_symb_cwd]) {
            this[_symb_options].cwd = this[_symb_cwd];
        }
        else {
            this[_symb_options].cwd = undefined;
        }
        this[_symb_watcher] = chokidar_1.default.watch(towatch, this[_symb_options]);
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
        this[_symb_watcher]
            .on('change', async (fpath, stats) => {
            this[_symb_queue].push({
                code: 'change', fpath, stats
            });
            // console.log(`watcher ${watcher_name} change ${fpath}`);
        })
            .on('add', async (fpath, stats) => {
            this[_symb_queue].push({
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
            this[_symb_queue].push({
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
            this[_symb_queue].push({
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
            if (!(0, exports.isVPathData)(vpinfo)) {
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
            if (!(0, exports.isVPathData)(vpinfo)) {
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
            if (!(0, exports.isVPathData)(vpinfo)) {
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
            if (!(0, exports.isVPathData)(toemit)) {
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
        if (this[_symb_watcher])
            return this[_symb_watcher].getWatched();
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
                    if ((0, minimatch_1.default)(fspath, i))
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
                if (!(0, exports.isVPathData)(ret)) {
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
                    stats = await fs_1.promises.stat(fspath);
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
                if (!(0, exports.isVPathData)(topush)) {
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
                        stats = await fs_1.promises.stat(fspath);
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
                    if (!(0, exports.isVPathData)(topush)) {
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
    /**
     * Convert data we gather about a file in the file system into a descriptor object.
     * @param fspath
     * @param stats
     */
    /* fileInfo(fspath, stats) {
        let e = this.dirForPath(fspath);
        if (!e) {
            throw new Error(`No mountPoint found for ${fspath}`);
        }
        let fnInSourceDir = fspath.substring(e.path.length).substring(1);
        let docpath = path.join(e.mountPoint, fnInSourceDir);
        if (docpath.startsWith('/')) {
            docpath = docpath.substring(1);
        }
        let ignore = false;
        let include = true;
        if (e.ignore) {
            let ignores;
            if (typeof e.ignore === 'string') {
                ignores = [ e.ignore ];
            } else {
                ignores = e.ignore;
            }
            for (let i of ignores) {
                if (minimatch(fnInSourceDir, i)) ignore = true;
                // console.log(`e.ignore ${fnInSourceDir} ${i} => ${ignore}`);
            }
        }
        if (e.include) {
            include = false;
            let includers;
            if (typeof e.include === 'string') {
                includers = [ e.include ];
            } else {
                includers = e.include;
            }
            for (let i of includers) {
                if (minimatch(fnInSourceDir, i)) include = true;
                // console.log(`e.include ${fnInSourceDir} ${i} => ${include}`);
            }
        }
        if (ignore || !include) {
            return undefined;
        } else {
            return {
                fspath: fspath,
                mime: mime.getType(fspath),
                baseMetadata: e.baseMetadata,
                sourcePath: e.path,
                mountPoint: e.mountPoint,
                pathInSource: fnInSourceDir,
                path: docpath,
                isDirectory: stats.isDirectory(),
                stats
            };
        }
    } */
    async close() {
        this.removeAllListeners('change');
        this.removeAllListeners('add');
        this.removeAllListeners('unlink');
        this.removeAllListeners('ready');
        if (this[_symb_watcher]) {
            // console.log(`Closing watcher ${this.name}`);
            await this[_symb_watcher].close();
            this[_symb_watcher] = undefined;
        }
    }
}
exports.DirsWatcher = DirsWatcher;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2F0Y2hlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2xpYi93YXRjaGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsMkJBR1k7QUFDWix3REFBK0M7QUFDL0MsMkNBQTZCO0FBQzdCOzs7O0tBSUs7QUFDTCx1RUFBdUU7QUFDdkUsMkNBQTZCO0FBQzdCLDJDQUE2QjtBQUM3QixtQ0FBc0M7QUFDdEMsMERBQWtDO0FBQ2xDLDZDQUErQjtBQUkvQixpRUFBaUU7QUFDakUsaUVBQWlFO0FBQ2pFLDJEQUEyRDtBQUMzRCxFQUFFO0FBQ0Ysb0RBQW9EO0FBQ3BELHlDQUF5QztBQUN6Qyw4REFBOEQ7QUFDOUQsMERBQTBEO0FBQzFELEVBQUU7QUFDRixzRUFBc0U7QUFDdEUsbURBQW1EO0FBRW5ELFNBQWdCLFVBQVUsQ0FBQyxPQUFPLEVBQUUsS0FBZ0I7SUFDaEQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDaEMsQ0FBQztBQUZELGdDQUVDO0FBR0QsTUFBYSxTQUFTO0NBMkNyQjtBQTNDRCw4QkEyQ0M7QUFFRDs7Ozs7R0FLRztBQUNJLE1BQU0sV0FBVyxHQUFHLENBQUMsTUFBTSxFQUF1QixFQUFFO0lBQ3ZELElBQUksT0FBTyxNQUFNLEtBQUssV0FBVztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQ2hELElBQUksT0FBTyxNQUFNLEtBQUssUUFBUTtRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQzdDLElBQUksT0FBTyxNQUFNLENBQUMsSUFBSSxLQUFLLFdBQVc7V0FDbEMsTUFBTSxDQUFDLElBQUksS0FBSyxJQUFJO1dBQ3BCLE9BQU8sTUFBTSxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7UUFDakMsT0FBTyxLQUFLLENBQUM7S0FDaEI7SUFDRCxJQUFJLE9BQU8sTUFBTSxDQUFDLE1BQU0sS0FBSyxRQUFRO1dBQ2pDLE9BQU8sTUFBTSxDQUFD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QUFDLFVBQVU7d0JBQzFCLGFBQWEsRUFBRSxhQUFhO3FCQUMvQixDQUFDO29CQUNGLElBQUksQ0FBQyxJQUFBLG1CQUFXLEVBQUMsTUFBTSxDQUFDLEVBQUU7d0JBQ3RCLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQXFCLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO3FCQUNoRTtvQkFDRCxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2lCQUNwQjtxQkFBTTtvQkFDSCwyRUFBMkU7aUJBQzlFO2FBQ0o7U0FDSjtRQUNELGlFQUFpRTtRQUNqRSxzQ0FBc0M7UUFDdEMsT0FBTyxHQUFHLENBQUM7SUFDZixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNIOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O1FBb0RJO0lBRUosS0FBSyxDQUFDLEtBQUs7UUFDUCxJQUFJLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDbEMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQy9CLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNsQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDakMsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLEVBQUU7WUFDckIsK0NBQStDO1lBQy9DLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2xDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxTQUFTLENBQUM7U0FDbkM7SUFDTCxDQUFDO0NBQ0o7QUF4ZkQsa0NBd2ZDIiwic291cmNlc0NvbnRlbnQiOlsiXG5pbXBvcnQge1xuICAgIHByb21pc2VzIGFzIGZzLFxuICAgIFN0YXRzXG59IGZyb20gJ2ZzJztcbmltcG9ydCB7IGRlZmF1bHQgYXMgY2hva2lkYXIgfSBmcm9tICdjaG9raWRhcic7XG5pbXBvcnQgKiBhcyBtaW1lIGZyb20gJ21pbWUnO1xuLyogY29uc3QgbWltZSA9IHsgXG4gICAgZ2V0VHlwZTogbWltZV9wa2cuZ2V0VHlwZSxcbiAgICBnZXRFeHRlbnNpb246IG1pbWVfcGtnLmdldEV4dGVuc2lvbixcbiAgICBkZWZpbmU6IG1pbWVfcGtnLmRlZmluZVxufTsgKi9cbi8vIGltcG9ydCB7IGdldFR5cGUsIGdldEV4dGVuc2lvbiwgZGVmaW5lIGFzIG1pbWVfZGVmaW5lIH0gZnJvbSAnbWltZSc7XG5pbXBvcnQgKiBhcyB1dGlsIGZyb20gJ3V0aWwnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgbWluaW1hdGNoIGZyb20gJ21pbmltYXRjaCc7XG5pbXBvcnQgKiBhcyBmYXN0cSBmcm9tICdmYXN0cSc7XG5pbXBvcnQgdHlwZSB7IHF1ZXVlQXNQcm9taXNlZCB9IGZyb20gXCJmYXN0cVwiO1xuXG5cbi8vIE5PVEUgV2Ugc2hvdWxkIG5vdCBkbyB0aGlzIGhlcmUuICBJdCBoYWQgYmVlbiBjb3BpZWQgb3ZlciBmcm9tXG4vLyBBa2FzaGFSZW5kZXIsIGJ1dCB0aGlzIGlzIGR1cGxpY2F0aXZlLCBhbmQgaXQncyBwb3NzaWJsZSB0aGVyZVxuLy8gd2lsbCBiZSBvdGhlciB1c2VycyBvZiBEaXJzV2F0Y2hlciB3aG8gZG8gbm90IHdhbnQgdGhpcy5cbi8vXG4vLyBUaGVyZSBkb2Vzbid0IHNlZW0gdG8gYmUgYW4gb2ZmaWNpYWwgcmVnaXN0cmF0aW9uXG4vLyBwZXI6IGh0dHBzOi8vYXNjaWlkb2N0b3Iub3JnL2RvY3MvZmFxL1xuLy8gcGVyOiBodHRwczovL2dpdGh1Yi5jb20vYXNjaWlkb2N0b3IvYXNjaWlkb2N0b3IvaXNzdWVzLzI1MDJcbi8vIG1pbWUuZGVmaW5lKHsndGV4dC94LWFzY2lpZG9jJzogWydhZG9jJywgJ2FzY2lpZG9jJ119KTtcbi8vXG4vLyBJbnN0ZWFkIG9mIGRlZmluaW5nIE1JTUUgdHlwZXMgaGVyZSwgd2UgYWRkZWQgYSBtZXRob2QgXCJtaW1lZGVmaW5lXCJcbi8vIHRvIGFsbG93IERpcnNXYXRjaGVyIHVzZXJzIHRvIGRlZmluZSBNSU1FIHR5cGVzLlxuXG5leHBvcnQgZnVuY3Rpb24gbWltZWRlZmluZShtYXBwaW5nLCBmb3JjZSA/OiBib29sZWFuKSB7XG4gICAgbWltZS5kZWZpbmUobWFwcGluZywgZm9yY2UpO1xufVxuXG5cbmV4cG9ydCBjbGFzcyBWUGF0aERhdGEge1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZ1bGwgZmlsZS1zeXN0ZW0gcGF0aCBmb3IgdGhlIGZpbGUuXG4gICAgICogZS5nLiAvaG9tZS9wYXRoL3RvL2FydGljbGUtbmFtZS5odG1sLm1kXG4gICAgICovXG4gICAgZnNwYXRoOiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdmlydHVhbCBwYXRoLCByb290ZWQgYXQgdGhlIHRvcFxuICAgICAqIGRpcmVjdG9yeSBvZiB0aGUgZmlsZXN5c3RlbSwgd2l0aCBub1xuICAgICAqIGxlYWRpbmcgc2xhc2guXG4gICAgICovXG4gICAgdnBhdGg6IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIFRoZSBtaW1lIHR5cGUgb2YgdGhlIGZpbGUuICBUaGUgbWltZSB0eXBlc1xuICAgICAqIGFyZSBkZXRlcm1pbmVkIGZyb20gdGhlIGZpbGUgZXh0ZW5zaW9uXG4gICAgICogdXNpbmcgdGhlICdtaW1lJyBwYWNrYWdlLlxuICAgICAqL1xuICAgIG1pbWUgPzogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZpbGUtc3lzdGVtIHBhdGggd2hpY2ggaXMgbW91bnRlZFxuICAgICAqIGludG8gdGhlIHZpcnR1YWwgZmlsZSBzcGFjZS5cbiAgICAgKi9cbiAgICBtb3VudGVkOiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdmlydHVhbCBkaXJlY3Rvcnkgb2YgdGhlIG1vdW50XG4gICAgICogZW50cnkgaW4gdGhlIGRpcmVjdG9yeSBzdGFjay5cbiAgICAgKi9cbiAgICBtb3VudFBvaW50OiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcmVsYXRpdmUgcGF0aCB1bmRlcm5lYXRoIHRoZSBtb3VudFBvaW50LlxuICAgICAqL1xuICAgIHBhdGhJbk1vdW50ZWQ6IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIFRoZSBmaWxlLXN5c3RlbSBzdGFjayByZWxhdGVkIHRvIHRoZSBmaWxlLlxuICAgICAqL1xuICAgIHN0YWNrID86IFZQYXRoRGF0YVtdO1xufVxuXG4vKipcbiAqIFR5cGVndWFyZCBmdW5jdGlvbiBlbnN1cmluZyB0aGF0IGFuIG9iamVjdFxuICogaXMgYSBWUGF0aERhdGEgb2JqZWN0LlxuICogQHBhcmFtIHZwaW5mbyBUaGUgb2JqZWN0IHRvIGNoZWNrXG4gKiBAcmV0dXJucyB0cnVlIGlmIGl0IGlzIGEgVlBhdGhEYXRhLCBmYWxzZSBvdGhlcndpc2VcbiAqL1xuZXhwb3J0IGNvbnN0IGlzVlBhdGhEYXRhID0gKHZwaW5mbyk6IHZwaW5mbyBpcyBWUGF0aERhdGEgPT4ge1xuICAgIGlmICh0eXBlb2YgdnBpbmZvID09PSAndW5kZWZpbmVkJykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2YgdnBpbmZvICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2YgdnBpbmZvLm1pbWUgIT09ICd1bmRlZmluZWQnXG4gICAgICYmIHZwaW5mby5taW1lICE9PSBudWxsXG4gICAgICYmIHR5cGVvZiB2cGluZm8ubWltZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHZwaW5mby5mc3BhdGggIT09ICdzdHJpbmcnXG4gICAgIHx8IHR5cGVvZiB2cGluZm8udnBhdGggIT09ICdzdHJpbmcnXG4gICAgIHx8IHR5cGVvZiB2cGluZm8ubW91bnRlZCAhPT0gJ3N0cmluZydcbiAgICAgfHwgdHlwZW9mIHZwaW5mby5tb3VudFBvaW50ICE9PSAnc3RyaW5nJ1xuICAgICB8fCB0eXBlb2YgdnBpbmZvLnBhdGhJbk1vdW50ZWQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB2cGluZm8uc3RhY2sgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gdHJ1ZTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2cGluZm8uc3RhY2spKSB7XG4gICAgICAgIGZvciAoY29uc3QgaW5mIG9mIHZwaW5mby5zdGFjaykge1xuICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YShpbmYpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG50eXBlIHF1ZXVlRXZlbnQgPSB7XG4gICAgY29kZTogc3RyaW5nO1xuICAgIGZwYXRoPzogc3RyaW5nO1xuICAgIHN0YXRzPzogU3RhdHM7XG59O1xuXG5jb25zdCBpc1F1ZXVlRXZlbnQgPSAoZXZlbnQpOiBldmVudCBpcyBxdWV1ZUV2ZW50ID0+IHtcbiAgICBpZiAodHlwZW9mIGV2ZW50ID09PSAndW5kZWZpbmVkJykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2YgZXZlbnQgIT09ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG5cbiAgICBpZiAodHlwZW9mIGV2ZW50LmNvZGUgPT09ICdzdHJpbmcnXG4gICAgICYmIHR5cGVvZiBldmVudC5mcGF0aCA9PT0gJ3N0cmluZydcbiAgICAgJiYgKGV2ZW50LnN0YXRzIGluc3RhbmNlb2YgU3RhdHMpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGV2ZW50LmNvZGUgPT09ICdzdHJpbmcnXG4gICAgICYmIGV2ZW50LmNvZGUgPT09ICdyZWFkeScpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgZXZlbnQuY29kZSA9PT0gJ3N0cmluZydcbiAgICAgJiYgZXZlbnQuY29kZSA9PT0gJ3VubGluaydcbiAgICAgJiYgdHlwZW9mIGV2ZW50LmZwYXRoID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuXG5jb25zdCBfc3ltYl9kaXJzID0gU3ltYm9sKCdkaXJzJyk7XG5jb25zdCBfc3ltYl93YXRjaGVyID0gU3ltYm9sKCd3YXRjaGVyJyk7XG5jb25zdCBfc3ltYl9uYW1lID0gU3ltYm9sKCduYW1lJyk7XG5jb25zdCBfc3ltYl9vcHRpb25zID0gU3ltYm9sKCdvcHRpb25zJyk7XG5jb25zdCBfc3ltYl9jd2QgPSBTeW1ib2woJ2Jhc2VkaXInKTtcbmNvbnN0IF9zeW1iX3F1ZXVlID0gU3ltYm9sKCdxdWV1ZScpO1xuXG5leHBvcnQgY2xhc3MgRGlyc1dhdGNoZXIgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIG5hbWUgc3RyaW5nIGdpdmluZyB0aGUgbmFtZSBmb3IgdGhpcyB3YXRjaGVyXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobmFtZSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgJHtuYW1lfSBjb25zdHJ1Y3RvcmApO1xuICAgICAgICB0aGlzW19zeW1iX25hbWVdID0gbmFtZTtcbiAgICAgICAgLy8gVE9ETyBpcyB0aGVyZSBhIG5lZWQgdG8gbWFrZSB0aGlzIGN1c3RvbWl6YWJsZT9cbiAgICAgICAgdGhpc1tfc3ltYl9vcHRpb25zXSA9IHtcbiAgICAgICAgICAgIHBlcnNpc3RlbnQ6IHRydWUsIGlnbm9yZUluaXRpYWw6IGZhbHNlLCBhd2FpdFdyaXRlRmluaXNoOiB0cnVlLCBhbHdheXNTdGF0OiB0cnVlXG4gICAgICAgIH07XG4gICAgICAgIHRoaXNbX3N5bWJfY3dkXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XG4gICAgICAgIGNvbnN0IHE6IHF1ZXVlQXNQcm9taXNlZDxxdWV1ZUV2ZW50PiA9IGZhc3RxLnByb21pc2UoXG4gICAgICAgICAgICBhc3luYyBmdW5jdGlvbihldmVudDogcXVldWVFdmVudCkge1xuICAgICAgICAgICAgICAgIGlmICghaXNRdWV1ZUV2ZW50KGV2ZW50KSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYElOVEVSTkFMIEVSUk9SIG5vdCBhIHF1ZXVlRXZlbnQgJHt1dGlsLmluc3BlY3QoZXZlbnQpfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoZXZlbnQuY29kZSA9PT0gJ2NoYW5nZScpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhhdC5vbkNoYW5nZShldmVudC5mcGF0aCAvKiwgZXZlbnQuc3RhdHMgKi8pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZXZlbnQuY29kZSA9PT0gJ2FkZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhhdC5vbkFkZChldmVudC5mcGF0aCAvKiwgZXZlbnQuc3RhdHMgKi8pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZXZlbnQuY29kZSA9PT0gJ3VubGluaycpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhhdC5vblVubGluayhldmVudC5mcGF0aCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC5jb2RlID09PSAncmVhZHknKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoYXQub25SZWFkeSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIDEpO1xuICAgICAgICB0aGlzW19zeW1iX3F1ZXVlXSA9IHE7XG4gICAgICAgIHRoaXNbX3N5bWJfcXVldWVdLmVycm9yKGZ1bmN0aW9uKGVyciwgdGFzaykge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYERpcnNXYXRjaGVyICR7bmFtZX0gJHt0YXNrLmNvZGV9ICR7dGFzay5mcGF0aH0gY2F1Z2h0IGVycm9yICR7ZXJyfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGRpcmVjdG9yeSBzdGFjayBmb3JcbiAgICAgKiB0aGlzIFdhdGNoZXIuXG4gICAgICovXG4gICAgZ2V0IGRpcnMoKSB7IHJldHVybiB0aGlzW19zeW1iX2RpcnNdOyB9XG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIG5hbWUgZm9yIHRoaXMgV2F0Y2hlclxuICAgICAqL1xuICAgIGdldCBuYW1lKCkgeyByZXR1cm4gdGhpc1tfc3ltYl9uYW1lXTsgfVxuXG4gICAgLyoqXG4gICAgICogQ2hhbmdlcyB0aGUgdXNlIG9mIGFic29sdXRlIHBhdGhuYW1lcywgdG8gcGF0aHMgcmVsYXR2ZSB0byB0aGUgZ2l2ZW4gZGlyZWN0b3J5LlxuICAgICAqIFRoaXMgbXVzdCBiZSBjYWxsZWQgYmVmb3JlIHRoZSA8ZW0+d2F0Y2g8L2VtPiBtZXRob2QgaXMgY2FsbGVkLiAgVGhlIHBhdGhzXG4gICAgICogeW91IHNwZWNpZnkgdG8gd2F0Y2ggbXVzdCBiZSByZWxhdGl2ZSB0byB0aGUgZ2l2ZW4gZGlyZWN0b3J5LlxuICAgICAqL1xuICAgIHNldCBiYXNlZGlyKGN3ZCkgeyB0aGlzW19zeW1iX2N3ZF0gPSBjd2Q7IH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgdGhlIENob2tpZGFyIHdhdGNoZXIsIGJhc2VjIG9uIHRoZSBkaXJlY3RvcmllcyB0byB3YXRjaC4gIFRoZSA8ZW0+ZGlyc3BlYzwvZW0+IG9wdGlvbiBjYW4gYmUgYSBzdHJpbmcsXG4gICAgICogb3IgYW4gb2JqZWN0LiAgSWYgaXQgaXMgYSBzdHJpbmcsIGl0IGlzIGEgZmlsZXN5c3RlbSBwYXRobmFtZSB0aGF0IHdpbGwgYmVcbiAgICAgKiBhc3NvY2lhdGVkIHdpdGggdGhlIHJvb3Qgb2YgdGhlIHZpcnR1YWwgZmlsZXN5c3RlbS4gIEFuIG9iamVjdCB3aWxsIGxvb2tcbiAgICAgKiBsaWtlIHRoaXM6XG4gICAgICogXG4gICAgICogPGNvZGU+XG4gICAgICoge1xuICAgICAqICAgbW91bnRlZDogJy9wYXRoL3RvL21vdW50ZWQnLFxuICAgICAqICAgbW91bnRQb2ludDogJ21vdW50ZWQnXG4gICAgICogfVxuICAgICAqIDwvY29kZT5cbiAgICAgKiBcbiAgICAgKiBUaGUgPHR0Pm1vdW50UG9pbnQ8L3R0PiBmaWVsZCBpcyBhIGZ1bGwgcGF0aCB0byB0aGUgZGlyZWN0b3J5IG9mIGludGVyZXN0LiAgVGhlXG4gICAgICogPHR0Pm1vdW50UG9pbnQ8L3R0PiBmaWVsZCBkZXNjcmliZXMgYSBwcmVmaXggd2l0aGluIHRoZSB2aXJ0dWFsIGZpbGVzeXN0ZW0uXG4gICAgICogXG4gICAgICogQHBhcmFtIGRpcnNwZWMgXG4gICAgICovXG4gICAgYXN5bmMgd2F0Y2goZGlycykge1xuICAgICAgICBpZiAodGhpc1tfc3ltYl93YXRjaGVyXSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBXYXRjaGVyIGFscmVhZHkgc3RhcnRlZCBmb3IgJHt0aGlzW19zeW1iX3dhdGNoZXJdfWApO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgZGlycyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGRpcnMgPSBbIHtcbiAgICAgICAgICAgICAgICBzcmM6IGRpcnMsIGRlc3Q6ICcvJ1xuICAgICAgICAgICAgfSBdO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkaXJzID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheShkaXJzKSkge1xuICAgICAgICAgICAgZGlycyA9IFsgZGlycyBdO1xuICAgICAgICB9IGVsc2UgaWYgKCFBcnJheS5pc0FycmF5KGRpcnMpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHdhdGNoIC0gdGhlIGRpcnMgYXJndW1lbnQgaXMgaW5jb3JyZWN0ICR7dXRpbC5pbnNwZWN0KGRpcnMpfWApO1xuICAgICAgICB9XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGB3YXRjaCBkaXJzPWAsIGRpcnMpO1xuICAgICAgICBjb25zdCB0b3dhdGNoID0gW107XG4gICAgICAgIGZvciAoY29uc3QgZGlyIG9mIGRpcnMpIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgZnMuc3RhdChkaXIubW91bnRlZCk7XG4gICAgICAgICAgICBpZiAoIXN0YXRzLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHdhdGNoIC0gbm9uLWRpcmVjdG9yeSBzcGVjaWZpZWQgaW4gJHt1dGlsLmluc3BlY3QoZGlyKX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRvd2F0Y2gucHVzaChkaXIubW91bnRlZCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpc1tfc3ltYl9kaXJzXSA9IGRpcnM7XG5cbiAgICAgICAgaWYgKHRoaXNbX3N5bWJfY3dkXSkge1xuICAgICAgICAgICAgdGhpc1tfc3ltYl9vcHRpb25zXS5jd2QgPSB0aGlzW19zeW1iX2N3ZF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzW19zeW1iX29wdGlvbnNdLmN3ZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXNbX3N5bWJfd2F0Y2hlcl0gPSBjaG9raWRhci53YXRjaCh0b3dhdGNoLCB0aGlzW19zeW1iX29wdGlvbnNdKTtcblxuICAgICAgICAvLyBJbiB0aGUgZXZlbnQgaGFuZGxlcnMsIHdlIGNyZWF0ZSB0aGUgRmlsZUluZm8gb2JqZWN0IG1hdGNoaW5nXG4gICAgICAgIC8vIHRoZSBwYXRoLiAgVGhlIEZpbGVJbmZvIGlzIG1hdGNoZWQgdG8gYSBfc3ltYl9kaXJzIGVudHJ5LlxuICAgICAgICAvLyBJZiB0aGUgX3N5bWJfZGlycyBlbnRyeSBoYXMgPGVtPmlnbm9yZTwvZW0+IG9yIDxlbT5pbmNsdWRlPC9lbT5cbiAgICAgICAgLy8gZmllbGRzLCB0aGUgcGF0dGVybnMgaW4gdGhvc2UgZmllbGRzIGFyZSB1c2VkIHRvIGRldGVybWluZSB3aGV0aGVyXG4gICAgICAgIC8vIHRvIGluY2x1ZGUgb3IgaWdub3JlIHRoaXMgZmlsZS4gIElmIHdlIGFyZSB0byBpZ25vcmUgaXQsIHRoZW5cbiAgICAgICAgLy8gZmlsZUluZm8gcmV0dXJucyB1bmRlZmluZWQuICBIZW5jZSwgaW4gZWFjaCBjYXNlIHdlIHRlc3Qgd2hldGhlclxuICAgICAgICAvLyA8ZW0+aW5mbzwvZW0+IGhhcyBhIHZhbHVlIGJlZm9yZSBlbWl0dGluZyB0aGUgZXZlbnQuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIEFsbCB0aGlzIGZ1bmN0aW9uIGRvZXMgaXMgdG8gcmVjZWl2ZSBldmVudHMgZnJvbSBDaG9raWRhcixcbiAgICAgICAgLy8gY29uc3RydWN0IEZpbGVJbmZvIG9iamVjdHMsIGFuZCBlbWl0IG1hdGNoaW5nIGV2ZW50cy5cblxuICAgICAgICAvLyBjb25zdCB3YXRjaGVyX25hbWUgPSB0aGlzLm5hbWU7XG5cbiAgICAgICAgdGhpc1tfc3ltYl93YXRjaGVyXVxuICAgICAgICAgICAgLm9uKCdjaGFuZ2UnLCBhc3luYyAoZnBhdGgsIHN0YXRzKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpc1tfc3ltYl9xdWV1ZV0ucHVzaCg8cXVldWVFdmVudD57XG4gICAgICAgICAgICAgICAgICAgIGNvZGU6ICdjaGFuZ2UnLCBmcGF0aCwgc3RhdHNcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgd2F0Y2hlciAke3dhdGNoZXJfbmFtZX0gY2hhbmdlICR7ZnBhdGh9YCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLm9uKCdhZGQnLCBhc3luYyAoZnBhdGgsIHN0YXRzKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpc1tfc3ltYl9xdWV1ZV0ucHVzaCg8cXVldWVFdmVudD57XG4gICAgICAgICAgICAgICAgICAgIGNvZGU6ICdhZGQnLCBmcGF0aCwgc3RhdHNcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgd2F0Y2hlciAke3dhdGNoZXJfbmFtZX0gYWRkICR7ZnBhdGh9YCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLyogLm9uKCdhZGREaXInLCBhc3luYyAoZnBhdGgsIHN0YXRzKSA9PiB7IFxuICAgICAgICAgICAgICAgIC8vID8/IGxldCBpbmZvID0gdGhpcy5maWxlSW5mbyhmcGF0aCwgc3RhdHMpO1xuICAgICAgICAgICAgICAgIC8vID8/IGNvbnNvbGUubG9nKGBEaXJzV2F0Y2hlciBhZGREaXJgLCBpbmZvKTtcbiAgICAgICAgICAgICAgICAvLyA/PyB0aGlzLmVtaXQoJ2FkZERpcicsIGluZm8pO1xuICAgICAgICAgICAgfSkgKi9cbiAgICAgICAgICAgIC5vbigndW5saW5rJywgYXN5bmMgZnBhdGggPT4ge1xuICAgICAgICAgICAgICAgIHRoaXNbX3N5bWJfcXVldWVdLnB1c2goPHF1ZXVlRXZlbnQ+e1xuICAgICAgICAgICAgICAgICAgICBjb2RlOiAndW5saW5rJywgZnBhdGhcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgd2F0Y2hlciAke3dhdGNoZXJfbmFtZX0gdW5saW5rICR7ZnBhdGh9YCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLyogLm9uKCd1bmxpbmtEaXInLCBhc3luYyBmcGF0aCA9PiB7IFxuICAgICAgICAgICAgICAgIC8vID8/IGxldCBpbmZvID0gdGhpcy5maWxlSW5mbyhmcGF0aCwgc3RhdHMpO1xuICAgICAgICAgICAgICAgIC8vID8/IGNvbnNvbGUubG9nKGBEaXJzV2F0Y2hlciB1bmxpbmtEaXIgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgICAgICAvLyA/PyB0aGlzLmVtaXQoJ3VubGlua0RpcicsIGluZm8pO1xuICAgICAgICAgICAgfSkgKi9cbiAgICAgICAgICAgIC5vbigncmVhZHknLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpc1tfc3ltYl9xdWV1ZV0ucHVzaCg8cXVldWVFdmVudD57XG4gICAgICAgICAgICAgICAgICAgIGNvZGU6ICdyZWFkeSdcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgd2F0Y2hlciAke3dhdGNoZXJfbmFtZX0gcmVhZHlgKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHRoaXMuaXNSZWFkeSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgLy8gICAgIHRoaXNbX3N5bWJfd2F0Y2hlcl0ub24oJ3JlYWR5JywgKCkgPT4geyByZXNvbHZlKHRydWUpOyB9KTtcbiAgICAgICAgLy8gfSk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKHRoaXMuaXNSZWFkeSk7XG4gICAgfVxuXG4gICAgLyogQ2FsY3VsYXRlIHRoZSBzdGFjayBmb3IgYSBmaWxlc3lzdGVtIHBhdGhcblxuICAgIE9ubHkgZW1pdCBpZiB0aGUgY2hhbmdlIHdhcyB0byB0aGUgZnJvbnQtbW9zdCBmaWxlICovIFxuICAgIGFzeW5jIG9uQ2hhbmdlKGZwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgdnBpbmZvID0gdGhpcy52cGF0aEZvckZTUGF0aChmcGF0aCk7XG4gICAgICAgIGlmICghdnBpbmZvKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgb25DaGFuZ2UgY291bGQgbm90IGZpbmQgbW91bnQgcG9pbnQgb3IgdnBhdGggZm9yICR7ZnBhdGh9YCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc3RhY2s6IFZQYXRoRGF0YVtdID0gYXdhaXQgdGhpcy5zdGFja0ZvclZQYXRoKHZwaW5mby52cGF0aCk7XG4gICAgICAgIGlmIChzdGFjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgb25DaGFuZ2UgY291bGQgbm90IGZpbmQgbW91bnQgcG9pbnRzIGZvciAke2ZwYXRofWApO1xuICAgICAgICB9XG4gICAgICAgIGxldCBpID0gMDtcbiAgICAgICAgbGV0IGRlcHRoO1xuICAgICAgICBsZXQgZW50cnk7XG4gICAgICAgIGZvciAoY29uc3QgcyBvZiBzdGFjaykge1xuICAgICAgICAgICAgaWYgKHMuZnNwYXRoID09PSBmcGF0aCkge1xuICAgICAgICAgICAgICAgIGVudHJ5ID0gcztcbiAgICAgICAgICAgICAgICBkZXB0aCA9IGk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpKys7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFlbnRyeSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBvbkNoYW5nZSBubyBzdGFjayBlbnRyeSBmb3IgJHtmcGF0aH0gKCR7dnBpbmZvLnZwYXRofSlgKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGVwdGggPT09IDApIHtcbiAgICAgICAgICAgIHZwaW5mby5zdGFjayA9IHN0YWNrO1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIGNoYW5nZSAke2ZwYXRofWApO1xuICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YSh2cGluZm8pKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFZQYXRoRGF0YSAke3V0aWwuaW5zcGVjdCh2cGluZm8pfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5lbWl0KCdjaGFuZ2UnLCB0aGlzLm5hbWUsIHZwaW5mbyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gbGV0IGluZm8gPSB0aGlzLmZpbGVJbmZvKGZwYXRoLCBzdGF0cyk7XG4gICAgICAgIC8vIGlmIChpbmZvKSB0aGlzLmVtaXQoJ2NoYW5nZScsIHRoaXMubmFtZSwgaW5mbyk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBEaXJzV2F0Y2hlciBjaGFuZ2UgJHtmcGF0aH1gLCBpbmZvKTtcbiAgICB9XG5cbiAgICAvLyBPbmx5IGVtaXQgaWYgdGhlIGFkZCB3YXMgdGhlIGZyb250LW1vc3QgZmlsZVxuICAgIGFzeW5jIG9uQWRkKGZwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgdnBpbmZvID0gdGhpcy52cGF0aEZvckZTUGF0aChmcGF0aCk7XG4gICAgICAgIGlmICghdnBpbmZvKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgb25BZGQgY291bGQgbm90IGZpbmQgbW91bnQgcG9pbnQgb3IgdnBhdGggZm9yICR7ZnBhdGh9YCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkICR7ZnBhdGh9YCwgdnBpbmZvKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkICR7ZnBhdGh9ICR7dnBpbmZvLnZwYXRofWApO1xuICAgICAgICBjb25zdCBzdGFjazogVlBhdGhEYXRhW10gPSBhd2FpdCB0aGlzLnN0YWNrRm9yVlBhdGgodnBpbmZvLnZwYXRoKTtcbiAgICAgICAgaWYgKHN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBvbkFkZCBjb3VsZCBub3QgZmluZCBtb3VudCBwb2ludHMgZm9yICR7ZnBhdGh9YCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkICR7ZnBhdGh9YCwgc3RhY2spO1xuICAgICAgICBsZXQgaSA9IDA7XG4gICAgICAgIGxldCBkZXB0aDtcbiAgICAgICAgbGV0IGVudHJ5O1xuICAgICAgICBmb3IgKGNvbnN0IHMgb2Ygc3RhY2spIHtcbiAgICAgICAgICAgIGlmIChzLmZzcGF0aCA9PT0gZnBhdGgpIHtcbiAgICAgICAgICAgICAgICBlbnRyeSA9IHM7XG4gICAgICAgICAgICAgICAgZGVwdGggPSBpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaSsrO1xuICAgICAgICB9XG4gICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgb25BZGQgbm8gc3RhY2sgZW50cnkgZm9yICR7ZnBhdGh9ICgke3ZwaW5mby52cGF0aH0pYCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkICR7ZnBhdGh9IGRlcHRoPSR7ZGVwdGh9YCwgZW50cnkpO1xuICAgICAgICBpZiAoZGVwdGggPT09IDApIHtcbiAgICAgICAgICAgIHZwaW5mby5zdGFjayA9IHN0YWNrO1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkIEVNSVQgYWRkICR7dnBpbmZvLnZwYXRofWApO1xuICAgICAgICAgICAgLy8gZm9yIChsZXQgcyBvZiBzdGFjaykge1xuICAgICAgICAgICAgLy8gICAgY29uc29sZS5sb2coYC4uLi4gJHtzLnZwYXRofSA9PT4gJHtzLmZzcGF0aH1gKTtcbiAgICAgICAgICAgIC8vIH1cbiAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEodnBpbmZvKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QodnBpbmZvKX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZW1pdCgnYWRkJywgdGhpcy5uYW1lLCB2cGluZm8pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkIFNLSVBQRUQgZW1pdCBldmVudCBmb3IgJHtmcGF0aH1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBsZXQgaW5mbyA9IHRoaXMuZmlsZUluZm8oZnBhdGgsIHN0YXRzKTtcbiAgICAgICAgLy8gaWYgKGluZm8pIHRoaXMuZW1pdCgnYWRkJywgdGhpcy5uYW1lLCBpbmZvKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIGFkZGAsIGluZm8pO1xuICAgICAgICBcbiAgICB9XG5cbiAgICAvKiBPbmx5IGVtaXQgaWYgaXQgd2FzIHRoZSBmcm9udC1tb3N0IGZpbGUgZGVsZXRlZFxuICAgIElmIHRoZXJlIGlzIGEgZmlsZSB1bmNvdmVyZWQgYnkgdGhpcywgdGhlbiBlbWl0IGFuIGFkZCBldmVudCBmb3IgdGhhdCAqL1xuICAgIGFzeW5jIG9uVW5saW5rKGZwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgdnBpbmZvID0gdGhpcy52cGF0aEZvckZTUGF0aChmcGF0aCk7XG4gICAgICAgIGlmICghdnBpbmZvKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgb25VbmxpbmsgY291bGQgbm90IGZpbmQgbW91bnQgcG9pbnQgb3IgdnBhdGggZm9yICR7ZnBhdGh9YCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc3RhY2s6IFZQYXRoRGF0YVtdID0gYXdhaXQgdGhpcy5zdGFja0ZvclZQYXRoKHZwaW5mby52cGF0aCk7XG4gICAgICAgIGlmIChzdGFjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIC8qIElmIG5vIGZpbGVzIHJlbWFpbiBpbiB0aGUgc3RhY2sgZm9yIHRoaXMgdmlydHVhbCBwYXRoLCB0aGVuXG4gICAgICAgICAgICAgKiB3ZSBtdXN0IGRlY2xhcmUgaXQgdW5saW5rZWQuXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEodnBpbmZvKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QodnBpbmZvKX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZW1pdCgndW5saW5rJywgdGhpcy5uYW1lLCB2cGluZm8pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLyogT24gdGhlIG90aGVyIGhhbmQsIGlmIHRoZXJlIGlzIGFuIGVudHJ5IHdlIHNob3VsZG4ndCBzZW5kXG4gICAgICAgICAgICAgKiBhbiB1bmxpbmsgZXZlbnQuICBJbnN0ZWFkIGl0IHNlZW1zIG1vc3QgYXBwcm9wcmlhdGUgdG8gc2VuZFxuICAgICAgICAgICAgICogYSBjaGFuZ2UgZXZlbnQuXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGNvbnN0IHNmaXJzdCA9IHN0YWNrWzBdO1xuICAgICAgICAgICAgY29uc3QgdG9lbWl0ID0gPFZQYXRoRGF0YT57XG4gICAgICAgICAgICAgICAgZnNwYXRoOiBzZmlyc3QuZnNwYXRoLFxuICAgICAgICAgICAgICAgIHZwYXRoOiBzZmlyc3QudnBhdGgsXG4gICAgICAgICAgICAgICAgbWltZTogbWltZS5nZXRUeXBlKHNmaXJzdC5mc3BhdGgpLFxuICAgICAgICAgICAgICAgIG1vdW50ZWQ6IHNmaXJzdC5tb3VudGVkLFxuICAgICAgICAgICAgICAgIG1vdW50UG9pbnQ6IHNmaXJzdC5tb3VudFBvaW50LFxuICAgICAgICAgICAgICAgIHBhdGhJbk1vdW50ZWQ6IHNmaXJzdC5wYXRoSW5Nb3VudGVkLFxuICAgICAgICAgICAgICAgIHN0YWNrXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YSh0b2VtaXQpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFZQYXRoRGF0YSAke3V0aWwuaW5zcGVjdCh0b2VtaXQpfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5lbWl0KCdjaGFuZ2UnLCB0aGlzLm5hbWUsIHRvZW1pdCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gbGV0IGluZm8gPSB0aGlzLmZpbGVJbmZvKGZwYXRoLCB1bmRlZmluZWQpO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgdW5saW5rICR7ZnBhdGh9YCk7XG4gICAgICAgIC8vIGlmIChpbmZvKSB0aGlzLmVtaXQoJ3VubGluaycsIHRoaXMubmFtZSwgaW5mbyk7XG4gICAgfVxuXG4gICAgb25SZWFkeSgpOiB2b2lkIHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ0RpcnNXYXRjaGVyOiBJbml0aWFsIHNjYW4gY29tcGxldGUuIFJlYWR5IGZvciBjaGFuZ2VzJyk7XG4gICAgICAgIHRoaXMuZW1pdCgncmVhZHknLCB0aGlzLm5hbWUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYW4gb2JqZWN0IHJlcHJlc2VudGluZyBhbGwgdGhlIHBhdGhzIG9uIHRoZSBmaWxlIHN5c3RlbSBiZWluZ1xuICAgICAqIHdhdGNoZWQgYnkgdGhpcyBGU1dhdGNoZXIgaW5zdGFuY2UuIFRoZSBvYmplY3QncyBrZXlzIGFyZSBhbGwgdGhlIFxuICAgICAqIGRpcmVjdG9yaWVzICh1c2luZyBhYnNvbHV0ZSBwYXRocyB1bmxlc3MgdGhlIGN3ZCBvcHRpb24gd2FzIHVzZWQpLFxuICAgICAqIGFuZCB0aGUgdmFsdWVzIGFyZSBhcnJheXMgb2YgdGhlIG5hbWVzIG9mIHRoZSBpdGVtcyBjb250YWluZWQgaW4gZWFjaCBkaXJlY3RvcnkuXG4gICAgICovXG4gICAgZ2V0V2F0Y2hlZCgpIHtcbiAgICAgICAgaWYgKHRoaXNbX3N5bWJfd2F0Y2hlcl0pIHJldHVybiB0aGlzW19zeW1iX3dhdGNoZXJdLmdldFdhdGNoZWQoKTtcbiAgICB9XG5cbiAgICB2cGF0aEZvckZTUGF0aChmc3BhdGg6IHN0cmluZyk6IFZQYXRoRGF0YSB7XG4gICAgICAgIGZvciAoY29uc3QgZGlyIG9mIHRoaXMuZGlycykge1xuXG4gICAgICAgICAgICAvLyBDaGVjayB0byBzZWUgaWYgd2UncmUgc3VwcG9zZWQgdG8gaWdub3JlIHRoZSBmaWxlXG4gICAgICAgICAgICBpZiAoZGlyLmlnbm9yZSkge1xuICAgICAgICAgICAgICAgIGxldCBpZ25vcmVzO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZGlyLmlnbm9yZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgaWdub3JlcyA9IFsgZGlyLmlnbm9yZSBdO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlnbm9yZXMgPSBkaXIuaWdub3JlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsZXQgaWdub3JlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBpIG9mIGlnbm9yZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1pbmltYXRjaChmc3BhdGgsIGkpKSBpZ25vcmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgZGlyLmlnbm9yZSAke2ZzcGF0aH0gJHtpfSA9PiAke2lnbm9yZX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGlnbm9yZSkgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFRoaXMgZW5zdXJlcyB3ZSBhcmUgbWF0Y2hpbmcgb24gZGlyZWN0b3J5IGJvdW5kYXJpZXNcbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSBmc3BhdGggXCIvcGF0aC90by9sYXlvdXRzLWV4dHJhL2xheW91dC5uamtcIiBtaWdodFxuICAgICAgICAgICAgLy8gbWF0Y2ggZGlyLm1vdW50ZWQgXCIvcGF0aC90by9sYXlvdXRzXCIuXG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHZwYXRoRm9yRlNQYXRoICR7ZGlyLm1vdW50ZWR9ICR7dHlwZW9mIGRpci5tb3VudGVkfWAsIGRpcik7XG4gICAgICAgICAgICBjb25zdCBkaXJtb3VudGVkID1cbiAgICAgICAgICAgICAgICAoZGlyICYmIGRpci5tb3VudGVkKVxuICAgICAgICAgICAgICAgICAgICA/IChkaXIubW91bnRlZC5jaGFyQXQoZGlyLm1vdW50ZWQubGVuZ3RoIC0gMSkgPT0gJy8nKVxuICAgICAgICAgICAgICAgICAgICAgICAgPyBkaXIubW91bnRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgOiAoZGlyLm1vdW50ZWQgKyAnLycpXG4gICAgICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgaWYgKGRpcm1vdW50ZWQgJiYgZnNwYXRoLmluZGV4T2YoZGlybW91bnRlZCkgPT09IDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXRoSW5Nb3VudGVkID0gZnNwYXRoLnN1YnN0cmluZyhkaXIubW91bnRlZC5sZW5ndGgpLnN1YnN0cmluZygxKTtcbiAgICAgICAgICAgICAgICBjb25zdCB2cGF0aCA9IGRpci5tb3VudFBvaW50ID09PSAnLydcbiAgICAgICAgICAgICAgICAgICAgICAgID8gcGF0aEluTW91bnRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgOiBwYXRoLmpvaW4oZGlyLm1vdW50UG9pbnQsIHBhdGhJbk1vdW50ZWQpO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB2cGF0aEZvckZTUGF0aCBmc3BhdGggJHtmc3BhdGh9IGRpci5tb3VudFBvaW50ICR7ZGlyLm1vdW50UG9pbnR9IHBhdGhJbk1vdW50ZWQgJHtwYXRoSW5Nb3VudGVkfSB2cGF0aCAke3ZwYXRofWApO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJldCA9IDxWUGF0aERhdGE+e1xuICAgICAgICAgICAgICAgICAgICBmc3BhdGg6IGZzcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgdnBhdGg6IHZwYXRoLFxuICAgICAgICAgICAgICAgICAgICBtaW1lOiBtaW1lLmdldFR5cGUoZnNwYXRoKSxcbiAgICAgICAgICAgICAgICAgICAgbW91bnRlZDogZGlyLm1vdW50ZWQsXG4gICAgICAgICAgICAgICAgICAgIG1vdW50UG9pbnQ6IGRpci5tb3VudFBvaW50LFxuICAgICAgICAgICAgICAgICAgICBwYXRoSW5Nb3VudGVkXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBpZiAoIWlzVlBhdGhEYXRhKHJldCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFZQYXRoRGF0YSAke3V0aWwuaW5zcGVjdChyZXQpfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIE5vIGRpcmVjdG9yeSBmb3VuZCBmb3IgdGhpcyBmaWxlXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgYXN5bmMgc3RhY2tGb3JWUGF0aCh2cGF0aDogc3RyaW5nKTogUHJvbWlzZTxWUGF0aERhdGFbXT4ge1xuICAgICAgICBjb25zdCByZXQ6IFZQYXRoRGF0YVtdID0gW107XG4gICAgICAgIGZvciAoY29uc3QgZGlyIG9mIHRoaXMuZGlycykge1xuICAgICAgICAgICAgaWYgKGRpci5tb3VudFBvaW50ID09PSAnLycpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXRoSW5Nb3VudGVkID0gdnBhdGg7XG4gICAgICAgICAgICAgICAgY29uc3QgZnNwYXRoID0gcGF0aC5qb2luKGRpci5tb3VudGVkLCBwYXRoSW5Nb3VudGVkKTtcbiAgICAgICAgICAgICAgICBsZXQgc3RhdHM7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KGZzcGF0aCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRzID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIXN0YXRzKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCB0b3B1c2ggPSA8VlBhdGhEYXRhPntcbiAgICAgICAgICAgICAgICAgICAgZnNwYXRoOiBmc3BhdGgsXG4gICAgICAgICAgICAgICAgICAgIHZwYXRoOiB2cGF0aCxcbiAgICAgICAgICAgICAgICAgICAgbWltZTogbWltZS5nZXRUeXBlKGZzcGF0aCksXG4gICAgICAgICAgICAgICAgICAgIG1vdW50ZWQ6IGRpci5tb3VudGVkLFxuICAgICAgICAgICAgICAgICAgICBtb3VudFBvaW50OiBkaXIubW91bnRQb2ludCxcbiAgICAgICAgICAgICAgICAgICAgcGF0aEluTW91bnRlZDogcGF0aEluTW91bnRlZFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YSh0b3B1c2gpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QodG9wdXNoKX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0LnB1c2godG9wdXNoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGlybW91bnRwdCA9XG4gICAgICAgICAgICAgICAgICAgIChkaXIgJiYgZGlyLm1vdW50UG9pbnQpXG4gICAgICAgICAgICAgICAgICAgICAgICA/IChkaXIubW91bnRQb2ludC5jaGFyQXQoZGlyLm1vdW50UG9pbnQubGVuZ3RoIC0gMSkgPT09ICcvJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IGRpci5tb3VudFBvaW50XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOiAoZGlyLm1vdW50UG9pbnQgKyAnLycpXG4gICAgICAgICAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgc3RhY2tGb3JWUGF0aCB2cGF0aCAke3ZwYXRofSBkaXIubW91bnRlZCAke2Rpci5tb3VudFBvaW50fSBkaXJtb3VudHB0ICR7ZGlybW91bnRwdH1gKTtcbiAgICAgICAgICAgICAgICBpZiAoZGlybW91bnRwdCAmJiB2cGF0aC5pbmRleE9mKGRpcm1vdW50cHQpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vID4gY29uc3QgdnBhdGggPSAnZm9vL2Jhci9iYXouaHRtbCc7XG4gICAgICAgICAgICAgICAgICAgIC8vID4gY29uc3QgbSA9ICdmb28vYmFyJztcbiAgICAgICAgICAgICAgICAgICAgLy8gPiBsZXQgcGF0aEluTW91bnRlZCA9IHZwYXRoLnN1YnN0cmluZyhtLmxlbmd0aCArIDEpO1xuICAgICAgICAgICAgICAgICAgICAvLyA+IHBhdGhJbk1vdW50ZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gJ2Jhei5odG1sJ1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXRoSW5Nb3VudGVkID0gdnBhdGguc3Vic3RyaW5nKGRpcm1vdW50cHQubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZnNwYXRoID0gcGF0aC5qb2luKGRpci5tb3VudGVkLCBwYXRoSW5Nb3VudGVkKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHN0YWNrRm9yVlBhdGggdnBhdGggJHt2cGF0aH0gcGF0aEluTW91bnRlZCAke3BhdGhJbk1vdW50ZWR9IGZzcGF0aCAke2ZzcGF0aH1gKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHN0YXRzO1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KGZzcGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHMgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFzdGF0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHN0YWNrRm9yVlBhdGggdnBhdGggJHt2cGF0aH0gZGlkIG5vdCBmaW5kIGZzLnN0YXRzIGZvciAke2ZzcGF0aH1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRvcHVzaCA9IDxWUGF0aERhdGE+e1xuICAgICAgICAgICAgICAgICAgICAgICAgZnNwYXRoOiBmc3BhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICB2cGF0aDogdnBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW1lOiBtaW1lLmdldFR5cGUoZnNwYXRoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vdW50ZWQ6IGRpci5tb3VudGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgbW91bnRQb2ludDogZGlyLm1vdW50UG9pbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoSW5Nb3VudGVkOiBwYXRoSW5Nb3VudGVkXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEodG9wdXNoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFZQYXRoRGF0YSAke3V0aWwuaW5zcGVjdCh0b3B1c2gpfWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldC5wdXNoKHRvcHVzaCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHN0YWNrRm9yVlBhdGggdnBhdGggJHt2cGF0aH0gZGlkIG5vdCBtYXRjaCAke2Rpcm1vdW50cHR9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIChrbm9jayBvbiB3b29kKSBFdmVyeSBlbnRyeSBpbiBgcmV0YCBoYXMgYWxyZWFkeSBiZWVuIHZlcmlmaWVkXG4gICAgICAgIC8vIGFzIGJlaW5nIGEgY29ycmVjdCBWUGF0aERhdGEgb2JqZWN0XG4gICAgICAgIHJldHVybiByZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydCBkYXRhIHdlIGdhdGhlciBhYm91dCBhIGZpbGUgaW4gdGhlIGZpbGUgc3lzdGVtIGludG8gYSBkZXNjcmlwdG9yIG9iamVjdC5cbiAgICAgKiBAcGFyYW0gZnNwYXRoIFxuICAgICAqIEBwYXJhbSBzdGF0cyBcbiAgICAgKi9cbiAgICAvKiBmaWxlSW5mbyhmc3BhdGgsIHN0YXRzKSB7XG4gICAgICAgIGxldCBlID0gdGhpcy5kaXJGb3JQYXRoKGZzcGF0aCk7XG4gICAgICAgIGlmICghZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBObyBtb3VudFBvaW50IGZvdW5kIGZvciAke2ZzcGF0aH1gKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgZm5JblNvdXJjZURpciA9IGZzcGF0aC5zdWJzdHJpbmcoZS5wYXRoLmxlbmd0aCkuc3Vic3RyaW5nKDEpO1xuICAgICAgICBsZXQgZG9jcGF0aCA9IHBhdGguam9pbihlLm1vdW50UG9pbnQsIGZuSW5Tb3VyY2VEaXIpO1xuICAgICAgICBpZiAoZG9jcGF0aC5zdGFydHNXaXRoKCcvJykpIHtcbiAgICAgICAgICAgIGRvY3BhdGggPSBkb2NwYXRoLnN1YnN0cmluZygxKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgaWdub3JlID0gZmFsc2U7XG4gICAgICAgIGxldCBpbmNsdWRlID0gdHJ1ZTtcbiAgICAgICAgaWYgKGUuaWdub3JlKSB7XG4gICAgICAgICAgICBsZXQgaWdub3JlcztcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZS5pZ25vcmUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgaWdub3JlcyA9IFsgZS5pZ25vcmUgXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWdub3JlcyA9IGUuaWdub3JlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChsZXQgaSBvZiBpZ25vcmVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1pbmltYXRjaChmbkluU291cmNlRGlyLCBpKSkgaWdub3JlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgZS5pZ25vcmUgJHtmbkluU291cmNlRGlyfSAke2l9ID0+ICR7aWdub3JlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChlLmluY2x1ZGUpIHtcbiAgICAgICAgICAgIGluY2x1ZGUgPSBmYWxzZTtcbiAgICAgICAgICAgIGxldCBpbmNsdWRlcnM7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGUuaW5jbHVkZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBpbmNsdWRlcnMgPSBbIGUuaW5jbHVkZSBdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpbmNsdWRlcnMgPSBlLmluY2x1ZGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBpIG9mIGluY2x1ZGVycykge1xuICAgICAgICAgICAgICAgIGlmIChtaW5pbWF0Y2goZm5JblNvdXJjZURpciwgaSkpIGluY2x1ZGUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBlLmluY2x1ZGUgJHtmbkluU291cmNlRGlyfSAke2l9ID0+ICR7aW5jbHVkZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoaWdub3JlIHx8ICFpbmNsdWRlKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBmc3BhdGg6IGZzcGF0aCxcbiAgICAgICAgICAgICAgICBtaW1lOiBtaW1lLmdldFR5cGUoZnNwYXRoKSxcbiAgICAgICAgICAgICAgICBiYXNlTWV0YWRhdGE6IGUuYmFzZU1ldGFkYXRhLFxuICAgICAgICAgICAgICAgIHNvdXJjZVBhdGg6IGUucGF0aCxcbiAgICAgICAgICAgICAgICBtb3VudFBvaW50OiBlLm1vdW50UG9pbnQsXG4gICAgICAgICAgICAgICAgcGF0aEluU291cmNlOiBmbkluU291cmNlRGlyLFxuICAgICAgICAgICAgICAgIHBhdGg6IGRvY3BhdGgsXG4gICAgICAgICAgICAgICAgaXNEaXJlY3Rvcnk6IHN0YXRzLmlzRGlyZWN0b3J5KCksXG4gICAgICAgICAgICAgICAgc3RhdHNcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9ICovXG5cbiAgICBhc3luYyBjbG9zZSgpIHtcbiAgICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2NoYW5nZScpO1xuICAgICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygnYWRkJyk7XG4gICAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCd1bmxpbmsnKTtcbiAgICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlYWR5Jyk7XG4gICAgICAgIGlmICh0aGlzW19zeW1iX3dhdGNoZXJdKSB7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgQ2xvc2luZyB3YXRjaGVyICR7dGhpcy5uYW1lfWApO1xuICAgICAgICAgICAgYXdhaXQgdGhpc1tfc3ltYl93YXRjaGVyXS5jbG9zZSgpO1xuICAgICAgICAgICAgdGhpc1tfc3ltYl93YXRjaGVyXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIH1cbn1cbiJdfQ==