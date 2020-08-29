
import util from 'util';
import Chai from 'chai';
const assert = Chai.assert;
import { DirsWatcher } from '../lib/watcher.mjs';


describe('Initialize', function() {

    let watcher;

    it('should successfully load some directories', async function() {
        try {
            watcher = new DirsWatcher([
                { path: 'partials-base',         mountPoint: '/' },
                { path: 'partials-blog-podcast', mountPoint: '/' },
                { path: 'partials-booknav',      mountPoint: '/' },
                { path: 'partials-embeddables',  mountPoint: '/' },
                { path: 'partials-footnotes',    mountPoint: '/' },
                { path: 'partials-bootstrap',    mountPoint: '/' },
                { path: 'partials-example',      mountPoint: '/' },
            ], 'akashacms-partials', './persist/akashacms-partials');
            
            await watcher.dbinit();
            watcher.start();

            await new Promise((resolve, reject) => {
                watcher.on('ready', () => { resolve(); });
            });

        } catch (e) {
            console.error(e);
            throw e;
        }
    });

    it('should close the directory watcher', async function() {
        await watcher.close();
    });

});
