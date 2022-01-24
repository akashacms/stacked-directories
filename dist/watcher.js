"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
exports.DirsWatcher = exports.VPathData = exports.mimedefine = void 0;
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
        for (let inf of vpinfo.stack) {
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
        let that = this;
        const q = fastq.promise(async function (event) {
            if (!isQueueEvent(event)) {
                throw new Error(`INTERNAL ERROR not a queueEvent ${util.inspect(event)}`);
            }
            if (event.code === 'change') {
                await that.onChange(event.fpath, event.stats);
            }
            else if (event.code === 'add') {
                await that.onAdd(event.fpath, event.stats);
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
    get dirs() { return this[_symb_dirs]; }
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
        for (let dir of dirs) {
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
        const watcher_name = this.name;
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
    async onChange(fpath, stats) {
        let vpinfo = this.vpathForFSPath(fpath);
        if (!vpinfo) {
            console.log(`onChange could not find mount point or vpath for ${fpath}`);
            return;
        }
        let stack = await this.stackForVPath(vpinfo.vpath);
        if (stack.length === 0) {
            throw new Error(`onChange could not find mount points for ${fpath}`);
        }
        let i = 0;
        let depth;
        let entry;
        for (let s of stack) {
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
            this.emit('change', this.name, vpinfo);
        }
        // let info = this.fileInfo(fpath, stats);
        // if (info) this.emit('change', this.name, info);
        // console.log(`DirsWatcher change ${fpath}`, info);
    }
    // Only emit if the add was the front-most file
    async onAdd(fpath, stats) {
        let vpinfo = this.vpathForFSPath(fpath);
        if (!vpinfo) {
            console.log(`onAdd could not find mount point or vpath for ${fpath}`);
            return;
        }
        // console.log(`onAdd ${fpath}`, vpinfo);
        // console.log(`onAdd ${fpath} ${vpinfo.vpath}`);
        let stack = await this.stackForVPath(vpinfo.vpath);
        if (stack.length === 0) {
            throw new Error(`onAdd could not find mount points for ${fpath}`);
        }
        // console.log(`onAdd ${fpath}`, stack);
        let i = 0;
        let depth;
        let entry;
        for (let s of stack) {
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
        let vpinfo = this.vpathForFSPath(fpath);
        if (!vpinfo) {
            console.log(`onUnlink could not find mount point or vpath for ${fpath}`);
            return;
        }
        let stack = await this.stackForVPath(vpinfo.vpath);
        if (stack.length === 0) {
            /* If no files remain in the stack for this virtual path, then
             * we must declare it unlinked.
             */
            this.emit('unlink', this.name, vpinfo);
        }
        else {
            /* On the other hand, if there is an entry we shouldn't send
             * an unlink event.  Instead it seems most appropriate to send
             * a change event.
             */
            let sfirst = stack[0];
            let toemit = {
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
        if (this[_symb_watcher])
            return this[_symb_watcher].getWatched();
    }
    vpathForFSPath(fspath) {
        for (let dir of this.dirs) {
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
                for (let i of ignores) {
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
            let dirmounted = (dir.mounted.charAt(dir.mounted.length - 1) == '/')
                ? dir.mounted
                : (dir.mounted + '/');
            if (fspath.indexOf(dirmounted) === 0) {
                let pathInMounted = fspath.substring(dir.mounted.length).substring(1);
                let vpath = dir.mountPoint === '/'
                    ? pathInMounted
                    : path.join(dir.mountPoint, pathInMounted);
                // console.log(`vpathForFSPath fspath ${fspath} dir.mountPoint ${dir.mountPoint} pathInMounted ${pathInMounted} vpath ${vpath}`);
                let ret = {
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
        for (let dir of this.dirs) {
            if (dir.mountPoint === '/') {
                let pathInMounted = vpath;
                let fspath = path.join(dir.mounted, pathInMounted);
                let stats;
                try {
                    stats = await fs_1.promises.stat(fspath);
                }
                catch (err) {
                    stats = undefined;
                }
                if (!stats)
                    continue;
                let topush = {
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
                let dirmountpt = (dir.mountPoint.charAt(dir.mountPoint.length - 1) == '/')
                    ? dir.mountPoint
                    : (dir.mountPoint + '/');
                // console.log(`stackForVPath vpath ${vpath} dir.mounted ${dir.mountPoint} dirmountpt ${dirmountpt}`);
                if (vpath.indexOf(dirmountpt) === 0) {
                    // > const vpath = 'foo/bar/baz.html';
                    // > const m = 'foo/bar';
                    // > let pathInMounted = vpath.substring(m.length + 1);
                    // > pathInMounted
                    // 'baz.html'
                    let pathInMounted = vpath.substring(dirmountpt.length);
                    let fspath = path.join(dir.mounted, pathInMounted);
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
                    let topush = {
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
        if (this[_symb_watcher]) {
            await this[_symb_watcher].close();
            this[_symb_watcher] = undefined;
        }
    }
}
exports.DirsWatcher = DirsWatcher;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2F0Y2hlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2xpYi93YXRjaGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSwyQkFHWTtBQUNaLHdEQUErQztBQUMvQywyQ0FBNkI7QUFDN0I7Ozs7S0FJSztBQUNMLHVFQUF1RTtBQUN2RSwyQ0FBNkI7QUFDN0IsMkNBQTZCO0FBQzdCLG1DQUFzQztBQUN0QywwREFBa0M7QUFDbEMsNkNBQStCO0FBSS9CLGlFQUFpRTtBQUNqRSxpRUFBaUU7QUFDakUsMkRBQTJEO0FBQzNELEVBQUU7QUFDRixvREFBb0Q7QUFDcEQseUNBQXlDO0FBQ3pDLDhEQUE4RDtBQUM5RCwwREFBMEQ7QUFDMUQsRUFBRTtBQUNGLHNFQUFzRTtBQUN0RSxtREFBbUQ7QUFFbkQsU0FBZ0IsVUFBVSxDQUFDLE9BQU8sRUFBRSxLQUFnQjtJQUNoRCxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRkQsZ0NBRUM7QUFHRCxNQUFhLFNBQVM7Q0FRckI7QUFSRCw4QkFRQztBQUVELE1BQU0sV0FBVyxHQUFHLENBQUMsTUFBTSxFQUF1QixFQUFFO0lBQ2hELElBQUksT0FBTyxNQUFNLEtBQUssV0FBVztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQ2hELElBQUksT0FBTyxNQUFNLEtBQUssUUFBUTtRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQzdDLElBQUksT0FBTyxNQUFNLENBQUMsSUFBSSxLQUFLLFdBQVc7V0FDbEMsTUFBTSxDQUFDLElBQUksS0FBSyxJQUFJO1dBQ3BCLE9BQU8sTUFBTSxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7UUFDakMsT0FBTyxLQUFLLENBQUM7S0FDaEI7SUFDRCxJQUFJLE9BQU8sTUFBTSxDQUFDLE1BQU0sS0FBSyxRQUFRO1dBQ2pDLE9BQU8sTUFBTSxDQUFDLEtBQUssS0FBSyxRQUFRO1dBQ2hD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aW1wb3J0IHtcbiAgICBwcm9taXNlcyBhcyBmcyxcbiAgICBTdGF0c1xufSBmcm9tICdmcyc7XG5pbXBvcnQgeyBkZWZhdWx0IGFzIGNob2tpZGFyIH0gZnJvbSAnY2hva2lkYXInO1xuaW1wb3J0ICogYXMgbWltZSBmcm9tICdtaW1lJztcbi8qIGNvbnN0IG1pbWUgPSB7IFxuICAgIGdldFR5cGU6IG1pbWVfcGtnLmdldFR5cGUsXG4gICAgZ2V0RXh0ZW5zaW9uOiBtaW1lX3BrZy5nZXRFeHRlbnNpb24sXG4gICAgZGVmaW5lOiBtaW1lX3BrZy5kZWZpbmVcbn07ICovXG4vLyBpbXBvcnQgeyBnZXRUeXBlLCBnZXRFeHRlbnNpb24sIGRlZmluZSBhcyBtaW1lX2RlZmluZSB9IGZyb20gJ21pbWUnO1xuaW1wb3J0ICogYXMgdXRpbCBmcm9tICd1dGlsJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuaW1wb3J0IG1pbmltYXRjaCBmcm9tICdtaW5pbWF0Y2gnO1xuaW1wb3J0ICogYXMgZmFzdHEgZnJvbSAnZmFzdHEnO1xuaW1wb3J0IHR5cGUgeyBxdWV1ZUFzUHJvbWlzZWQgfSBmcm9tIFwiZmFzdHFcIjtcblxuXG4vLyBOT1RFIFdlIHNob3VsZCBub3QgZG8gdGhpcyBoZXJlLiAgSXQgaGFkIGJlZW4gY29waWVkIG92ZXIgZnJvbVxuLy8gQWthc2hhUmVuZGVyLCBidXQgdGhpcyBpcyBkdXBsaWNhdGl2ZSwgYW5kIGl0J3MgcG9zc2libGUgdGhlcmVcbi8vIHdpbGwgYmUgb3RoZXIgdXNlcnMgb2YgRGlyc1dhdGNoZXIgd2hvIGRvIG5vdCB3YW50IHRoaXMuXG4vL1xuLy8gVGhlcmUgZG9lc24ndCBzZWVtIHRvIGJlIGFuIG9mZmljaWFsIHJlZ2lzdHJhdGlvblxuLy8gcGVyOiBodHRwczovL2FzY2lpZG9jdG9yLm9yZy9kb2NzL2ZhcS9cbi8vIHBlcjogaHR0cHM6Ly9naXRodWIuY29tL2FzY2lpZG9jdG9yL2FzY2lpZG9jdG9yL2lzc3Vlcy8yNTAyXG4vLyBtaW1lLmRlZmluZSh7J3RleHQveC1hc2NpaWRvYyc6IFsnYWRvYycsICdhc2NpaWRvYyddfSk7XG4vL1xuLy8gSW5zdGVhZCBvZiBkZWZpbmluZyBNSU1FIHR5cGVzIGhlcmUsIHdlIGFkZGVkIGEgbWV0aG9kIFwibWltZWRlZmluZVwiXG4vLyB0byBhbGxvdyBEaXJzV2F0Y2hlciB1c2VycyB0byBkZWZpbmUgTUlNRSB0eXBlcy5cblxuZXhwb3J0IGZ1bmN0aW9uIG1pbWVkZWZpbmUobWFwcGluZywgZm9yY2UgPzogYm9vbGVhbikge1xuICAgIG1pbWUuZGVmaW5lKG1hcHBpbmcsIGZvcmNlKTtcbn1cblxuXG5leHBvcnQgY2xhc3MgVlBhdGhEYXRhIHtcbiAgICBmc3BhdGg6IHN0cmluZztcbiAgICB2cGF0aDogc3RyaW5nO1xuICAgIG1pbWUgPzogc3RyaW5nO1xuICAgIG1vdW50ZWQ6IHN0cmluZztcbiAgICBtb3VudFBvaW50OiBzdHJpbmc7XG4gICAgcGF0aEluTW91bnRlZDogc3RyaW5nO1xuICAgIHN0YWNrID86IFZQYXRoRGF0YVtdO1xufVxuXG5jb25zdCBpc1ZQYXRoRGF0YSA9ICh2cGluZm8pOiB2cGluZm8gaXMgVlBhdGhEYXRhID0+IHtcbiAgICBpZiAodHlwZW9mIHZwaW5mbyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodHlwZW9mIHZwaW5mbyAhPT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodHlwZW9mIHZwaW5mby5taW1lICE9PSAndW5kZWZpbmVkJ1xuICAgICAmJiB2cGluZm8ubWltZSAhPT0gbnVsbFxuICAgICAmJiB0eXBlb2YgdnBpbmZvLm1pbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB2cGluZm8uZnNwYXRoICE9PSAnc3RyaW5nJ1xuICAgICB8fCB0eXBlb2YgdnBpbmZvLnZwYXRoICE9PSAnc3RyaW5nJ1xuICAgICB8fCB0eXBlb2YgdnBpbmZvLm1vdW50ZWQgIT09ICdzdHJpbmcnXG4gICAgIHx8IHR5cGVvZiB2cGluZm8ubW91bnRQb2ludCAhPT0gJ3N0cmluZydcbiAgICAgfHwgdHlwZW9mIHZwaW5mby5wYXRoSW5Nb3VudGVkICE9PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgdnBpbmZvLnN0YWNrID09PSAndW5kZWZpbmVkJykgcmV0dXJuIHRydWU7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodnBpbmZvLnN0YWNrKSkge1xuICAgICAgICBmb3IgKGxldCBpbmYgb2YgdnBpbmZvLnN0YWNrKSB7XG4gICAgICAgICAgICBpZiAoIWlzVlBhdGhEYXRhKGluZikpIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbnR5cGUgcXVldWVFdmVudCA9IHtcbiAgICBjb2RlOiBzdHJpbmc7XG4gICAgZnBhdGg/OiBzdHJpbmc7XG4gICAgc3RhdHM/OiBTdGF0cztcbn07XG5cbmNvbnN0IGlzUXVldWVFdmVudCA9IChldmVudCk6IGV2ZW50IGlzIHF1ZXVlRXZlbnQgPT4ge1xuICAgIGlmICh0eXBlb2YgZXZlbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiBldmVudCAhPT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcblxuICAgIGlmICh0eXBlb2YgZXZlbnQuY29kZSA9PT0gJ3N0cmluZydcbiAgICAgJiYgdHlwZW9mIGV2ZW50LmZwYXRoID09PSAnc3RyaW5nJ1xuICAgICAmJiAoZXZlbnQuc3RhdHMgaW5zdGFuY2VvZiBTdGF0cykpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgZXZlbnQuY29kZSA9PT0gJ3N0cmluZydcbiAgICAgJiYgZXZlbnQuY29kZSA9PT0gJ3JlYWR5Jykge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBldmVudC5jb2RlID09PSAnc3RyaW5nJ1xuICAgICAmJiBldmVudC5jb2RlID09PSAndW5saW5rJ1xuICAgICAmJiB0eXBlb2YgZXZlbnQuZnBhdGggPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59XG5cbmNvbnN0IF9zeW1iX2RpcnMgPSBTeW1ib2woJ2RpcnMnKTtcbmNvbnN0IF9zeW1iX3dhdGNoZXIgPSBTeW1ib2woJ3dhdGNoZXInKTtcbmNvbnN0IF9zeW1iX25hbWUgPSBTeW1ib2woJ25hbWUnKTtcbmNvbnN0IF9zeW1iX29wdGlvbnMgPSBTeW1ib2woJ29wdGlvbnMnKTtcbmNvbnN0IF9zeW1iX2N3ZCA9IFN5bWJvbCgnYmFzZWRpcicpO1xuY29uc3QgX3N5bWJfcXVldWUgPSBTeW1ib2woJ3F1ZXVlJyk7XG5cbmV4cG9ydCBjbGFzcyBEaXJzV2F0Y2hlciBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0gbmFtZSBzdHJpbmcgZ2l2aW5nIHRoZSBuYW1lIGZvciB0aGlzIHdhdGNoZXJcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihuYW1lKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBEaXJzV2F0Y2hlciAke25hbWV9IGNvbnN0cnVjdG9yYCk7XG4gICAgICAgIHRoaXNbX3N5bWJfbmFtZV0gPSBuYW1lO1xuICAgICAgICAvLyBUT0RPIGlzIHRoZXJlIGEgbmVlZCB0byBtYWtlIHRoaXMgY3VzdG9taXphYmxlP1xuICAgICAgICB0aGlzW19zeW1iX29wdGlvbnNdID0ge1xuICAgICAgICAgICAgcGVyc2lzdGVudDogdHJ1ZSwgaWdub3JlSW5pdGlhbDogZmFsc2UsIGF3YWl0V3JpdGVGaW5pc2g6IHRydWUsIGFsd2F5c1N0YXQ6IHRydWVcbiAgICAgICAgfTtcbiAgICAgICAgdGhpc1tfc3ltYl9jd2RdID0gdW5kZWZpbmVkO1xuICAgICAgICBsZXQgdGhhdCA9IHRoaXM7XG4gICAgICAgIGNvbnN0IHE6IHF1ZXVlQXNQcm9taXNlZDxxdWV1ZUV2ZW50PiA9IGZhc3RxLnByb21pc2UoXG4gICAgICAgICAgICBhc3luYyBmdW5jdGlvbihldmVudDogcXVldWVFdmVudCkge1xuICAgICAgICAgICAgICAgIGlmICghaXNRdWV1ZUV2ZW50KGV2ZW50KSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYElOVEVSTkFMIEVSUk9SIG5vdCBhIHF1ZXVlRXZlbnQgJHt1dGlsLmluc3BlY3QoZXZlbnQpfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoZXZlbnQuY29kZSA9PT0gJ2NoYW5nZScpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhhdC5vbkNoYW5nZShldmVudC5mcGF0aCwgZXZlbnQuc3RhdHMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZXZlbnQuY29kZSA9PT0gJ2FkZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhhdC5vbkFkZChldmVudC5mcGF0aCwgZXZlbnQuc3RhdHMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZXZlbnQuY29kZSA9PT0gJ3VubGluaycpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhhdC5vblVubGluayhldmVudC5mcGF0aCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC5jb2RlID09PSAncmVhZHknKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoYXQub25SZWFkeSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIDEpO1xuICAgICAgICB0aGlzW19zeW1iX3F1ZXVlXSA9IHE7XG4gICAgICAgIHRoaXNbX3N5bWJfcXVldWVdLmVycm9yKGZ1bmN0aW9uKGVyciwgdGFzaykge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYERpcnNXYXRjaGVyICR7bmFtZX0gJHt0YXNrLmNvZGV9ICR7dGFzay5mcGF0aH0gY2F1Z2h0IGVycm9yICR7ZXJyfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBnZXQgZGlycygpIHsgcmV0dXJuIHRoaXNbX3N5bWJfZGlyc107IH1cbiAgICBnZXQgbmFtZSgpIHsgcmV0dXJuIHRoaXNbX3N5bWJfbmFtZV07IH1cblxuICAgIC8qKlxuICAgICAqIENoYW5nZXMgdGhlIHVzZSBvZiBhYnNvbHV0ZSBwYXRobmFtZXMsIHRvIHBhdGhzIHJlbGF0dmUgdG8gdGhlIGdpdmVuIGRpcmVjdG9yeS5cbiAgICAgKiBUaGlzIG11c3QgYmUgY2FsbGVkIGJlZm9yZSB0aGUgPGVtPndhdGNoPC9lbT4gbWV0aG9kIGlzIGNhbGxlZC4gIFRoZSBwYXRoc1xuICAgICAqIHlvdSBzcGVjaWZ5IHRvIHdhdGNoIG11c3QgYmUgcmVsYXRpdmUgdG8gdGhlIGdpdmVuIGRpcmVjdG9yeS5cbiAgICAgKi9cbiAgICBzZXQgYmFzZWRpcihjd2QpIHsgdGhpc1tfc3ltYl9jd2RdID0gY3dkOyB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIHRoZSBDaG9raWRhciB3YXRjaGVyLCBiYXNlYyBvbiB0aGUgZGlyZWN0b3JpZXMgdG8gd2F0Y2guICBUaGUgPGVtPmRpcnNwZWM8L2VtPiBvcHRpb24gY2FuIGJlIGEgc3RyaW5nLFxuICAgICAqIG9yIGFuIG9iamVjdC4gIElmIGl0IGlzIGEgc3RyaW5nLCBpdCBpcyBhIGZpbGVzeXN0ZW0gcGF0aG5hbWUgdGhhdCB3aWxsIGJlXG4gICAgICogYXNzb2NpYXRlZCB3aXRoIHRoZSByb290IG9mIHRoZSB2aXJ0dWFsIGZpbGVzeXN0ZW0uICBBbiBvYmplY3Qgd2lsbCBsb29rXG4gICAgICogbGlrZSB0aGlzOlxuICAgICAqIFxuICAgICAqIDxjb2RlPlxuICAgICAqIHtcbiAgICAgKiAgIG1vdW50ZWQ6ICcvcGF0aC90by9tb3VudGVkJyxcbiAgICAgKiAgIG1vdW50UG9pbnQ6ICdtb3VudGVkJ1xuICAgICAqIH1cbiAgICAgKiA8L2NvZGU+XG4gICAgICogXG4gICAgICogVGhlIDx0dD5tb3VudFBvaW50PC90dD4gZmllbGQgaXMgYSBmdWxsIHBhdGggdG8gdGhlIGRpcmVjdG9yeSBvZiBpbnRlcmVzdC4gIFRoZVxuICAgICAqIDx0dD5tb3VudFBvaW50PC90dD4gZmllbGQgZGVzY3JpYmVzIGEgcHJlZml4IHdpdGhpbiB0aGUgdmlydHVhbCBmaWxlc3lzdGVtLlxuICAgICAqIFxuICAgICAqIEBwYXJhbSBkaXJzcGVjIFxuICAgICAqL1xuICAgIGFzeW5jIHdhdGNoKGRpcnMpIHtcbiAgICAgICAgaWYgKHRoaXNbX3N5bWJfd2F0Y2hlcl0pIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgV2F0Y2hlciBhbHJlYWR5IHN0YXJ0ZWQgZm9yICR7dGhpc1tfc3ltYl93YXRjaGVyXX1gKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIGRpcnMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBkaXJzID0gWyB7XG4gICAgICAgICAgICAgICAgc3JjOiBkaXJzLCBkZXN0OiAnLydcbiAgICAgICAgICAgIH0gXTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZGlycyA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkoZGlycykpIHtcbiAgICAgICAgICAgIGRpcnMgPSBbIGRpcnMgXTtcbiAgICAgICAgfSBlbHNlIGlmICghQXJyYXkuaXNBcnJheShkaXJzKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXRjaCAtIHRoZSBkaXJzIGFyZ3VtZW50IGlzIGluY29ycmVjdCAke3V0aWwuaW5zcGVjdChkaXJzKX1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBjb25zb2xlLmxvZyhgd2F0Y2ggZGlycz1gLCBkaXJzKTtcbiAgICAgICAgY29uc3QgdG93YXRjaCA9IFtdO1xuICAgICAgICBmb3IgKGxldCBkaXIgb2YgZGlycykge1xuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KGRpci5tb3VudGVkKTtcbiAgICAgICAgICAgIGlmICghc3RhdHMuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2F0Y2ggLSBub24tZGlyZWN0b3J5IHNwZWNpZmllZCBpbiAke3V0aWwuaW5zcGVjdChkaXIpfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdG93YXRjaC5wdXNoKGRpci5tb3VudGVkKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzW19zeW1iX2RpcnNdID0gZGlycztcblxuICAgICAgICBpZiAodGhpc1tfc3ltYl9jd2RdKSB7XG4gICAgICAgICAgICB0aGlzW19zeW1iX29wdGlvbnNdLmN3ZCA9IHRoaXNbX3N5bWJfY3dkXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXNbX3N5bWJfb3B0aW9uc10uY3dkID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpc1tfc3ltYl93YXRjaGVyXSA9IGNob2tpZGFyLndhdGNoKHRvd2F0Y2gsIHRoaXNbX3N5bWJfb3B0aW9uc10pO1xuXG4gICAgICAgIC8vIEluIHRoZSBldmVudCBoYW5kbGVycywgd2UgY3JlYXRlIHRoZSBGaWxlSW5mbyBvYmplY3QgbWF0Y2hpbmdcbiAgICAgICAgLy8gdGhlIHBhdGguICBUaGUgRmlsZUluZm8gaXMgbWF0Y2hlZCB0byBhIF9zeW1iX2RpcnMgZW50cnkuXG4gICAgICAgIC8vIElmIHRoZSBfc3ltYl9kaXJzIGVudHJ5IGhhcyA8ZW0+aWdub3JlPC9lbT4gb3IgPGVtPmluY2x1ZGU8L2VtPlxuICAgICAgICAvLyBmaWVsZHMsIHRoZSBwYXR0ZXJucyBpbiB0aG9zZSBmaWVsZHMgYXJlIHVzZWQgdG8gZGV0ZXJtaW5lIHdoZXRoZXJcbiAgICAgICAgLy8gdG8gaW5jbHVkZSBvciBpZ25vcmUgdGhpcyBmaWxlLiAgSWYgd2UgYXJlIHRvIGlnbm9yZSBpdCwgdGhlblxuICAgICAgICAvLyBmaWxlSW5mbyByZXR1cm5zIHVuZGVmaW5lZC4gIEhlbmNlLCBpbiBlYWNoIGNhc2Ugd2UgdGVzdCB3aGV0aGVyXG4gICAgICAgIC8vIDxlbT5pbmZvPC9lbT4gaGFzIGEgdmFsdWUgYmVmb3JlIGVtaXR0aW5nIHRoZSBldmVudC5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gQWxsIHRoaXMgZnVuY3Rpb24gZG9lcyBpcyB0byByZWNlaXZlIGV2ZW50cyBmcm9tIENob2tpZGFyLFxuICAgICAgICAvLyBjb25zdHJ1Y3QgRmlsZUluZm8gb2JqZWN0cywgYW5kIGVtaXQgbWF0Y2hpbmcgZXZlbnRzLlxuXG4gICAgICAgIGNvbnN0IHdhdGNoZXJfbmFtZSA9IHRoaXMubmFtZTtcblxuICAgICAgICB0aGlzW19zeW1iX3dhdGNoZXJdXG4gICAgICAgICAgICAub24oJ2NoYW5nZScsIGFzeW5jIChmcGF0aCwgc3RhdHMpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzW19zeW1iX3F1ZXVlXS5wdXNoKDxxdWV1ZUV2ZW50PntcbiAgICAgICAgICAgICAgICAgICAgY29kZTogJ2NoYW5nZScsIGZwYXRoLCBzdGF0c1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB3YXRjaGVyICR7d2F0Y2hlcl9uYW1lfSBjaGFuZ2UgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAub24oJ2FkZCcsIGFzeW5jIChmcGF0aCwgc3RhdHMpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzW19zeW1iX3F1ZXVlXS5wdXNoKDxxdWV1ZUV2ZW50PntcbiAgICAgICAgICAgICAgICAgICAgY29kZTogJ2FkZCcsIGZwYXRoLCBzdGF0c1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB3YXRjaGVyICR7d2F0Y2hlcl9uYW1lfSBhZGQgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAvKiAub24oJ2FkZERpcicsIGFzeW5jIChmcGF0aCwgc3RhdHMpID0+IHsgXG4gICAgICAgICAgICAgICAgLy8gPz8gbGV0IGluZm8gPSB0aGlzLmZpbGVJbmZvKGZwYXRoLCBzdGF0cyk7XG4gICAgICAgICAgICAgICAgLy8gPz8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIGFkZERpcmAsIGluZm8pO1xuICAgICAgICAgICAgICAgIC8vID8/IHRoaXMuZW1pdCgnYWRkRGlyJywgaW5mbyk7XG4gICAgICAgICAgICB9KSAqL1xuICAgICAgICAgICAgLm9uKCd1bmxpbmsnLCBhc3luYyBmcGF0aCA9PiB7XG4gICAgICAgICAgICAgICAgdGhpc1tfc3ltYl9xdWV1ZV0ucHVzaCg8cXVldWVFdmVudD57XG4gICAgICAgICAgICAgICAgICAgIGNvZGU6ICd1bmxpbmsnLCBmcGF0aFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB3YXRjaGVyICR7d2F0Y2hlcl9uYW1lfSB1bmxpbmsgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAvKiAub24oJ3VubGlua0RpcicsIGFzeW5jIGZwYXRoID0+IHsgXG4gICAgICAgICAgICAgICAgLy8gPz8gbGV0IGluZm8gPSB0aGlzLmZpbGVJbmZvKGZwYXRoLCBzdGF0cyk7XG4gICAgICAgICAgICAgICAgLy8gPz8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIHVubGlua0RpciAke2ZwYXRofWApO1xuICAgICAgICAgICAgICAgIC8vID8/IHRoaXMuZW1pdCgndW5saW5rRGlyJywgaW5mbyk7XG4gICAgICAgICAgICB9KSAqL1xuICAgICAgICAgICAgLm9uKCdyZWFkeScsICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzW19zeW1iX3F1ZXVlXS5wdXNoKDxxdWV1ZUV2ZW50PntcbiAgICAgICAgICAgICAgICAgICAgY29kZTogJ3JlYWR5J1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB3YXRjaGVyICR7d2F0Y2hlcl9uYW1lfSByZWFkeWApO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gdGhpcy5pc1JlYWR5ID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAvLyAgICAgdGhpc1tfc3ltYl93YXRjaGVyXS5vbigncmVhZHknLCAoKSA9PiB7IHJlc29sdmUodHJ1ZSk7IH0pO1xuICAgICAgICAvLyB9KTtcbiAgICAgICAgLy8gY29uc29sZS5sb2codGhpcy5pc1JlYWR5KTtcbiAgICB9XG5cbiAgICAvKiBDYWxjdWxhdGUgdGhlIHN0YWNrIGZvciBhIGZpbGVzeXN0ZW0gcGF0aFxuXG4gICAgT25seSBlbWl0IGlmIHRoZSBjaGFuZ2Ugd2FzIHRvIHRoZSBmcm9udC1tb3N0IGZpbGUgKi8gXG4gICAgYXN5bmMgb25DaGFuZ2UoZnBhdGg6IHN0cmluZywgc3RhdHM6IFN0YXRzKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGxldCB2cGluZm8gPSB0aGlzLnZwYXRoRm9yRlNQYXRoKGZwYXRoKTtcbiAgICAgICAgaWYgKCF2cGluZm8pIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBvbkNoYW5nZSBjb3VsZCBub3QgZmluZCBtb3VudCBwb2ludCBvciB2cGF0aCBmb3IgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc3RhY2s6IFZQYXRoRGF0YVtdID0gYXdhaXQgdGhpcy5zdGFja0ZvclZQYXRoKHZwaW5mby52cGF0aCk7XG4gICAgICAgIGlmIChzdGFjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgb25DaGFuZ2UgY291bGQgbm90IGZpbmQgbW91bnQgcG9pbnRzIGZvciAke2ZwYXRofWApO1xuICAgICAgICB9XG4gICAgICAgIGxldCBpID0gMDtcbiAgICAgICAgbGV0IGRlcHRoO1xuICAgICAgICBsZXQgZW50cnk7XG4gICAgICAgIGZvciAobGV0IHMgb2Ygc3RhY2spIHtcbiAgICAgICAgICAgIGlmIChzLmZzcGF0aCA9PT0gZnBhdGgpIHtcbiAgICAgICAgICAgICAgICBlbnRyeSA9IHM7XG4gICAgICAgICAgICAgICAgZGVwdGggPSBpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaSsrO1xuICAgICAgICB9XG4gICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgb25DaGFuZ2Ugbm8gc3RhY2sgZW50cnkgZm9yICR7ZnBhdGh9ICgke3ZwaW5mby52cGF0aH0pYCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRlcHRoID09PSAwKSB7XG4gICAgICAgICAgICB2cGluZm8uc3RhY2sgPSBzdGFjaztcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBEaXJzV2F0Y2hlciBjaGFuZ2UgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywgdGhpcy5uYW1lLCB2cGluZm8pO1xuICAgICAgICB9XG4gICAgICAgIC8vIGxldCBpbmZvID0gdGhpcy5maWxlSW5mbyhmcGF0aCwgc3RhdHMpO1xuICAgICAgICAvLyBpZiAoaW5mbykgdGhpcy5lbWl0KCdjaGFuZ2UnLCB0aGlzLm5hbWUsIGluZm8pO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgY2hhbmdlICR7ZnBhdGh9YCwgaW5mbyk7XG4gICAgfVxuXG4gICAgLy8gT25seSBlbWl0IGlmIHRoZSBhZGQgd2FzIHRoZSBmcm9udC1tb3N0IGZpbGVcbiAgICBhc3luYyBvbkFkZChmcGF0aDogc3RyaW5nLCBzdGF0czogU3RhdHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgbGV0IHZwaW5mbyA9IHRoaXMudnBhdGhGb3JGU1BhdGgoZnBhdGgpO1xuICAgICAgICBpZiAoIXZwaW5mbykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYG9uQWRkIGNvdWxkIG5vdCBmaW5kIG1vdW50IHBvaW50IG9yIHZwYXRoIGZvciAke2ZwYXRofWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBvbkFkZCAke2ZwYXRofWAsIHZwaW5mbyk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBvbkFkZCAke2ZwYXRofSAke3ZwaW5mby52cGF0aH1gKTtcbiAgICAgICAgbGV0IHN0YWNrOiBWUGF0aERhdGFbXSA9IGF3YWl0IHRoaXMuc3RhY2tGb3JWUGF0aCh2cGluZm8udnBhdGgpO1xuICAgICAgICBpZiAoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYG9uQWRkIGNvdWxkIG5vdCBmaW5kIG1vdW50IHBvaW50cyBmb3IgJHtmcGF0aH1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBjb25zb2xlLmxvZyhgb25BZGQgJHtmcGF0aH1gLCBzdGFjayk7XG4gICAgICAgIGxldCBpID0gMDtcbiAgICAgICAgbGV0IGRlcHRoO1xuICAgICAgICBsZXQgZW50cnk7XG4gICAgICAgIGZvciAobGV0IHMgb2Ygc3RhY2spIHtcbiAgICAgICAgICAgIGlmIChzLmZzcGF0aCA9PT0gZnBhdGgpIHtcbiAgICAgICAgICAgICAgICBlbnRyeSA9IHM7XG4gICAgICAgICAgICAgICAgZGVwdGggPSBpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaSsrO1xuICAgICAgICB9XG4gICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgb25BZGQgbm8gc3RhY2sgZW50cnkgZm9yICR7ZnBhdGh9ICgke3ZwaW5mby52cGF0aH0pYCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkICR7ZnBhdGh9IGRlcHRoPSR7ZGVwdGh9YCwgZW50cnkpO1xuICAgICAgICBpZiAoZGVwdGggPT09IDApIHtcbiAgICAgICAgICAgIHZwaW5mby5zdGFjayA9IHN0YWNrO1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkIEVNSVQgYWRkICR7dnBpbmZvLnZwYXRofWApO1xuICAgICAgICAgICAgLy8gZm9yIChsZXQgcyBvZiBzdGFjaykge1xuICAgICAgICAgICAgLy8gICAgY29uc29sZS5sb2coYC4uLi4gJHtzLnZwYXRofSA9PT4gJHtzLmZzcGF0aH1gKTtcbiAgICAgICAgICAgIC8vIH1cbiAgICAgICAgICAgIHRoaXMuZW1pdCgnYWRkJywgdGhpcy5uYW1lLCB2cGluZm8pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkIFNLSVBQRUQgZW1pdCBldmVudCBmb3IgJHtmcGF0aH1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBsZXQgaW5mbyA9IHRoaXMuZmlsZUluZm8oZnBhdGgsIHN0YXRzKTtcbiAgICAgICAgLy8gaWYgKGluZm8pIHRoaXMuZW1pdCgnYWRkJywgdGhpcy5uYW1lLCBpbmZvKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIGFkZGAsIGluZm8pO1xuICAgICAgICBcbiAgICB9XG5cbiAgICAvKiBPbmx5IGVtaXQgaWYgaXQgd2FzIHRoZSBmcm9udC1tb3N0IGZpbGUgZGVsZXRlZFxuICAgIElmIHRoZXJlIGlzIGEgZmlsZSB1bmNvdmVyZWQgYnkgdGhpcywgdGhlbiBlbWl0IGFuIGFkZCBldmVudCBmb3IgdGhhdCAqL1xuICAgIGFzeW5jIG9uVW5saW5rKGZwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgbGV0IHZwaW5mbyA9IHRoaXMudnBhdGhGb3JGU1BhdGgoZnBhdGgpO1xuICAgICAgICBpZiAoIXZwaW5mbykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYG9uVW5saW5rIGNvdWxkIG5vdCBmaW5kIG1vdW50IHBvaW50IG9yIHZwYXRoIGZvciAke2ZwYXRofWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGxldCBzdGFjazogVlBhdGhEYXRhW10gPSBhd2FpdCB0aGlzLnN0YWNrRm9yVlBhdGgodnBpbmZvLnZwYXRoKTtcbiAgICAgICAgaWYgKHN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgLyogSWYgbm8gZmlsZXMgcmVtYWluIGluIHRoZSBzdGFjayBmb3IgdGhpcyB2aXJ0dWFsIHBhdGgsIHRoZW5cbiAgICAgICAgICAgICAqIHdlIG11c3QgZGVjbGFyZSBpdCB1bmxpbmtlZC5cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5lbWl0KCd1bmxpbmsnLCB0aGlzLm5hbWUsIHZwaW5mbyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvKiBPbiB0aGUgb3RoZXIgaGFuZCwgaWYgdGhlcmUgaXMgYW4gZW50cnkgd2Ugc2hvdWxkbid0IHNlbmRcbiAgICAgICAgICAgICAqIGFuIHVubGluayBldmVudC4gIEluc3RlYWQgaXQgc2VlbXMgbW9zdCBhcHByb3ByaWF0ZSB0byBzZW5kXG4gICAgICAgICAgICAgKiBhIGNoYW5nZSBldmVudC5cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgbGV0IHNmaXJzdCA9IHN0YWNrWzBdO1xuICAgICAgICAgICAgbGV0IHRvZW1pdCA9IDxWUGF0aERhdGE+e1xuICAgICAgICAgICAgICAgIGZzcGF0aDogc2ZpcnN0LmZzcGF0aCxcbiAgICAgICAgICAgICAgICB2cGF0aDogc2ZpcnN0LnZwYXRoLFxuICAgICAgICAgICAgICAgIG1pbWU6IG1pbWUuZ2V0VHlwZShzZmlyc3QuZnNwYXRoKSxcbiAgICAgICAgICAgICAgICBtb3VudGVkOiBzZmlyc3QubW91bnRlZCxcbiAgICAgICAgICAgICAgICBtb3VudFBvaW50OiBzZmlyc3QubW91bnRQb2ludCxcbiAgICAgICAgICAgICAgICBwYXRoSW5Nb3VudGVkOiBzZmlyc3QucGF0aEluTW91bnRlZCxcbiAgICAgICAgICAgICAgICBzdGFja1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEodG9lbWl0KSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QodG9lbWl0KX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywgdGhpcy5uYW1lLCB0b2VtaXQpO1xuICAgICAgICB9XG4gICAgICAgIC8vIGxldCBpbmZvID0gdGhpcy5maWxlSW5mbyhmcGF0aCwgdW5kZWZpbmVkKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIHVubGluayAke2ZwYXRofWApO1xuICAgICAgICAvLyBpZiAoaW5mbykgdGhpcy5lbWl0KCd1bmxpbmsnLCB0aGlzLm5hbWUsIGluZm8pO1xuICAgIH1cblxuICAgIG9uUmVhZHkoKTogdm9pZCB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdEaXJzV2F0Y2hlcjogSW5pdGlhbCBzY2FuIGNvbXBsZXRlLiBSZWFkeSBmb3IgY2hhbmdlcycpO1xuICAgICAgICB0aGlzLmVtaXQoJ3JlYWR5JywgdGhpcy5uYW1lKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGFuIG9iamVjdCByZXByZXNlbnRpbmcgYWxsIHRoZSBwYXRocyBvbiB0aGUgZmlsZSBzeXN0ZW0gYmVpbmdcbiAgICAgKiB3YXRjaGVkIGJ5IHRoaXMgRlNXYXRjaGVyIGluc3RhbmNlLiBUaGUgb2JqZWN0J3Mga2V5cyBhcmUgYWxsIHRoZSBcbiAgICAgKiBkaXJlY3RvcmllcyAodXNpbmcgYWJzb2x1dGUgcGF0aHMgdW5sZXNzIHRoZSBjd2Qgb3B0aW9uIHdhcyB1c2VkKSxcbiAgICAgKiBhbmQgdGhlIHZhbHVlcyBhcmUgYXJyYXlzIG9mIHRoZSBuYW1lcyBvZiB0aGUgaXRlbXMgY29udGFpbmVkIGluIGVhY2ggZGlyZWN0b3J5LlxuICAgICAqL1xuICAgIGdldFdhdGNoZWQoKSB7XG4gICAgICAgIGlmICh0aGlzW19zeW1iX3dhdGNoZXJdKSByZXR1cm4gdGhpc1tfc3ltYl93YXRjaGVyXS5nZXRXYXRjaGVkKCk7XG4gICAgfVxuXG4gICAgdnBhdGhGb3JGU1BhdGgoZnNwYXRoOiBzdHJpbmcpOiBWUGF0aERhdGEge1xuICAgICAgICBmb3IgKGxldCBkaXIgb2YgdGhpcy5kaXJzKSB7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIHRvIHNlZSBpZiB3ZSdyZSBzdXBwb3NlZCB0byBpZ25vcmUgdGhlIGZpbGVcbiAgICAgICAgICAgIGlmIChkaXIuaWdub3JlKSB7XG4gICAgICAgICAgICAgICAgbGV0IGlnbm9yZXM7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBkaXIuaWdub3JlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBpZ25vcmVzID0gWyBkaXIuaWdub3JlIF07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWdub3JlcyA9IGRpci5pZ25vcmU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxldCBpZ25vcmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpIG9mIGlnbm9yZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1pbmltYXRjaChmc3BhdGgsIGkpKSBpZ25vcmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgZGlyLmlnbm9yZSAke2ZzcGF0aH0gJHtpfSA9PiAke2lnbm9yZX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGlnbm9yZSkgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFRoaXMgZW5zdXJlcyB3ZSBhcmUgbWF0Y2hpbmcgb24gZGlyZWN0b3J5IGJvdW5kYXJpZXNcbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSBmc3BhdGggXCIvcGF0aC90by9sYXlvdXRzLWV4dHJhL2xheW91dC5uamtcIiBtaWdodFxuICAgICAgICAgICAgLy8gbWF0Y2ggZGlyLm1vdW50ZWQgXCIvcGF0aC90by9sYXlvdXRzXCIuXG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHZwYXRoRm9yRlNQYXRoICR7ZGlyLm1vdW50ZWR9ICR7dHlwZW9mIGRpci5tb3VudGVkfWAsIGRpcik7XG4gICAgICAgICAgICBsZXQgZGlybW91bnRlZCA9IChkaXIubW91bnRlZC5jaGFyQXQoZGlyLm1vdW50ZWQubGVuZ3RoIC0gMSkgPT0gJy8nKVxuICAgICAgICAgICAgICAgICAgICAgICAgPyBkaXIubW91bnRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgOiAoZGlyLm1vdW50ZWQgKyAnLycpO1xuICAgICAgICAgICAgaWYgKGZzcGF0aC5pbmRleE9mKGRpcm1vdW50ZWQpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgbGV0IHBhdGhJbk1vdW50ZWQgPSBmc3BhdGguc3Vic3RyaW5nKGRpci5tb3VudGVkLmxlbmd0aCkuc3Vic3RyaW5nKDEpO1xuICAgICAgICAgICAgICAgIGxldCB2cGF0aCA9IGRpci5tb3VudFBvaW50ID09PSAnLydcbiAgICAgICAgICAgICAgICAgICAgICAgID8gcGF0aEluTW91bnRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgOiBwYXRoLmpvaW4oZGlyLm1vdW50UG9pbnQsIHBhdGhJbk1vdW50ZWQpO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB2cGF0aEZvckZTUGF0aCBmc3BhdGggJHtmc3BhdGh9IGRpci5tb3VudFBvaW50ICR7ZGlyLm1vdW50UG9pbnR9IHBhdGhJbk1vdW50ZWQgJHtwYXRoSW5Nb3VudGVkfSB2cGF0aCAke3ZwYXRofWApO1xuICAgICAgICAgICAgICAgIGxldCByZXQgPSA8VlBhdGhEYXRhPntcbiAgICAgICAgICAgICAgICAgICAgZnNwYXRoOiBmc3BhdGgsXG4gICAgICAgICAgICAgICAgICAgIHZwYXRoOiB2cGF0aCxcbiAgICAgICAgICAgICAgICAgICAgbWltZTogbWltZS5nZXRUeXBlKGZzcGF0aCksXG4gICAgICAgICAgICAgICAgICAgIG1vdW50ZWQ6IGRpci5tb3VudGVkLFxuICAgICAgICAgICAgICAgICAgICBtb3VudFBvaW50OiBkaXIubW91bnRQb2ludCxcbiAgICAgICAgICAgICAgICAgICAgcGF0aEluTW91bnRlZFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YShyZXQpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QocmV0KX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBObyBkaXJlY3RvcnkgZm91bmQgZm9yIHRoaXMgZmlsZVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGFzeW5jIHN0YWNrRm9yVlBhdGgodnBhdGg6IHN0cmluZyk6IFByb21pc2U8VlBhdGhEYXRhW10+IHtcbiAgICAgICAgY29uc3QgcmV0OiBWUGF0aERhdGFbXSA9IFtdO1xuICAgICAgICBmb3IgKGxldCBkaXIgb2YgdGhpcy5kaXJzKSB7XG4gICAgICAgICAgICBpZiAoZGlyLm1vdW50UG9pbnQgPT09ICcvJykge1xuICAgICAgICAgICAgICAgIGxldCBwYXRoSW5Nb3VudGVkID0gdnBhdGg7XG4gICAgICAgICAgICAgICAgbGV0IGZzcGF0aCA9IHBhdGguam9pbihkaXIubW91bnRlZCwgcGF0aEluTW91bnRlZCk7XG4gICAgICAgICAgICAgICAgbGV0IHN0YXRzO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRzID0gYXdhaXQgZnMuc3RhdChmc3BhdGgpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBzdGF0cyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFzdGF0cykgY29udGludWU7XG4gICAgICAgICAgICAgICAgbGV0IHRvcHVzaCA9IDxWUGF0aERhdGE+e1xuICAgICAgICAgICAgICAgICAgICBmc3BhdGg6IGZzcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgdnBhdGg6IHZwYXRoLFxuICAgICAgICAgICAgICAgICAgICBtaW1lOiBtaW1lLmdldFR5cGUoZnNwYXRoKSxcbiAgICAgICAgICAgICAgICAgICAgbW91bnRlZDogZGlyLm1vdW50ZWQsXG4gICAgICAgICAgICAgICAgICAgIG1vdW50UG9pbnQ6IGRpci5tb3VudFBvaW50LFxuICAgICAgICAgICAgICAgICAgICBwYXRoSW5Nb3VudGVkOiBwYXRoSW5Nb3VudGVkXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBpZiAoIWlzVlBhdGhEYXRhKHRvcHVzaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFZQYXRoRGF0YSAke3V0aWwuaW5zcGVjdCh0b3B1c2gpfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXQucHVzaCh0b3B1c2gpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXQgZGlybW91bnRwdCA9IChkaXIubW91bnRQb2ludC5jaGFyQXQoZGlyLm1vdW50UG9pbnQubGVuZ3RoIC0gMSkgPT0gJy8nKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gZGlyLm1vdW50UG9pbnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IChkaXIubW91bnRQb2ludCArICcvJyk7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHN0YWNrRm9yVlBhdGggdnBhdGggJHt2cGF0aH0gZGlyLm1vdW50ZWQgJHtkaXIubW91bnRQb2ludH0gZGlybW91bnRwdCAke2Rpcm1vdW50cHR9YCk7XG4gICAgICAgICAgICAgICAgaWYgKHZwYXRoLmluZGV4T2YoZGlybW91bnRwdCkgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gPiBjb25zdCB2cGF0aCA9ICdmb28vYmFyL2Jhei5odG1sJztcbiAgICAgICAgICAgICAgICAgICAgLy8gPiBjb25zdCBtID0gJ2Zvby9iYXInO1xuICAgICAgICAgICAgICAgICAgICAvLyA+IGxldCBwYXRoSW5Nb3VudGVkID0gdnBhdGguc3Vic3RyaW5nKG0ubGVuZ3RoICsgMSk7XG4gICAgICAgICAgICAgICAgICAgIC8vID4gcGF0aEluTW91bnRlZFxuICAgICAgICAgICAgICAgICAgICAvLyAnYmF6Lmh0bWwnXG4gICAgICAgICAgICAgICAgICAgIGxldCBwYXRoSW5Nb3VudGVkID0gdnBhdGguc3Vic3RyaW5nKGRpcm1vdW50cHQubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGZzcGF0aCA9IHBhdGguam9pbihkaXIubW91bnRlZCwgcGF0aEluTW91bnRlZCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBzdGFja0ZvclZQYXRoIHZwYXRoICR7dnBhdGh9IHBhdGhJbk1vdW50ZWQgJHtwYXRoSW5Nb3VudGVkfSBmc3BhdGggJHtmc3BhdGh9YCk7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzdGF0cztcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzID0gYXdhaXQgZnMuc3RhdChmc3BhdGgpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICghc3RhdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBzdGFja0ZvclZQYXRoIHZwYXRoICR7dnBhdGh9IGRpZCBub3QgZmluZCBmcy5zdGF0cyBmb3IgJHtmc3BhdGh9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsZXQgdG9wdXNoID0gPFZQYXRoRGF0YT57XG4gICAgICAgICAgICAgICAgICAgICAgICBmc3BhdGg6IGZzcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZwYXRoOiB2cGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pbWU6IG1pbWUuZ2V0VHlwZShmc3BhdGgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbW91bnRlZDogZGlyLm1vdW50ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBtb3VudFBvaW50OiBkaXIubW91bnRQb2ludCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGhJbk1vdW50ZWQ6IHBhdGhJbk1vdW50ZWRcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YSh0b3B1c2gpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgVlBhdGhEYXRhICR7dXRpbC5pbnNwZWN0KHRvcHVzaCl9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0LnB1c2godG9wdXNoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgc3RhY2tGb3JWUGF0aCB2cGF0aCAke3ZwYXRofSBkaWQgbm90IG1hdGNoICR7ZGlybW91bnRwdH1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gKGtub2NrIG9uIHdvb2QpIEV2ZXJ5IGVudHJ5IGluIGByZXRgIGhhcyBhbHJlYWR5IGJlZW4gdmVyaWZpZWRcbiAgICAgICAgLy8gYXMgYmVpbmcgYSBjb3JyZWN0IFZQYXRoRGF0YSBvYmplY3RcbiAgICAgICAgcmV0dXJuIHJldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0IGRhdGEgd2UgZ2F0aGVyIGFib3V0IGEgZmlsZSBpbiB0aGUgZmlsZSBzeXN0ZW0gaW50byBhIGRlc2NyaXB0b3Igb2JqZWN0LlxuICAgICAqIEBwYXJhbSBmc3BhdGggXG4gICAgICogQHBhcmFtIHN0YXRzIFxuICAgICAqL1xuICAgIC8qIGZpbGVJbmZvKGZzcGF0aCwgc3RhdHMpIHtcbiAgICAgICAgbGV0IGUgPSB0aGlzLmRpckZvclBhdGgoZnNwYXRoKTtcbiAgICAgICAgaWYgKCFlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vIG1vdW50UG9pbnQgZm91bmQgZm9yICR7ZnNwYXRofWApO1xuICAgICAgICB9XG4gICAgICAgIGxldCBmbkluU291cmNlRGlyID0gZnNwYXRoLnN1YnN0cmluZyhlLnBhdGgubGVuZ3RoKS5zdWJzdHJpbmcoMSk7XG4gICAgICAgIGxldCBkb2NwYXRoID0gcGF0aC5qb2luKGUubW91bnRQb2ludCwgZm5JblNvdXJjZURpcik7XG4gICAgICAgIGlmIChkb2NwYXRoLnN0YXJ0c1dpdGgoJy8nKSkge1xuICAgICAgICAgICAgZG9jcGF0aCA9IGRvY3BhdGguc3Vic3RyaW5nKDEpO1xuICAgICAgICB9XG4gICAgICAgIGxldCBpZ25vcmUgPSBmYWxzZTtcbiAgICAgICAgbGV0IGluY2x1ZGUgPSB0cnVlO1xuICAgICAgICBpZiAoZS5pZ25vcmUpIHtcbiAgICAgICAgICAgIGxldCBpZ25vcmVzO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBlLmlnbm9yZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBpZ25vcmVzID0gWyBlLmlnbm9yZSBdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZ25vcmVzID0gZS5pZ25vcmU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBpIG9mIGlnbm9yZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAobWluaW1hdGNoKGZuSW5Tb3VyY2VEaXIsIGkpKSBpZ25vcmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBlLmlnbm9yZSAke2ZuSW5Tb3VyY2VEaXJ9ICR7aX0gPT4gJHtpZ25vcmV9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGUuaW5jbHVkZSkge1xuICAgICAgICAgICAgaW5jbHVkZSA9IGZhbHNlO1xuICAgICAgICAgICAgbGV0IGluY2x1ZGVycztcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZS5pbmNsdWRlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGluY2x1ZGVycyA9IFsgZS5pbmNsdWRlIF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGluY2x1ZGVycyA9IGUuaW5jbHVkZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgb2YgaW5jbHVkZXJzKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1pbmltYXRjaChmbkluU291cmNlRGlyLCBpKSkgaW5jbHVkZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYGUuaW5jbHVkZSAke2ZuSW5Tb3VyY2VEaXJ9ICR7aX0gPT4gJHtpbmNsdWRlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChpZ25vcmUgfHwgIWluY2x1ZGUpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGZzcGF0aDogZnNwYXRoLFxuICAgICAgICAgICAgICAgIG1pbWU6IG1pbWUuZ2V0VHlwZShmc3BhdGgpLFxuICAgICAgICAgICAgICAgIGJhc2VNZXRhZGF0YTogZS5iYXNlTWV0YWRhdGEsXG4gICAgICAgICAgICAgICAgc291cmNlUGF0aDogZS5wYXRoLFxuICAgICAgICAgICAgICAgIG1vdW50UG9pbnQ6IGUubW91bnRQb2ludCxcbiAgICAgICAgICAgICAgICBwYXRoSW5Tb3VyY2U6IGZuSW5Tb3VyY2VEaXIsXG4gICAgICAgICAgICAgICAgcGF0aDogZG9jcGF0aCxcbiAgICAgICAgICAgICAgICBpc0RpcmVjdG9yeTogc3RhdHMuaXNEaXJlY3RvcnkoKSxcbiAgICAgICAgICAgICAgICBzdGF0c1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH0gKi9cblxuICAgIGFzeW5jIGNsb3NlKCkge1xuICAgICAgICBpZiAodGhpc1tfc3ltYl93YXRjaGVyXSkge1xuICAgICAgICAgICAgYXdhaXQgdGhpc1tfc3ltYl93YXRjaGVyXS5jbG9zZSgpO1xuICAgICAgICAgICAgdGhpc1tfc3ltYl93YXRjaGVyXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIH1cbn1cbiJdfQ==