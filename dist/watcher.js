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
exports.DirsWatcher = exports.VPathData = void 0;
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
class VPathData {
}
exports.VPathData = VPathData;
const isVPathData = (vpinfo) => {
    if (typeof vpinfo === 'undefined')
        return false;
    if (typeof vpinfo !== 'object')
        return false;
    if (typeof vpinfo.fspath !== 'string'
        || typeof vpinfo.vpath !== 'string'
        || typeof vpinfo.mime !== 'string'
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
    mimedefine(mapping) {
        mime.define(mapping);
    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2F0Y2hlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2xpYi93YXRjaGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSwyQkFHWTtBQUNaLHdEQUErQztBQUMvQywyQ0FBNkI7QUFDN0I7Ozs7S0FJSztBQUNMLHVFQUF1RTtBQUN2RSwyQ0FBNkI7QUFDN0IsMkNBQTZCO0FBQzdCLG1DQUFzQztBQUN0QywwREFBa0M7QUFDbEMsNkNBQStCO0FBSS9CLGlFQUFpRTtBQUNqRSxpRUFBaUU7QUFDakUsMkRBQTJEO0FBQzNELEVBQUU7QUFDRixvREFBb0Q7QUFDcEQseUNBQXlDO0FBQ3pDLDhEQUE4RDtBQUM5RCwwREFBMEQ7QUFDMUQsRUFBRTtBQUNGLHNFQUFzRTtBQUN0RSxtREFBbUQ7QUFFbkQsTUFBYSxTQUFTO0NBUXJCO0FBUkQsOEJBUUM7QUFFRCxNQUFNLFdBQVcsR0FBRyxDQUFDLE1BQU0sRUFBdUIsRUFBRTtJQUNoRCxJQUFJLE9BQU8sTUFBTSxLQUFLLFdBQVc7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUNoRCxJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVE7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUM3QyxJQUFJLE9BQU8sTUFBTSxDQUFDLE1BQU0sS0FBSyxRQUFRO1dBQ2pDLE9BQU8sTUFBTSxDQUFDLEtBQUssS0FBSyxRQUFRO1dBQ2hDLE9BQU8sTUFBTSxDQUFDLElBQUksS0FBSyxRQUFRO1dBQy9CLE9BQU8sTUFBTSxDQUFDLE9BQU8sS0FBSyxRQUFRO1dBQ2xDLE9BQU8sTUFBTSxDQUFDLFVBQVUsS0FBSyxRQUFRO1dBQ3JDLE9BQU8sTUFBTSxDQUFDLGFBQWEsS0FBSyxRQUFRLEVBQUU7UUFDMUMsT0FBTyxLQUFLLENBQUM7S0FDaEI7SUFDRCxJQUFJLE9BQU8sTUFBTSxDQUFDLEtBQUssS0FBSyxXQUFXO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFDckQsSUFBSSxLQUFLLENB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QkFDWjtvQkFDRCxJQUFJLE1BQU0sR0FBYzt3QkFDcEIsTUFBTSxFQUFFLE1BQU07d0JBQ2QsS0FBSyxFQUFFLEtBQUs7d0JBQ1osSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO3dCQUMxQixPQUFPLEVBQUUsR0FBRyxDQUFDLE9BQU87d0JBQ3BCLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVTt3QkFDMUIsYUFBYSxFQUFFLGFBQWE7cUJBQy9CLENBQUM7b0JBQ0YsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRTt3QkFDdEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQkFBcUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7cUJBQ2hFO29CQUNELEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7aUJBQ3BCO3FCQUFNO29CQUNILDJFQUEyRTtpQkFDOUU7YUFDSjtTQUNKO1FBQ0QsaUVBQWlFO1FBQ2pFLHNDQUFzQztRQUN0QyxPQUFPLEdBQUcsQ0FBQztJQUNmLENBQUM7SUFFRDs7OztPQUlHO0lBQ0g7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7UUFvREk7SUFFSixLQUFLLENBQUMsS0FBSztRQUNQLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFO1lBQ3JCLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2xDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxTQUFTLENBQUM7U0FDbkM7SUFDTCxDQUFDO0NBQ0o7QUFoZUQsa0NBZ2VDIiwic291cmNlc0NvbnRlbnQiOlsiXG5pbXBvcnQge1xuICAgIHByb21pc2VzIGFzIGZzLFxuICAgIFN0YXRzXG59IGZyb20gJ2ZzJztcbmltcG9ydCB7IGRlZmF1bHQgYXMgY2hva2lkYXIgfSBmcm9tICdjaG9raWRhcic7XG5pbXBvcnQgKiBhcyBtaW1lIGZyb20gJ21pbWUnO1xuLyogY29uc3QgbWltZSA9IHsgXG4gICAgZ2V0VHlwZTogbWltZV9wa2cuZ2V0VHlwZSxcbiAgICBnZXRFeHRlbnNpb246IG1pbWVfcGtnLmdldEV4dGVuc2lvbixcbiAgICBkZWZpbmU6IG1pbWVfcGtnLmRlZmluZVxufTsgKi9cbi8vIGltcG9ydCB7IGdldFR5cGUsIGdldEV4dGVuc2lvbiwgZGVmaW5lIGFzIG1pbWVfZGVmaW5lIH0gZnJvbSAnbWltZSc7XG5pbXBvcnQgKiBhcyB1dGlsIGZyb20gJ3V0aWwnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgbWluaW1hdGNoIGZyb20gJ21pbmltYXRjaCc7XG5pbXBvcnQgKiBhcyBmYXN0cSBmcm9tICdmYXN0cSc7XG5pbXBvcnQgdHlwZSB7IHF1ZXVlQXNQcm9taXNlZCB9IGZyb20gXCJmYXN0cVwiO1xuXG5cbi8vIE5PVEUgV2Ugc2hvdWxkIG5vdCBkbyB0aGlzIGhlcmUuICBJdCBoYWQgYmVlbiBjb3BpZWQgb3ZlciBmcm9tXG4vLyBBa2FzaGFSZW5kZXIsIGJ1dCB0aGlzIGlzIGR1cGxpY2F0aXZlLCBhbmQgaXQncyBwb3NzaWJsZSB0aGVyZVxuLy8gd2lsbCBiZSBvdGhlciB1c2VycyBvZiBEaXJzV2F0Y2hlciB3aG8gZG8gbm90IHdhbnQgdGhpcy5cbi8vXG4vLyBUaGVyZSBkb2Vzbid0IHNlZW0gdG8gYmUgYW4gb2ZmaWNpYWwgcmVnaXN0cmF0aW9uXG4vLyBwZXI6IGh0dHBzOi8vYXNjaWlkb2N0b3Iub3JnL2RvY3MvZmFxL1xuLy8gcGVyOiBodHRwczovL2dpdGh1Yi5jb20vYXNjaWlkb2N0b3IvYXNjaWlkb2N0b3IvaXNzdWVzLzI1MDJcbi8vIG1pbWUuZGVmaW5lKHsndGV4dC94LWFzY2lpZG9jJzogWydhZG9jJywgJ2FzY2lpZG9jJ119KTtcbi8vXG4vLyBJbnN0ZWFkIG9mIGRlZmluaW5nIE1JTUUgdHlwZXMgaGVyZSwgd2UgYWRkZWQgYSBtZXRob2QgXCJtaW1lZGVmaW5lXCJcbi8vIHRvIGFsbG93IERpcnNXYXRjaGVyIHVzZXJzIHRvIGRlZmluZSBNSU1FIHR5cGVzLlxuXG5leHBvcnQgY2xhc3MgVlBhdGhEYXRhIHtcbiAgICBmc3BhdGg6IHN0cmluZztcbiAgICB2cGF0aDogc3RyaW5nO1xuICAgIG1pbWU6IHN0cmluZztcbiAgICBtb3VudGVkOiBzdHJpbmc7XG4gICAgbW91bnRQb2ludDogc3RyaW5nO1xuICAgIHBhdGhJbk1vdW50ZWQ6IHN0cmluZztcbiAgICBzdGFjayA/OiBWUGF0aERhdGFbXTtcbn1cblxuY29uc3QgaXNWUGF0aERhdGEgPSAodnBpbmZvKTogdnBpbmZvIGlzIFZQYXRoRGF0YSA9PiB7XG4gICAgaWYgKHR5cGVvZiB2cGluZm8gPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiB2cGluZm8gIT09ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiB2cGluZm8uZnNwYXRoICE9PSAnc3RyaW5nJ1xuICAgICB8fCB0eXBlb2YgdnBpbmZvLnZwYXRoICE9PSAnc3RyaW5nJ1xuICAgICB8fCB0eXBlb2YgdnBpbmZvLm1pbWUgIT09ICdzdHJpbmcnXG4gICAgIHx8IHR5cGVvZiB2cGluZm8ubW91bnRlZCAhPT0gJ3N0cmluZydcbiAgICAgfHwgdHlwZW9mIHZwaW5mby5tb3VudFBvaW50ICE9PSAnc3RyaW5nJ1xuICAgICB8fCB0eXBlb2YgdnBpbmZvLnBhdGhJbk1vdW50ZWQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB2cGluZm8uc3RhY2sgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gdHJ1ZTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2cGluZm8uc3RhY2spKSB7XG4gICAgICAgIGZvciAobGV0IGluZiBvZiB2cGluZm8uc3RhY2spIHtcbiAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEoaW5mKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufTtcblxudHlwZSBxdWV1ZUV2ZW50ID0ge1xuICAgIGNvZGU6IHN0cmluZztcbiAgICBmcGF0aD86IHN0cmluZztcbiAgICBzdGF0cz86IFN0YXRzO1xufTtcblxuY29uc3QgaXNRdWV1ZUV2ZW50ID0gKGV2ZW50KTogZXZlbnQgaXMgcXVldWVFdmVudCA9PiB7XG4gICAgaWYgKHR5cGVvZiBldmVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodHlwZW9mIGV2ZW50ICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuXG4gICAgaWYgKHR5cGVvZiBldmVudC5jb2RlID09PSAnc3RyaW5nJ1xuICAgICAmJiB0eXBlb2YgZXZlbnQuZnBhdGggPT09ICdzdHJpbmcnXG4gICAgICYmIChldmVudC5zdGF0cyBpbnN0YW5jZW9mIFN0YXRzKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBldmVudC5jb2RlID09PSAnc3RyaW5nJ1xuICAgICAmJiBldmVudC5jb2RlID09PSAncmVhZHknKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGV2ZW50LmNvZGUgPT09ICdzdHJpbmcnXG4gICAgICYmIGV2ZW50LmNvZGUgPT09ICd1bmxpbmsnXG4gICAgICYmIHR5cGVvZiBldmVudC5mcGF0aCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuY29uc3QgX3N5bWJfZGlycyA9IFN5bWJvbCgnZGlycycpO1xuY29uc3QgX3N5bWJfd2F0Y2hlciA9IFN5bWJvbCgnd2F0Y2hlcicpO1xuY29uc3QgX3N5bWJfbmFtZSA9IFN5bWJvbCgnbmFtZScpO1xuY29uc3QgX3N5bWJfb3B0aW9ucyA9IFN5bWJvbCgnb3B0aW9ucycpO1xuY29uc3QgX3N5bWJfY3dkID0gU3ltYm9sKCdiYXNlZGlyJyk7XG5jb25zdCBfc3ltYl9xdWV1ZSA9IFN5bWJvbCgncXVldWUnKTtcblxuZXhwb3J0IGNsYXNzIERpcnNXYXRjaGVyIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSBuYW1lIHN0cmluZyBnaXZpbmcgdGhlIG5hbWUgZm9yIHRoaXMgd2F0Y2hlclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG5hbWUpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyICR7bmFtZX0gY29uc3RydWN0b3JgKTtcbiAgICAgICAgdGhpc1tfc3ltYl9uYW1lXSA9IG5hbWU7XG4gICAgICAgIC8vIFRPRE8gaXMgdGhlcmUgYSBuZWVkIHRvIG1ha2UgdGhpcyBjdXN0b21pemFibGU/XG4gICAgICAgIHRoaXNbX3N5bWJfb3B0aW9uc10gPSB7XG4gICAgICAgICAgICBwZXJzaXN0ZW50OiB0cnVlLCBpZ25vcmVJbml0aWFsOiBmYWxzZSwgYXdhaXRXcml0ZUZpbmlzaDogdHJ1ZSwgYWx3YXlzU3RhdDogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgICB0aGlzW19zeW1iX2N3ZF0gPSB1bmRlZmluZWQ7XG4gICAgICAgIGxldCB0aGF0ID0gdGhpcztcbiAgICAgICAgY29uc3QgcTogcXVldWVBc1Byb21pc2VkPHF1ZXVlRXZlbnQ+ID0gZmFzdHEucHJvbWlzZShcbiAgICAgICAgICAgIGFzeW5jIGZ1bmN0aW9uKGV2ZW50OiBxdWV1ZUV2ZW50KSB7XG4gICAgICAgICAgICAgICAgaWYgKCFpc1F1ZXVlRXZlbnQoZXZlbnQpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSU5URVJOQUwgRVJST1Igbm90IGEgcXVldWVFdmVudCAke3V0aWwuaW5zcGVjdChldmVudCl9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChldmVudC5jb2RlID09PSAnY2hhbmdlJykge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGF0Lm9uQ2hhbmdlKGV2ZW50LmZwYXRoLCBldmVudC5zdGF0cyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC5jb2RlID09PSAnYWRkJykge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGF0Lm9uQWRkKGV2ZW50LmZwYXRoLCBldmVudC5zdGF0cyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC5jb2RlID09PSAndW5saW5rJykge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGF0Lm9uVW5saW5rKGV2ZW50LmZwYXRoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LmNvZGUgPT09ICdyZWFkeScpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhhdC5vblJlYWR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgMSk7XG4gICAgICAgIHRoaXNbX3N5bWJfcXVldWVdID0gcTtcbiAgICAgICAgdGhpc1tfc3ltYl9xdWV1ZV0uZXJyb3IoZnVuY3Rpb24oZXJyLCB0YXNrKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgRGlyc1dhdGNoZXIgJHtuYW1lfSAke3Rhc2suY29kZX0gJHt0YXNrLmZwYXRofSBjYXVnaHQgZXJyb3IgJHtlcnJ9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGdldCBkaXJzKCkgeyByZXR1cm4gdGhpc1tfc3ltYl9kaXJzXTsgfVxuICAgIGdldCBuYW1lKCkgeyByZXR1cm4gdGhpc1tfc3ltYl9uYW1lXTsgfVxuXG4gICAgLyoqXG4gICAgICogQ2hhbmdlcyB0aGUgdXNlIG9mIGFic29sdXRlIHBhdGhuYW1lcywgdG8gcGF0aHMgcmVsYXR2ZSB0byB0aGUgZ2l2ZW4gZGlyZWN0b3J5LlxuICAgICAqIFRoaXMgbXVzdCBiZSBjYWxsZWQgYmVmb3JlIHRoZSA8ZW0+d2F0Y2g8L2VtPiBtZXRob2QgaXMgY2FsbGVkLiAgVGhlIHBhdGhzXG4gICAgICogeW91IHNwZWNpZnkgdG8gd2F0Y2ggbXVzdCBiZSByZWxhdGl2ZSB0byB0aGUgZ2l2ZW4gZGlyZWN0b3J5LlxuICAgICAqL1xuICAgIHNldCBiYXNlZGlyKGN3ZCkgeyB0aGlzW19zeW1iX2N3ZF0gPSBjd2Q7IH1cblxuICAgIG1pbWVkZWZpbmUobWFwcGluZykge1xuICAgICAgICBtaW1lLmRlZmluZShtYXBwaW5nKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIHRoZSBDaG9raWRhciB3YXRjaGVyLCBiYXNlYyBvbiB0aGUgZGlyZWN0b3JpZXMgdG8gd2F0Y2guICBUaGUgPGVtPmRpcnNwZWM8L2VtPiBvcHRpb24gY2FuIGJlIGEgc3RyaW5nLFxuICAgICAqIG9yIGFuIG9iamVjdC4gIElmIGl0IGlzIGEgc3RyaW5nLCBpdCBpcyBhIGZpbGVzeXN0ZW0gcGF0aG5hbWUgdGhhdCB3aWxsIGJlXG4gICAgICogYXNzb2NpYXRlZCB3aXRoIHRoZSByb290IG9mIHRoZSB2aXJ0dWFsIGZpbGVzeXN0ZW0uICBBbiBvYmplY3Qgd2lsbCBsb29rXG4gICAgICogbGlrZSB0aGlzOlxuICAgICAqIFxuICAgICAqIDxjb2RlPlxuICAgICAqIHtcbiAgICAgKiAgIG1vdW50ZWQ6ICcvcGF0aC90by9tb3VudGVkJyxcbiAgICAgKiAgIG1vdW50UG9pbnQ6ICdtb3VudGVkJ1xuICAgICAqIH1cbiAgICAgKiA8L2NvZGU+XG4gICAgICogXG4gICAgICogVGhlIDx0dD5tb3VudFBvaW50PC90dD4gZmllbGQgaXMgYSBmdWxsIHBhdGggdG8gdGhlIGRpcmVjdG9yeSBvZiBpbnRlcmVzdC4gIFRoZVxuICAgICAqIDx0dD5tb3VudFBvaW50PC90dD4gZmllbGQgZGVzY3JpYmVzIGEgcHJlZml4IHdpdGhpbiB0aGUgdmlydHVhbCBmaWxlc3lzdGVtLlxuICAgICAqIFxuICAgICAqIEBwYXJhbSBkaXJzcGVjIFxuICAgICAqL1xuICAgIGFzeW5jIHdhdGNoKGRpcnMpIHtcbiAgICAgICAgaWYgKHRoaXNbX3N5bWJfd2F0Y2hlcl0pIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgV2F0Y2hlciBhbHJlYWR5IHN0YXJ0ZWQgZm9yICR7dGhpc1tfc3ltYl93YXRjaGVyXX1gKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIGRpcnMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBkaXJzID0gWyB7XG4gICAgICAgICAgICAgICAgc3JjOiBkaXJzLCBkZXN0OiAnLydcbiAgICAgICAgICAgIH0gXTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZGlycyA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkoZGlycykpIHtcbiAgICAgICAgICAgIGRpcnMgPSBbIGRpcnMgXTtcbiAgICAgICAgfSBlbHNlIGlmICghQXJyYXkuaXNBcnJheShkaXJzKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXRjaCAtIHRoZSBkaXJzIGFyZ3VtZW50IGlzIGluY29ycmVjdCAke3V0aWwuaW5zcGVjdChkaXJzKX1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBjb25zb2xlLmxvZyhgd2F0Y2ggZGlycz1gLCBkaXJzKTtcbiAgICAgICAgY29uc3QgdG93YXRjaCA9IFtdO1xuICAgICAgICBmb3IgKGxldCBkaXIgb2YgZGlycykge1xuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KGRpci5tb3VudGVkKTtcbiAgICAgICAgICAgIGlmICghc3RhdHMuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2F0Y2ggLSBub24tZGlyZWN0b3J5IHNwZWNpZmllZCBpbiAke3V0aWwuaW5zcGVjdChkaXIpfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdG93YXRjaC5wdXNoKGRpci5tb3VudGVkKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzW19zeW1iX2RpcnNdID0gZGlycztcblxuICAgICAgICBpZiAodGhpc1tfc3ltYl9jd2RdKSB7XG4gICAgICAgICAgICB0aGlzW19zeW1iX29wdGlvbnNdLmN3ZCA9IHRoaXNbX3N5bWJfY3dkXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXNbX3N5bWJfb3B0aW9uc10uY3dkID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpc1tfc3ltYl93YXRjaGVyXSA9IGNob2tpZGFyLndhdGNoKHRvd2F0Y2gsIHRoaXNbX3N5bWJfb3B0aW9uc10pO1xuXG4gICAgICAgIC8vIEluIHRoZSBldmVudCBoYW5kbGVycywgd2UgY3JlYXRlIHRoZSBGaWxlSW5mbyBvYmplY3QgbWF0Y2hpbmdcbiAgICAgICAgLy8gdGhlIHBhdGguICBUaGUgRmlsZUluZm8gaXMgbWF0Y2hlZCB0byBhIF9zeW1iX2RpcnMgZW50cnkuXG4gICAgICAgIC8vIElmIHRoZSBfc3ltYl9kaXJzIGVudHJ5IGhhcyA8ZW0+aWdub3JlPC9lbT4gb3IgPGVtPmluY2x1ZGU8L2VtPlxuICAgICAgICAvLyBmaWVsZHMsIHRoZSBwYXR0ZXJucyBpbiB0aG9zZSBmaWVsZHMgYXJlIHVzZWQgdG8gZGV0ZXJtaW5lIHdoZXRoZXJcbiAgICAgICAgLy8gdG8gaW5jbHVkZSBvciBpZ25vcmUgdGhpcyBmaWxlLiAgSWYgd2UgYXJlIHRvIGlnbm9yZSBpdCwgdGhlblxuICAgICAgICAvLyBmaWxlSW5mbyByZXR1cm5zIHVuZGVmaW5lZC4gIEhlbmNlLCBpbiBlYWNoIGNhc2Ugd2UgdGVzdCB3aGV0aGVyXG4gICAgICAgIC8vIDxlbT5pbmZvPC9lbT4gaGFzIGEgdmFsdWUgYmVmb3JlIGVtaXR0aW5nIHRoZSBldmVudC5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gQWxsIHRoaXMgZnVuY3Rpb24gZG9lcyBpcyB0byByZWNlaXZlIGV2ZW50cyBmcm9tIENob2tpZGFyLFxuICAgICAgICAvLyBjb25zdHJ1Y3QgRmlsZUluZm8gb2JqZWN0cywgYW5kIGVtaXQgbWF0Y2hpbmcgZXZlbnRzLlxuXG4gICAgICAgIGNvbnN0IHdhdGNoZXJfbmFtZSA9IHRoaXMubmFtZTtcblxuICAgICAgICB0aGlzW19zeW1iX3dhdGNoZXJdXG4gICAgICAgICAgICAub24oJ2NoYW5nZScsIGFzeW5jIChmcGF0aCwgc3RhdHMpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzW19zeW1iX3F1ZXVlXS5wdXNoKDxxdWV1ZUV2ZW50PntcbiAgICAgICAgICAgICAgICAgICAgY29kZTogJ2NoYW5nZScsIGZwYXRoLCBzdGF0c1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB3YXRjaGVyICR7d2F0Y2hlcl9uYW1lfSBjaGFuZ2UgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAub24oJ2FkZCcsIGFzeW5jIChmcGF0aCwgc3RhdHMpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzW19zeW1iX3F1ZXVlXS5wdXNoKDxxdWV1ZUV2ZW50PntcbiAgICAgICAgICAgICAgICAgICAgY29kZTogJ2FkZCcsIGZwYXRoLCBzdGF0c1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB3YXRjaGVyICR7d2F0Y2hlcl9uYW1lfSBhZGQgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAvKiAub24oJ2FkZERpcicsIGFzeW5jIChmcGF0aCwgc3RhdHMpID0+IHsgXG4gICAgICAgICAgICAgICAgLy8gPz8gbGV0IGluZm8gPSB0aGlzLmZpbGVJbmZvKGZwYXRoLCBzdGF0cyk7XG4gICAgICAgICAgICAgICAgLy8gPz8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIGFkZERpcmAsIGluZm8pO1xuICAgICAgICAgICAgICAgIC8vID8/IHRoaXMuZW1pdCgnYWRkRGlyJywgaW5mbyk7XG4gICAgICAgICAgICB9KSAqL1xuICAgICAgICAgICAgLm9uKCd1bmxpbmsnLCBhc3luYyBmcGF0aCA9PiB7XG4gICAgICAgICAgICAgICAgdGhpc1tfc3ltYl9xdWV1ZV0ucHVzaCg8cXVldWVFdmVudD57XG4gICAgICAgICAgICAgICAgICAgIGNvZGU6ICd1bmxpbmsnLCBmcGF0aFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB3YXRjaGVyICR7d2F0Y2hlcl9uYW1lfSB1bmxpbmsgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAvKiAub24oJ3VubGlua0RpcicsIGFzeW5jIGZwYXRoID0+IHsgXG4gICAgICAgICAgICAgICAgLy8gPz8gbGV0IGluZm8gPSB0aGlzLmZpbGVJbmZvKGZwYXRoLCBzdGF0cyk7XG4gICAgICAgICAgICAgICAgLy8gPz8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIHVubGlua0RpciAke2ZwYXRofWApO1xuICAgICAgICAgICAgICAgIC8vID8/IHRoaXMuZW1pdCgndW5saW5rRGlyJywgaW5mbyk7XG4gICAgICAgICAgICB9KSAqL1xuICAgICAgICAgICAgLm9uKCdyZWFkeScsICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzW19zeW1iX3F1ZXVlXS5wdXNoKDxxdWV1ZUV2ZW50PntcbiAgICAgICAgICAgICAgICAgICAgY29kZTogJ3JlYWR5J1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB3YXRjaGVyICR7d2F0Y2hlcl9uYW1lfSByZWFkeWApO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gdGhpcy5pc1JlYWR5ID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAvLyAgICAgdGhpc1tfc3ltYl93YXRjaGVyXS5vbigncmVhZHknLCAoKSA9PiB7IHJlc29sdmUodHJ1ZSk7IH0pO1xuICAgICAgICAvLyB9KTtcbiAgICAgICAgLy8gY29uc29sZS5sb2codGhpcy5pc1JlYWR5KTtcbiAgICB9XG5cbiAgICAvKiBDYWxjdWxhdGUgdGhlIHN0YWNrIGZvciBhIGZpbGVzeXN0ZW0gcGF0aFxuXG4gICAgT25seSBlbWl0IGlmIHRoZSBjaGFuZ2Ugd2FzIHRvIHRoZSBmcm9udC1tb3N0IGZpbGUgKi8gXG4gICAgYXN5bmMgb25DaGFuZ2UoZnBhdGg6IHN0cmluZywgc3RhdHM6IFN0YXRzKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGxldCB2cGluZm8gPSB0aGlzLnZwYXRoRm9yRlNQYXRoKGZwYXRoKTtcbiAgICAgICAgaWYgKCF2cGluZm8pIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBvbkNoYW5nZSBjb3VsZCBub3QgZmluZCBtb3VudCBwb2ludCBvciB2cGF0aCBmb3IgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc3RhY2s6IFZQYXRoRGF0YVtdID0gYXdhaXQgdGhpcy5zdGFja0ZvclZQYXRoKHZwaW5mby52cGF0aCk7XG4gICAgICAgIGlmIChzdGFjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgb25DaGFuZ2UgY291bGQgbm90IGZpbmQgbW91bnQgcG9pbnRzIGZvciAke2ZwYXRofWApO1xuICAgICAgICB9XG4gICAgICAgIGxldCBpID0gMDtcbiAgICAgICAgbGV0IGRlcHRoO1xuICAgICAgICBsZXQgZW50cnk7XG4gICAgICAgIGZvciAobGV0IHMgb2Ygc3RhY2spIHtcbiAgICAgICAgICAgIGlmIChzLmZzcGF0aCA9PT0gZnBhdGgpIHtcbiAgICAgICAgICAgICAgICBlbnRyeSA9IHM7XG4gICAgICAgICAgICAgICAgZGVwdGggPSBpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaSsrO1xuICAgICAgICB9XG4gICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgb25DaGFuZ2Ugbm8gc3RhY2sgZW50cnkgZm9yICR7ZnBhdGh9ICgke3ZwaW5mby52cGF0aH0pYCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRlcHRoID09PSAwKSB7XG4gICAgICAgICAgICB2cGluZm8uc3RhY2sgPSBzdGFjaztcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBEaXJzV2F0Y2hlciBjaGFuZ2UgJHtmcGF0aH1gKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywgdGhpcy5uYW1lLCB2cGluZm8pO1xuICAgICAgICB9XG4gICAgICAgIC8vIGxldCBpbmZvID0gdGhpcy5maWxlSW5mbyhmcGF0aCwgc3RhdHMpO1xuICAgICAgICAvLyBpZiAoaW5mbykgdGhpcy5lbWl0KCdjaGFuZ2UnLCB0aGlzLm5hbWUsIGluZm8pO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhgRGlyc1dhdGNoZXIgY2hhbmdlICR7ZnBhdGh9YCwgaW5mbyk7XG4gICAgfVxuXG4gICAgLy8gT25seSBlbWl0IGlmIHRoZSBhZGQgd2FzIHRoZSBmcm9udC1tb3N0IGZpbGVcbiAgICBhc3luYyBvbkFkZChmcGF0aDogc3RyaW5nLCBzdGF0czogU3RhdHMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgbGV0IHZwaW5mbyA9IHRoaXMudnBhdGhGb3JGU1BhdGgoZnBhdGgpO1xuICAgICAgICBpZiAoIXZwaW5mbykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYG9uQWRkIGNvdWxkIG5vdCBmaW5kIG1vdW50IHBvaW50IG9yIHZwYXRoIGZvciAke2ZwYXRofWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBvbkFkZCAke2ZwYXRofWAsIHZwaW5mbyk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBvbkFkZCAke2ZwYXRofSAke3ZwaW5mby52cGF0aH1gKTtcbiAgICAgICAgbGV0IHN0YWNrOiBWUGF0aERhdGFbXSA9IGF3YWl0IHRoaXMuc3RhY2tGb3JWUGF0aCh2cGluZm8udnBhdGgpO1xuICAgICAgICBpZiAoc3RhY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYG9uQWRkIGNvdWxkIG5vdCBmaW5kIG1vdW50IHBvaW50cyBmb3IgJHtmcGF0aH1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBjb25zb2xlLmxvZyhgb25BZGQgJHtmcGF0aH1gLCBzdGFjayk7XG4gICAgICAgIGxldCBpID0gMDtcbiAgICAgICAgbGV0IGRlcHRoO1xuICAgICAgICBsZXQgZW50cnk7XG4gICAgICAgIGZvciAobGV0IHMgb2Ygc3RhY2spIHtcbiAgICAgICAgICAgIGlmIChzLmZzcGF0aCA9PT0gZnBhdGgpIHtcbiAgICAgICAgICAgICAgICBlbnRyeSA9IHM7XG4gICAgICAgICAgICAgICAgZGVwdGggPSBpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaSsrO1xuICAgICAgICB9XG4gICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgb25BZGQgbm8gc3RhY2sgZW50cnkgZm9yICR7ZnBhdGh9ICgke3ZwaW5mby52cGF0aH0pYCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkICR7ZnBhdGh9IGRlcHRoPSR7ZGVwdGh9YCwgZW50cnkpO1xuICAgICAgICBpZiAoZGVwdGggPT09IDApIHtcbiAgICAgICAgICAgIHZwaW5mby5zdGFjayA9IHN0YWNrO1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkIEVNSVQgYWRkICR7dnBpbmZvLnZwYXRofWApO1xuICAgICAgICAgICAgLy8gZm9yIChsZXQgcyBvZiBzdGFjaykge1xuICAgICAgICAgICAgLy8gICAgY29uc29sZS5sb2coYC4uLi4gJHtzLnZwYXRofSA9PT4gJHtzLmZzcGF0aH1gKTtcbiAgICAgICAgICAgIC8vIH1cbiAgICAgICAgICAgIHRoaXMuZW1pdCgnYWRkJywgdGhpcy5uYW1lLCB2cGluZm8pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYG9uQWRkIFNLSVBQRUQgZW1pdCBldmVudCBmb3IgJHtmcGF0aH1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBsZXQgaW5mbyA9IHRoaXMuZmlsZUluZm8oZnBhdGgsIHN0YXRzKTtcbiAgICAgICAgLy8gaWYgKGluZm8pIHRoaXMuZW1pdCgnYWRkJywgdGhpcy5uYW1lLCBpbmZvKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIGFkZGAsIGluZm8pO1xuICAgICAgICBcbiAgICB9XG5cbiAgICAvKiBPbmx5IGVtaXQgaWYgaXQgd2FzIHRoZSBmcm9udC1tb3N0IGZpbGUgZGVsZXRlZFxuICAgIElmIHRoZXJlIGlzIGEgZmlsZSB1bmNvdmVyZWQgYnkgdGhpcywgdGhlbiBlbWl0IGFuIGFkZCBldmVudCBmb3IgdGhhdCAqL1xuICAgIGFzeW5jIG9uVW5saW5rKGZwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgbGV0IHZwaW5mbyA9IHRoaXMudnBhdGhGb3JGU1BhdGgoZnBhdGgpO1xuICAgICAgICBpZiAoIXZwaW5mbykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYG9uVW5saW5rIGNvdWxkIG5vdCBmaW5kIG1vdW50IHBvaW50IG9yIHZwYXRoIGZvciAke2ZwYXRofWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGxldCBzdGFjazogVlBhdGhEYXRhW10gPSBhd2FpdCB0aGlzLnN0YWNrRm9yVlBhdGgodnBpbmZvLnZwYXRoKTtcbiAgICAgICAgaWYgKHN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgLyogSWYgbm8gZmlsZXMgcmVtYWluIGluIHRoZSBzdGFjayBmb3IgdGhpcyB2aXJ0dWFsIHBhdGgsIHRoZW5cbiAgICAgICAgICAgICAqIHdlIG11c3QgZGVjbGFyZSBpdCB1bmxpbmtlZC5cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5lbWl0KCd1bmxpbmsnLCB0aGlzLm5hbWUsIHZwaW5mbyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvKiBPbiB0aGUgb3RoZXIgaGFuZCwgaWYgdGhlcmUgaXMgYW4gZW50cnkgd2Ugc2hvdWxkbid0IHNlbmRcbiAgICAgICAgICAgICAqIGFuIHVubGluayBldmVudC4gIEluc3RlYWQgaXQgc2VlbXMgbW9zdCBhcHByb3ByaWF0ZSB0byBzZW5kXG4gICAgICAgICAgICAgKiBhIGNoYW5nZSBldmVudC5cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgbGV0IHNmaXJzdCA9IHN0YWNrWzBdO1xuICAgICAgICAgICAgbGV0IHRvZW1pdCA9IDxWUGF0aERhdGE+e1xuICAgICAgICAgICAgICAgIGZzcGF0aDogc2ZpcnN0LmZzcGF0aCxcbiAgICAgICAgICAgICAgICB2cGF0aDogc2ZpcnN0LnZwYXRoLFxuICAgICAgICAgICAgICAgIG1pbWU6IG1pbWUuZ2V0VHlwZShzZmlyc3QuZnNwYXRoKSxcbiAgICAgICAgICAgICAgICBtb3VudGVkOiBzZmlyc3QubW91bnRlZCxcbiAgICAgICAgICAgICAgICBtb3VudFBvaW50OiBzZmlyc3QubW91bnRQb2ludCxcbiAgICAgICAgICAgICAgICBwYXRoSW5Nb3VudGVkOiBzZmlyc3QucGF0aEluTW91bnRlZCxcbiAgICAgICAgICAgICAgICBzdGFja1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmICghaXNWUGF0aERhdGEodG9lbWl0KSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QodG9lbWl0KX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywgdGhpcy5uYW1lLCB0b2VtaXQpO1xuICAgICAgICB9XG4gICAgICAgIC8vIGxldCBpbmZvID0gdGhpcy5maWxlSW5mbyhmcGF0aCwgdW5kZWZpbmVkKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coYERpcnNXYXRjaGVyIHVubGluayAke2ZwYXRofWApO1xuICAgICAgICAvLyBpZiAoaW5mbykgdGhpcy5lbWl0KCd1bmxpbmsnLCB0aGlzLm5hbWUsIGluZm8pO1xuICAgIH1cblxuICAgIG9uUmVhZHkoKTogdm9pZCB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdEaXJzV2F0Y2hlcjogSW5pdGlhbCBzY2FuIGNvbXBsZXRlLiBSZWFkeSBmb3IgY2hhbmdlcycpO1xuICAgICAgICB0aGlzLmVtaXQoJ3JlYWR5JywgdGhpcy5uYW1lKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGFuIG9iamVjdCByZXByZXNlbnRpbmcgYWxsIHRoZSBwYXRocyBvbiB0aGUgZmlsZSBzeXN0ZW0gYmVpbmdcbiAgICAgKiB3YXRjaGVkIGJ5IHRoaXMgRlNXYXRjaGVyIGluc3RhbmNlLiBUaGUgb2JqZWN0J3Mga2V5cyBhcmUgYWxsIHRoZSBcbiAgICAgKiBkaXJlY3RvcmllcyAodXNpbmcgYWJzb2x1dGUgcGF0aHMgdW5sZXNzIHRoZSBjd2Qgb3B0aW9uIHdhcyB1c2VkKSxcbiAgICAgKiBhbmQgdGhlIHZhbHVlcyBhcmUgYXJyYXlzIG9mIHRoZSBuYW1lcyBvZiB0aGUgaXRlbXMgY29udGFpbmVkIGluIGVhY2ggZGlyZWN0b3J5LlxuICAgICAqL1xuICAgIGdldFdhdGNoZWQoKSB7XG4gICAgICAgIGlmICh0aGlzW19zeW1iX3dhdGNoZXJdKSByZXR1cm4gdGhpc1tfc3ltYl93YXRjaGVyXS5nZXRXYXRjaGVkKCk7XG4gICAgfVxuXG4gICAgdnBhdGhGb3JGU1BhdGgoZnNwYXRoOiBzdHJpbmcpOiBWUGF0aERhdGEge1xuICAgICAgICBmb3IgKGxldCBkaXIgb2YgdGhpcy5kaXJzKSB7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIHRvIHNlZSBpZiB3ZSdyZSBzdXBwb3NlZCB0byBpZ25vcmUgdGhlIGZpbGVcbiAgICAgICAgICAgIGlmIChkaXIuaWdub3JlKSB7XG4gICAgICAgICAgICAgICAgbGV0IGlnbm9yZXM7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBkaXIuaWdub3JlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBpZ25vcmVzID0gWyBkaXIuaWdub3JlIF07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWdub3JlcyA9IGRpci5pZ25vcmU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxldCBpZ25vcmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpIG9mIGlnbm9yZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1pbmltYXRjaChmc3BhdGgsIGkpKSBpZ25vcmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgZGlyLmlnbm9yZSAke2ZzcGF0aH0gJHtpfSA9PiAke2lnbm9yZX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGlnbm9yZSkgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFRoaXMgZW5zdXJlcyB3ZSBhcmUgbWF0Y2hpbmcgb24gZGlyZWN0b3J5IGJvdW5kYXJpZXNcbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSBmc3BhdGggXCIvcGF0aC90by9sYXlvdXRzLWV4dHJhL2xheW91dC5uamtcIiBtaWdodFxuICAgICAgICAgICAgLy8gbWF0Y2ggZGlyLm1vdW50ZWQgXCIvcGF0aC90by9sYXlvdXRzXCIuXG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHZwYXRoRm9yRlNQYXRoICR7ZGlyLm1vdW50ZWR9ICR7dHlwZW9mIGRpci5tb3VudGVkfWAsIGRpcik7XG4gICAgICAgICAgICBsZXQgZGlybW91bnRlZCA9IChkaXIubW91bnRlZC5jaGFyQXQoZGlyLm1vdW50ZWQubGVuZ3RoIC0gMSkgPT0gJy8nKVxuICAgICAgICAgICAgICAgICAgICAgICAgPyBkaXIubW91bnRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgOiAoZGlyLm1vdW50ZWQgKyAnLycpO1xuICAgICAgICAgICAgaWYgKGZzcGF0aC5pbmRleE9mKGRpcm1vdW50ZWQpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgbGV0IHBhdGhJbk1vdW50ZWQgPSBmc3BhdGguc3Vic3RyaW5nKGRpci5tb3VudGVkLmxlbmd0aCkuc3Vic3RyaW5nKDEpO1xuICAgICAgICAgICAgICAgIGxldCB2cGF0aCA9IGRpci5tb3VudFBvaW50ID09PSAnLydcbiAgICAgICAgICAgICAgICAgICAgICAgID8gcGF0aEluTW91bnRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgOiBwYXRoLmpvaW4oZGlyLm1vdW50UG9pbnQsIHBhdGhJbk1vdW50ZWQpO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB2cGF0aEZvckZTUGF0aCBmc3BhdGggJHtmc3BhdGh9IGRpci5tb3VudFBvaW50ICR7ZGlyLm1vdW50UG9pbnR9IHBhdGhJbk1vdW50ZWQgJHtwYXRoSW5Nb3VudGVkfSB2cGF0aCAke3ZwYXRofWApO1xuICAgICAgICAgICAgICAgIGxldCByZXQgPSA8VlBhdGhEYXRhPntcbiAgICAgICAgICAgICAgICAgICAgZnNwYXRoOiBmc3BhdGgsXG4gICAgICAgICAgICAgICAgICAgIHZwYXRoOiB2cGF0aCxcbiAgICAgICAgICAgICAgICAgICAgbWltZTogbWltZS5nZXRUeXBlKGZzcGF0aCksXG4gICAgICAgICAgICAgICAgICAgIG1vdW50ZWQ6IGRpci5tb3VudGVkLFxuICAgICAgICAgICAgICAgICAgICBtb3VudFBvaW50OiBkaXIubW91bnRQb2ludCxcbiAgICAgICAgICAgICAgICAgICAgcGF0aEluTW91bnRlZFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YShyZXQpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBWUGF0aERhdGEgJHt1dGlsLmluc3BlY3QocmV0KX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBObyBkaXJlY3RvcnkgZm91bmQgZm9yIHRoaXMgZmlsZVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGFzeW5jIHN0YWNrRm9yVlBhdGgodnBhdGg6IHN0cmluZyk6IFByb21pc2U8VlBhdGhEYXRhW10+IHtcbiAgICAgICAgY29uc3QgcmV0OiBWUGF0aERhdGFbXSA9IFtdO1xuICAgICAgICBmb3IgKGxldCBkaXIgb2YgdGhpcy5kaXJzKSB7XG4gICAgICAgICAgICBpZiAoZGlyLm1vdW50UG9pbnQgPT09ICcvJykge1xuICAgICAgICAgICAgICAgIGxldCBwYXRoSW5Nb3VudGVkID0gdnBhdGg7XG4gICAgICAgICAgICAgICAgbGV0IGZzcGF0aCA9IHBhdGguam9pbihkaXIubW91bnRlZCwgcGF0aEluTW91bnRlZCk7XG4gICAgICAgICAgICAgICAgbGV0IHN0YXRzO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRzID0gYXdhaXQgZnMuc3RhdChmc3BhdGgpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBzdGF0cyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFzdGF0cykgY29udGludWU7XG4gICAgICAgICAgICAgICAgbGV0IHRvcHVzaCA9IDxWUGF0aERhdGE+e1xuICAgICAgICAgICAgICAgICAgICBmc3BhdGg6IGZzcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgdnBhdGg6IHZwYXRoLFxuICAgICAgICAgICAgICAgICAgICBtaW1lOiBtaW1lLmdldFR5cGUoZnNwYXRoKSxcbiAgICAgICAgICAgICAgICAgICAgbW91bnRlZDogZGlyLm1vdW50ZWQsXG4gICAgICAgICAgICAgICAgICAgIG1vdW50UG9pbnQ6IGRpci5tb3VudFBvaW50LFxuICAgICAgICAgICAgICAgICAgICBwYXRoSW5Nb3VudGVkOiBwYXRoSW5Nb3VudGVkXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBpZiAoIWlzVlBhdGhEYXRhKHRvcHVzaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFZQYXRoRGF0YSAke3V0aWwuaW5zcGVjdCh0b3B1c2gpfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXQucHVzaCh0b3B1c2gpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXQgZGlybW91bnRwdCA9IChkaXIubW91bnRQb2ludC5jaGFyQXQoZGlyLm1vdW50UG9pbnQubGVuZ3RoIC0gMSkgPT0gJy8nKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gZGlyLm1vdW50UG9pbnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IChkaXIubW91bnRQb2ludCArICcvJyk7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYHN0YWNrRm9yVlBhdGggdnBhdGggJHt2cGF0aH0gZGlyLm1vdW50ZWQgJHtkaXIubW91bnRQb2ludH0gZGlybW91bnRwdCAke2Rpcm1vdW50cHR9YCk7XG4gICAgICAgICAgICAgICAgaWYgKHZwYXRoLmluZGV4T2YoZGlybW91bnRwdCkgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gPiBjb25zdCB2cGF0aCA9ICdmb28vYmFyL2Jhei5odG1sJztcbiAgICAgICAgICAgICAgICAgICAgLy8gPiBjb25zdCBtID0gJ2Zvby9iYXInO1xuICAgICAgICAgICAgICAgICAgICAvLyA+IGxldCBwYXRoSW5Nb3VudGVkID0gdnBhdGguc3Vic3RyaW5nKG0ubGVuZ3RoICsgMSk7XG4gICAgICAgICAgICAgICAgICAgIC8vID4gcGF0aEluTW91bnRlZFxuICAgICAgICAgICAgICAgICAgICAvLyAnYmF6Lmh0bWwnXG4gICAgICAgICAgICAgICAgICAgIGxldCBwYXRoSW5Nb3VudGVkID0gdnBhdGguc3Vic3RyaW5nKGRpcm1vdW50cHQubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGZzcGF0aCA9IHBhdGguam9pbihkaXIubW91bnRlZCwgcGF0aEluTW91bnRlZCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBzdGFja0ZvclZQYXRoIHZwYXRoICR7dnBhdGh9IHBhdGhJbk1vdW50ZWQgJHtwYXRoSW5Nb3VudGVkfSBmc3BhdGggJHtmc3BhdGh9YCk7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzdGF0cztcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzID0gYXdhaXQgZnMuc3RhdChmc3BhdGgpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICghc3RhdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBzdGFja0ZvclZQYXRoIHZwYXRoICR7dnBhdGh9IGRpZCBub3QgZmluZCBmcy5zdGF0cyBmb3IgJHtmc3BhdGh9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsZXQgdG9wdXNoID0gPFZQYXRoRGF0YT57XG4gICAgICAgICAgICAgICAgICAgICAgICBmc3BhdGg6IGZzcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZwYXRoOiB2cGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pbWU6IG1pbWUuZ2V0VHlwZShmc3BhdGgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbW91bnRlZDogZGlyLm1vdW50ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBtb3VudFBvaW50OiBkaXIubW91bnRQb2ludCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGhJbk1vdW50ZWQ6IHBhdGhJbk1vdW50ZWRcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFpc1ZQYXRoRGF0YSh0b3B1c2gpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgVlBhdGhEYXRhICR7dXRpbC5pbnNwZWN0KHRvcHVzaCl9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0LnB1c2godG9wdXNoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgc3RhY2tGb3JWUGF0aCB2cGF0aCAke3ZwYXRofSBkaWQgbm90IG1hdGNoICR7ZGlybW91bnRwdH1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gKGtub2NrIG9uIHdvb2QpIEV2ZXJ5IGVudHJ5IGluIGByZXRgIGhhcyBhbHJlYWR5IGJlZW4gdmVyaWZpZWRcbiAgICAgICAgLy8gYXMgYmVpbmcgYSBjb3JyZWN0IFZQYXRoRGF0YSBvYmplY3RcbiAgICAgICAgcmV0dXJuIHJldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0IGRhdGEgd2UgZ2F0aGVyIGFib3V0IGEgZmlsZSBpbiB0aGUgZmlsZSBzeXN0ZW0gaW50byBhIGRlc2NyaXB0b3Igb2JqZWN0LlxuICAgICAqIEBwYXJhbSBmc3BhdGggXG4gICAgICogQHBhcmFtIHN0YXRzIFxuICAgICAqL1xuICAgIC8qIGZpbGVJbmZvKGZzcGF0aCwgc3RhdHMpIHtcbiAgICAgICAgbGV0IGUgPSB0aGlzLmRpckZvclBhdGgoZnNwYXRoKTtcbiAgICAgICAgaWYgKCFlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vIG1vdW50UG9pbnQgZm91bmQgZm9yICR7ZnNwYXRofWApO1xuICAgICAgICB9XG4gICAgICAgIGxldCBmbkluU291cmNlRGlyID0gZnNwYXRoLnN1YnN0cmluZyhlLnBhdGgubGVuZ3RoKS5zdWJzdHJpbmcoMSk7XG4gICAgICAgIGxldCBkb2NwYXRoID0gcGF0aC5qb2luKGUubW91bnRQb2ludCwgZm5JblNvdXJjZURpcik7XG4gICAgICAgIGlmIChkb2NwYXRoLnN0YXJ0c1dpdGgoJy8nKSkge1xuICAgICAgICAgICAgZG9jcGF0aCA9IGRvY3BhdGguc3Vic3RyaW5nKDEpO1xuICAgICAgICB9XG4gICAgICAgIGxldCBpZ25vcmUgPSBmYWxzZTtcbiAgICAgICAgbGV0IGluY2x1ZGUgPSB0cnVlO1xuICAgICAgICBpZiAoZS5pZ25vcmUpIHtcbiAgICAgICAgICAgIGxldCBpZ25vcmVzO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBlLmlnbm9yZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBpZ25vcmVzID0gWyBlLmlnbm9yZSBdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZ25vcmVzID0gZS5pZ25vcmU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBpIG9mIGlnbm9yZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAobWluaW1hdGNoKGZuSW5Tb3VyY2VEaXIsIGkpKSBpZ25vcmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBlLmlnbm9yZSAke2ZuSW5Tb3VyY2VEaXJ9ICR7aX0gPT4gJHtpZ25vcmV9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGUuaW5jbHVkZSkge1xuICAgICAgICAgICAgaW5jbHVkZSA9IGZhbHNlO1xuICAgICAgICAgICAgbGV0IGluY2x1ZGVycztcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZS5pbmNsdWRlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGluY2x1ZGVycyA9IFsgZS5pbmNsdWRlIF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGluY2x1ZGVycyA9IGUuaW5jbHVkZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgb2YgaW5jbHVkZXJzKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1pbmltYXRjaChmbkluU291cmNlRGlyLCBpKSkgaW5jbHVkZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYGUuaW5jbHVkZSAke2ZuSW5Tb3VyY2VEaXJ9ICR7aX0gPT4gJHtpbmNsdWRlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChpZ25vcmUgfHwgIWluY2x1ZGUpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGZzcGF0aDogZnNwYXRoLFxuICAgICAgICAgICAgICAgIG1pbWU6IG1pbWUuZ2V0VHlwZShmc3BhdGgpLFxuICAgICAgICAgICAgICAgIGJhc2VNZXRhZGF0YTogZS5iYXNlTWV0YWRhdGEsXG4gICAgICAgICAgICAgICAgc291cmNlUGF0aDogZS5wYXRoLFxuICAgICAgICAgICAgICAgIG1vdW50UG9pbnQ6IGUubW91bnRQb2ludCxcbiAgICAgICAgICAgICAgICBwYXRoSW5Tb3VyY2U6IGZuSW5Tb3VyY2VEaXIsXG4gICAgICAgICAgICAgICAgcGF0aDogZG9jcGF0aCxcbiAgICAgICAgICAgICAgICBpc0RpcmVjdG9yeTogc3RhdHMuaXNEaXJlY3RvcnkoKSxcbiAgICAgICAgICAgICAgICBzdGF0c1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH0gKi9cblxuICAgIGFzeW5jIGNsb3NlKCkge1xuICAgICAgICBpZiAodGhpc1tfc3ltYl93YXRjaGVyXSkge1xuICAgICAgICAgICAgYXdhaXQgdGhpc1tfc3ltYl93YXRjaGVyXS5jbG9zZSgpO1xuICAgICAgICAgICAgdGhpc1tfc3ltYl93YXRjaGVyXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIH1cbn1cbiJdfQ==