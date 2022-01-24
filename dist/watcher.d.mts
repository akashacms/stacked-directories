export class DirsWatcher {
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
    set basedir(arg: any);
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
    onChange(fpath: any, stats: any): Promise<void>;
    onAdd(fpath: any, stats: any): Promise<void>;
    onUnlink(fpath: any): Promise<void>;
    onReady(): void;
    /**
     * Returns an object representing all the paths on the file system being
     * watched by this FSWatcher instance. The object's keys are all the
     * directories (using absolute paths unless the cwd option was used),
     * and the values are arrays of the names of the items contained in each directory.
     */
    getWatched(): any;
    vpathForFSPath(fspath: any): {
        fspath: any;
        vpath: any;
        mime: any;
        mounted: any;
        mountPoint: any;
        pathInMounted: any;
    };
    stackForVPath(vpath: any): Promise<{
        fspath: string;
        vpath: any;
        mime: any;
        mounted: any;
        mountPoint: any;
        pathInMounted: any;
    }[]>;
    /**
     * Convert data we gather about a file in the file system into a descriptor object.
     * @param fspath
     * @param stats
     */
    close(): Promise<void>;
    [_symb_name]: any;
    [_symb_options]: {
        persistent: boolean;
        ignoreInitial: boolean;
        awaitWriteFinish: boolean;
        alwaysStat: boolean;
    };
    [_symb_cwd]: any;
    [_symb_queue]: any;
    [_symb_dirs]: any;
    [_symb_watcher]: any;
}
declare const _symb_name: unique symbol;
declare const _symb_options: unique symbol;
declare const _symb_cwd: unique symbol;
declare const _symb_queue: unique symbol;
declare const _symb_dirs: unique symbol;
declare const _symb_watcher: unique symbol;
export {};
//# sourceMappingURL=watcher.d.mts.map