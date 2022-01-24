
// import { DirsWatcher } from '@akashacms/stacked-dirs';
import { DirsWatcher } from '../../lib/watcher.js';
import path from 'path';
import { promises as fs } from 'fs';
import { render, renderedPath } from './render.mjs';
import yaml from 'js-yaml';

// Read the configuration from a YAML file

if (process.argv.length < 2 || !process.argv[2]) {
    console.error('USAGE: node index.mjs config.yaml');
    process.exit(1);
}

let ymltxt = await fs.readFile(process.argv[2], 'utf8');
let cfg = yaml.load(ymltxt);

let batchmode = cfg.batchmode;

const docsDirectories = cfg.dirs.documents;

export const renderedOutput = cfg.dirs.output;
export const layoutsDir = cfg.dirs.layout;
export const partialsDir = cfg.dirs.partial;

// Do initializations in the Render module
import { init } from './render.mjs';
init(layoutsDir, partialsDir);

////////////// END OF CONFIGURATION SECTION

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

