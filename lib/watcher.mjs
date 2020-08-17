
import { default as chokidar } from 'chokidar';
import { default as ForerunnerDB } from 'forerunnerdb';
import { default as mime } from 'mime';
import * as util from 'util';
import * as path from 'path';

// There doesn't seem to be an official registration
// per: https://asciidoctor.org/docs/faq/
// per: https://github.com/asciidoctor/asciidoctor/issues/2502
mime.define({'text/x-asciidoc': ['adoc', 'asciidoc']});

const fdb = new ForerunnerDB();

const _symb_dirs = Symbol('dirs');
const _symb_watcher = Symbol('watcher');
const _symb_db = Symbol('db');
const _symb_collection = Symbol('collection');
const _symb_persistPath = Symbol('persist');

// dirs -- must be an array of:
//
//      { path, mountPoint }


export class DirsWatcher {
    /**
     * 
     * @param dirs array of directories and mount points to watch
     * @param collection string giving the name for this watcher collection
     * @param persistPath string giving the location to persist this collection
     */
    constructor(dirs, collection, persistPath) {
        this[_symb_dirs] = dirs;
        this[_symb_collection] = collection;
        this[_symb_persistPath] = persistPath;
    }

    async dbinit() {
        this[_symb_db] = fdb.db(this[_symb_collection]);
        this[_symb_db].persist.dataDir(this[_symb_persistPath]);
        await new Promise((resolve, reject) => {
            this[_symb_db].collection('filez').load(function (err) {
                if (!err) resolve();
                else reject(`Failed to load ${this[_symb_collection]} because ${err}`);
            });
        });
    }

    findMount(fspath) {
        let e;
        for (let entry of this[_symb_dirs]) {
            if (fspath.indexOf(entry.path) === 0) {
                e = entry;
                break;
            }
        }
        if (!e) {
            throw new Error(`No mountPoint found for ${fspath}`);
        }
        let nmWithinRoot = fspath.substring(e.path.length).substring(1);
        let docpath = path.join(e.mountPoint, nmWithinRoot);
        if (docpath.startsWith('/')) {
            docpath = docpath.substring(1);
        }
        return {
            fspath: fspath,
            rootPath: e.path,
            mountPoint: e.mountPoint,
            pathInRoot: nmWithinRoot,
            path: docpath,
            fspath: fspath,
            mime: mime.getType(fspath)
        };
    }

    start() {
        if (this[_symb_watcher]) {
            throw new Error(`Watcher already started for ${this[_symb_watcher]}`);
        }
        let towatch = this[_symb_dirs].map(item => {
            return item.path;
        })
        this[_symb_watcher] = chokidar.watch(towatch, {
            persistent: true, ignoreInitial: false
        });

        this[_symb_watcher]
            .on('change', async (fpath, stats) => { 
                console.log(`PreviewServer change ${fpath}`);
            })
            .on('add', async (fpath, stats) => {
                let mount = this.findMount(fpath);
                console.log(`PreviewServer add`, mount);
            })
            .on('addDir', async (fpath, stats) => { 
                let mount = this.findMount(fpath);
                console.log(`PreviewServer addDir`, mount);
            })
            .on('unlink', async fpath => { 
                    console.log(`PreviewServer unlink ${fpath}`);
            })
            .on('unlinkDir', async fpath => { 
                    console.log(`PreviewServer unlinkDir ${fpath}`);
            })
            .on('ready', () => {
                console.log('Initial scan complete. Ready for changes');
            });
    }

    async close() {
        if (this[_symb_watcher]) {
            await this[_symb_watcher].close();
            this[_symb_watcher] = undefined;
        }
    }

}