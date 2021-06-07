
import { promises as fs } from 'fs';
import { default as chokidar } from 'chokidar';
import { default as mime } from 'mime';
import * as util from 'util';
import * as path from 'path';
import EventEmitter from 'events';
import minimatch from 'minimatch';

// There doesn't seem to be an official registration
// per: https://asciidoctor.org/docs/faq/
// per: https://github.com/asciidoctor/asciidoctor/issues/2502
mime.define({'text/x-asciidoc': ['adoc', 'asciidoc']});

const _symb_dirs = Symbol('dirs');
const _symb_watcher = Symbol('watcher');
const _symb_name = Symbol('name');
const _symb_options = Symbol('options');
const _symb_cwd = Symbol('basedir');

export class DirsWatcher extends EventEmitter {

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
        this.isReady = false;
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
            dirs = [ {
                src: dirspec, dest: '/'
            } ];
        } else if (typeof dirs === 'object' && !Array.isArray(dirs)) {
            dirs = [ dirs ];
        } else if (!Array.isArray(dirs)) {
            throw new Error(`watch - the dirs argument is incorrect ${util.inspect(dirs)}`);
        }
        console.log(`watch dirs=`, dirs);
        const towatch = [];
        for (let dir of dirs) {
            const stats = await fs.stat(dir.mounted);
            if (!stats.isDirectory()) {
                throw new Error(`watch - non-directory specified in ${util.inspect(dir)}`);
            }
            towatch.push(dir.mounted);
        }
        this[_symb_dirs] = dirs;

        if (this[_symb_cwd]) {
            this[_symb_options].cwd = this[_symb_cwd];
        } else {
            this[_symb_options].cwd = undefined;
        }

        this[_symb_watcher] = chokidar.watch(towatch, this[_symb_options]);

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

        this[_symb_watcher]
            .on('change', async (fpath, stats) => { this.onChange(fpath, stats); })
            .on('add', async (fpath, stats) => { this.onAdd(fpath, stats); })
            /* .on('addDir', async (fpath, stats) => { 
                // ?? let info = this.fileInfo(fpath, stats);
                // ?? console.log(`DirsWatcher addDir`, info);
                // ?? this.emit('addDir', info);
            }) */
            .on('unlink', async fpath => { this.onUnlink(fpath); })
            /* .on('unlinkDir', async fpath => { 
                // ?? let info = this.fileInfo(fpath, stats);
                // ?? console.log(`DirsWatcher unlinkDir ${fpath}`);
                // ?? this.emit('unlinkDir', info);
            }) */
            .on('ready', () => { this.onReady(); });

        this.isReady = new Promise((resolve, reject) => {
            this[_symb_watcher].on('ready', () => { resolve(true); });
        });
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
    async onUnlink(fpath) {
        let vpinfo = this.vpathForFSPath(fpath);
        if (!vpinfo) {
            console.log(`onUnlink could not find mount point or vpath for ${fpath}`);
            return;
        }
        let stack = await this.stackForVPath(vpinfo.vpath);
        if (stack.length === 0) {
            throw new Error(`onUnlink could not find mount points for ${fpath}`);
        }
        if (stack.length === 0) {
            /* If no files remain in the stack for this virtual path, then
             * we must declare it unlinked.
             */
            this.emit('unlink', this.name, vpinfo);
        } else {
            /* On the other hand, if there is an entry we shouldn't send
             * an unlink event.  Instead it seems most appropriate to send
             * a change event.
             */
            let sfirst = stack[0];
            this.emit('change', this.name, {
                fspath: sfirst.fspath,
                vpath: sfirst.vpath,
                mime: mime.getType(sfirst.fspath),
                mounted: sfirst.mounted,
                mountPoint: sfirst.mountPoint,
                pathInMounted: sfirst.pathInMounted,
                stack
            });
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
        if (this[_symb_watcher]) return this[_symb_watcher].getWatched();
    }

    vpathForFSPath(fspath) {
        for (let dir of this.dirs) {

            // Check to see if we're supposed to ignore the file
            if (dir.ignore) {
                let ignores;
                if (typeof dir.ignore === 'string') {
                    ignores = [ dir.ignore ];
                } else {
                    ignores = dir.ignore;
                }
                let ignore = false;
                for (let i of ignores) {
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
            let dirmounted = (dir.mounted.charAt(dir.mounted.length - 1) == '/')
                        ? dir.mounted
                        : (dir.mounted + '/');
            if (fspath.indexOf(dirmounted) === 0) {
                let pathInMounted = fspath.substring(dir.mounted.length).substring(1);
                let vpath = dir.mountPoint === '/'
                        ? pathInMounted
                        : path.join(dir.mountPoint, pathInMounted);
                // console.log(`vpathForFSPath fspath ${fspath} dir.mountPoint ${dir.mountPoint} pathInMounted ${pathInMounted} vpath ${vpath}`);
                return {
                    fspath: fspath,
                    vpath: vpath,
                    mime: mime.getType(fspath),
                    mounted: dir.mounted,
                    mountPoint: dir.mountPoint,
                    pathInMounted
                };
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
                    stats = await fs.stat(fspath);
                } catch (err) {
                    stats = undefined;
                }
                if (!stats) continue;
                ret.push({
                    fspath: fspath,
                    vpath: vpath,
                    mime: mime.getType(fspath),
                    mounted: dir.mounted,
                    mountPoint: dir.mountPoint,
                    pathInMounted: pathInMounted
                });
            } else {
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
                        stats = await fs.stat(fspath);
                    } catch (err) {
                        stats = undefined;
                    }
                    if (!stats) {
                        // console.log(`stackForVPath vpath ${vpath} did not find fs.stats for ${fspath}`);
                        continue;
                    }
                    ret.push({
                        fspath: fspath,
                        vpath: vpath,
                        mime: mime.getType(fspath),
                        mounted: dir.mounted,
                        mountPoint: dir.mountPoint,
                        pathInMounted: pathInMounted
                    });
                } else {
                    // console.log(`stackForVPath vpath ${vpath} did not match ${dirmountpt}`);
                }
            }
        }
        return ret;
    }

    /* dirForPath(fspath) {
        let e;
        for (let entry of this.dirs) {
            // console.log(`dirForPath fspath ${fspath} path ${entry.path} ${fspath.indexOf(entry.path+'/')}`)
            if (fspath.indexOf(entry.path+'/') === 0) {
                e = entry;
                break;
            }
        }
        return e;
    } */

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
