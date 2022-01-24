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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2F0Y2hlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2xpYi93YXRjaGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSwyQkFHWTtBQUNaLHdEQUErQztBQUMvQywyQ0FBNkI7QUFDN0I7Ozs7S0FJSztBQUNMLHVFQUF1RTtBQUN2RSwyQ0FBNkI7QUFDN0IsMkNBQTZCO0FBQzdCLG1DQUFzQztBQUN0QywwREFBa0M7QUFDbEMsNkNBQStCO0FBSS9CLGlFQUFpRTtBQUNqRSxpRUFBaUU7QUFDakUsMkRBQTJEO0FBQzNELEVBQUU7QUFDRixvREFBb0Q7QUFDcEQseUNBQXlDO0FBQ3pDLDhEQUE4RDtBQUM5RCwwREFBMEQ7QUFDMUQsRUFBRTtBQUNGLHNFQUFzRTtBQUN0RSxtREFBbUQ7QUFFbkQsU0FBZ0IsVUFBVSxDQUFDLE9BQU8sRUFBRSxLQUFnQjtJQUNoRCxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRkQsZ0NBRUM7QUFHRCxNQUFhLFNBQVM7Q0FRckI7QUFSRCw4QkFRQztBQUVELE1BQU0sV0FBVyxHQUFHLENBQUMsTUFBTSxFQUF1QixFQUFFO0lBQ2hELElBQUksT0FBTyxNQUFNLEtBQUssV0FBVztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQ2hELElBQUksT0FBTyxNQUFNLEtBQUssUUFBUTtRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQzdDLElBQUksT0FBTyxNQUFNLENBQUMsSUFBSSxLQUFLLFdBQVc7V0FDbEMsT0FBTyxNQUFNLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRTtRQUNqQyxPQUFPLEtBQUssQ0FBQztLQUNoQjtJQUNELElBQUksT0FBTyxNQUFNLENBQUMsTUFBTSxLQUFLLFFBQVE7V0FDakMsT0FBTyxNQUFNLENBQUMsS0FBSyxLQUFLLFFBQVE7V0FDaEMsT0FBTyxNQUFNLENBQUMsT0FBTyxLQUFLLFFBQVE7V0FDbEMsT0FBTyxNQUFNLENBQUMsVUFBVSxLQUFLLFFBQVE7V0FDckMsT0FBTyxNQUFNLENBQUMsYUFBYSxLQUFLLFFBQVEsRUFBRTtRQUMxQyxPQUFPLEtBQUssQ0FBQztLQUNoQjtJQUNELElBQUksT0FBTyxNQUFNLENBQUMsS0FBSyxLQUFLLFdBQVc7UUFBRSxPQUFPLElBQUksQ0FBQztJQUNyRCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQzdCLEtBQUssSUFBSSxHQUFHLElBQUksTUFBTSxDQUFDLEtBQUssRUFBRTtZQUMxQixJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQztnQkFBRSxPQUFPLEtBQUssQ0FBQztTQUN2QztLQUNKO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDaEIsQ0FBQyxDQUFDO0FBUUYsTUFBTSxZQUFZLEdBQUcsQ0FBQyxLQUFLLEVBQXVCLEVBQUU7SUFDaEQsSUFBSSxPQUFPLEtBQUssS0FBSyxXQUFXO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDL0MsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFFNUMsSUFBSSxPQUFPLEtBQUssQ0FBQyxJQUFJLEtBQUssUUFBUTtXQUM5QixPQUFPLEtBQUssQ0FBQyxLQUFLLEtBQUssUUFBUTtXQUMvQixDQUFDLEtBQUssQ0FBQyxLQUFLLFlBQVksVUFBSyxDQUFDLEVBQUU7UUFDaEMsT0FBTyxJQUFJLENBQUM7S0FDZjtJQUNELElBQUksT0FBTyxLQUFLLENBQUMsSUFBSSxLQUFLLFFBQVE7V0FDOUIsS0FBSyxDQUFDLElBQUksS0FBSyxPQUFPLEVBQUU7UUFDeEIsT0FBTyxJQUFJLENBQUM7S0FDZjtJQUNELElBQUksT0FBTyxLQUFLLENBQUMsSUFBSSxLQUFLLFFBQVE7V0FDOUIsS0FBSyxDQUFDLElBQUksS0FBSyxRQUFRO1dBQ3ZCLE9BQU8sS0FBSyxDQUFDLEtBQUssS0FBSyxRQUFRLEVBQUU7UUFDakMsT0FBTyxJQUFJLENBQUM7S0FDZjtJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2pCLENBQUMsQ0FBQTtBQUVELE1BQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNsQyxNQUFNLGFBQWEsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDeEMsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ2xDLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUN4QyxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDcEMsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBRXBDLE1BQWEsV0FBWSxTQUFRLHFCQUFZO0lBRXpDOztPQUVHO0lBQ0gsWUFBWSxJQUFJO1FBQ1osS0FBSyxFQUFFLENBQUM7UUFDUixrREFBa0Q7UUFDbEQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUN4QixrREFBa0Q7UUFDbEQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHO1lBQ2xCLFVBQVUsRUFBRSxJQUFJLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLElBQUk7U0FDbkYsQ0FBQztRQUNGLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxTQUFTLENBQUM7UUFDNUIsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2hCLE1BQU0sQ0FBQyxHQUFnQyxLQUFLLENBQUMsT0FBTyxDQUNoRCxLQUFLLFdBQVUsS0FBaUI7WUFDNUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDdEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxtQ0FBbUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7YUFDN0U7WUFDRCxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO2dCQUN6QixNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7YUFDakQ7aUJBQU0sSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLEtBQUssRUFBRTtnQkFDN0IsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQzlDO2lCQUFNLElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7Z0JBQ2hDLE1BQU0sSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7YUFDcEM7aUJBQU0sSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLE9BQU8sRUFBRTtnQkFDL0IsTUFBTSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7YUFDeEI7UUFDTCxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDVixJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3RCLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBUyxHQUFHLEVBQUUsSUFBSTtZQUN0QyxJQUFJLEdBQUcsRUFBRTtnQkFDTCxPQUFPLENBQUMsS0FBSyxDQUFDLGVBQWUsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLEtBQUssaUJBQWlCLEdBQUcsRUFBRSxDQUFDLENBQUM7YUFDdkY7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFRCxJQUFJLElBQUksS0FBSyxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdkMsSUFBSSxJQUFJLEtBQUssT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRXZDOzs7O09BSUc7SUFDSCxJQUFJLE9BQU8sQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFFM0M7Ozs7Ozs7Ozs7Ozs7Ozs7O09BaUJHO0lBQ0gsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJO1FBQ1osSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLEVBQUU7WUFDckIsTUFBTSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsSUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsQ0FBQztTQUN6RTtRQUNELElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxFQUFFO1lBQzFCLElBQUksR0FBRyxDQUFFO29CQUNMLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEdBQUc7aUJBQ3ZCLENBQUUsQ0FBQztTQUNQO2FBQU0sSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3pELElBQUksR0FBRyxDQUFFLElBQUksQ0FBRSxDQUFDO1NBQ25CO2FBQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQywwQ0FBMEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDbkY7UUFDRCxvQ0FBb0M7UUFDcEMsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDO1FBQ25CLEtBQUssSUFBSSxHQUFHLElBQUksSUFBSSxFQUFFO1lBQ2xCLE1BQU0sS0FBSyxHQUFHLE1BQU0sYUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDekMsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsRUFBRTtnQkFDdEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQ0FBc0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7YUFDOUU7WUFDRCxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztTQUM3QjtRQUNELElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxJQUFJLENBQUM7UUFFeEIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUU7WUFDakIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDN0M7YUFBTTtZQUNILElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxHQUFHLEdBQUcsU0FBUyxDQUFDO1NBQ3ZDO1FBRUQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLGtCQUFRLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztRQUVuRSxnRUFBZ0U7UUFDaEUsNERBQTREO1FBQzVELGtFQUFrRTtRQUNsRSxxRUFBcUU7UUFDckUsZ0VBQWdFO1FBQ2hFLG1FQUFtRTtRQUNuRSx1REFBdUQ7UUFDdkQsRUFBRTtRQUNGLDZEQUE2RDtRQUM3RCx3REFBd0Q7UUFFeEQsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUUvQixJQUFJLENBQUMsYUFBYSxDQUFDO2FBQ2QsRUFBRSxDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxFQUFFO1lBQ2pDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJLENBQWE7Z0JBQy9CLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEtBQUs7YUFDL0IsQ0FBQyxDQUFDO1lBQ0gsMERBQTBEO1FBQzlELENBQUMsQ0FBQzthQUNELEVBQUUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsRUFBRTtZQUM5QixJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsSUFBSSxDQUFhO2dCQUMvQixJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLO2FBQzVCLENBQUMsQ0FBQztZQUNILHVEQUF1RDtRQUMzRCxDQUFDLENBQUM7WUFDRjs7OztpQkFJSzthQUNKLEVBQUUsQ0FBQyxRQUFRLEVBQUUsS0FBSyxFQUFDLEtBQUssRUFBQyxFQUFFO1lBQ3hCLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJLENBQWE7Z0JBQy9CLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSzthQUN4QixDQUFDLENBQUM7WUFDSCwwREFBMEQ7UUFDOUQsQ0FBQyxDQUFDO1lBQ0Y7Ozs7aUJBSUs7YUFDSixFQUFFLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRTtZQUNkLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJLENBQWE7Z0JBQy9CLElBQUksRUFBRSxPQUFPO2FBQ2hCLENBQUMsQ0FBQztZQUNILGdEQUFnRDtRQUNwRCxDQUFDLENBQUMsQ0FBQztRQUVQLG9EQUFvRDtRQUNwRCxpRUFBaUU7UUFDakUsTUFBTTtRQUNOLDZCQUE2QjtJQUNqQyxDQUFDO0lBRUQ7O3lEQUVxRDtJQUNyRCxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQWEsRUFBRSxLQUFZO1FBQ3RDLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDeEMsSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUNULE9BQU8sQ0FBQyxHQUFHLENBQUMsb0RBQW9ELEtBQUssRUFBRSxDQUFDLENBQUM7WUFDekUsT0FBTztTQUNWO1FBQ0QsSUFBSSxLQUFLLEdBQWdCLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDaEUsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNwQixNQUFNLElBQUksS0FBSyxDQUFDLDRDQUE0QyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1NBQ3hFO1FBQ0QsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ1YsSUFBSSxLQUFLLENBQUM7UUFDVixJQUFJLEtBQUssQ0FBQztRQUNWLEtBQUssSUFBSSxDQUFDLElBQUksS0FBSyxFQUFFO1lBQ2pCLElBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSyxLQUFLLEVBQUU7Z0JBQ3BCLEtBQUssR0FBRyxDQUFDLENBQUM7Z0JBQ1YsS0FBSyxHQUFHLENBQUMsQ0FBQztnQkFDVixNQUFNO2FBQ1Q7WUFDRCxDQUFDLEVBQUUsQ0FBQztTQUNQO1FBQ0QsSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNSLE1BQU0sSUFBSSxLQUFLLENBQUMsK0JBQStCLEtBQUssS0FBSyxNQUFNLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztTQUM3RTtRQUNELElBQUksS0FBSyxLQUFLLENBQUMsRUFBRTtZQUNiLE1BQU0sQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1lBQ3JCLDhDQUE4QztZQUM5QyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1NBQzFDO1FBQ0QsMENBQTBDO1FBQzFDLGtEQUFrRDtRQUNsRCxvREFBb0Q7SUFDeEQsQ0FBQztJQUVELCtDQUErQztJQUMvQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQWEsRUFBRSxLQUFZO1FBQ25DLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDeEMsSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUNULE9BQU8sQ0FBQyxHQUFHLENBQUMsaURBQWlELEtBQUssRUFBRSxDQUFDLENBQUM7WUFDdEUsT0FBTztTQUNWO1FBQ0QseUNBQXlDO1FBQ3pDLGlEQUFpRDtRQUNqRCxJQUFJLEtBQUssR0FBZ0IsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNoRSxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ3BCLE1BQU0sSUFBSSxLQUFLLENBQUMseUNBQXlDLEtBQUssRUFBRSxDQUFDLENBQUM7U0FDckU7UUFDRCx3Q0FBd0M7UUFDeEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ1YsSUFBSSxLQUFLLENBQUM7UUFDVixJQUFJLEtBQUssQ0FBQztRQUNWLEtBQUssSUFBSSxDQUFDLElBQUksS0FBSyxFQUFFO1lBQ2pCLElBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSyxLQUFLLEVBQUU7Z0JBQ3BCLEtBQUssR0FBRyxDQUFDLENBQUM7Z0JBQ1YsS0FBSyxHQUFHLENBQUMsQ0FBQztnQkFDVixNQUFNO2FBQ1Q7WUFDRCxDQUFDLEVBQUUsQ0FBQztTQUNQO1FBQ0QsSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNSLE1BQU0sSUFBSSxLQUFLLENBQUMsNEJBQTRCLEtBQUssS0FBSyxNQUFNLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztTQUMxRTtRQUNELHVEQUF1RDtRQUN2RCxJQUFJLEtBQUssS0FBSyxDQUFDLEVBQUU7WUFDYixNQUFNLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztZQUNyQixpREFBaUQ7WUFDakQseUJBQXlCO1lBQ3pCLHFEQUFxRDtZQUNyRCxJQUFJO1lBQ0osSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztTQUN2QzthQUFNO1lBQ0gsd0RBQXdEO1NBQzNEO1FBQ0QsMENBQTBDO1FBQzFDLCtDQUErQztRQUMvQyx3Q0FBd0M7SUFFNUMsQ0FBQztJQUVEOzRFQUN3RTtJQUN4RSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQWE7UUFDeEIsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN4QyxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQ1QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvREFBb0QsS0FBSyxFQUFFLENBQUMsQ0FBQztZQUN6RSxPQUFPO1NBQ1Y7UUFDRCxJQUFJLEtBQUssR0FBZ0IsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNoRSxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ3BCOztlQUVHO1lBQ0gsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztTQUMxQzthQUFNO1lBQ0g7OztlQUdHO1lBQ0gsSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3RCLElBQUksTUFBTSxHQUFjO2dCQUNwQixNQUFNLEVBQUUsTUFBTSxDQUFDLE1BQU07Z0JBQ3JCLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSztnQkFDbkIsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztnQkFDakMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPO2dCQUN2QixVQUFVLEVBQUUsTUFBTSxDQUFDLFVBQVU7Z0JBQzdCLGFBQWEsRUFBRSxNQUFNLENBQUMsYUFBYTtnQkFDbkMsS0FBSzthQUNSLENBQUM7WUFDRixJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUN0QixNQUFNLElBQUksS0FBSyxDQUFDLHFCQUFxQixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQzthQUNoRTtZQUNELElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7U0FDMUM7UUFDRCw4Q0FBOEM7UUFDOUMsOENBQThDO1FBQzlDLGtEQUFrRDtJQUN0RCxDQUFDO0lBRUQsT0FBTztRQUNILHdFQUF3RTtRQUN4RSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbEMsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsVUFBVTtRQUNOLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQztZQUFFLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQ3JFLENBQUM7SUFFRCxjQUFjLENBQUMsTUFBYztRQUN6QixLQUFLLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUU7WUFFdkIsb0RBQW9EO1lBQ3BELElBQUksR0FBRyxDQUFDLE1BQU0sRUFBRTtnQkFDWixJQUFJLE9BQU8sQ0FBQztnQkFDWixJQUFJLE9BQU8sR0FBRyxDQUFDLE1BQU0sS0FBSyxRQUFRLEVBQUU7b0JBQ2hDLE9BQU8sR0FBRyxDQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUUsQ0FBQztpQkFDNUI7cUJBQU07b0JBQ0gsT0FBTyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUM7aUJBQ3hCO2dCQUNELElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQztnQkFDbkIsS0FBSyxJQUFJLENBQUMsSUFBSSxPQUFPLEVBQUU7b0JBQ25CLElBQUksSUFBQSxtQkFBUyxFQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7d0JBQUUsTUFBTSxHQUFHLElBQUksQ0FBQztvQkFDeEMseURBQXlEO2lCQUM1RDtnQkFDRCxJQUFJLE1BQU07b0JBQUUsU0FBUzthQUN4QjtZQUVELHVEQUF1RDtZQUN2RCw2REFBNkQ7WUFDN0Qsd0NBQXdDO1lBQ3hDLEVBQUU7WUFDRiwyRUFBMkU7WUFDM0UsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUM7Z0JBQ3hELENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTztnQkFDYixDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQyxDQUFDO1lBQ2xDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUU7Z0JBQ2xDLElBQUksYUFBYSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3RFLElBQUksS0FBSyxHQUFHLEdBQUcsQ0FBQyxVQUFVLEtBQUssR0FBRztvQkFDMUIsQ0FBQyxDQUFDLGFBQWE7b0JBQ2YsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxhQUFhLENBQUMsQ0FBQztnQkFDbkQsaUlBQWlJO2dCQUNqSSxJQUFJLEdBQUcsR0FBYztvQkFDakIsTUFBTSxFQUFFLE1BQU07b0JBQ2QsS0FBSyxFQUFFLEtBQUs7b0JBQ1osSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO29CQUMxQixPQUFPLEVBQUUsR0FBRyxDQUFDLE9BQU87b0JBQ3BCLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVTtvQkFDMUIsYUFBYTtpQkFDaEIsQ0FBQztnQkFDRixJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxFQUFFO29CQUNuQixNQUFNLElBQUksS0FBSyxDQUFDLHFCQUFxQixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztpQkFDN0Q7Z0JBQ0QsT0FBTyxHQUFHLENBQUM7YUFDZDtTQUNKO1FBQ0QsbUNBQW1DO1FBQ25DLE9BQU8sU0FBUyxDQUFDO0lBQ3JCLENBQUM7SUFFRCxLQUFLLENBQUMsYUFBYSxDQUFDLEtBQWE7UUFDN0IsTUFBTSxHQUFHLEdBQWdCLEVBQUUsQ0FBQztRQUM1QixLQUFLLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUU7WUFDdkIsSUFBSSxHQUFHLENBQUMsVUFBVSxLQUFLLEdBQUcsRUFBRTtnQkFDeEIsSUFBSSxhQUFhLEdBQUcsS0FBSyxDQUFDO2dCQUMxQixJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsYUFBYSxDQUFDLENBQUM7Z0JBQ25ELElBQUksS0FBSyxDQUFDO2dCQUNWLElBQUk7b0JBQ0EsS0FBSyxHQUFHLE1BQU0sYUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztpQkFDakM7Z0JBQUMsT0FBTyxHQUFHLEVBQUU7b0JBQ1YsS0FBSyxHQUFHLFNBQVMsQ0FBQztpQkFDckI7Z0JBQ0QsSUFBSSxDQUFDLEtBQUs7b0JBQUUsU0FBUztnQkFDckIsSUFBSSxNQUFNLEdBQWM7b0JBQ3BCLE1BQU0sRUFBRSxNQUFNO29CQUNkLEtBQUssRUFBRSxLQUFLO29CQUNaLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztvQkFDMUIsT0FBTyxFQUFFLEdBQUcsQ0FBQyxPQUFPO29CQUNwQixVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVU7b0JBQzFCLGFBQWEsRUFBRSxhQUFhO2lCQUMvQixDQUFDO2dCQUNGLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEVBQUU7b0JBQ3RCLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQXFCLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2lCQUNoRTtnQkFDRCxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQ3BCO2lCQUFNO2dCQUNILElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDO29CQUM5RCxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVU7b0JBQ2hCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEdBQUcsR0FBRyxDQUFDLENBQUM7Z0JBQ3JDLHNHQUFzRztnQkFDdEcsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRTtvQkFDakMsc0NBQXNDO29CQUN0Qyx5QkFBeUI7b0JBQ3pCLHVEQUF1RDtvQkFDdkQsa0JBQWtCO29CQUNsQixhQUFhO29CQUNiLElBQUksYUFBYSxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUN2RCxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsYUFBYSxDQUFDLENBQUM7b0JBQ25ELCtGQUErRjtvQkFDL0YsSUFBSSxLQUFLLENBQUM7b0JBQ1YsSUFBSTt3QkFDQSxLQUFLLEdBQUcsTUFBTSxhQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO3FCQUNqQztvQkFBQyxPQUFPLEdBQUcsRUFBRTt3QkFDVixLQUFLLEdBQUcsU0FBUyxDQUFDO3FCQUNyQjtvQkFDRCxJQUFJLENBQUMsS0FBSyxFQUFFO3dCQUNSLG1GQUFtRjt3QkFDbkYsU0FBUztxQkFDWjtvQkFDRCxJQUFJLE1BQU0sR0FBYzt3QkFDcEIsTUFBTSxFQUFFLE1BQU07d0JBQ2QsS0FBSyxFQUFFLEtBQUs7d0JBQ1osSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO3dCQUMxQixPQUFPLEVBQUUsR0FBRyxDQUFDLE9BQU87d0JBQ3BCLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVTt3QkFDMUIsYUFBYSxFQUFFLGFBQWE7cUJBQy9CLENBQUM7b0JBQ0YsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRTt3QkFDdEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQkFBcUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7cUJBQ2hFO29CQUNELEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7aUJBQ3BCO3FCQUFNO29CQUNILDJFQUEyRTtpQkFDOUU7YUFDSjtTQUNKO1FBQ0QsaUVBQWlFO1FBQ2pFLHNDQUFzQztRQUN0QyxPQUFPLEdBQUcsQ0FBQztJQUNmLENBQUM7SUFFRDs7OztPQUlHO0lBQ0g7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7UUFvREk7SUFFSixLQUFLLENBQUMsS0FBSztRQUNQLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFO1lBQ3JCLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2xDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxTQUFTLENBQUM7U0FDbkM7SUFDTCxDQUFDO0NBQ0o7QUE1ZEQsa0NBNGRDIiwic291cmNlc0NvbnRlbnQiOlsiXG5pbXBvcnQge1xuICAgIHByb21pc2VzIGFzIGZzLFxuICAgIFN0YXRzXG59IGZyb20gJ2ZzJztcbmltcG9ydCB7IGRlZmF1bHQgYXMgY2hva2lkYXIgfSBmcm9tICdjaG9raWRhcic7XG5pbXBvcnQgKiBhcyBtaW1lIGZyb20gJ21pbWUnO1xuLyogY29uc3QgbWltZSA9IHsgXG4gICAgZ2V0VHlwZTogbWltZV9wa2cuZ2V0VHlwZSxcbiAgICBnZXRFeHRlbnNpb246IG1pbWVfcGtnLmdldEV4dGVuc2lvbixcbiAgICBkZWZpbmU6IG1pbWVfcGtnLmRlZmluZVxufTsgKi9cbi8vIGltcG9ydCB7IGdldFR5cGUsIGdldEV4dGVuc2lvbiwgZGVmaW5lIGFzIG1pbWVfZGVmaW5lIH0gZnJvbSAnbWltZSc7XG5pbXBvcnQgKiBhcyB1dGlsIGZyb20gJ3V0aWwnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgbWluaW1hdGNoIGZyb20gJ21pbmltYXRjaCc7XG5pbXBvcnQgKiBhcyBmYXN0cSBmcm9tICdmYXN0cSc7XG5pbXBvcnQgdHlwZSB7IHF1ZXVlQXNQcm9taXNlZCB9IGZyb20gXCJmYXN0cVwiO1xuXG5cbi8vIE5PVEUgV2Ugc2hvdWxkIG5vdCBkbyB0aGlzIGhlcmUuICBJdCBoYWQgYmVlbiBjb3BpZWQgb3ZlciBmcm9tXG4vLyBBa2FzaGFSZW5kZXIsIGJ1dCB0aGlzIGlzIGR1cGxpY2F0aXZlLCBhbmQgaXQncyBwb3NzaWJsZSB0aGVyZVxuLy8gd2lsbCBiZSBvdGhlciB1c2VycyBvZiBEaXJzV2F0Y2hlciB3aG8gZG8gbm90IHdhbnQgdGhpcy5cbi8vXG4vLyBUaGVyZSBkb2Vzbid0IHNlZW0gdG8gYmUgYW4gb2ZmaWNpYWwgcmVnaXN0cmF0aW9uXG4vLyBwZXI6IGh0dHBzOi8vYXNjaWlkb2N0b3Iub3JnL2RvY3MvZmFxL1xuLy8gcGVyOiBodHRwczovL2dpdGh1Yi5jb20vYXNjaWlkb2N0b3IvYXNjaWlkb2N0b3IvaXNzdWVzLzI1MDJcbi8vIG1pbWUuZGVmaW5lKHsndGV4dC94LWFzY2lpZG9jJzogWydhZG9jJywgJ2FzY2lpZG9jJ119KTtcbi8vXG4vLyBJbnN0ZWFkIG9mIGRlZmluaW5nIE1JTUUgdHlwZXMgaGVyZSwgd2UgYWRkZWQgYSBtZXRob2QgXCJtaW1lZGVmaW5lXCJcbi8vIHRvIGFsbG93IERpcnNXYXRjaGVyIHVzZXJzIHRvIGRlZmluZSBNSU1FIHR5cGVzLlxuXG5leHBvcnQgZnVuY3Rpb24gbWltZWRlZmluZShtYXBwaW5nLCBmb3JjZSA/OiBib29sZWFuKSB7XG4gICAgbWltZS5kZWZpbmUobWFwcGluZywgZm9yY2UpO1xufVxuXG5cbmV4cG9ydCBjbGFzcyBWUGF0aERhdGEge1xuICAgIGZzcGF0aDogc3RyaW5nO1xuICAgIHZwYXRoOiBzdHJpbmc7XG4gICAgbWltZSA/OiBzdHJpbmc7XG4gICAgbW91bnRlZDogc3RyaW5nO1xuICAgIG1vdW50UG9pbnQ6IHN0cmluZztcbiAgICBwYXRoSW5Nb3VudGVkOiBzdHJpbmc7XG4gICAgc3RhY2sgPzogVlBhdGhEYXRhW107XG59XG5cbmNvbnN0IGlzVlBhdGhEYXRhID0gKHZwaW5mbyk6IHZwaW5mbyBpcyBWUGF0aERhdGEgPT4ge1xuICAgIGlmICh0eXBlb2YgdnBpbmZvID09PSAndW5kZWZpbmVkJykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2YgdnBpbmZvICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2YgdnBpbmZvLm1pbWUgIT09ICd1bmRlZmluZWQnXG4gICAgICYmIHR5cGVvZiB2cGluZm8ubWltZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHZwaW5mby5mc3BhdGggIT09ICdzdHJpbmcnXG4gICAgIHx8IHR5cGVvZiB2cGluZm8udnBhdGggIT09ICdzdHJpbmcnXG4gICAgIHx8IHR5cGVvZiB2cGluZm8ubW91bnRlZCAhPT0gJ3N0cmluZydcbiAgICAgfHwgdHlwZW9mIHZwaW5mby5tb3VudFBvaW50ICE9PSAnc3RyaW5nJ1xuICAgICB8fCB0eXBlb2YgdnBpbmZvLnBhdGhJbk1vdW50ZWQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB2cGluZm8uc3RhY2sgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gdHJ1ZTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2cGluZm8uc3RhY2spKSB7XG4gICAgICAgIGZvciAobGV0IGluZiBvZiB2cGluZm8uc3RhY2spIHtcbiAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEoaW5mKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufTtcblxudHlwZSBxdWV1ZUV2ZW50ID0ge1xuICAgIGNvZGU6IHN0cmluZztcbiAgICBmcGF0aD86IHN0cmluZztcbiAgICBzdGF0cz86IFN0YXRzO1xufTtcblxuY29uc3QgaXNRdWV1ZUV2ZW50ID0gKGV2ZW50KTogZXZlbnQgaXMgcXVldWVFdmVudCA9PiB7XG4gICAgaWYgKHR5cGVvZiBldmVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodHlwZW9mIGV2ZW50ICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuXG4gICAgaWYgKHR5cGVvZiBldmVudC5jb2RlID09PSAnc3RyaW5nJ1xuICAgICAmJiB0eXBlb2YgZXZlbnQuZnBhdGggPT09ICdzdHJpbmcnXG4gICAgICYmIChldmVudC5zdGF0cyBpbnN0YW5jZW9mIFN0YXRzKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBldmVudC5jb2RlID09PSAnc3RyaW5nJ1xuICAgICAmJiBldmVudC5jb2RlID09PSAncmVhZHknKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGV2ZW50LmNvZGUgPT09ICdzdHJpbmcnXG4gICAgICYmIGV2ZW50LmNvZGUgPT09ICd1bmxpbmsnXG4gICAgICYmIHR5cGVvZiBldmVudC5mcGF0aCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuY29uc3QgX3N5bWJfZGlycyA9IFN5bWJvbCgnZGlycycpO1xuY29uc3QgX3N5bWJfd2F0Y2hlciA9IFN5bWJvbCgnd2F0Y2hlcicpO1xuY29uc3QgX3N5bWJfbmFtZSA9IFN5bWJvbCgnbmFtZScpO1xuY29uc3QgX3N5bWJfb3B0aW9ucyA9IFN5bWJvbCgnb3B0aW9ucycpO1xuY29uc3QgX3N5bWJfY3dkID0gU3ltYm9sKCdiYXNlZGlyJyk7XG5jb25zdCBfc3ltYl9xdWV1ZSA9IFN5bWJvbCgncXVldWUnKTtcblxuZXhwb3J0IGNsYXNzIERpcnNXYXRjaGVyIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSBuYW1lIHN0cmluZyBnaXZpbmcgdGhlIG5hbWUgZm9yIHRoaXMgd2F0Y2hlclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG5hbWUpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyICR7bmFtZX0gY29uc3RydWN0b3JgKTtcbiAgICAgICAgdGhpc1tfc3ltYl9uYW1lXSA9IG5hbWU7XG4gICAgICAgIC8vIFRPRE8gaXMgdGhlcmUgYSBuZWVkIHRvIG1ha2UgdGhpcyBjdXN0b21pemFibGU/XG4gICAgICAgIHRoaXNbX3N5bWJfb3B0aW9uc10gPSB7XG4gICAgICAgICAgICBwZXJzaXN0ZW50OiB0cnVlLCBpZ25vcmVJbml0aWFsOiBmYWxzZSwgYXdhaXRXcml0ZUZpbmlzaDogdHJ1ZSwgYWx3YXlzU3RhdDogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgICB0aGlzW19zeW1iX2N3ZF0gPSB1bmRlZmluZWQ7XG4gICAgICAgIGxldCB0aGF0ID0gdGhpcztcbiAgICAgICAgY29uc3QgcTogcXVldWVBc1Byb21pc2VkPHF1ZXVlRXZlbnQ+ID0gZmFzdHEucHJvbWlzZShcbiAgICAgICAgICAgIGFzeW5jIGZ1bmN0aW9uKGV2ZW50OiBxdWV1ZUV2ZW50KSB7XG4gICAgICAgICAgICAgICAgaWYgKCFpc1F1ZXVlRXZlbnQoZXZlbnQpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSU5URVJOQUwgRVJST1Igbm90IGEgcXVldWVFdmVudCAke3V0aWwuaW5zcGVjdChldmVudCl9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChldmVudC5jb2RlID09PSAnY2hhbmdlJykge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGF0Lm9uQ2hhbmdlKGV2ZW50LmZwYXRoLCBldmVudC5zdGF0cyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC5jb2RlID09PSAnYWRkJykge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGF0Lm9uQWRkKGV2ZW50LmZwYXRoLCBldmVudC5zdGF0cyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC5jb2RlID09PSAndW5saW5rJykge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGF0Lm9uVW5saW5rKGV2ZW50LmZwYXRoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LmNvZGUgPT09ICdyZWFkeScpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhhdC5vblJlYWR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgMSk7XG4gICAgICAgIHRoaXNbX3N5bWJfcXVldWVdID0gcTtcbiAgICAgICAgdGhpc1tfc3ltYl9xdWV1ZV0uZXJyb3IoZnVuY3Rpb24oZXJyLCB0YXNrKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgRGlyc1dhdGNoZXIgJHtuYW1lfSAke3Rhc2suY29kZX0gJHt0YXNrLmZwYXRofSBjYXVnaHQgZXJyb3IgJHtlcnJ9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGdldCBkaXJzKCkgeyByZXR1cm4gdGhpc1tfc3ltYl9kaXJzXTsgfVxuICAgIGdldCBuYW1lKCkgeyByZXR1cm4gdGhpc1tfc3ltYl9uYW1lXTsgfVxuXG4gICAgLyoqXG4gICAgICogQ2hhbmdlcyB0aGUgdXNlIG9mIGFic29sdXRlIHBhdGhuYW1lcywgdG8gcGF0aHMgcmVsYXR2ZSB0byB0aGUgZ2l2ZW4gZGlyZWN0b3J5LlxuICAgICAqIFRoaXMgbXVzdCBiZSBjYWxsZWQgYmVmb3JlIHRoZSA8ZW0+d2F0Y2g8L2VtPiBtZXRob2QgaXMgY2FsbGVkLiAgVGhlIHBhdGhzXG4gICAgICogeW91IHNwZWNpZnkgdG8gd2F0Y2ggbXVzdCBiZSByZWxhdGl2ZSB0byB0aGUgZ2l2ZW4gZGlyZWN0b3J5LlxuICAgICAqL1xuICAgIHNldCBiYXNlZGlyKGN3ZCkgeyB0aGlzW19zeW1iX2N3ZF0gPSBjd2Q7IH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgdGhlIENob2tpZGFyIHdhdGNoZXIsIGJhc2VjIG9uIHRoZSBkaXJlY3RvcmllcyB0byB3YXRjaC4gIFRoZSA8ZW0+ZGlyc3BlYzwvZW0+IG9wdGlvbiBjYW4gYmUgYSBzdHJpbmcsXG4gICAgICogb3IgYW4gb2JqZWN0LiAgSWYgaXQgaXMgYSBzdHJpbmcsIGl0IGlzIGEgZmlsZXN5c3RlbSBwYXRobmFtZSB0aGF0IHdpbGwgYmVcbiAgICAgKiBhc3NvY2lhdGVkIHdpdGggdGhlIHJvb3Qgb2YgdGhlIHZpcnR1YWwgZmlsZXN5c3RlbS4gIEFuIG9iamVjdCB3aWxsIGxvb2tcbiAgICAgKiBsaWtlIHRoaXM6XG4gICAgICogXG4gICAgICogPGNvZGU+XG4gICAgICoge1xuICAgICAqICAgbW91bnRlZDogJy9wYXRoL3RvL21vdW50ZWQnLFxuICAgICAqICAgbW91bnRQb2ludDogJ21vdW50ZWQnXG4gICAgICogfVxuICAgICAqIDwvY29kZT5cbiAgICAgKiBcbiAgICAgKiBUaGUgPHR0Pm1vdW50UG9pbnQ8L3R0PiBmaWVsZCBpcyBhIGZ1bGwgcGF0aCB0byB0aGUgZGlyZWN0b3J5IG9mIGludGVyZXN0LiAgVGhlXG4gICAgICogPHR0Pm1vdW50UG9pbnQ8L3R0PiBmaWVsZCBkZXNjcmliZXMgYSBwcmVmaXggd2l0aGluIHRoZSB2aXJ0dWFsIGZpbGVzeXN0ZW0uXG4gICAgICogXG4gICAgICogQHBhcmFtIGRpcnNwZWMgXG4gICAgICovXG4gICAgYXN5bmMgd2F0Y2goZGlycykge1xuICAgICAgICBpZiAodGhpc1tfc3ltYl93YXRjaGVyXSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBXYXRjaGVyIGFscmVhZHkgc3RhcnRlZCBmb3IgJHt0aGlzW19zeW1iX3dhdGNoZXJdfWApO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgZGlycyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGRpcnMgPSBbIHtcbiAgICAgICAgICAgICAgICBzcmM6IGRpcnMsIGRlc3Q6ICcvJ1xuICAgICAgICAgICAgfSBdO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkaXJzID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheShkaXJzKSkge1xuICAgICAgICAgICAgZGlycyA9IFsgZGlycyBdO1xuICAgICAgICB9IGVsc2UgaWYgKCFBcnJheS5pc0FycmF5KGRpcnMpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHdhdGNoIC0gdGhlIGRpcnMgYXJndW1lbnQgaXMgaW5jb3JyZWN0ICR7dXRpbC5pbnNwZWN0KGRpcnMpfWApO1xuICAgICAgICB9XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGB3YXRjaCBkaXJzPWAsIGRpcnMpO1xuICAgICAgICBjb25zdCB0b3dhdGNoID0gW107XG4gICAgICAgIGZvciAobGV0IGRpciBvZiBkaXJzKSB7XG4gICAgICAgICAgICBjb25zdCBzdGF0cyA9IGF3YWl0IGZzLnN0YXQoZGlyLm1vdW50ZWQpO1xuICAgICAgICAgICAgaWYgKCFzdGF0cy5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXRjaCAtIG5vbi1kaXJlY3Rvcnkgc3BlY2lmaWVkIGluICR7dXRpbC5pbnNwZWN0KGRpcil9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0b3dhdGNoLnB1c2goZGlyLm1vdW50ZWQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXNbX3N5bWJfZGlyc10gPSBkaXJzO1xuXG4gICAgICAgIGlmICh0aGlzW19zeW1iX2N3ZF0pIHtcbiAgICAgICAgICAgIHRoaXNbX3N5bWJfb3B0aW9uc10uY3dkID0gdGhpc1tfc3ltYl9jd2RdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpc1tfc3ltYl9vcHRpb25zXS5jd2QgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzW19zeW1iX3dhdGNoZXJdID0gY2hva2lkYXIud2F0Y2godG93YXRjaCwgdGhpc1tfc3ltYl9vcHRpb25zXSk7XG5cbiAgICAgICAgLy8gSW4gdGhlIGV2ZW50IGhhbmRsZXJzLCB3ZSBjcmVhdGUgdGhlIEZpbGVJbmZvIG9iamVjdCBtYXRjaGluZ1xuICAgICAgICAvLyB0aGUgcGF0aC4gIFRoZSBGaWxlSW5mbyBpcyBtYXRjaGVkIHRvIGEgX3N5bWJfZGlycyBlbnRyeS5cbiAgICAgICAgLy8gSWYgdGhlIF9zeW1iX2RpcnMgZW50cnkgaGFzIDxlbT5pZ25vcmU8L2VtPiBvciA8ZW0+aW5jbHVkZTwvZW0+XG4gICAgICAgIC8vIGZpZWxkcywgdGhlIHBhdHRlcm5zIGluIHRob3NlIGZpZWxkcyBhcmUgdXNlZCB0byBkZXRlcm1pbmUgd2hldGhlclxuICAgICAgICAvLyB0byBpbmNsdWRlIG9yIGlnbm9yZSB0aGlzIGZpbGUuICBJZiB3ZSBhcmUgdG8gaWdub3JlIGl0LCB0aGVuXG4gICAgICAgIC8vIGZpbGVJbmZvIHJldHVybnMgdW5kZWZpbmVkLiAgSGVuY2UsIGluIGVhY2ggY2FzZSB3ZSB0ZXN0IHdoZXRoZXJcbiAgICAgICAgLy8gPGVtPmluZm88L2VtPiBoYXMgYSB2YWx1ZSBiZWZvcmUgZW1pdHRpbmcgdGhlIGV2ZW50LlxuICAgICAgICAvL1xuICAgICAgICAvLyBBbGwgdGhpcyBmdW5jdGlvbiBkb2VzIGlzIHRvIHJlY2VpdmUgZXZlbnRzIGZyb20gQ2hva2lkYXIsXG4gICAgICAgIC8vIGNvbnN0cnVjdCBGaWxlSW5mbyBvYmplY3RzLCBhbmQgZW1pdCBtYXRjaGluZyBldmVudHMuXG5cbiAgICAgICAgY29uc3Qgd2F0Y2hlcl9uYW1lID0gdGhpcy5uYW1lO1xuXG4gICAgICAgIHRoaXNbX3N5bWJfd2F0Y2hlcl1cbiAgICAgICAgICAgIC5vbignY2hhbmdlJywgYXN5bmMgKGZwYXRoLCBzdGF0cykgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXNbX3N5bWJfcXVldWVdLnB1c2goPHF1ZXVlRXZlbnQ+e1xuICAgICAgICAgICAgICAgICAgICBjb2RlOiAnY2hhbmdlJywgZnBhdGgsIHN0YXRzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHdhdGNoZXIgJHt3YXRjaGVyX25hbWV9IGNoYW5nZSAke2ZwYXRofWApO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5vbignYWRkJywgYXN5bmMgKGZwYXRoLCBzdGF0cykgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXNbX3N5bWJfcXVldWVdLnB1c2goPHF1ZXVlRXZlbnQ+e1xuICAgICAgICAgICAgICAgICAgICBjb2RlOiAnYWRkJywgZnBhdGgsIHN0YXRzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHdhdGNoZXIgJHt3YXRjaGVyX25hbWV9IGFkZCAke2ZwYXRofWApO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC8qIC5vbignYWRkRGlyJywgYXN5bmMgKGZwYXRoLCBzdGF0cykgPT4geyBcbiAgICAgICAgICAgICAgICAvLyA/PyBsZXQgaW5mbyA9IHRoaXMuZmlsZUluZm8oZnBhdGgsIHN0YXRzKTtcbiAgICAgICAgICAgICAgICAvLyA/PyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgYWRkRGlyYCwgaW5mbyk7XG4gICAgICAgICAgICAgICAgLy8gPz8gdGhpcy5lbWl0KCdhZGREaXInLCBpbmZvKTtcbiAgICAgICAgICAgIH0pICovXG4gICAgICAgICAgICAub24oJ3VubGluaycsIGFzeW5jIGZwYXRoID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzW19zeW1iX3F1ZXVlXS5wdXNoKDxxdWV1ZUV2ZW50PntcbiAgICAgICAgICAgICAgICAgICAgY29kZTogJ3VubGluaycsIGZwYXRoXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHdhdGNoZXIgJHt3YXRjaGVyX25hbWV9IHVubGluayAke2ZwYXRofWApO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC8qIC5vbigndW5saW5rRGlyJywgYXN5bmMgZnBhdGggPT4geyBcbiAgICAgICAgICAgICAgICAvLyA/PyBsZXQgaW5mbyA9IHRoaXMuZmlsZUluZm8oZnBhdGgsIHN0YXRzKTtcbiAgICAgICAgICAgICAgICAvLyA/PyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgdW5saW5rRGlyICR7ZnBhdGh9YCk7XG4gICAgICAgICAgICAgICAgLy8gPz8gdGhpcy5lbWl0KCd1bmxpbmtEaXInLCBpbmZvKTtcbiAgICAgICAgICAgIH0pICovXG4gICAgICAgICAgICAub24oJ3JlYWR5JywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXNbX3N5bWJfcXVldWVdLnB1c2goPHF1ZXVlRXZlbnQ+e1xuICAgICAgICAgICAgICAgICAgICBjb2RlOiAncmVhZHknXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHdhdGNoZXIgJHt3YXRjaGVyX25hbWV9IHJlYWR5YCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAvLyB0aGlzLmlzUmVhZHkgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIC8vICAgICB0aGlzW19zeW1iX3dhdGNoZXJdLm9uKCdyZWFkeScsICgpID0+IHsgcmVzb2x2ZSh0cnVlKTsgfSk7XG4gICAgICAgIC8vIH0pO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyh0aGlzLmlzUmVhZHkpO1xuICAgIH1cblxuICAgIC8qIENhbGN1bGF0ZSB0aGUgc3RhY2sgZm9yIGEgZmlsZXN5c3RlbSBwYXRoXG5cbiAgICBPbmx5IGVtaXQgaWYgdGhlIGNoYW5nZSB3YXMgdG8gdGhlIGZyb250LW1vc3QgZmlsZSAqLyBcbiAgICBhc3luYyBvbkNoYW5nZShmcGF0aDogc3RyaW5nLCBzdGF0czogU3RhdHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgbGV0IHZwaW5mbyA9IHRoaXMudnBhdGhGb3JGU1BhdGgoZnBhdGgpO1xuICAgICAgICBpZiAoIXZwaW5mbykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYG9uQ2hhbmdlIGNvdWxkIG5vdCBmaW5kIG1vdW50IHBvaW50IG9yIHZwYXRoIGZvciAke2ZwYXRofWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGxldCBzdGFjazogVlBhdGhEYXRhW10gPSBhd2FpdCB0aGlzLnN0YWNrRm9yVlBhdGgodnBpbmZvLnZwYXRoKTtcbiAgICAgICAgaWYgKHN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBvbkNoYW5nZSBjb3VsZCBub3QgZmluZCBtb3VudCBwb2ludHMgZm9yICR7ZnBhdGh9YCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGkgPSAwO1xuICAgICAgICBsZXQgZGVwdGg7XG4gICAgICAgIGxldCBlbnRyeTtcbiAgICAgICAgZm9yIChsZXQgcyBvZiBzdGFjaykge1xuICAgICAgICAgICAgaWYgKHMuZnNwYXRoID09PSBmcGF0aCkge1xuICAgICAgICAgICAgICAgIGVudHJ5ID0gcztcbiAgICAgICAgICAgICAgICBkZXB0aCA9IGk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpKys7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFlbnRyeSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBvbkNoYW5nZSBubyBzdGFjayBlbnRyeSBmb3IgJHtmcGF0aH0gKCR7dnBpbmZvLnZwYXRofSlgKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGVwdGggPT09IDApIHtcbiAgICAgICAgICAgIHZwaW5mby5zdGFjayA9IHN0YWNrO1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIGNoYW5nZSAke2ZwYXRofWApO1xuICAgICAgICAgICAgdGhpcy5lbWl0KCdjaGFuZ2UnLCB0aGlzLm5hbWUsIHZwaW5mbyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gbGV0IGluZm8gPSB0aGlzLmZpbGVJbmZvKGZwYXRoLCBzdGF0cyk7XG4gICAgICAgIC8vIGlmIChpbmZvKSB0aGlzLmVtaXQoJ2NoYW5nZScsIHRoaXMubmFtZSwgaW5mbyk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBEaXJzV2F0Y2hlciBjaGFuZ2UgJHtmcGF0aH1gLCBpbmZvKTtcbiAgICB9XG5cbiAgICAvLyBPbmx5IGVtaXQgaWYgdGhlIGFkZCB3YXMgdGhlIGZyb250LW1vc3QgZmlsZVxuICAgIGFzeW5jIG9uQWRkKGZwYXRoOiBzdHJpbmcsIHN0YXRzOiBTdGF0cyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBsZXQgdnBpbmZvID0gdGhpcy52cGF0aEZvckZTUGF0aChmcGF0aCk7XG4gICAgICAgIGlmICghdnBpbmZvKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgb25BZGQgY291bGQgbm90IGZpbmQgbW91bnQgcG9pbnQgb3IgdnBhdGggZm9yICR7ZnBhdGh9YCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkICR7ZnBhdGh9YCwgdnBpbmZvKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkICR7ZnBhdGh9ICR7dnBpbmZvLnZwYXRofWApO1xuICAgICAgICBsZXQgc3RhY2s6IFZQYXRoRGF0YVtdID0gYXdhaXQgdGhpcy5zdGFja0ZvclZQYXRoKHZwaW5mby52cGF0aCk7XG4gICAgICAgIGlmIChzdGFjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgb25BZGQgY291bGQgbm90IGZpbmQgbW91bnQgcG9pbnRzIGZvciAke2ZwYXRofWApO1xuICAgICAgICB9XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBvbkFkZCAke2ZwYXRofWAsIHN0YWNrKTtcbiAgICAgICAgbGV0IGkgPSAwO1xuICAgICAgICBsZXQgZGVwdGg7XG4gICAgICAgIGxldCBlbnRyeTtcbiAgICAgICAgZm9yIChsZXQgcyBvZiBzdGFjaykge1xuICAgICAgICAgICAgaWYgKHMuZnNwYXRoID09PSBmcGF0aCkge1xuICAgICAgICAgICAgICAgIGVudHJ5ID0gcztcbiAgICAgICAgICAgICAgICBkZXB0aCA9IGk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpKys7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFlbnRyeSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBvbkFkZCBubyBzdGFjayBlbnRyeSBmb3IgJHtmcGF0aH0gKCR7dnBpbmZvLnZwYXRofSlgKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBjb25zb2xlLmxvZyhgb25BZGQgJHtmcGF0aH0gZGVwdGg9JHtkZXB0aH1gLCBlbnRyeSk7XG4gICAgICAgIGlmIChkZXB0aCA9PT0gMCkge1xuICAgICAgICAgICAgdnBpbmZvLnN0YWNrID0gc3RhY2s7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgb25BZGQgRU1JVCBhZGQgJHt2cGluZm8udnBhdGh9YCk7XG4gICAgICAgICAgICAvLyBmb3IgKGxldCBzIG9mIHN0YWNrKSB7XG4gICAgICAgICAgICAvLyAgICBjb25zb2xlLmxvZyhgLi4uLiAke3MudnBhdGh9ID09PiAke3MuZnNwYXRofWApO1xuICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgdGhpcy5lbWl0KCdhZGQnLCB0aGlzLm5hbWUsIHZwaW5mbyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgb25BZGQgU0tJUFBFRCBlbWl0IGV2ZW50IGZvciAke2ZwYXRofWApO1xuICAgICAgICB9XG4gICAgICAgIC8vIGxldCBpbmZvID0gdGhpcy5maWxlSW5mbyhmcGF0aCwgc3RhdHMpO1xuICAgICAgICAvLyBpZiAoaW5mbykgdGhpcy5lbWl0KCdhZGQnLCB0aGlzLm5hbWUsIGluZm8pO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgYWRkYCwgaW5mbyk7XG4gICAgICAgIFxuICAgIH1cblxuICAgIC8qIE9ubHkgZW1pdCBpZiBpdCB3YXMgdGhlIGZyb250LW1vc3QgZmlsZSBkZWxldGVkXG4gICAgSWYgdGhlcmUgaXMgYSBmaWxlIHVuY292ZXJlZCBieSB0aGlzLCB0aGVuIGVtaXQgYW4gYWRkIGV2ZW50IGZvciB0aGF0ICovXG4gICAgYXN5bmMgb25VbmxpbmsoZnBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBsZXQgdnBpbmZvID0gdGhpcy52cGF0aEZvckZTUGF0aChmcGF0aCk7XG4gICAgICAgIGlmICghdnBpbmZvKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgb25VbmxpbmsgY291bGQgbm90IGZpbmQgbW91bnQgcG9pbnQgb3IgdnBhdGggZm9yICR7ZnBhdGh9YCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHN0YWNrOiBWUGF0aERhdGFbXSA9IGF3YWl0IHRoaXMuc3RhY2tGb3JWUGF0aCh2cGluZm8udnBhdGgpO1xuICAgICAgICBpZiAoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAvKiBJZiBubyBmaWxlcyByZW1haW4gaW4gdGhlIHN0YWNrIGZvciB0aGlzIHZpcnR1YWwgcGF0aCwgdGhlblxuICAgICAgICAgICAgICogd2UgbXVzdCBkZWNsYXJlIGl0IHVubGlua2VkLlxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmVtaXQoJ3VubGluaycsIHRoaXMubmFtZSwgdnBpbmZvKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8qIE9uIHRoZSBvdGhlciBoYW5kLCBpZiB0aGVyZSBpcyBhbiBlbnRyeSB3ZSBzaG91bGRuJ3Qgc2VuZFxuICAgICAgICAgICAgICogYW4gdW5saW5rIGV2ZW50LiAgSW5zdGVhZCBpdCBzZWVtcyBtb3N0IGFwcHJvcHJpYXRlIHRvIHNlbmRcbiAgICAgICAgICAgICAqIGEgY2hhbmdlIGV2ZW50LlxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBsZXQgc2ZpcnN0ID0gc3RhY2tbMF07XG4gICAgICAgICAgICBsZXQgdG9lbWl0ID0gPFZQYXRoRGF0YT57XG4gICAgICAgICAgICAgICAgZnNwYXRoOiBzZmlyc3QuZnNwYXRoLFxuICAgICAgICAgICAgICAgIHZwYXRoOiBzZmlyc3QudnBhdGgsXG4gICAgICAgICAgICAgICAgbWltZTogbWltZS5nZXRUeXBlKHNmaXJzdC5mc3BhdGgpLFxuICAgICAgICAgICAgICAgIG1vdW50ZWQ6IHNmaXJzdC5tb3VudGVkLFxuICAgICAgICAgICAgICAgIG1vdW50UG9pbnQ6IHNmaXJzdC5tb3VudFBvaW50LFxuICAgICAgICAgICAgICAgIHBhdGhJbk1vdW50ZWQ6IHNmaXJzdC5wYXRoSW5Nb3VudGVkLFxuICAgICAgICAgICAgICAgIHN0YWNrXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YSh0b2VtaXQpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFZQYXRoRGF0YSAke3V0aWwuaW5zcGVjdCh0b2VtaXQpfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5lbWl0KCdjaGFuZ2UnLCB0aGlzLm5hbWUsIHRvZW1pdCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gbGV0IGluZm8gPSB0aGlzLmZpbGVJbmZvKGZwYXRoLCB1bmRlZmluZWQpO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgdW5saW5rICR7ZnBhdGh9YCk7XG4gICAgICAgIC8vIGlmIChpbmZvKSB0aGlzLmVtaXQoJ3VubGluaycsIHRoaXMubmFtZSwgaW5mbyk7XG4gICAgfVxuXG4gICAgb25SZWFkeSgpOiB2b2lkIHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ0RpcnNXYXRjaGVyOiBJbml0aWFsIHNjYW4gY29tcGxldGUuIFJlYWR5IGZvciBjaGFuZ2VzJyk7XG4gICAgICAgIHRoaXMuZW1pdCgncmVhZHknLCB0aGlzLm5hbWUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYW4gb2JqZWN0IHJlcHJlc2VudGluZyBhbGwgdGhlIHBhdGhzIG9uIHRoZSBmaWxlIHN5c3RlbSBiZWluZ1xuICAgICAqIHdhdGNoZWQgYnkgdGhpcyBGU1dhdGNoZXIgaW5zdGFuY2UuIFRoZSBvYmplY3QncyBrZXlzIGFyZSBhbGwgdGhlIFxuICAgICAqIGRpcmVjdG9yaWVzICh1c2luZyBhYnNvbHV0ZSBwYXRocyB1bmxlc3MgdGhlIGN3ZCBvcHRpb24gd2FzIHVzZWQpLFxuICAgICAqIGFuZCB0aGUgdmFsdWVzIGFyZSBhcnJheXMgb2YgdGhlIG5hbWVzIG9mIHRoZSBpdGVtcyBjb250YWluZWQgaW4gZWFjaCBkaXJlY3RvcnkuXG4gICAgICovXG4gICAgZ2V0V2F0Y2hlZCgpIHtcbiAgICAgICAgaWYgKHRoaXNbX3N5bWJfd2F0Y2hlcl0pIHJldHVybiB0aGlzW19zeW1iX3dhdGNoZXJdLmdldFdhdGNoZWQoKTtcbiAgICB9XG5cbiAgICB2cGF0aEZvckZTUGF0aChmc3BhdGg6IHN0cmluZyk6IFZQYXRoRGF0YSB7XG4gICAgICAgIGZvciAobGV0IGRpciBvZiB0aGlzLmRpcnMpIHtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgdG8gc2VlIGlmIHdlJ3JlIHN1cHBvc2VkIHRvIGlnbm9yZSB0aGUgZmlsZVxuICAgICAgICAgICAgaWYgKGRpci5pZ25vcmUpIHtcbiAgICAgICAgICAgICAgICBsZXQgaWdub3JlcztcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGRpci5pZ25vcmUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIGlnbm9yZXMgPSBbIGRpci5pZ25vcmUgXTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZ25vcmVzID0gZGlyLmlnbm9yZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGV0IGlnbm9yZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgb2YgaWdub3Jlcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAobWluaW1hdGNoKGZzcGF0aCwgaSkpIGlnbm9yZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBkaXIuaWdub3JlICR7ZnNwYXRofSAke2l9ID0+ICR7aWdub3JlfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoaWdub3JlKSBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gVGhpcyBlbnN1cmVzIHdlIGFyZSBtYXRjaGluZyBvbiBkaXJlY3RvcnkgYm91bmRhcmllc1xuICAgICAgICAgICAgLy8gT3RoZXJ3aXNlIGZzcGF0aCBcIi9wYXRoL3RvL2xheW91dHMtZXh0cmEvbGF5b3V0Lm5qa1wiIG1pZ2h0XG4gICAgICAgICAgICAvLyBtYXRjaCBkaXIubW91bnRlZCBcIi9wYXRoL3RvL2xheW91dHNcIi5cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgdnBhdGhGb3JGU1BhdGggJHtkaXIubW91bnRlZH0gJHt0eXBlb2YgZGlyLm1vdW50ZWR9YCwgZGlyKTtcbiAgICAgICAgICAgIGxldCBkaXJtb3VudGVkID0gKGRpci5tb3VudGVkLmNoYXJBdChkaXIubW91bnRlZC5sZW5ndGggLSAxKSA9PSAnLycpXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGRpci5tb3VudGVkXG4gICAgICAgICAgICAgICAgICAgICAgICA6IChkaXIubW91bnRlZCArICcvJyk7XG4gICAgICAgICAgICBpZiAoZnNwYXRoLmluZGV4T2YoZGlybW91bnRlZCkgPT09IDApIHtcbiAgICAgICAgICAgICAgICBsZXQgcGF0aEluTW91bnRlZCA9IGZzcGF0aC5zdWJzdHJpbmcoZGlyLm1vdW50ZWQubGVuZ3RoKS5zdWJzdHJpbmcoMSk7XG4gICAgICAgICAgICAgICAgbGV0IHZwYXRoID0gZGlyLm1vdW50UG9pbnQgPT09ICcvJ1xuICAgICAgICAgICAgICAgICAgICAgICAgPyBwYXRoSW5Nb3VudGVkXG4gICAgICAgICAgICAgICAgICAgICAgICA6IHBhdGguam9pbihkaXIubW91bnRQb2ludCwgcGF0aEluTW91bnRlZCk7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHZwYXRoRm9yRlNQYXRoIGZzcGF0aCAke2ZzcGF0aH0gZGlyLm1vdW50UG9pbnQgJHtkaXIubW91bnRQb2ludH0gcGF0aEluTW91bnRlZCAke3BhdGhJbk1vdW50ZWR9IHZwYXRoICR7dnBhdGh9YCk7XG4gICAgICAgICAgICAgICAgbGV0IHJldCA9IDxWUGF0aERhdGE+e1xuICAgICAgICAgICAgICAgICAgICBmc3BhdGg6IGZzcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgdnBhdGg6IHZwYXRoLFxuICAgICAgICAgICAgICAgICAgICBtaW1lOiBtaW1lLmdldFR5cGUoZnNwYXRoKSxcbiAgICAgICAgICAgICAgICAgICAgbW91bnRlZDogZGlyLm1vdW50ZWQsXG4gICAgICAgICAgICAgICAgICAgIG1vdW50UG9pbnQ6IGRpci5tb3VudFBvaW50LFxuICAgICAgICAgICAgICAgICAgICBwYXRoSW5Nb3VudGVkXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBpZiAoIWlzVlBhdGhEYXRhKHJldCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFZQYXRoRGF0YSAke3V0aWwuaW5zcGVjdChyZXQpfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIE5vIGRpcmVjdG9yeSBmb3VuZCBmb3IgdGhpcyBmaWxlXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgYXN5bmMgc3RhY2tGb3JWUGF0aCh2cGF0aDogc3RyaW5nKTogUHJvbWlzZTxWUGF0aERhdGFbXT4ge1xuICAgICAgICBjb25zdCByZXQ6IFZQYXRoRGF0YVtdID0gW107XG4gICAgICAgIGZvciAobGV0IGRpciBvZiB0aGlzLmRpcnMpIHtcbiAgICAgICAgICAgIGlmIChkaXIubW91bnRQb2ludCA9PT0gJy8nKSB7XG4gICAgICAgICAgICAgICAgbGV0IHBhdGhJbk1vdW50ZWQgPSB2cGF0aDtcbiAgICAgICAgICAgICAgICBsZXQgZnNwYXRoID0gcGF0aC5qb2luKGRpci5tb3VudGVkLCBwYXRoSW5Nb3VudGVkKTtcbiAgICAgICAgICAgICAgICBsZXQgc3RhdHM7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KGZzcGF0aCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRzID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIXN0YXRzKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBsZXQgdG9wdXNoID0gPFZQYXRoRGF0YT57XG4gICAgICAgICAgICAgICAgICAgIGZzcGF0aDogZnNwYXRoLFxuICAgICAgICAgICAgICAgICAgICB2cGF0aDogdnBhdGgsXG4gICAgICAgICAgICAgICAgICAgIG1pbWU6IG1pbWUuZ2V0VHlwZShmc3BhdGgpLFxuICAgICAgICAgICAgICAgICAgICBtb3VudGVkOiBkaXIubW91bnRlZCxcbiAgICAgICAgICAgICAgICAgICAgbW91bnRQb2ludDogZGlyLm1vdW50UG9pbnQsXG4gICAgICAgICAgICAgICAgICAgIHBhdGhJbk1vdW50ZWQ6IHBhdGhJbk1vdW50ZWRcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEodG9wdXNoKSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgVlBhdGhEYXRhICR7dXRpbC5pbnNwZWN0KHRvcHVzaCl9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldC5wdXNoKHRvcHVzaCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxldCBkaXJtb3VudHB0ID0gKGRpci5tb3VudFBvaW50LmNoYXJBdChkaXIubW91bnRQb2ludC5sZW5ndGggLSAxKSA9PSAnLycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBkaXIubW91bnRQb2ludFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogKGRpci5tb3VudFBvaW50ICsgJy8nKTtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgc3RhY2tGb3JWUGF0aCB2cGF0aCAke3ZwYXRofSBkaXIubW91bnRlZCAke2Rpci5tb3VudFBvaW50fSBkaXJtb3VudHB0ICR7ZGlybW91bnRwdH1gKTtcbiAgICAgICAgICAgICAgICBpZiAodnBhdGguaW5kZXhPZihkaXJtb3VudHB0KSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyA+IGNvbnN0IHZwYXRoID0gJ2Zvby9iYXIvYmF6Lmh0bWwnO1xuICAgICAgICAgICAgICAgICAgICAvLyA+IGNvbnN0IG0gPSAnZm9vL2Jhcic7XG4gICAgICAgICAgICAgICAgICAgIC8vID4gbGV0IHBhdGhJbk1vdW50ZWQgPSB2cGF0aC5zdWJzdHJpbmcobS5sZW5ndGggKyAxKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gPiBwYXRoSW5Nb3VudGVkXG4gICAgICAgICAgICAgICAgICAgIC8vICdiYXouaHRtbCdcbiAgICAgICAgICAgICAgICAgICAgbGV0IHBhdGhJbk1vdW50ZWQgPSB2cGF0aC5zdWJzdHJpbmcoZGlybW91bnRwdC5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICBsZXQgZnNwYXRoID0gcGF0aC5qb2luKGRpci5tb3VudGVkLCBwYXRoSW5Nb3VudGVkKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHN0YWNrRm9yVlBhdGggdnBhdGggJHt2cGF0aH0gcGF0aEluTW91bnRlZCAke3BhdGhJbk1vdW50ZWR9IGZzcGF0aCAke2ZzcGF0aH1gKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHN0YXRzO1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KGZzcGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHMgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFzdGF0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHN0YWNrRm9yVlBhdGggdnBhdGggJHt2cGF0aH0gZGlkIG5vdCBmaW5kIGZzLnN0YXRzIGZvciAke2ZzcGF0aH1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGxldCB0b3B1c2ggPSA8VlBhdGhEYXRhPntcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzcGF0aDogZnNwYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgdnBhdGg6IHZwYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWltZTogbWltZS5nZXRUeXBlKGZzcGF0aCksXG4gICAgICAgICAgICAgICAgICAgICAgICBtb3VudGVkOiBkaXIubW91bnRlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vdW50UG9pbnQ6IGRpci5tb3VudFBvaW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aEluTW91bnRlZDogcGF0aEluTW91bnRlZFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWlzVlBhdGhEYXRhKHRvcHVzaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QodG9wdXNoKX1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXQucHVzaCh0b3B1c2gpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBzdGFja0ZvclZQYXRoIHZwYXRoICR7dnBhdGh9IGRpZCBub3QgbWF0Y2ggJHtkaXJtb3VudHB0fWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyAoa25vY2sgb24gd29vZCkgRXZlcnkgZW50cnkgaW4gYHJldGAgaGFzIGFscmVhZHkgYmVlbiB2ZXJpZmllZFxuICAgICAgICAvLyBhcyBiZWluZyBhIGNvcnJlY3QgVlBhdGhEYXRhIG9iamVjdFxuICAgICAgICByZXR1cm4gcmV0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnQgZGF0YSB3ZSBnYXRoZXIgYWJvdXQgYSBmaWxlIGluIHRoZSBmaWxlIHN5c3RlbSBpbnRvIGEgZGVzY3JpcHRvciBvYmplY3QuXG4gICAgICogQHBhcmFtIGZzcGF0aCBcbiAgICAgKiBAcGFyYW0gc3RhdHMgXG4gICAgICovXG4gICAgLyogZmlsZUluZm8oZnNwYXRoLCBzdGF0cykge1xuICAgICAgICBsZXQgZSA9IHRoaXMuZGlyRm9yUGF0aChmc3BhdGgpO1xuICAgICAgICBpZiAoIWUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTm8gbW91bnRQb2ludCBmb3VuZCBmb3IgJHtmc3BhdGh9YCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGZuSW5Tb3VyY2VEaXIgPSBmc3BhdGguc3Vic3RyaW5nKGUucGF0aC5sZW5ndGgpLnN1YnN0cmluZygxKTtcbiAgICAgICAgbGV0IGRvY3BhdGggPSBwYXRoLmpvaW4oZS5tb3VudFBvaW50LCBmbkluU291cmNlRGlyKTtcbiAgICAgICAgaWYgKGRvY3BhdGguc3RhcnRzV2l0aCgnLycpKSB7XG4gICAgICAgICAgICBkb2NwYXRoID0gZG9jcGF0aC5zdWJzdHJpbmcoMSk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGlnbm9yZSA9IGZhbHNlO1xuICAgICAgICBsZXQgaW5jbHVkZSA9IHRydWU7XG4gICAgICAgIGlmIChlLmlnbm9yZSkge1xuICAgICAgICAgICAgbGV0IGlnbm9yZXM7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGUuaWdub3JlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGlnbm9yZXMgPSBbIGUuaWdub3JlIF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlnbm9yZXMgPSBlLmlnbm9yZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgb2YgaWdub3Jlcykge1xuICAgICAgICAgICAgICAgIGlmIChtaW5pbWF0Y2goZm5JblNvdXJjZURpciwgaSkpIGlnbm9yZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYGUuaWdub3JlICR7Zm5JblNvdXJjZURpcn0gJHtpfSA9PiAke2lnbm9yZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZS5pbmNsdWRlKSB7XG4gICAgICAgICAgICBpbmNsdWRlID0gZmFsc2U7XG4gICAgICAgICAgICBsZXQgaW5jbHVkZXJzO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBlLmluY2x1ZGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgaW5jbHVkZXJzID0gWyBlLmluY2x1ZGUgXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaW5jbHVkZXJzID0gZS5pbmNsdWRlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChsZXQgaSBvZiBpbmNsdWRlcnMpIHtcbiAgICAgICAgICAgICAgICBpZiAobWluaW1hdGNoKGZuSW5Tb3VyY2VEaXIsIGkpKSBpbmNsdWRlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgZS5pbmNsdWRlICR7Zm5JblNvdXJjZURpcn0gJHtpfSA9PiAke2luY2x1ZGV9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlnbm9yZSB8fCAhaW5jbHVkZSkge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgZnNwYXRoOiBmc3BhdGgsXG4gICAgICAgICAgICAgICAgbWltZTogbWltZS5nZXRUeXBlKGZzcGF0aCksXG4gICAgICAgICAgICAgICAgYmFzZU1ldGFkYXRhOiBlLmJhc2VNZXRhZGF0YSxcbiAgICAgICAgICAgICAgICBzb3VyY2VQYXRoOiBlLnBhdGgsXG4gICAgICAgICAgICAgICAgbW91bnRQb2ludDogZS5tb3VudFBvaW50LFxuICAgICAgICAgICAgICAgIHBhdGhJblNvdXJjZTogZm5JblNvdXJjZURpcixcbiAgICAgICAgICAgICAgICBwYXRoOiBkb2NwYXRoLFxuICAgICAgICAgICAgICAgIGlzRGlyZWN0b3J5OiBzdGF0cy5pc0RpcmVjdG9yeSgpLFxuICAgICAgICAgICAgICAgIHN0YXRzXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfSAqL1xuXG4gICAgYXN5bmMgY2xvc2UoKSB7XG4gICAgICAgIGlmICh0aGlzW19zeW1iX3dhdGNoZXJdKSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzW19zeW1iX3dhdGNoZXJdLmNsb3NlKCk7XG4gICAgICAgICAgICB0aGlzW19zeW1iX3dhdGNoZXJdID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgfVxufVxuIl19