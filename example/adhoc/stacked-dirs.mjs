
import { DirsWatcher } from '../../dist/watcher.js';

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
].map(dir => {
    return {
        mounted: dir,
        mountPoint: '/'
    }
});

const start = new Date();

try {
const docsWatcher = new DirsWatcher('documents');

const waitClose = new Promise((resolve, reject) => {

    try {
        docsWatcher.on('ready', async (name) => {
            console.log(`documents ready ${name}`);
            await close();
        })
        /* .on('change', async (name, info) => {
            console.log(`documents change ${name} ${info.vpath}`, info);
        })
        .on('add', async (name, info) => {
            console.log(`documents add ${name} ${info.vpath}`, info);
        }) */;
        
        docsWatcher.watch(dirs);
            
        async function close() {
            await docsWatcher.close();

            const finish = new Date();

            console.log(`time ${(finish - start) / 1000} seconds`);
            resolve();
        }
    } catch(errr) { reject(errr); }

});

await waitClose;

} catch (err) {
    console.error(err);
}