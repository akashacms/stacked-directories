
import util from 'util';
import Chai from 'chai';
const assert = Chai.assert;
import { DirsWatcher } from '../lib/watcher.mjs';
import { info } from 'console';


describe('Documents simple', function() {

    let watcher;
    let events = [];
    const name = 'test-simple';

    it('should set up simple documents watcher', async function() {
        try {
            watcher = new DirsWatcher(name);
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
            let ready = await watcher.isReady;
            assert.isOk(ready);
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
        assert.equal(vpinfo.mime, 'text/x-asciidoc');
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
    const name = 'test-overlaid';

    it('should successfully load Partials directories', async function() {
        this.timeout(25000);
        try {
            watcher = new DirsWatcher(name);
            
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
            
        } catch (e) {
            console.error(e);
            throw e;
        }
    });

    it('should get Ready with overlaid directories documents watcher', async function() {
        this.timeout(25000);
        try {
            let ready = await watcher.isReady;
            assert.isOk(ready);
        } catch (e) {
            console.error(e);
            throw e;
        }
    });

    it('should find authorship-disabled', async function() {
        let found;
        for (let event of events) {
            if (event.event === 'add' && event.info.vpath === 'ak_linkreltag.html.ejs') {
                found = event;
                break;
            }
        }
        // console.log(events);
        // console.log(found);

        assert.isNotNull(found);
        assert.isDefined(found);
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
    const name = 'test-mounted';

    it('should successfully load dual mounted documents directories', async function() {
        this.timeout(25000);
        try {
            watcher = new DirsWatcher(name);
            
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
            
        } catch (e) {
            console.error(e);
            throw e;
        }
    });

    it('should get Ready with overlaid directories documents watcher', async function() {
        this.timeout(25000);
        try {
            let ready = await watcher.isReady;
            assert.isOk(ready);
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
