import { Command } from 'commander/esm.mjs';
const program = new Command();

import path from 'path';
import { promises as fs } from 'fs';
import fse from 'fs-extra';

import { DirsWatcher } from 'stacked-dirs';

import data from './node_modules/akasharender/data.js';
data.init();

program
    .option('--config <config>',
            'AkashaCMS config file')
    .option('--collection <name>',
            'Collection name in internal cache',
            'filez')
    .option('--persist <path>',
            'Directory to persist data to',
            './persist')

program.parse(process.argv);

const options = program.opts();

// console.log(options);

const config_module = await import(options.config);
const config = config_module.default;

// import config from './config.js';

///////////////////// Documents watcher

const docsDirs = config.documentDirs.map(dir => {
    // console.log('document dir ', dir);
    if (typeof dir === 'string') return { path: dir, mountPoint: '/' };
    else return { path: dir.src, mountPoint: dir.dest };
});

const docsWatcher = new DirsWatcher(docsDirs,
                                    'documents',
                                    './persist/docs');

await docsWatcher.dbinit();
docsWatcher.start();

await new Promise((resolve, reject) => {
    docsWatcher.on('ready', () => {
        console.log('documents ready ');
        resolve();
    });
    docsWatcher.on('change', async info => {
        console.log('document changed ', info.path);

        data.remove(info.sourcePath, info.path);

        config.akasha.cache.del("filez-findRendersTo", info.path);
        let found = await config.akasha.findRendersTo(config, info.path);
        config.akasha.cache.del("filez-findRendersTo", info.path);
        config.akasha.cache.del("filez-findRendersTo", found.foundPath);

        let cachekey = `fm-${info.sourcePath}-/${info.path}`;
        let cachekey2 = `fm-${info.sourcePath}-${info.path}`;
        config.akasha.cache.del("htmlrenderer", cachekey);
        config.akasha.cache.del("htmlrenderer", cachekey2);

        let result = await config.akasha.renderPath(config, found.foundPath);
        console.log(result);
    });
    docsWatcher.on('add', async info => {
        // console.log('document add ', info.path);

        let renderer = config.findRendererPath(info.path);
        let rpath = renderer
                    ? renderer.filePath(info.path)
                    : info.path;
        let renderedto = path.join(config.renderDestination, rpath);

        let statSrc;
        let statDest;

        try {
            statSrc = await fs.stat(info.fspath);
        } catch (e) { statSrc = undefined; }
        try {
            statDest = await fs.stat(renderedto);
        } catch (e) { statDest = undefined; }

        let doRender = false;
        if (!statDest && statSrc) {
            doRender = true;
        } else if (statSrc && statDest && statSrc.ctime > statDest.ctime) {
            doRender = true;
        }

        // console.log(`document add fspath ${info.fspath} ${statSrc ? statSrc.ctime : -1} renderedto ${renderedto}  ${statDest ? statDest.ctime : -1} ${doRender ? 'RENDER' : 'SKIP'}`);

        if (doRender) {
            data.remove(info.mountPoint, info.path);

            config.akasha.cache.del("filez-findRendersTo", info.path);
            let found = await config.akasha.findRendersTo(config, info.path);
            config.akasha.cache.del("filez-findRendersTo", info.path);
            config.akasha.cache.del("filez-findRendersTo", found.foundPath);

            let cachekey = `fm-${info.sourcePath}-/${info.path}`;
            let cachekey2 = `fm-${info.sourcePath}-${info.path}`;
            config.akasha.cache.del("htmlrenderer", cachekey);
            config.akasha.cache.del("htmlrenderer", cachekey2);

            let result = await config.akasha.renderPath(config, found.foundPath);
            console.log(result);
        }
    });
});

//////////////////////// Assets Watcher

const assetsDirs = config.assetDirs.map(dir => {
    // console.log('assets dir ', dir);
    if (typeof dir === 'string') return { path: dir, mountPoint: '/' };
    else return { path: dir.src, mountPoint: dir.dest };
});

const assetsWatcher = new DirsWatcher(assetsDirs,
                                    'assets',
                                    './persist/assets');

await assetsWatcher.dbinit();
assetsWatcher.start();

await new Promise((resolve, reject) => {
    assetsWatcher.on('ready', () => {
        console.log('assets ready ');
        resolve();
    });
    assetsWatcher.on('change', async info => {
        console.log('asset changed ', info.path);

        await fse.copy(info.fspath,
                        path.join(config.renderDestination, info.path));
    });
    assetsWatcher.on('add', async info => {
        // console.log('asset add ', info.path);

        await fse.copy(info.fspath,
                        path.join(config.renderDestination, info.path));
    });
});


//////////////////////// Partials & Layouts Watcher

const templatez = config.partialsDirs.concat(config.layoutDirs);

const templatezDirs = templatez.map(dir => {
    // console.log('template dir ', dir);
    if (typeof dir === 'string') return { path: dir, mountPoint: '/' };
    else return { path: dir.src, mountPoint: dir.dest };
});

const templatesWatcher = new DirsWatcher(templatezDirs,
                                    'templates',
                                    './persist/templates');

await templatesWatcher.dbinit();
templatesWatcher.start();

await new Promise((resolve, reject) => {
    templatesWatcher.on('ready', () => {
        console.log('template ready ');
        resolve();
    });
    templatesWatcher.on('change', async info => {
        console.log('template changed ', info.path);

        let results = await config.akasha.render(config);
        for (let result of results) {
            if (result.error) {
                console.error(result.error);
            } else {
                console.log(result.result);
            }
        }
    });

    // Using ADD causes a rebuild for every file 
    // TODO need a way to avoid this for the initial scan 

    // NOT NEEDED for this add event to cause a full rebuild.
    // Rationale is that an added template is not referenced
    // by an existing thing.  Instead the existing thing will
    // shortly be modified to reference the template.

    templatesWatcher.on('add', async info => {
        // console.log('template add ', info.path);

        /* let results = await akasha.render(config);
        for (let result of results) {
            if (result.error) {
                console.error(result.error);
            } else {
                console.log(result.result);
            }
        } */
    });
});


process.on('uncaughtException', (err, origin) => {
    fs.writeSync(
      process.stderr.fd,
      `Caught exception: ${err}\n` +
      `Exception origin: ${origin}`
    );
});

/* const unhandledRejections = new Map();
process.on('unhandledRejection', (reason, promise) => {
  unhandledRejections.set(promise, reason);
});

process.on('rejectionHandled', (promise) => {
  unhandledRejections.delete(promise);
}); */
