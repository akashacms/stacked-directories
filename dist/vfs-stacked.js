var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _VFStacked_name, _VFStacked_dirs, _VFStacked_watcher, _VFStacked_queue;
import util from 'node:util';
import { DirsWatcher } from './watcher.js';
import EventEmitter from 'events';
/**
 * An object which listens to a DirsWatcher configuration,
 * and stores data about the files within the
 * defined virtual filespace.
 *
 * TBD - Overridable functions for persisting the data.
 *    The default will be storing in a Map<string, VPathData>
 */
export class VFStacked extends EventEmitter {
    constructor(name, dirs) {
        super();
        _VFStacked_name.set(this, void 0);
        _VFStacked_dirs.set(this, void 0);
        _VFStacked_watcher.set(this, void 0);
        _VFStacked_queue.set(this, void 0);
        __classPrivateFieldSet(this, _VFStacked_name, name, "f");
        __classPrivateFieldSet(this, _VFStacked_dirs, dirs, "f");
    }
    get name() { return __classPrivateFieldGet(this, _VFStacked_name, "f"); }
    get dirs() { return __classPrivateFieldGet(this, _VFStacked_dirs, "f"); }
    async close() {
        if (__classPrivateFieldGet(this, _VFStacked_queue, "f")) {
            __classPrivateFieldGet(this, _VFStacked_queue, "f").killAndDrain();
            __classPrivateFieldSet(this, _VFStacked_queue, undefined, "f");
        }
        if (__classPrivateFieldGet(this, _VFStacked_watcher, "f")) {
            // console.log(`CLOSING ${this.name}`);
            await __classPrivateFieldGet(this, _VFStacked_watcher, "f").close();
            __classPrivateFieldSet(this, _VFStacked_watcher, undefined, "f");
        }
        this.removeAllListeners('changed');
        this.removeAllListeners('added');
        this.removeAllListeners('unlinked');
        this.removeAllListeners('ready');
        // await sqdb.close();
    }
    /**
     * Set up receiving events from DirsWatcher, and dispatching to
     * the handler methods.
     */
    async setup() {
        __classPrivateFieldSet(this, _VFStacked_watcher, new DirsWatcher(this.name), "f");
        __classPrivateFieldGet(this, _VFStacked_watcher, "f").on('change', async (name, info) => {
            // console.log(`${name} changed ${info.mountPoint} ${info.vpath}`);
            try {
                if (!this.ignoreFile(info)) {
                    // console.log(`PUSH ${name} changed ${info.mountPoint} ${info.vpath}`);
                    // TBD store the change to the file information
                }
                else {
                    console.log(`Ignored 'change' for ${info.vpath}`);
                }
            }
            catch (err) {
                console.error(`FAIL change ${info.vpath} because ${err.stack}`);
            }
        })
            .on('add', async (name, info) => {
            try {
                // console.log(`${name} add ${info.mountPoint} ${info.vpath}`);
                if (!this.ignoreFile(info)) {
                    // console.log(`PUSH ${name} add ${info.mountPoint} ${info.vpath}`);
                    // TBD Store the file information
                }
                else {
                    console.log(`Ignored 'add' for ${info.vpath}`);
                }
            }
            catch (err) {
                console.error(`FAIL add ${info.vpath} because ${err.stack}`);
            }
        })
            .on('unlink', async (name, info) => {
            // console.log(`unlink ${name} ${info.vpath}`);
            try {
                if (!this.ignoreFile(info)) {
                    // TBD delete the file information
                }
                else {
                    console.log(`Ignored 'unlink' for ${info.vpath}`);
                }
            }
            catch (err) {
                console.error(`FAIL unlink ${info.vpath} because ${err.stack}`);
            }
        })
            .on('ready', async (name) => {
            // console.log(`${name} ready`);
            // TBD record that it is "ready"
        });
        const mapped = remapdirs(this.dirs);
        // console.log(`setup ${this.#name} watch ${util.inspect(this.#dirs)} ==> ${util.inspect(mapped)}`);
        await __classPrivateFieldGet(this, _VFStacked_watcher, "f").watch(mapped);
        // console.log(`DAO ${this.dao.table.name} ${util.inspect(this.dao.table.fields)}`);
    }
    /**
     * Should this file be ignored, based on the `ignore` field
     * in the matching `dir` mount entry.
     *
     * @param {*} info
     * @returns
     */
    ignoreFile(info) {
        // TBD determine if the file is to be ignored
        return false;
    }
}
_VFStacked_name = new WeakMap(), _VFStacked_dirs = new WeakMap(), _VFStacked_watcher = new WeakMap(), _VFStacked_queue = new WeakMap();
// Convert AkashaCMS mount points into the mountpoint
// used by DirsWatcher
const remapdirs = dirz => {
    return dirz.map(dir => {
        // console.log('document dir ', dir);
        if (typeof dir === 'string') {
            return {
                mounted: dir,
                mountPoint: '/',
                baseMetadata: {}
            };
        }
        else {
            if (!dir.dest) {
                throw new Error(`remapdirs invalid mount specification ${util.inspect(dir)}`);
            }
            return {
                mounted: dir.src,
                mountPoint: dir.dest,
                baseMetadata: dir.baseMetadata,
                ignore: dir.ignore
            };
        }
    });
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmZzLXN0YWNrZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9saWIvdmZzLXN0YWNrZWQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQ0EsT0FBTyxJQUFJLE1BQU0sV0FBVyxDQUFDO0FBQzdCLE9BQU8sRUFBRSxXQUFXLEVBQXlCLE1BQU0sY0FBYyxDQUFDO0FBQ2xFLE9BQU8sWUFBWSxNQUFNLFFBQVEsQ0FBQztBQVNsQzs7Ozs7OztHQU9HO0FBQ0gsTUFBTSxPQUFPLFNBQVUsU0FBUSxZQUFZO0lBS3ZDLFlBQ0ksSUFBYSxFQUNiLElBQW1CO1FBRW5CLEtBQUssRUFBRSxDQUFDO1FBUFosa0NBQWU7UUFDZixrQ0FBcUI7UUFjckIscUNBQXNCO1FBQ3RCLG1DQUFPO1FBUkgsdUJBQUEsSUFBSSxtQkFBUyxJQUFJLE1BQUEsQ0FBQztRQUNsQix1QkFBQSxJQUFJLG1CQUFTLElBQUksTUFBQSxDQUFDO0lBQ3RCLENBQUM7SUFFRCxJQUFJLElBQUksS0FBVyxPQUFPLHVCQUFBLElBQUksdUJBQU0sQ0FBQyxDQUFDLENBQUM7SUFDdkMsSUFBSSxJQUFJLEtBQVcsT0FBTyx1QkFBQSxJQUFJLHVCQUFNLENBQUMsQ0FBQyxDQUFDO0lBS3ZDLEtBQUssQ0FBQyxLQUFLO1FBQ1AsSUFBSSx1QkFBQSxJQUFJLHdCQUFPLEVBQUUsQ0FBQztZQUNkLHVCQUFBLElBQUksd0JBQU8sQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUMzQix1QkFBQSxJQUFJLG9CQUFVLFNBQVMsTUFBQSxDQUFDO1FBQzVCLENBQUM7UUFDRCxJQUFJLHVCQUFBLElBQUksMEJBQVMsRUFBRSxDQUFDO1lBQ2hCLHVDQUF1QztZQUN2QyxNQUFNLHVCQUFBLElBQUksMEJBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUM1Qix1QkFBQSxJQUFJLHNCQUFZLFNBQVMsTUFBQSxDQUFDO1FBQzlCLENBQUM7UUFDRCxJQUFJLENBQUMsa0JBQWtCLENBQUMsU0FBUyxD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QTZDO1FBQzdDLE9BQU8sS0FBSyxDQUFDO0lBQ2pCLENBQUM7Q0FDSjs7QUEwREQscURBQXFEO0FBQ3JELHNCQUFzQjtBQUN0QixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsRUFBRTtJQUNyQixPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDbEIscUNBQXFDO1FBQ3JDLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDMUIsT0FBTztnQkFDSCxPQUFPLEVBQUUsR0FBRztnQkFDWixVQUFVLEVBQUUsR0FBRztnQkFDZixZQUFZLEVBQUUsRUFBRTthQUNuQixDQUFDO1FBQ04sQ0FBQzthQUFNLENBQUM7WUFDSixJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNaLE1BQU0sSUFBSSxLQUFLLENBQUMseUNBQXlDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ2xGLENBQUM7WUFDRCxPQUFPO2dCQUNILE9BQU8sRUFBRSxHQUFHLENBQUMsR0FBRztnQkFDaEIsVUFBVSxFQUFFLEdBQUcsQ0FBQyxJQUFJO2dCQUNwQixZQUFZLEVBQUUsR0FBRyxDQUFDLFlBQVk7Z0JBQzlCLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTTthQUNyQixDQUFDO1FBQ04sQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiXG5pbXBvcnQgdXRpbCBmcm9tICdub2RlOnV0aWwnO1xuaW1wb3J0IHsgRGlyc1dhdGNoZXIsIGRpclRvV2F0Y2gsIFZQYXRoRGF0YSB9IGZyb20gJy4vd2F0Y2hlci5qcyc7XG5pbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gJ2V2ZW50cyc7XG5cbi8qKlxuICogQ29uZmlndXJhdGlvbiBmb3IgYSBWRlN0YWNrXG4gKi9cbmV4cG9ydCB0eXBlIFZGU0NvbmZpZ3VyYXRpb24gPSB7XG5cbn07XG5cbi8qKlxuICogQW4gb2JqZWN0IHdoaWNoIGxpc3RlbnMgdG8gYSBEaXJzV2F0Y2hlciBjb25maWd1cmF0aW9uLFxuICogYW5kIHN0b3JlcyBkYXRhIGFib3V0IHRoZSBmaWxlcyB3aXRoaW4gdGhlXG4gKiBkZWZpbmVkIHZpcnR1YWwgZmlsZXNwYWNlLlxuICogXG4gKiBUQkQgLSBPdmVycmlkYWJsZSBmdW5jdGlvbnMgZm9yIHBlcnNpc3RpbmcgdGhlIGRhdGEuXG4gKiAgICBUaGUgZGVmYXVsdCB3aWxsIGJlIHN0b3JpbmcgaW4gYSBNYXA8c3RyaW5nLCBWUGF0aERhdGE+XG4gKi9cbmV4cG9ydCBjbGFzcyBWRlN0YWNrZWQgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuXG4gICAgI25hbWU/OiBzdHJpbmc7XG4gICAgI2RpcnM/OiBkaXJUb1dhdGNoW107XG5cbiAgICBjb25zdHJ1Y3RvcihcbiAgICAgICAgbmFtZT86IHN0cmluZyxcbiAgICAgICAgZGlycz86IGRpclRvV2F0Y2hbXSxcbiAgICApIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy4jbmFtZSA9IG5hbWU7XG4gICAgICAgIHRoaXMuI2RpcnMgPSBkaXJzO1xuICAgIH1cblxuICAgIGdldCBuYW1lKCkgICAgICAgeyByZXR1cm4gdGhpcy4jbmFtZTsgfVxuICAgIGdldCBkaXJzKCkgICAgICAgeyByZXR1cm4gdGhpcy4jZGlyczsgfVxuXG4gICAgI3dhdGNoZXI6IERpcnNXYXRjaGVyO1xuICAgICNxdWV1ZTtcblxuICAgIGFzeW5jIGNsb3NlKCkge1xuICAgICAgICBpZiAodGhpcy4jcXVldWUpIHtcbiAgICAgICAgICAgIHRoaXMuI3F1ZXVlLmtpbGxBbmREcmFpbigpO1xuICAgICAgICAgICAgdGhpcy4jcXVldWUgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuI3dhdGNoZXIpIHtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBDTE9TSU5HICR7dGhpcy5uYW1lfWApO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy4jd2F0Y2hlci5jbG9zZSgpO1xuICAgICAgICAgICAgdGhpcy4jd2F0Y2hlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygnY2hhbmdlZCcpO1xuICAgICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygnYWRkZWQnKTtcbiAgICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3VubGlua2VkJyk7XG4gICAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZWFkeScpO1xuXG4gICAgICAgIC8vIGF3YWl0IHNxZGIuY2xvc2UoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdXAgcmVjZWl2aW5nIGV2ZW50cyBmcm9tIERpcnNXYXRjaGVyLCBhbmQgZGlzcGF0Y2hpbmcgdG9cbiAgICAgKiB0aGUgaGFuZGxlciBtZXRob2RzLlxuICAgICAqL1xuICAgIGFzeW5jIHNldHVwKCkge1xuXG4gICAgICAgIHRoaXMuI3dhdGNoZXIgPSBuZXcgRGlyc1dhdGNoZXIodGhpcy5uYW1lKTtcblxuICAgICAgICB0aGlzLiN3YXRjaGVyLm9uKCdjaGFuZ2UnLCBhc3luYyAobmFtZSwgaW5mbykgPT4ge1xuXG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgJHtuYW1lfSBjaGFuZ2VkICR7aW5mby5tb3VudFBvaW50fSAke2luZm8udnBhdGh9YCk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5pZ25vcmVGaWxlKGluZm8pKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBQVVNIICR7bmFtZX0gY2hhbmdlZCAke2luZm8ubW91bnRQb2ludH0gJHtpbmZvLnZwYXRofWApO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFRCRCBzdG9yZSB0aGUgY2hhbmdlIHRvIHRoZSBmaWxlIGluZm9ybWF0aW9uXG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgSWdub3JlZCAnY2hhbmdlJyBmb3IgJHtpbmZvLnZwYXRofWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYEZBSUwgY2hhbmdlICR7aW5mby52cGF0aH0gYmVjYXVzZSAke2Vyci5zdGFja31gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgLm9uKCdhZGQnLCBhc3luYyAobmFtZSwgaW5mbykgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgJHtuYW1lfSBhZGQgJHtpbmZvLm1vdW50UG9pbnR9ICR7aW5mby52cGF0aH1gKTtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaWdub3JlRmlsZShpbmZvKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgUFVTSCAke25hbWV9IGFkZCAke2luZm8ubW91bnRQb2ludH0gJHtpbmZvLnZwYXRofWApO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFRCRCBTdG9yZSB0aGUgZmlsZSBpbmZvcm1hdGlvblxuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYElnbm9yZWQgJ2FkZCcgZm9yICR7aW5mby52cGF0aH1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBGQUlMIGFkZCAke2luZm8udnBhdGh9IGJlY2F1c2UgJHtlcnIuc3RhY2t9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC5vbigndW5saW5rJywgYXN5bmMgKG5hbWUsIGluZm8pID0+IHtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGB1bmxpbmsgJHtuYW1lfSAke2luZm8udnBhdGh9YCk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5pZ25vcmVGaWxlKGluZm8pKSB7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBUQkQgZGVsZXRlIHRoZSBmaWxlIGluZm9ybWF0aW9uXG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgSWdub3JlZCAndW5saW5rJyBmb3IgJHtpbmZvLnZwYXRofWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBGQUlMIHVubGluayAke2luZm8udnBhdGh9IGJlY2F1c2UgJHtlcnIuc3RhY2t9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC5vbigncmVhZHknLCBhc3luYyAobmFtZSkgPT4ge1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYCR7bmFtZX0gcmVhZHlgKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gVEJEIHJlY29yZCB0aGF0IGl0IGlzIFwicmVhZHlcIlxuICAgICAgICB9KTtcblxuXG4gICAgICAgIGNvbnN0IG1hcHBlZCA9IHJlbWFwZGlycyh0aGlzLmRpcnMpO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhgc2V0dXAgJHt0aGlzLiNuYW1lfSB3YXRjaCAke3V0aWwuaW5zcGVjdCh0aGlzLiNkaXJzKX0gPT0+ICR7dXRpbC5pbnNwZWN0KG1hcHBlZCl9YCk7XG4gICAgICAgIGF3YWl0IHRoaXMuI3dhdGNoZXIud2F0Y2gobWFwcGVkKTtcblxuICAgICAgICAvLyBjb25zb2xlLmxvZyhgREFPICR7dGhpcy5kYW8udGFibGUubmFtZX0gJHt1dGlsLmluc3BlY3QodGhpcy5kYW8udGFibGUuZmllbGRzKX1gKTtcblxuICAgICAgICBcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTaG91bGQgdGhpcyBmaWxlIGJlIGlnbm9yZWQsIGJhc2VkIG9uIHRoZSBgaWdub3JlYCBmaWVsZFxuICAgICAqIGluIHRoZSBtYXRjaGluZyBgZGlyYCBtb3VudCBlbnRyeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gaW5mb1xuICAgICAqIEByZXR1cm5zXG4gICAgICovXG4gICAgaWdub3JlRmlsZShpbmZvKTogYm9vbGVhbiB7XG4gICAgICAgIC8vIFRCRCBkZXRlcm1pbmUgaWYgdGhlIGZpbGUgaXMgdG8gYmUgaWdub3JlZFxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuXG5cbi8qKlxuICogRGVmaW5lIG9wZXJhdGlvbnMgb24gYSB2aXJ0dWFsIGZpbGVzcGFjZSBkZWZpbmVkXG4gKiBieSBhIFN0YWNrZWREaXJzIGNvbmZpZ3VyYXRpb24uICBUaGUgb3BlcmF0aW9uc1xuICogYXJlIHRvIG1hdGNoIGEgc3Vic2V0IG9mIHdoYXQncyBpbiBub2RlOmZzL3Byb21pc2VzLlxuICogXG4gKiBUQkQgLSBpbiBub2RlOmZzIHRoZSBgcGF0aGAgYXJndW1lbnQgaXMgYSBzdHJpbmcgb3IgQnVmZmVyIG9yIFVSTC5cbiAqICAgICBGb3IgdGhpcyBwdXJwb3NlIHN1cHBvcnQgb25seSBzdHJpbmcsIGFzIGEgdmlydHVhbCBwYXRoXG4gKiAgICAgd2l0aGluIHRoZSBWRlN0YWNrLlxuICovXG5cbmV4cG9ydCB0eXBlIHZmcyA9IHtcblxuICAgIGFjY2VzcyhwYXRoOiBzdHJpbmcgfCBCdWZmZXIgfCBVUkwsIG1vZGU6IG51bWJlcik6IFByb21pc2U8bnVtYmVyPjtcblxuICAgIGFwcGVuZEZpbGUoXG4gICAgICAgIHBhdGg6IHN0cmluZyB8IEJ1ZmZlciB8IFVSTCxcbiAgICAgICAgZGF0YTogc3RyaW5nIHwgQnVmZmVyLFxuICAgICAgICBvcHRpb25zOiBzdHJpbmcgfCB7XG4gICAgICAgICAgICBlbmNvZGluZz86IHN0cmluZyxcbiAgICAgICAgICAgIG1vZGU/OiBudW1iZXIsXG4gICAgICAgICAgICBmbGFnPzogc3RyaW5nLFxuICAgICAgICAgICAgZmx1c2g/OiBib29sZWFuXG4gICAgICAgIH0pXG4gICAgOiBQcm9taXNlPG51bWJlcj47XG4gICAgXG4gICAgY2htb2QoXG4gICAgICAgIHBhdGg6IHN0cmluZyB8IEJ1ZmZlciB8IFVSTCxcbiAgICAgICAgbW9kZTogc3RyaW5nIHwgbnVtYmVyKVxuICAgIDogUHJvbWlzZTxudW1iZXI+O1xuXG4gICAgY29weUZpbGUoXG4gICAgICAgIHNyYzogc3RyaW5nIHwgQnVmZmVyIHwgVVJMLFxuICAgICAgICBkZXN0OiBzdHJpbmcgfCBCdWZmZXIgfCBVUkwsXG4gICAgICAgIG1vZGU6IG51bWJlcilcbiAgICA6IFByb21pc2U8bnVtYmVyPjtcblxuICAgIG1rZGlyKFxuICAgICAgICBwYXRoOiBzdHJpbmcgfCBCdWZmZXIgfCBVUkwsXG4gICAgICAgIG9wdGlvbnM6IHN0cmluZyB8IHtcbiAgICAgICAgICAgIHJlY3Vyc2l2ZT86IGJvb2xlYW4sXG4gICAgICAgICAgICBtb2RlOiBudW1iZXIgfCBzdHJpbmdcbiAgICAgICAgfVxuICAgICk6IFByb21pc2U8bnVtYmVyPjtcblxuICAgIHJlYWRGaWxlKFxuICAgICAgICBwYXRoOiBzdHJpbmcgfCBCdWZmZXIgfCBVUkwsXG4gICAgICAgIG9wdGlvbnM6IHN0cmluZyB8IHtcbiAgICAgICAgICAgIGVuY29kaW5nPzogc3RyaW5nLFxuICAgICAgICAgICAgZmxhZz86IHN0cmluZyxcbiAgICAgICAgICAgIHNpZ25hbD86IGFueSAvLyBBYm9ydFNpZ25hbFxuICAgICAgICB9XG4gICAgKTogUHJvbWlzZTxudW1iZXI+O1xufTtcblxuXG4vLyBDb252ZXJ0IEFrYXNoYUNNUyBtb3VudCBwb2ludHMgaW50byB0aGUgbW91bnRwb2ludFxuLy8gdXNlZCBieSBEaXJzV2F0Y2hlclxuY29uc3QgcmVtYXBkaXJzID0gZGlyeiA9PiB7XG4gICAgcmV0dXJuIGRpcnoubWFwKGRpciA9PiB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdkb2N1bWVudCBkaXIgJywgZGlyKTtcbiAgICAgICAgaWYgKHR5cGVvZiBkaXIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG1vdW50ZWQ6IGRpcixcbiAgICAgICAgICAgICAgICBtb3VudFBvaW50OiAnLycsXG4gICAgICAgICAgICAgICAgYmFzZU1ldGFkYXRhOiB7fVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICghZGlyLmRlc3QpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHJlbWFwZGlycyBpbnZhbGlkIG1vdW50IHNwZWNpZmljYXRpb24gJHt1dGlsLmluc3BlY3QoZGlyKX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgbW91bnRlZDogZGlyLnNyYyxcbiAgICAgICAgICAgICAgICBtb3VudFBvaW50OiBkaXIuZGVzdCxcbiAgICAgICAgICAgICAgICBiYXNlTWV0YWRhdGE6IGRpci5iYXNlTWV0YWRhdGEsXG4gICAgICAgICAgICAgICAgaWdub3JlOiBkaXIuaWdub3JlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuIl19