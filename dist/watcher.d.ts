/// <reference types="node" />
import { EventEmitter } from 'events';
export declare function mimedefine(mapping: any, force?: boolean): void;
export declare class VPathData {
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
     * The file-system stack related to the file.
     */
    stack?: VPathData[];
}
/**
 * Typeguard function ensuring that an object
 * is a VPathData object.
 * @param vpinfo The object to check
 * @returns true if it is a VPathData, false otherwise
 */
export declare const isVPathData: (vpinfo: any) => vpinfo is VPathData;
export declare class DirsWatcher extends EventEmitter {
    /**
     * @param name string giving the name for this watcher
     */
    constructor(name: any);
    /**
     * Retrieves the directory stack for
     * this Watcher.
     */
    get dirs(): any;
    /**
     * Retrieves the name for this Watcher
     */
    get name(): any;
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
    watch(dirs: any): Promise<void>;
    onChange(fpath: string): Promise<void>;
    onAdd(fpath: string): Promise<void>;
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