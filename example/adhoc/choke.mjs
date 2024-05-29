
import { inspect } from 'util';
import { default as chokidar } from 'chokidar';


const dirs = [

    // Documents
    '/home/david/Projects/ws/techsparx.com/documents',

    // Assets
    '/home/david/Projects/ws/techsparx.com/assets',
    '/home/david/Projects/ws/techsparx.com/node_modules/bootstrap/dist',
    '/home/david/Projects/ws/techsparx.com/node_modules/jquery/dist',
    '/home/david/Projects/ws/techsparx.com/node_modules/popper.js/dist',
    '/home/david/Projects/ws/techsparx.com/node_modules/@fortawesome/fontawesome-free',
    '/home/david/Projects/ws/techsparx.com/node_modules/highlight.js',
    '/home/david/Projects/ws/techsparx.com/node_modules/swagger-ui-dist',
    '/home/david/Projects/ws/techsparx.com/vue-js-examples/example-1/dist',
    '/home/david/Projects/ws/techsparx.com/vue-js-examples/list-add-delete/dist',
    '/home/david/Projects/ws/techsparx.com/vue-js-examples/sl-vue-tree-demo/dist',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/plugins-document-viewers/assets',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/plugins-embeddables/assets',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/plugins-external-links/assets',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/plugins-affiliates/buy-images',
    '/home/david/Projects/ws/techsparx.com/node_modules/epub-website/assets',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/plugins-base/assets',

    // Layouts
    '/home/david/Projects/ws/techsparx.com/layouts',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/theme-bootstrap/layout',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/plugins-embeddables/layouts',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/plugins-affiliates/layouts',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/plugins-base/layouts',
    '/home/david/Projects/ws/techsparx.com/node_modules/akasharender/layouts',

    // Partials
    '/home/david/Projects/ws/techsparx.com/partials',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/theme-bootstrap/partials',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/plugins-authors/partials',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/plugins-breadcrumbs/partials',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/plugins-booknav/partials',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/plugins-document-viewers/partials',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/plugins-embeddables/partials',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/plugins-footnotes/partials',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/plugins-blog-podcast/partials',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/plugins-affiliates/partials',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/plugins-tagged-content/partials',
    '/home/david/Projects/ws/techsparx.com/node_modules/epub-website/partials',
    '/home/david/Projects/ws/techsparx.com/node_modules/@akashacms/plugins-base/partials',
    '/home/david/Projects/ws/techsparx.com/node_modules/akasharender/partials'
];

let watcher;

const start = new Date();
let count = 0;

try {
    await new Promise((resolve, reject) => {
        try {
            watcher = chokidar.watch(
                typeof process.argv[2] !== 'undefined'
                ? process.argv[2]
                : dirs
            );
            watcher
            .on('error', async (error) => {
                console.error(error);
                reject(error);
            })
            .on('add', (fpath, stats) => {
                // console.log(`add ${fpath} ${inspect(stats)}`);
                count++;
            })
            .on('change', (fpath, stats) => {
                // console.log(`change ${fpath} ${inspect(stats)}`);
            })
            .on('ready', async () => {
                // console.log(`ready`);
                await close();

                const finish = new Date();

                console.log(`time ${(finish - start) / 1000} seconds - ${count} files`);

                resolve();
            });
        } catch (err) { reject(err); }
    });

} catch (errr) { console.error(errr); }

async function close() {
    await watcher.close();
    watcher = undefined;
}
