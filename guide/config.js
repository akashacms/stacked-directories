
// Change is good

const akasha  = require('akasharender');
const path    = require('path');
// const hljs    = require('highlight.js'); // https://highlightjs.org/

const config = new akasha.Configuration(module.filename);

config.configDir = __dirname;

config.rootURL("hhttps://akashacms.github.io/stacked-directories/");

// config.setConcurrency(10);

config
    // .addAssetsDir('assets')
    .addAssetsDir({ src: 'node_modules/bootstrap/dist', dest: 'vendor/bootstrap' })
    .addAssetsDir({ src: 'node_modules/jquery/dist',    dest: 'vendor/jquery'    })
    .addAssetsDir({ src: 'node_modules/popper.js/dist', dest: 'vendor/popper.js' })
    .addAssetsDir({ src: 'node_modules/@fortawesome/fontawesome-free', dest: 'vendor/fontawesome-free' })
    // .addAssetsDir({ src: 'node_modules/highlight.js', dest: 'vendor/highlight.js' })
    
    .addAssetsDir({
        src: 'node_modules/@fortawesome/fontawesome-free',
        dest: 'vendor/fontawesome-free'
    })
    .addLayoutsDir('layouts')
    .addDocumentsDir({
        src: 'documents',
        dest: '/',
        baseMetadata: {
            bookHomeURL: "/index.html"
        }
    })
    .addPartialsDir('partials');

config
    .use(require('@akashacms/theme-bootstrap'))
    .use(require('@akashacms/plugins-base'), {
        generateSitemapFlag: true
    })
    .use(require('@akashacms/plugins-authors'), {
        default: 'david',
        authors: [
            {
                code: 'david',
                fullname: 'David Herron',
                url: '/about.html',
                imgsrc: '/img/headshot-new.jpg',
                bio: 'David Herron is a writer and software engineer focusing on the wise use of technology.  He is especially interested in clean energy technologies like solar power, wind power, and electric cars.  David worked for nearly 30 years in Silicon Valley on software ranging from electronic mail systems, to video streaming, to the Java programming language, and has published several books on Node.js programming and electric vehicles.'
            }
        ]
    })
    .use(require('@akashacms/plugins-breadcrumbs'))
    .use(require('@akashacms/plugins-booknav'))
    .use(require('epub-website'));

config
    .addFooterJavaScript({ href: "/vendor/jquery/jquery.min.js" })
    .addFooterJavaScript({ href: "/vendor/popper.js/umd/popper.min.js" })
    .addFooterJavaScript({ href: "/vendor/bootstrap/js/bootstrap.min.js" })
    .addStylesheet({ href: "/vendor/bootstrap/css/bootstrap.min.css" })
    .addStylesheet({ href: "/vendor/fontawesome-free/css/all.min.css" });

config.setMahabhutaConfig({
    recognizeSelfClosing: true,
    recognizeCDATA: true
});

config.prepare();
module.exports = config;
