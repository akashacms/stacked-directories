
// import { DirsWatcher } from '@akashacms/stacked-dirs';
import { DirsWatcher } from '../../lib/watcher.mjs';
import path from 'path';
import { promises as fs } from 'fs';
import { render, renderedPath } from './render.mjs';

let batchmode = false;

const docsDirectories = [
    {
        mounted: '../project/documents-overlay',
        mountPoint: '/'
    },
    {
        mounted: '../../test/documents-example',
        mountPoint: '/'
    },
    {
        mounted: '../../test/documents-epub-skeleton',
        mountPoint: 'epub'
    }
];

export const renderedOutput = '../project/out';
export const layoutsDir = '../project/layouts';
export const partialsDir = '../../test/partials-base';

// Do initializations in the Render module
import { init } from './render.mjs';
init();

const docsWatcher = new DirsWatcher('documents');

docsWatcher.on('ready', async (name) => {
    console.log(`documents ready ${name}`);
    if (batchmode) await close();
})
.on('change', async (name, info) => {
    console.log(`documents change ${name} ${info.vpath}`, info);
    try {
        await render(info);
    } catch (err) {
        console.error(`documents change ERROR `, err.stack);
    }
})
.on('add', async (name, info) => {
    console.log(`documents add ${name} ${info.vpath}`, info);
    try {
        await render(info);
    } catch (err) {
        console.error(`documents add ERROR `, err.stack);
    }
})
.on('unlink', async (name, info) => {
    console.log(`documents unlink ${name} ${info.vpath}`, info);
    // TODO Convert the path into a path within renderedOutput
    try {
        await fs.unlink(path.join(renderedOutput, renderedPath(info.vpath)));
    } catch (err) {
        console.error(`documents unlink ERROR `, err.stack);
    }
});

docsWatcher.watch(docsDirectories);

async function close() {
    await docsWatcher.close();
}

