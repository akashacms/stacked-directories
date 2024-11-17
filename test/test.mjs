
import util from 'util';
import { promises as fs } from 'fs';
import Chai from 'chai';
const assert = Chai.assert;
import {
    DirsWatcher, mimedefine
} from '../dist/watcher.js';

/* import * as Watcher from '../dist/watcher.js';

console.log(Watcher);
const DirsWatcher = Watcher.DirsWatcher; */

// This function sets up definitions for file extensions
// that are not recognized by default by the MIME package.
// These file extensions are used in the test suite, and in AkashaCMS.
// This function should only be called once.
//
// This function also handles testing of the mimedefine function.

function mimeDefines(watcher) {

    mimedefine({'text/x-asciidoc': [ 'adoc', 'asciidoc' ]});
    mimedefine({'text/x-ejs': [ 'ejs']});
    mimedefine({'text/x-nunjucks': [ 'njk' ]});
    mimedefine({'text/x-handlebars': [ 'handlebars' ]});
    mimedefine({'text/x-liquid': [ 'liquid' ]});

}

describe('Documents simple', function() {

    let watcher;
    let events = [];
    const name = 'test-simple';

    let watcherReady;

    it('should set up simple documents watcher', async function() {
        try {
            watcher = new DirsWatcher(name);
            mimeDefines(watcher);
            watcher.on('change', (name, info) => {
                // console.log(`watcher on 'change' for ${info.vpath}`);
                events.push({
                    event: 'change',
                    name, info
                });
            });
            watcher.on('add', (name, info) => {
                // console.log(`watcher on 'add' for ${info.vpath}`);
                events.push({
                    event: 'add',
                    name, info
                });
            });
            watcher.on('unlink', (name, info) => {
                // console.log(`watcher on 'unlink' for ${info.vpath}`);
                events.push({
                    event: 'unlink',
                    name, info
                });
            });
            watcherReady = new Promise((resolve, reject) => {
                watcher.on('ready', () => {
                    resolve(true);
                });
            });
            await watcher.watch([
                { mounted: 'documents-example',      mountPoint: '/' }
            ]);
        } catch (e) {
            console.error(e);
            throw e;
        }
    });

    it('should get Ready with simple documents watcher', async function() {
        this.timeout(25000);
        try {
            let ready = await watcherReady;
            assert.isOk(ready);
        } catch (e) {
            console.error(e);
            throw e;
        }
    });
    
    it('should find feeds-tags', async function() {
        // console.log(`feeds-tags `, events);
        let found;
        for (let event of events) {
            if (event.event === 'add' && event.info.vpath === 'feeds-tags.html.md') {
                found = event;
                break;
            }
        }
        // console.log(found);
        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        assert.isOk(vpinfo);
        assert.equal(vpinfo.fspath, 'documents-example/feeds-tags.html.md');
        assert.equal(vpinfo.mounted, 'documents-example');
        assert.equal(vpinfo.mountPoint, '/');
        assert.equal(vpinfo.pathInMounted, 'feeds-tags.html.md');
        assert.equal(vpinfo.vpath, 'feeds-tags.html.md');
        assert.equal(vpinfo.mime, 'text/markdown');
    });

    it('should find asciidoctor', async function() {
        let found;
        for (let event of events) {
            if (event.event === 'add' && event.info.vpath === 'asciidoctor.html.adoc') {
                found = event;
                break;
            }
        }
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        assert.isOk(vpinfo);
        assert.equal(vpinfo.fspath, 'documents-example/asciidoctor.html.adoc');
        assert.equal(vpinfo.mounted, 'documents-example');
        assert.equal(vpinfo.mountPoint, '/');
        assert.equal(vpinfo.pathInMounted, 'asciidoctor.html.adoc');
        assert.equal(vpinfo.vpath, 'asciidoctor.html.adoc');
        // Stacked Directories does not make the setting to support
        // this value
        // assert.equal(vpinfo.mime, 'text/x-asciidoc');
    });

    it('should find json-data', async function() {
        let found;
        for (let event of events) {
            if (event.event === 'add' && event.info.vpath === 'json-data.html.json') {
                found = event;
                break;
            }
        }
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        assert.isOk(vpinfo);
        assert.equal(vpinfo.fspath, 'documents-example/json-data.html.json');
        assert.equal(vpinfo.mounted, 'documents-example');
        assert.equal(vpinfo.mountPoint, '/');
        assert.equal(vpinfo.pathInMounted, 'json-data.html.json');
        assert.equal(vpinfo.vpath, 'json-data.html.json');
        assert.equal(vpinfo.mime, 'application/json');
    });

    it('should find Human-Skeleton', async function() {
        let found;
        for (let event of events) {
            if (event.event === 'add' && event.info.vpath === 'Human-Skeleton.jpg') {
                found = event;
                break;
            }
        }
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        assert.isOk(vpinfo);
        assert.equal(vpinfo.fspath, 'documents-example/Human-Skeleton.jpg');
        assert.equal(vpinfo.mounted, 'documents-example');
        assert.equal(vpinfo.mountPoint, '/');
        assert.equal(vpinfo.pathInMounted, 'Human-Skeleton.jpg');
        assert.equal(vpinfo.vpath, 'Human-Skeleton.jpg');
        assert.equal(vpinfo.mime, 'image/jpeg');
    });

    it('should find vue-js CSS', async function() {
        let found;
        for (let event of events) {
            if (event.event === 'add' && event.info.vpath === 'vue-js-example.css') {
                found = event;
                break;
            }
        }
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        assert.isOk(vpinfo);
        assert.equal(vpinfo.fspath, 'documents-example/vue-js-example.css');
        assert.equal(vpinfo.mounted, 'documents-example');
        assert.equal(vpinfo.mountPoint, '/');
        assert.equal(vpinfo.pathInMounted, 'vue-js-example.css');
        assert.equal(vpinfo.vpath, 'vue-js-example.css');
        assert.equal(vpinfo.mime, 'text/css');
    });

    it('should find syncpartial EJS', async function() {
        let found;
        for (let event of events) {
            if (event.event === 'add' && event.info.vpath === 'syncpartial.html.ejs') {
                found = event;
                break;
            }
        }
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        assert.isNotNull(vpinfo);
        assert.equal(vpinfo.fspath, 'documents-example/syncpartial.html.ejs');
        assert.equal(vpinfo.mounted, 'documents-example');
        assert.equal(vpinfo.mountPoint, '/');
        assert.equal(vpinfo.pathInMounted, 'syncpartial.html.ejs');
        assert.equal(vpinfo.vpath, 'syncpartial.html.ejs');
    });

    it('should find viewer/pdf-spec-inline', async function() {
        let found;
        for (let event of events) {
            if (event.event === 'add' && event.info.vpath === 'viewer-js-viewer/pdf-spec-inline.html.md') {
                found = event;
                break;
            }
        }
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        assert.isOk(vpinfo);
        assert.equal(vpinfo.fspath, 'documents-example/viewer-js-viewer/pdf-spec-inline.html.md');
        assert.equal(vpinfo.mounted, 'documents-example');
        assert.equal(vpinfo.mountPoint, '/');
        assert.equal(vpinfo.pathInMounted, 'viewer-js-viewer/pdf-spec-inline.html.md');
        assert.equal(vpinfo.vpath, 'viewer-js-viewer/pdf-spec-inline.html.md');
        assert.equal(vpinfo.mime, 'text/markdown');
    });

    it('should find folder/folder/folder/index', async function() {
        let found;
        for (let event of events) {
            if (event.event === 'add' && event.info.vpath === 'folder/folder/folder/index.html.md') {
                found = event;
                break;
            }
        }
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        assert.isOk(vpinfo);
        assert.equal(vpinfo.fspath, 'documents-example/folder/folder/folder/index.html.md');
        assert.equal(vpinfo.mounted, 'documents-example');
        assert.equal(vpinfo.mountPoint, '/');
        assert.equal(vpinfo.pathInMounted, 'folder/folder/folder/index.html.md');
        assert.equal(vpinfo.vpath, 'folder/folder/folder/index.html.md');
        assert.equal(vpinfo.mime, 'text/markdown');
    });


    it('should close the directory watcher', async function() {
        this.timeout(25000);
        await watcher.close();
    });

});

