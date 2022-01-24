/// <reference types="node" />
import { Stats } from 'fs';
import { EventEmitter } from 'events';
export declare class VPathData {
    fspath: string;
    vpath: string;
    mime: string;
    mounted: string;
    mountPoint: string;
    pathInMounted: string;
    stack?: VPathData[];
}
export declare class DirsWatcher extends EventEmitter {
    /**
     * @param name string giving the name for this watcher
     */
    constructor(name: any);
    get dirs(): any;
    get name(): any;
    /**
     * Changes the use of absolute pathnames, to paths relatve to the given directory.
     * This must be called before the <em>watch</em> method is called.  The paths
     * you specify to watch must be relative to the given directory.
     */
    set basedir(cwd: any);
    mimedefine(mapping: any): void;
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
    watch(dirs: any): Promise<void>;
    onChange(fpath: string, stats: Stats): Promise<void>;
    onAdd(fpath: string, stats: Stats): Promise<void>;
    onUnlink(fpath: string): Promise<void>;
    onReady(): void;
    /**
     * Returns an object representing all the paths on the file system being
     * watched by this FSWatcher instance. The object's keys are all the
     * directories (using absolute paths unless the cwd option was used),
     * and the values are arrays of the names of the items contained in each directory.
     */
    getWatched(): any;
    vpathForFSPath(fspath: string): VPathData;
    stackForVPath(vpath: string): Promise<VPathData[]>;
    /**
     * Convert data we gather about a file in the file system into a descriptor object.
     * @param fspath
     * @param stats
     */
    close(): Promise<void>;
}
//# sourceMappingURL=watcher.d.ts.map