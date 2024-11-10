import { Stats } from 'node:fs';
import { EventEmitter } from 'node:events';
export declare function mimedefine(mapping: any, force?: boolean): void;
export type VPathData = {
    /**
     * The full file-system path for the file.
     * e.g. /home/path/to/article-name.html.md
     */
    fspath: string;
    /**
     * The virtual path, rooted at the top
     * directory of the filesystem, with no
     * leading slash.
     */
    vpath: string;
    /**
     * The mime type of the file.  The mime types
     * are determined from the file extension
     * using the 'mime' package.
     */
    mime?: string;
    /**
     * The file-system path which is mounted
     * into the virtual file space.
     */
    mounted: string;
    /**
     * The virtual directory of the mount
     * entry in the directory stack.
     */
    mountPoint: string;
    /**
     * The relative path underneath the mountPoint.
     */
    pathInMounted: string;
    /**
     * The mTime value from Stats
     */
    statsMtime: number;
    /**
     * The file-system stack related to the file.
     */
    stack?: VPathData[];
};
/**
 * Typeguard function ensuring that an object
 * is a VPathData object.
 * @param vpinfo The object to check
 * @returns true if it is a VPathData, false otherwise
 */
export declare const isVPathData: (vpinfo: any) => vpinfo is VPathData;
export type dirToWatch = {
    /**
     * The filesystem path to "mount".
     */
    mounted: string;
    /**
     * The path within the virtual filesystem where this will appear.
     */
    mountPoint: string;
    /**
     * Metadata object to use within the
     * sub-hierarchy.
     */
    baseMetadata?: any;
    /**
     * Optional array of strings containing globs for matching
     * files to ignore.
     */
    ignore?: string[];
};
/**
 * Determine whether the {@code dir} is a {@code dirToWatch}.
 */
export declare const isDirToWatch: (dir: any) => dir is dirToWatch;
export declare class DirsWatcher extends EventEmitter {
    #private;
    /**
     * @param name string giving the name for this watcher
     */
    constructor(name: string);
    /**
     * Retrieves the directory stack for
     * this Watcher.
     */
    get dirs(): dirToWatch[] | undefined;
    /**
     * Retrieves the name for this Watcher
     */
    get name(): string;
    /**
     * Changes the use of absolute pathnames, to paths relatve to the given directory.
     * This must be called before the <em>watch</em> method is called.  The paths
     * you specify to watch must be relative to the given directory.
     */
    set basedir(cwd: any);
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
    watch(dirs: dirToWatch[] | string): Promise<void>;
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
    getWatched(): Record<string, string[]>;
    vpathForFSPath(fspath: string, stats?: Stats): VPathData;
    stackForVPath(vpath: string): Promise<VPathData[]>;
    close(): Promise<void>;
}
//# sourceMappingURL=watcher.d.ts.map