describe('Overlaid directories', function() {

    let watcher;
    let events = [];
    let ready;
    const name = 'test-overlaid';

    it('should successfully load Partials directories', async function() {
        this.timeout(25000);
        try {
            watcher = new DirsWatcher(name);
            // mimeDefines(watcher);
            
            watcher.on('change', (name, info) => {
                // console.log(`watcher on 'change' for ${info.vpath}`);
                events.push({
                    event: 'change',
                    name, info
                });
            });
            watcher.on('add', (name, info) => {
                // console.log(`watcher on 'add' for ${info.vpath}`);
                events.push({
                    event: 'add',
                    name, info
                });
            });
            watcher.on('unlink', (name, info) => {
                // console.log(`watcher on 'unlink' for ${info.vpath}`);
                events.push({
                    event: 'unlink',
                    name, info
                });
            });
            await watcher.watch([
                { mounted: 'partials-example',      mountPoint: '/' },
                { mounted: 'partials-bootstrap',    mountPoint: '/' },
                { mounted: 'partials-booknav',      mountPoint: '/' },
                { mounted: 'partials-footnotes',    mountPoint: '/' },
                { mounted: 'partials-embeddables',  mountPoint: '/' },
                { mounted: 'partials-blog-podcast', mountPoint: '/' },
                { mounted: 'partials-base',         mountPoint: '/' },
            ]);
            ready = await new Promise((resolve, reject) => {
                try {
                    watcher.on('ready', (name) => {
                        // console.log(`watcher on 'ready' for ${name}`);
                        resolve(name); 
                    });
                } catch (err) { reject(err); }
            });
            
        } catch (e) {
            console.error(e);
            throw e;
        }
    });

    it('should get Ready with overlaid directories documents watcher', async function() {
        this.timeout(25000);
        try {
            let readier = await ready;
            assert.isOk(readier);
        } catch (e) {
            console.error(e);
            throw e;
        }
    });

    it('should find ak_linkreltag.html.ejs', async function() {
        let found;
        for (let event of events) {
            // console.log(`event.info.vpath ${event.info.vpath} === ak_linkreltag.html.ejs ??`);
            if (event.event === 'add' && event.info.vpath === 'ak_linkreltag.html.ejs') {
                found = event;
                break;
            }
        }
        // console.log(events);
        // console.log(found);

        assert.isOk(found);
        // This line randomly fails
        // assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        // console.log(vpinfo);
        assert.isOk(vpinfo);
        assert.equal(vpinfo.fspath, 'partials-base/ak_linkreltag.html.ejs');
        assert.equal(vpinfo.mounted, 'partials-base');
        assert.equal(vpinfo.mountPoint, '/');
        assert.equal(vpinfo.pathInMounted, 'ak_linkreltag.html.ejs');
        assert.equal(vpinfo.vpath, 'ak_linkreltag.html.ejs');
        assert.equal(vpinfo.stack.length, 1);
    });

    it('should find blog-next-prev - overridden by partials-bootstrap', async function() {
        let found;
        for (let event of events) {
            if (event.event === 'add' && event.info.vpath === 'blog-next-prev.html.ejs') {
                found = event;
                break;
            }
        }
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        // console.log(vpinfo);
        assert.isOk(vpinfo);
        assert.equal(vpinfo.fspath, 'partials-bootstrap/blog-next-prev.html.ejs');
        assert.equal(vpinfo.mounted, 'partials-bootstrap');
        assert.equal(vpinfo.mountPoint, '/');
        assert.equal(vpinfo.pathInMounted, 'blog-next-prev.html.ejs');
        assert.equal(vpinfo.vpath, 'blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack.length, 2);

        assert.equal(vpinfo.stack[0].fspath, 'partials-bootstrap/blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack[0].mounted, 'partials-bootstrap');
        assert.equal(vpinfo.stack[0].mountPoint, '/');
        assert.equal(vpinfo.stack[0].pathInMounted, 'blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack[0].vpath, 'blog-next-prev.html.ejs');

        assert.equal(vpinfo.stack[1].fspath, 'partials-blog-podcast/blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack[1].mounted, 'partials-blog-podcast');
        assert.equal(vpinfo.stack[1].mountPoint, '/');
        assert.equal(vpinfo.stack[1].pathInMounted, 'blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack[1].vpath, 'blog-next-prev.html.ejs');

    });

    it('should find blog-feeds-all', async function() {
        let found;
        for (let event of events) {
            if (event.event === 'add' && event.info.vpath === 'blog-feeds-all.html.ejs') {
                found = event;
                break;
            }
        }
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        // console.log(vpinfo);
        assert.isOk(vpinfo);
        assert.equal(vpinfo.fspath, 'partials-blog-podcast/blog-feeds-all.html.ejs');
        assert.equal(vpinfo.mounted, 'partials-blog-podcast');
        assert.equal(vpinfo.mountPoint, '/');
        assert.equal(vpinfo.pathInMounted, 'blog-feeds-all.html.ejs');
        assert.equal(vpinfo.vpath, 'blog-feeds-all.html.ejs');
        assert.equal(vpinfo.stack.length, 1);
    });

    it('should find ak_toc_group_element - overridden by partials-bootstrap, partials-example', async function() {
        let found;
        for (let event of events) {
            if (event.event === 'add' && event.info.vpath === 'ak_toc_group_element.html.ejs') {
                found = event;
                break;
            }
        }
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        // console.log(vpinfo);
        assert.isOk(vpinfo);
        assert.equal(vpinfo.fspath, 'partials-example/ak_toc_group_element.html.ejs');
        assert.equal(vpinfo.mounted, 'partials-example');
        assert.equal(vpinfo.mountPoint, '/');
        assert.equal(vpinfo.pathInMounted, 'ak_toc_group_element.html.ejs');
        assert.equal(vpinfo.vpath, 'ak_toc_group_element.html.ejs');
        assert.equal(vpinfo.stack.length, 3);

        assert.equal(vpinfo.stack[0].fspath, 'partials-example/ak_toc_group_element.html.ejs');
        assert.equal(vpinfo.stack[0].mounted, 'partials-example');
        assert.equal(vpinfo.stack[0].mountPoint, '/');
        assert.equal(vpinfo.stack[0].pathInMounted, 'ak_toc_group_element.html.ejs');
        assert.equal(vpinfo.stack[0].vpath, 'ak_toc_group_element.html.ejs');

        assert.equal(vpinfo.stack[1].fspath, 'partials-bootstrap/ak_toc_group_element.html.ejs');
        assert.equal(vpinfo.stack[1].mounted, 'partials-bootstrap');
        assert.equal(vpinfo.stack[1].mountPoint, '/');
        assert.equal(vpinfo.stack[1].pathInMounted, 'ak_toc_group_element.html.ejs');
        assert.equal(vpinfo.stack[1].vpath, 'ak_toc_group_element.html.ejs');


        assert.equal(vpinfo.stack[2].fspath, 'partials-base/ak_toc_group_element.html.ejs');
        assert.equal(vpinfo.stack[2].mounted, 'partials-base');
        assert.equal(vpinfo.stack[2].mountPoint, '/');
        assert.equal(vpinfo.stack[2].pathInMounted, 'ak_toc_group_element.html.ejs');
        assert.equal(vpinfo.stack[2].vpath, 'ak_toc_group_element.html.ejs');


    });

    it('should close the directory watcher', async function() {
        this.timeout(25000);
        await watcher.close();
    });

});

describe('Documents dual with mounted', function() {

    let watcher;
    let events = [];
    let ready;
    const name = 'test-mounted';

    it('should successfully load dual mounted documents directories', async function() {
        this.timeout(25000);
        try {
            watcher = new DirsWatcher(name);
            // mimeDefines(watcher);

            watcher.on('change', (name, info) => {
                // console.log(`watcher on 'change' for ${info.vpath}`);
                events.push({
                    event: 'change',
                    name, info
                });
            });
            watcher.on('add', (name, info) => {
                // console.log(`watcher on 'add' for ${info.vpath}`);
                events.push({
                    event: 'add',
                    name, info
                });
            });
            watcher.on('unlink', (name, info) => {
                // console.log(`watcher on 'unlink' for ${info.vpath}`);
                events.push({
                    event: 'unlink',
                    name, info
                });
            });
            watcher.watch([
                { mounted: 'documents-example',       mountPoint: '/' },
                { mounted: 'documents-epub-skeleton', mountPoint: 'epub' }
            ]);
            ready = await new Promise((resolve, reject) => {
                try {
                    watcher.on('ready', (name) => {
                        // console.log(`watcher on 'ready' for ${name}`);
                        resolve(name); 
                    });
                } catch (err) { reject(err); }
            });

        } catch (e) {
            console.error(e);
            throw e;
        }
    });

    it('should get Ready with overlaid directories documents watcher', async function() {
        this.timeout(25000);
        try {
            let readier = await ready;
            assert.isOk(readier);
        } catch (e) {
            console.error(e);
            throw e;
        }
    });

    it('should find feeds-tags', async function() {
        // console.log(events);
        let found;
        for (let event of events) {
            if (event.event === 'add' && event.info.vpath === 'feeds-tags.html.md') {
                found = event;
                break;
            }
        }
        // console.log(found);
        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        assert.isOk(vpinfo);
        assert.equal(vpinfo.fspath, 'documents-example/feeds-tags.html.md');
        assert.equal(vpinfo.mounted, 'documents-example');
        assert.equal(vpinfo.mountPoint, '/');
        assert.equal(vpinfo.pathInMounted, 'feeds-tags.html.md');
        assert.equal(vpinfo.vpath, 'feeds-tags.html.md');
        assert.equal(vpinfo.mime, 'text/markdown');
        
    });

    it('should find EPUB chap1', async function() {
        let found;
        for (let event of events) {
            if (event.event === 'add' && event.info.vpath === 'epub/chap1.html.md') {
                found = event;
                break;
            }
        }
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        assert.isOk(vpinfo);
        assert.equal(vpinfo.fspath, 'documents-epub-skeleton/chap1.html.md');
        assert.equal(vpinfo.mounted, 'documents-epub-skeleton');
        assert.equal(vpinfo.mountPoint, 'epub');
        assert.equal(vpinfo.pathInMounted, 'chap1.html.md');
        assert.equal(vpinfo.vpath, 'epub/chap1.html.md');
        assert.equal(vpinfo.mime, 'text/markdown');
    });

    it('should find EPUB chap5/b/chap5b', async function() {
        let found;
        for (let event of events) {
            if (event.event === 'add' && event.info.vpath === 'epub/chap5/b/chap5b.html.md') {
                found = event;
                break;
            }
        }
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        assert.isOk(vpinfo);
        assert.equal(vpinfo.fspath, 'documents-epub-skeleton/chap5/b/chap5b.html.md');
        assert.equal(vpinfo.mounted, 'documents-epub-skeleton');
        assert.equal(vpinfo.mountPoint, 'epub');
        assert.equal(vpinfo.pathInMounted, 'chap5/b/chap5b.html.md');
        assert.equal(vpinfo.vpath, 'epub/chap5/b/chap5b.html.md');
        assert.equal(vpinfo.mime, 'text/markdown');
    });

    it('should close the directory watcher', async function() {
        this.timeout(25000);
        await watcher.close();
    });

});

describe('Documents dual with mounted with ignored files', function() {

    let watcher;
    let events = [];
    let ready;
    const name = 'test-mounted-ignored';

    it('should successfully load dual mounted documents directories', async function() {
        this.timeout(25000);
        try {
            watcher = new DirsWatcher(name);
            // mimeDefines(watcher);
            
            watcher.on('change', (name, info) => {
                // console.log(`watcher on 'change' for ${info.vpath}`);
                events.push({
                    event: 'change',
                    name, info
                });
            });
            watcher.on('add', (name, info) => {
                // console.log(`watcher on 'add' for ${info.vpath}`);
                events.push({
                    event: 'add',
                    name, info
                });
            });
            watcher.on('unlink', (name, info) => {
                // console.log(`watcher on 'unlink' for ${info.vpath}`);
                events.push({
                    event: 'unlink',
                    name, info
                });
            });
            watcher.watch([
                {
                    mounted: 'documents-example',
                    mountPoint: '/',
                    // These are the files we'll ignore
                    ignore: [
                        '**/viewer-js-viewer/**',
                        '**/folder/**/*.html.md',
                        '**/*.html.ejs'
                    ]
                },
                {
                    mounted: 'documents-epub-skeleton', mountPoint: 'epub'
                }
            ]);
            ready = await new Promise((resolve, reject) => {
                try {
                    watcher.on('ready', (name) => {
                        // console.log(`watcher on 'ready' for ${name}`);
                        resolve(name); 
                    });
                } catch (err) { reject(err); }
            });
            
        } catch (e) {
            console.error(e);
            throw e;
        }
    });

    it('should get Ready with overlaid directories documents watcher', async function() {
        this.timeout(25000);
        try {
            let readier = await ready;
            assert.isOk(readier);
        } catch (e) {
            console.error(e);
            throw e;
        }
    });

    it('should find feeds-tags', async function() {
        // console.log(events);
        let found;
        for (let event of events) {
            if (event.event === 'add' && event.info.vpath === 'feeds-tags.html.md') {
                found = event;
                break;
            }
        }
        // console.log(found);
        assert.isNotNull(found);
        assert.isDefined(found);
    });

    it('should NOT find viewer-js-viewer files', async function() {
        let found;
        for (let event of events) {
            if (event.info.vpath === 'viewer-js-viewer/index.html.md') {
                found = event;
                break;
            }
        }

        assert.notOk(found);

        for (let event of events) {
            if (event.info.vpath === 'viewer-js-viewer/pdf-spec-inline.html.md') {
                found = event;
                break;
            }
        }

        assert.notOk(found);

        for (let event of events) {
            if (event.info.vpath === 'viewer-js-viewer/pdf-spec-link.html.md') {
                found = event;
                break;
            }
        }

        assert.notOk(found);
    });

    it('should NOT find folder/**/*.html.md', async function() {
        let found;
        for (let event of events) {
            if (event.info.vpath === 'folder/index.html.md') {
                found = event;
                break;
            }
        }

        assert.notOk(found);

        for (let event of events) {
            if (event.info.vpath === 'folder/folder/index.html.md') {
                found = event;
                break;
            }
        }

        assert.notOk(found);

        for (let event of events) {
            if (event.info.vpath === 'folder/folder/folder/page2.html.md') {
                found = event;
                break;
            }
        }

        assert.notOk(found);

        for (let event of events) {
            if (event.info.vpath === 'folder/folder/folder/page1.html.md') {
                found = event;
                break;
            }
        }

        assert.notOk(found);

        for (let event of events) {
            if (event.info.vpath === 'folder/folder/folder/index.html.md') {
                found = event;
                break;
            }
        }

        assert.notOk(found);
    });

    it('should NOT find **/*.html.ejs', async function() {
        let found;

        // In this case we're asking to ignore .html.ejs files in one
        // of the directories, but not the other.  Hence it is legit
        // for epub/toc.html.ejs to show up.  In this section we don't
        // want that file to create a false failure.
        for (let event of events) {
            // console.log(`NOT html.ejs ${event.info.vpath} ${typeof event.info.vpath}`);
            if (event.info.vpath.match(/\.html\.ejs$/)
             && event.info.vpath !== 'epub/toc.html.ejs') {
                found = event;
                break;
            }
        }

        // console.log(found);
        assert.notOk(found);

        // In this section we want to make sure it is included.
        found = undefined;
        for (let event of events) {
            // console.log(`is epub/toc.html.ejs? ${event.info.vpath} ${typeof event.info.vpath}`);
            if (event.info.vpath === 'epub/toc.html.ejs') {
                found = event;
                break;
            }
        }

        // console.log(found);
        assert.isOk(found);
    });

    it('should close the directory watcher', async function() {
        this.timeout(25000);
        await watcher.close();
    });

});

describe('Add event post-Ready', function() {

    let watcher;
    let events = [];
    let ready;
    const name = 'test-add-event';

    it('should successfully load overridden documents directories', async function() {
        this.timeout(25000);
        try {
            watcher = new DirsWatcher(name);
            // mimeDefines(watcher);

            watcher.on('change', (name, info) => {
                // console.log(`watcher on 'change' for ${info.vpath}`);
                events.push({
                    event: 'change',
                    name, info
                });
            });
            watcher.on('add', (name, info) => {
                // console.log(`watcher on 'add' for ${info.vpath}`);
                events.push({
                    event: 'add',
                    name, info
                });
            });
            watcher.on('unlink', (name, info) => {
                // console.log(`watcher on 'unlink' for ${info.vpath}`);
                events.push({
                    event: 'unlink',
                    name, info
                });
            });
            await watcher.watch([
                { mounted: 'partials-example',      mountPoint: '/' },
                { mounted: 'partials-bootstrap',    mountPoint: '/' },
                { mounted: 'partials-booknav',      mountPoint: '/' },
                { mounted: 'partials-footnotes',    mountPoint: '/' },
                { mounted: 'partials-embeddables',  mountPoint: '/' },
                { mounted: 'partials-blog-podcast', mountPoint: '/' },
                { mounted: 'partials-base',         mountPoint: '/' },
            ]);
            ready = await new Promise((resolve, reject) => {
                try {
                    watcher.on('ready', (name) => {
                        // console.log(`watcher on 'ready' for ${name}`);
                        resolve(name); 
                    });
                } catch (err) { reject(err); }
            });

        } catch (e) {
            console.error(e);
            throw e;
        }
    });

    // verify partials-blog-podcast/blog-next-prev.html.ejs in expected dirs

    // copy partials-blog-podcast/blog-next-prev.html.ejs to partials-base
    // NO event

    // copy partials-blog-podcast/blog-next-prev.html.ejs to partials-footnotes
    // NO event

    // partials-blog-podcast/blog-next-prev.html.ejs to partials-example
    // EMIT EVENT ... the stack should then include the added files

    it('should get Ready with overlaid directories documents watcher', async function() {
        this.timeout(25000);
        try {
            let readier = await ready;
            assert.isOk(readier);
        } catch (e) {
            console.error(e);
            throw e;
        }
    });

    it('should find blog-next-prev.html.ejs in expected places', async function() {
        let found;
        for (let count = 0; count < 10; count++) {
            // Wait for a second to allow events to circulate
            await new Promise((resolve, reject) => {
                setTimeout(() => { resolve(); }, 1000);
            });

            for (let event of events) {
                if (event.event === 'add'
                && event.info.vpath === 'blog-next-prev.html.ejs') {
                    found = event;
                    break;
                }
            }

            if (found) break;
        }
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        assert.isOk(vpinfo);

        assert.equal(vpinfo.fspath, 'partials-bootstrap/blog-next-prev.html.ejs');
        assert.equal(vpinfo.mounted, 'partials-bootstrap');
        assert.equal(vpinfo.mountPoint, '/');
        assert.equal(vpinfo.pathInMounted, 'blog-next-prev.html.ejs');
        assert.equal(vpinfo.vpath, 'blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack.length, 2);

        // This is already fully tested previously.  What we're doing is
        // quickly ensuring this file is in the expected places


    });

    it('should not trigger ADD on copy blog-next-prev.html.ejs to partials-base', async function() {
        this.timeout(25000);

        await fs.copyFile('partials-bootstrap/blog-next-prev.html.ejs',
                          'partials-base/blog-next-prev.html.ejs');
        let found;
        for (let count = 0; count < 10; count++) {
            // Wait for a second to allow events to circulate
            await new Promise((resolve, reject) => {
                setTimeout(() => { resolve(); }, 1000);
            });

            for (let event of events) {
                if (event.event === 'add'
                && event.info.vpath === 'blog-next-prev.html.ejs') {
                    let instack = false;
                    for (let s of event.info.stack) {
                        if (s.fspath === 'partials-bootstrap/blog-next-prev.html.ejs') {
                            instack = true;
                            break;
                        }
                    }
                    if (instack) {
                        found = event;
                        break;
                    }
                }
            }

            if (found) break;
        }
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        assert.isOk(vpinfo);

        assert.equal(vpinfo.fspath, 'partials-bootstrap/blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack.length, 2);

        // We've copied the file to the bottom of the stack.  There should not
        // have been an event, and therefore the stack should not have changed

    });

    it('should not trigger ADD on copy blog-next-prev.html.ejs to partials-footnotes', async function() {
        this.timeout(25000);

        await fs.copyFile('partials-bootstrap/blog-next-prev.html.ejs',
                          'partials-footnotes/blog-next-prev.html.ejs');
        let found;
        for (let count = 0; count < 10; count++) {
            // Wait for a second to allow events to circulate
            await new Promise((resolve, reject) => {
                setTimeout(() => { resolve(); }, 1000);
            });

            for (let event of events) {
                if (event.event === 'add'
                 && event.info.vpath === 'blog-next-prev.html.ejs') {
                    let instack = false;
                    for (let s of event.info.stack) {
                        if (s.fspath === 'partials-bootstrap/blog-next-prev.html.ejs') {
                            instack = true;
                            break;
                        }
                    }
                    if (instack) {
                        found = event;
                        break;
                    }
                }
            }

            if (found) break;
        }
        
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        assert.isOk(vpinfo);

        assert.equal(vpinfo.fspath, 'partials-bootstrap/blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack.length, 2);

        // We've copied the file to the middle of the stack.  There should not
        // have been an event, and therefore the stack should not have changed

    });

    it('should trigger ADD on copy blog-next-prev.html.ejs to partials-example', async function() {
        this.timeout(25000);

        await fs.copyFile('partials-bootstrap/blog-next-prev.html.ejs',
                          'partials-example/blog-next-prev.html.ejs');
        
        
        let found;
        for (let count = 0; count < 10; count++) {
            // Wait for a second to allow events to circulate
            await new Promise((resolve, reject) => {
                setTimeout(() => { resolve(); }, 1000);
            });

            for (let event of events) {
                if (event.event === 'add'
                 && event.info.vpath === 'blog-next-prev.html.ejs') {
                    let instack = false;
                    for (let s of event.info.stack) {
                        if (s.fspath === 'partials-example/blog-next-prev.html.ejs') {
                            instack = true;
                            break;
                        }
                    }
                    if (instack) {
                        found = event;
                        break;
                    }
                }
            }

            if (found) break;
        }
        
        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);

        // console.log(found);
        // console.log(found.info.stack);

        let vpinfo = found.info;
        assert.isOk(vpinfo);

        assert.equal(vpinfo.fspath, 'partials-example/blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack.length, 5);

        // We've copied the file to the middle of the stack.  There should not
        // have been an event, and therefore the stack should not have changed

        assert.equal(vpinfo.stack[0].fspath, 'partials-example/blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack[1].fspath, 'partials-bootstrap/blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack[2].fspath, 'partials-footnotes/blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack[3].fspath, 'partials-blog-podcast/blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack[4].fspath, 'partials-base/blog-next-prev.html.ejs');
    });

    it('should close the directory watcher', async function() {
        this.timeout(25000);
        await watcher.close();
    });

    it('should delete the files which were copied', async function() {
        await fs.unlink('partials-example/blog-next-prev.html.ejs');
        await fs.unlink('partials-footnotes/blog-next-prev.html.ejs');
        await fs.unlink('partials-base/blog-next-prev.html.ejs');
    });


});


describe('Change and Unlink events post-Ready', function() {

    let watcher;
    let events = [];
    let ready;
    const name = 'test-add-event';

    it('should successfully load overridden documents directories', async function() {
        this.timeout(25000);
        try {
            watcher = new DirsWatcher(name);
            // mimeDefines(watcher);

            watcher.on('change', (name, info) => {
                // console.log(`watcher on 'change' for ${name} ${info.vpath}`);
                events.push({
                    event: 'change',
                    name, info
                });
            });
            watcher.on('add', (name, info) => {
                // console.log(`watcher on 'add' for ${name} ${info.vpath}`);
                events.push({
                    event: 'add',
                    name, info
                });
            });
            watcher.on('unlink', (name, info) => {
                // console.log(`watcher on 'unlink' for ${name} ${info.vpath}`);
                events.push({
                    event: 'unlink',
                    name, info
                });
            });
            watcher.on('error', (name, fpath, error) => {
                // console.log(`watcher on 'error' for ${name} ${fpath} ${error}`);
                events.push({
                    event: 'error',
                    name, fpath, error
                });
            });
            await watcher.watch([
                { mounted: 'partials-example',
                  mountPoint: '/' },
                { mounted: 'partials-bootstrap',
                  mountPoint: '/' },
                { mounted: 'partials-booknav',
                  mountPoint: '/' },
                { mounted: 'partials-footnotes',
                  mountPoint: '/' },
                { mounted: 'partials-embeddables',
                  mountPoint: '/' },
                { mounted: 'partials-blog-podcast',
                  mountPoint: '/' },
                { mounted: 'partials-base',
                  mountPoint: '/' },
            ]);
            ready = await new Promise((resolve, reject) => {
                try {
                    watcher.on('ready', (name) => {
                        // console.log(`watcher on 'ready' for ${name}`);
                        resolve(name); 
                    });
                } catch (err) { reject(err); }
            });

        } catch (e) {
            console.error(e);
            throw e;
        }
    });

    // copy a file into partials-example ... make sure an add event happens. 
    // touch it ... make sure a change event happens 

    // copy a file into partials-base that is hidden by another file
    // make sure no add event happens
    // touch it ... make sure no change event happens


    it('should get Ready with overlaid directories documents watcher', async function() {
        this.timeout(25000);
        try {
            let readier = await ready;
            assert.isOk(readier);
        } catch (e) {
            console.error(e);
            throw e;
        }
    });

    it('should find blog-next-prev.html.ejs in expected places', async function() {
        let found;
        for (let count = 0; count < 10; count++) {
            // Wait for a second to allow events to circulate
            await new Promise((resolve, reject) => {
                setTimeout(() => { resolve(); }, 1000);
            });

            for (let event of events) {
                if (event.event === 'add'
                && event.info.vpath === 'blog-next-prev.html.ejs') {
                    found = event;
                    break;
                }
            }

            if (found) break;
        }
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        assert.isOk(vpinfo);

        assert.equal(vpinfo.fspath, 'partials-bootstrap/blog-next-prev.html.ejs');
        assert.equal(vpinfo.mounted, 'partials-bootstrap');
        assert.equal(vpinfo.mountPoint, '/');
        assert.equal(vpinfo.pathInMounted, 'blog-next-prev.html.ejs');
        assert.equal(vpinfo.vpath, 'blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack.length, 2);

        // This is already fully tested previously.  What we're doing is
        // quickly ensuring this file is in the expected places


    });


    it('should not trigger ADD on copy blog-next-prev.html.ejs to partials-base', async function() {
        this.timeout(75000);

        await fs.copyFile('partials-bootstrap/blog-next-prev.html.ejs',
                          'partials-base/blog-next-prev.html.ejs');
        let found;
        for (let count = 0; count < 10; count++) {
            // Wait for a second to allow events to circulate
            await new Promise((resolve, reject) => {
                setTimeout(() => { resolve(); }, 1000);
            });

            for (let event of events) {
                if (event.event === 'add'
                && event.info.vpath === 'blog-next-prev.html.ejs') {
                    let instack = false;
                    for (let s of event.info.stack) {
                        if (s.fspath === 'partials-bootstrap/blog-next-prev.html.ejs') {
                            instack = true;
                            break;
                        }
                    }
                    if (instack) {
                        found = event;
                        break;
                    }
                }
            }

            if (found) break;
        }
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        assert.isOk(vpinfo);

        assert.equal(vpinfo.fspath, 'partials-bootstrap/blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack.length, 2);

        // We've copied the file to the bottom of the stack.  There should not
        // have been an event, and therefore the stack should not have changed

    });

    it('should not trigger CHANGE on touching blog-next-prev.html.ejs to partials-base', async function() {
        this.timeout(75000);

        const stats = await fs.stat('partials-base/blog-next-prev.html.ejs');
        await fs.utimes('partials-base/blog-next-prev.html.ejs',
                    stats.atimeMs + 10000, stats.mtimeMs + 10000);
        

        let found;
        for (let count = 0; count < 30; count++) {
            // Wait for a second to allow events to circulate
            await new Promise((resolve, reject) => {
                setTimeout(() => { resolve(); }, 1000);
            });

            for (let event of events) {
                if (event.event === 'change'
                && event.info.vpath === 'blog-next-prev.html.ejs') {
                    found = event;
                    break;
                }
            }

            if (found) break;
        }

        assert.isNotOk(found);

    });


    it('should trigger ADD on copy blog-next-prev.html.ejs to partials-example', async function() {
        this.timeout(75000);

        await fs.copyFile('partials-bootstrap/blog-next-prev.html.ejs',
                          'partials-example/blog-next-prev.html.ejs');
        let found;
        for (let count = 0; count < 20; count++) {
            // Wait for a second to allow events to circulate
            await new Promise((resolve, reject) => {
                setTimeout(() => { resolve(); }, 1000);
            });

            for (let event of events) {
                if (event.event === 'add'
                && event.info.vpath === 'blog-next-prev.html.ejs') {
                    let instack = false;
                    for (let s of event.info.stack) {
                        if (s.fspath === 'partials-example/blog-next-prev.html.ejs') {
                            instack = true;
                            break;
                        }
                    }
                    if (instack) {
                        found = event;
                        break;
                    }
                }
            }

            if (found) break;
        }
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
        assert.equal(found.name, name);
        let vpinfo = found.info;
        assert.isOk(vpinfo);

        assert.equal(vpinfo.fspath, 'partials-example/blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack.length, 4);

        // We've copied the file to the bottom of the stack.  There should not
        // have been an event, and therefore the stack should not have changed

    });

    it('should trigger CHANGE on touching blog-next-prev.html.ejs to partials-example', async function() {
        this.timeout(75000);

        const stats = await fs.stat('partials-example/blog-next-prev.html.ejs');
        await fs.utimes('partials-example/blog-next-prev.html.ejs',
                    stats.atimeMs + 10000, stats.mtimeMs + 10000);
        

        let found;
        for (let count = 0; count < 30; count++) {
            // Wait for a second to allow events to circulate
            await new Promise((resolve, reject) => {
                setTimeout(() => { resolve(); }, 1000);
            });

            for (let event of events) {
                if (event.event === 'change'
                && event.info.vpath === 'blog-next-prev.html.ejs') {
                    found = event;
                    break;
                }
            }

            if (found) break;
        }


        assert.isOk(found);
        assert.equal(found.name, name);

        // console.log(found);
        // console.log(found.info.stack);

        let vpinfo = found.info;
        assert.isOk(vpinfo);

        assert.equal(vpinfo.fspath, 'partials-example/blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack.length, 4);

        // We've copied the file to the middle of the stack.  There should not
        // have been an event, and therefore the stack should not have changed

        assert.equal(vpinfo.stack[0].fspath, 'partials-example/blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack[1].fspath, 'partials-bootstrap/blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack[2].fspath, 'partials-blog-podcast/blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack[3].fspath, 'partials-base/blog-next-prev.html.ejs');
    });

    // handle the unlink commands as test cases ... 
    // in partials-base there should not be an unlink event
    // in partials-example there should be a change event revealing partials-bootstrap


    it('should not trigger unlink when deleting partials-base/blog-next-prev.html.ejs', async function() {
        this.timeout(25000);
        
        await fs.unlink('partials-base/blog-next-prev.html.ejs');

        let found;
        for (let count = 0; count < 20; count++) {
            // Wait for a second to allow events to circulate
            await new Promise((resolve, reject) => {
                setTimeout(() => { resolve(); }, 1000);
            });

            for (let event of events) {
                if (event.event === 'unlink'
                 && event.info.vpath === 'blog-next-prev.html.ejs'
                 && event.info.fspath.indexOf('partials-base/blog-next-prev.html.ejs') >= 0) {
                    found = event;
                    break;
                }
            }

            if (found) break;
        }

        assert.isNotOk(found);
    });

    it('should trigger change when deleting partials-example/blog-next-prev.html.ejs', async function() {
        this.timeout(25000);
        
        await fs.unlink('partials-example/blog-next-prev.html.ejs');

        let found;
        for (let count = 0; count < 20; count++) {
            // Wait for a second to allow events to circulate
            await new Promise((resolve, reject) => {
                setTimeout(() => { resolve(); }, 1000);
            });

            for (let event of events) {
                if (event.event === 'change'
                 && event.info.vpath === 'blog-next-prev.html.ejs'
                 && event.info.fspath.indexOf('partials-bootstrap/blog-next-prev.html.ejs') >= 0) {
                    found = event;
                    break;
                }
            }

            if (found) break;
        }

        assert.isOk(found);
        assert.equal(found.name, name);

        // console.log(found);
        // console.log(found.info.stack);

        let vpinfo = found.info;
        assert.isOk(vpinfo);
        assert.equal(vpinfo.fspath, 'partials-bootstrap/blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack.length, 2);

        assert.equal(vpinfo.stack[0].fspath, 'partials-bootstrap/blog-next-prev.html.ejs');
        assert.equal(vpinfo.stack[1].fspath, 'partials-blog-podcast/blog-next-prev.html.ejs');
    });

    // next add a new file with a new name 
    // ensure an add event occurs
    // unlink the file
    // ensure an unlink event occurs 

    it('should trigger add when creating new file', async function() {
        this.timeout(25000);
        
        await fs.copyFile('partials-bootstrap/blog-next-prev.html.ejs',
                          'partials-base/blog-base-next-prev.html.ejs');
        let found;
        for (let count = 0; count < 20; count++) {
            // Wait for a second to allow events to circulate
            await new Promise((resolve, reject) => {
                setTimeout(() => { resolve(); }, 1000);
            });

            for (let event of events) {
                if (event.event === 'add'
                && event.info.vpath === 'blog-base-next-prev.html.ejs'
                && event.info.fspath.indexOf('partials-base/blog-base-next-prev.html.ejs') >= 0) {
                    found = event;
                    break;
                }
            }

            if (found) break;
        }

        assert.isOk(found);
        assert.equal(found.name, name);

        // console.log(found);
        // console.log(found.info.stack);

        let vpinfo = found.info;
        assert.isOk(vpinfo);
        assert.equal(vpinfo.fspath, 'partials-base/blog-base-next-prev.html.ejs');
        assert.equal(vpinfo.stack.length, 1);

        assert.equal(vpinfo.stack[0].fspath, 'partials-base/blog-base-next-prev.html.ejs');
    });

    it('should trigger unlink when deleting partials-base/blog-base-next-prev.html.ejs', async function() {
        this.timeout(25000);
        
        await fs.unlink('partials-base/blog-base-next-prev.html.ejs');

        let found;
        for (let count = 0; count < 20; count++) {
            // Wait for a second to allow events to circulate
            await new Promise((resolve, reject) => {
                setTimeout(() => { resolve(); }, 1000);
            });

            for (let event of events) {
                if (event.event === 'unlink'
                 && event.info.vpath === 'blog-base-next-prev.html.ejs'
                 && event.info.fspath.indexOf('partials-base/blog-base-next-prev.html.ejs') >= 0) {
                    found = event;
                    break;
                }
            }

            if (found) break;
        }

        assert.isOk(found);
        assert.equal(found.event, 'unlink');
        assert.equal(found.name, name);

        // console.log(found);
        // console.log(found.info.stack);

        let vpinfo = found.info;
        assert.isOk(vpinfo);
        assert.equal(vpinfo.fspath, 'partials-base/blog-base-next-prev.html.ejs');
        assert.isNotOk(vpinfo.stack);

    });

    it('should close the directory watcher', async function() {
        this.timeout(25000);
        await watcher.close();
    });

    /* it('should delete the files which were copied', async function() {
        await fs.unlink('partials-example/blog-next-prev.html.ejs');
        // await fs.unlink('partials-footnotes/blog-next-prev.html.ejs');
        await fs.unlink('partials-base/blog-next-prev.html.ejs');
    }); */

});

