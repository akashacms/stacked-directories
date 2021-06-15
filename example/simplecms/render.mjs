
import path from 'path';
import { promises as fs } from 'fs';
import { renderedOutput } from './index.mjs';

import matter from 'gray-matter';
import less from 'less';
import mdit from 'markdown-it';
import nunjucks from 'nunjucks';
import ejs from 'ejs';

const mditConfig = {
    html:         true,         // Enable html tags in source
    xhtmlOut:     true,         // Use '/' to close single tags (<br />)
    breaks:       false,        // Convert '\n' in paragraphs into <br>
    // langPrefix:   'language-',  // CSS language prefix for fenced blocks
    linkify:      true,         // Autoconvert url-like texts to links
    typographer:  false,        // Enable smartypants and other sweet transforms
  
    // Highlighter function. Should return escaped html,
    // or '' if input not changed
    highlight: function (/*str, , lang*/) { return ''; }
};

const md = mdit(mditConfig);

let njenv;
let layoutsDir;
let partialsDir;

export function init(_layoutsDir, _partialsDir) {
    layoutsDir = _layoutsDir;
    partialsDir = _partialsDir;
    njenv = new nunjucks.Environment(
        // Using watch=true requires installing chokidar
        new nunjucks.FileSystemLoader([ layoutsDir, partialsDir ], { watch: false }),
        {
            autoescape: false
        }
    );
}

// Determine the type of file
// For .less - use LessCSS 
// For .md - use MarkdownIT
// For anything else, just copy

export async function render(info) {
    let ext = path.extname(info.fspath);
    // console.log(`render ${info.fspath} ext ${ext}`);
    if (ext === '.md') await renderMarkdown(info);
    else if (ext === '.less') await renderLess(info);
    else copyFile(info);
}

export async function renderLess(info) {
    const lesstxt = await fs.readFile(info.fspath, 'utf8');

    const css = new Promise((resolve, reject) => {
        less.render(lesstxt, function (err, css) {
            if (err) reject(err);
            else     resolve(css);
        });
    });

    // Convert filename (foo.less) to CSS file name (foo.css)
    const renderPath = renderedPath(info.vpath)

    const writeTo = path.join(renderedOutput, renderPath);

    await fs.mkdir(path.dirname(writeTo), { recursive: true });
    await fs.writeFile(writeTo, css.css);

    console.log(`renderLess ${info.vpath} ==> ${writeTo}`);
}

export async function copyFile(info) {
    const writeTo = path.join(renderedOutput, info.vpath);
    await fs.mkdir(path.dirname(writeTo), { recursive: true });
    await fs.copyFile(info.fspath, writeTo);

    console.log(`copyFile ${info.vpath} ==> ${writeTo}`);
}

export async function renderMarkdown(info) {
    const mdtxt = await fs.readFile(info.fspath, 'utf8');
    // Extract the Markdown and Frontmatter
    const fm = matter(mdtxt);
    // Render the Markdown text
    const rendered = md.render(fm.content);

    const renderPath = renderedPath(info.vpath)

    const writeTo = path.join(renderedOutput, renderPath);

    // Make sure the destination directory exists
    await fs.mkdir(path.dirname(writeTo), { recursive: true });

    // If the page frontmatter declares a layout template,
    // render the content using that template.  The rendered
    // content is passed as the "content" metadata variable.
    const layoutFN = fm.data.layout
                    ? path.join(layoutsDir, fm.data.layout)
                    : undefined;
    fm.data.content = rendered;
    if (layoutFN && path.extname(layoutFN) === '.njk') {
        const layout = await fs.readFile(layoutFN, 'utf8');
        const page = njenv.renderString(layout, fm.data);
        await fs.writeFile(writeTo, page);
    } else if (layoutFN && path.extname(layoutFN) === '.ejs') {
        const layout = await fs.readFile(layoutFN, 'utf8');
        const page = ejs.render(layout, fm.data);
        await fs.writeFile(writeTo, page);
    } else {
        await fs.writeFile(writeTo, rendered);
    }

    console.log(`renderMarkdown ${info.vpath} ==> ${writeTo}`);
}

// Compute the pathname that will be rendered into
// rendered output directory
export function renderedPath(vpath) {

    let vrendered;

    // Convert the file name to '.html'
    // handle file names following both these patterns:
    //      file-name.html.md -- Comes from AkashaCMS
    //      file-name.md      -- Simple file name
    //      file-name.css.less -- Comes from AkashaCMS
    // In both cases, the extension is stripped and replaced with '.html'
    //
    //      file-name.css.less -- Comes from AkashaCMS
    //      file-name.less     -- Simple file name
    // In both cases, the extension is stripped and replaced with '.css'
    // 
    const dn = path.dirname(vpath);
    let bn;
    if (vpath.match(/\.html\.md$/)) {
        bn = path.basename(vpath, '.html.md') + '.html';
    } else if (vpath.match(/\.md$/)) {
        bn = path.basename(vpath, '.md') + '.html';
    } else if (vpath.match(/\.css\.less$/)) {
        bn = path.basename(vpath, '.css.less') + '.css';
    } else if (vpath.match(/\.less$/)) {
        bn = path.basename(vpath, '.less') + '.css';
    } else {
        bn = path.basename(vpath);
    }
    vrendered = path.join(dn, bn);

    console.log(`renderedPath ${vpath} ==> ${vrendered}`);
    return vrendered;
}
