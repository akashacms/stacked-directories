
import util from 'util';
import Chai from 'chai';
const assert = Chai.assert;
import { DirsWatcher } from '../lib/watcher.mjs';


describe('Documents simple', function() {

    let watcher;

    it('should successfully load single documents directory', async function() {
        try {
            watcher = new DirsWatcher([
                { path: 'documents-example',      mountPoint: '/' }
            ], 'akashacms-documents-simple', './persist/akashacms-documents-simple');
            
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

    it('should find feeds-tags', async function() {
        let found = await watcher.find('feeds-tags.html.md');
        // console.log(found);

        assert.isNotNull(found);
        assert.equal(found.fspath, 'documents-example/feeds-tags.html.md');
        assert.equal(found.sourcePath, 'documents-example');
        assert.equal(found.mountPoint, '/');
        assert.equal(found.pathInSource, 'feeds-tags.html.md');
        assert.equal(found.path, 'feeds-tags.html.md');
        assert.equal(found.mime, 'text/markdown');
    });

    it('should find asciidoctor', async function() {
        let found = await watcher.find('asciidoctor.html.adoc');
        // console.log(found);

        assert.isNotNull(found);
        assert.equal(found.fspath, 'documents-example/asciidoctor.html.adoc');
        assert.equal(found.sourcePath, 'documents-example');
        assert.equal(found.mountPoint, '/');
        assert.equal(found.pathInSource, 'asciidoctor.html.adoc');
        assert.equal(found.path, 'asciidoctor.html.adoc');
        assert.equal(found.mime, 'text/x-asciidoc');
    });

    it('should find json-data', async function() {
        let found = await watcher.find('json-data.html.json');
        // console.log(found);

        assert.isNotNull(found);
        assert.equal(found.fspath, 'documents-example/json-data.html.json');
        assert.equal(found.sourcePath, 'documents-example');
        assert.equal(found.mountPoint, '/');
        assert.equal(found.pathInSource, 'json-data.html.json');
        assert.equal(found.path, 'json-data.html.json');
        assert.equal(found.mime, 'application/json');
    });

    it('should find Human-Skeleton', async function() {
        let found = await watcher.find('Human-Skeleton.jpg');
        // console.log(found);

        assert.isNotNull(found);
        assert.equal(found.fspath, 'documents-example/Human-Skeleton.jpg');
        assert.equal(found.sourcePath, 'documents-example');
        assert.equal(found.mountPoint, '/');
        assert.equal(found.pathInSource, 'Human-Skeleton.jpg');
        assert.equal(found.path, 'Human-Skeleton.jpg');
        assert.equal(found.mime, 'image/jpeg');
    });

    it('should find vue-js CSS', async function() {
        let found = await watcher.find('vue-js-example.css');
        // console.log(found);

        assert.isNotNull(found);
        assert.equal(found.fspath, 'documents-example/vue-js-example.css');
        assert.equal(found.sourcePath, 'documents-example');
        assert.equal(found.mountPoint, '/');
        assert.equal(found.pathInSource, 'vue-js-example.css');
        assert.equal(found.path, 'vue-js-example.css');
        assert.equal(found.mime, 'text/css');
    });

    it('should find syncpartial EJS', async function() {
        let found = await watcher.find('syncpartial.html.ejs');
        // console.log(found);

        assert.isNotNull(found);
        assert.equal(found.fspath, 'documents-example/syncpartial.html.ejs');
        assert.equal(found.sourcePath, 'documents-example');
        assert.equal(found.mountPoint, '/');
        assert.equal(found.pathInSource, 'syncpartial.html.ejs');
        assert.equal(found.path, 'syncpartial.html.ejs');
    });

    it('should find viewer/pdf-spec-inline', async function() {
        let found = await watcher.find('viewer-js-viewer/pdf-spec-inline.html.md');
        // console.log(found);

        assert.isNotNull(found);
        assert.equal(found.fspath, 'documents-example/viewer-js-viewer/pdf-spec-inline.html.md');
        assert.equal(found.sourcePath, 'documents-example');
        assert.equal(found.mountPoint, '/');
        assert.equal(found.pathInSource, 'viewer-js-viewer/pdf-spec-inline.html.md');
        assert.equal(found.path, 'viewer-js-viewer/pdf-spec-inline.html.md');
        assert.equal(found.mime, 'text/markdown');
    });

    it('should find folder/folder/folder/index', async function() {
        let found = await watcher.find('folder/folder/folder/index.html.md');
        // console.log(found);

        assert.isNotNull(found);
        assert.equal(found.fspath, 'documents-example/folder/folder/folder/index.html.md');
        assert.equal(found.sourcePath, 'documents-example');
        assert.equal(found.mountPoint, '/');
        assert.equal(found.pathInSource, 'folder/folder/folder/index.html.md');
        assert.equal(found.path, 'folder/folder/folder/index.html.md');
        assert.equal(found.mime, 'text/markdown');
    });


    it('should close the directory watcher', async function() {
        await watcher.close();
    });

});

describe('Partials', function() {

    let watcher;

    it('should successfully load Partials directories', async function() {
        try {
            watcher = new DirsWatcher([
                { path: 'partials-example',      mountPoint: '/' },
                { path: 'partials-bootstrap',    mountPoint: '/' },
                { path: 'partials-booknav',      mountPoint: '/' },
                { path: 'partials-footnotes',    mountPoint: '/' },
                { path: 'partials-embeddables',  mountPoint: '/' },
                { path: 'partials-blog-podcast', mountPoint: '/' },
                { path: 'partials-base',         mountPoint: '/' },
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

    it('should find authorship-disabled', async function() {
        let found = await watcher.find('ak_linkreltag.html.ejs');

        assert.isNotNull(found);
        assert.equal(found.fspath, 'partials-base/ak_linkreltag.html.ejs');
        assert.equal(found.sourcePath, 'partials-base');
        assert.equal(found.mountPoint, '/');
        assert.equal(found.pathInSource, 'ak_linkreltag.html.ejs');
        assert.equal(found.path, 'ak_linkreltag.html.ejs');
    });

    it('should find blog-next-prev - overridden by partials-bootstrap', async function() {
        let found = await watcher.find('blog-next-prev.html.ejs');
        // console.log(found);

        assert.isNotNull(found);
        assert.equal(found.fspath, 'partials-bootstrap/blog-next-prev.html.ejs');
        assert.equal(found.sourcePath, 'partials-bootstrap');
        assert.equal(found.mountPoint, '/');
        assert.equal(found.pathInSource, 'blog-next-prev.html.ejs');
        assert.equal(found.path, 'blog-next-prev.html.ejs');
    });

    it('should find blog-feeds-all', async function() {
        let found = await watcher.find('blog-feeds-all.html.ejs');
        // console.log(found);

        assert.isNotNull(found);
        assert.equal(found.fspath, 'partials-blog-podcast/blog-feeds-all.html.ejs');
        assert.equal(found.sourcePath, 'partials-blog-podcast');
        assert.equal(found.mountPoint, '/');
        assert.equal(found.pathInSource, 'blog-feeds-all.html.ejs');
        assert.equal(found.path, 'blog-feeds-all.html.ejs');
    });

    it('should find ak_toc_group_element - overridden by partials-bootstrap, partials-example', async function() {
        let found = await watcher.find('ak_toc_group_element.html.ejs');
        // console.log(found);

        assert.isNotNull(found);
        assert.equal(found.fspath, 'partials-example/ak_toc_group_element.html.ejs');
        assert.equal(found.sourcePath, 'partials-example');
        assert.equal(found.mountPoint, '/');
        assert.equal(found.pathInSource, 'ak_toc_group_element.html.ejs');
        assert.equal(found.path, 'ak_toc_group_element.html.ejs');
    });

    it('should close the directory watcher', async function() {
        await watcher.close();
    });

});

describe('Documents dual with mounted', function() {

    let watcher;

    it('should successfully load dual mounted documents directories', async function() {
        try {
            watcher = new DirsWatcher([
                { path: 'documents-example',       mountPoint: '/' },
                { path: 'documents-epub-skeleton', mountPoint: 'epub' }
            ], 'akashacms-documents-dual', './persist/akashacms-documents-dual');
            
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

    it('should find feeds-tags', async function() {
        let found = await watcher.find('feeds-tags.html.md');
        // console.log(found);

        assert.isNotNull(found);
        assert.equal(found.fspath, 'documents-example/feeds-tags.html.md');
        assert.equal(found.sourcePath, 'documents-example');
        assert.equal(found.mountPoint, '/');
        assert.equal(found.pathInSource, 'feeds-tags.html.md');
        assert.equal(found.path, 'feeds-tags.html.md');
        assert.equal(found.mime, 'text/markdown');
    });

    it('should find EPUB chap1', async function() {
        let found = await watcher.find('epub/chap1.html.md');
        // console.log(found);

        assert.isNotNull(found);
        assert.equal(found.fspath, 'documents-epub-skeleton/chap1.html.md');
        assert.equal(found.sourcePath, 'documents-epub-skeleton');
        assert.equal(found.mountPoint, 'epub');
        assert.equal(found.pathInSource, 'chap1.html.md');
        assert.equal(found.path, 'epub/chap1.html.md');
        assert.equal(found.mime, 'text/markdown');
    });

    it('should find EPUB chap5/b/chap5b', async function() {
        let found = await watcher.find('epub/chap5/b/chap5b.html.md');
        // console.log(found);

        assert.isNotNull(found);
        assert.equal(found.fspath, 'documents-epub-skeleton/chap5/b/chap5b.html.md');
        assert.equal(found.sourcePath, 'documents-epub-skeleton');
        assert.equal(found.mountPoint, 'epub');
        assert.equal(found.pathInSource, 'chap5/b/chap5b.html.md');
        assert.equal(found.path, 'epub/chap5/b/chap5b.html.md');
        assert.equal(found.mime, 'text/markdown');
    });

    it('should close the directory watcher', async function() {
        await watcher.close();
    });

});
