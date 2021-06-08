---
layout: ebook-page.html.ejs
title: Introduction to Stacked Directories
# bookHomeURL: 'toc.html'
---

In applications like static website generators, it is desired to include a dynamic builder/previewer/watcher mode to automatically rebuild the website every time a file changes.  When a new file is added, or if an existing file is changed, or if an existing file is deleted (unlinked), some or all of the website must be rebuilt.  Then for full enjoyment, once the rebuild finishes a web browser tab can be automatically reloaded.  That way an author can be editing their file, type COMMAND-S to save the file, and automatically a good quality preview shows up in a web browser.

The `@akashacms/stacked-dirs` package was created to serve that purpose within the AkashaCMS ecosystem.  This package was designed to independent enough to be used by any other package, because there is no dependency on the rest of AkashaCMS.

The concept of _Stacked Directories_ comes from AkashaCMS.  That is, a particular kind of file might be supplied by bringing together multiple directories from multiple sources.  The general concept is

* There is a virtual filesystem space created by merging content from one or more input directories in the filesystem.   ... `[ d1, d2, d3, d4, d5 ... ] ==> d-output`
* Each input directory (`d1`, etc) is mounted either to the root of the virtual filesystem, or a subdirectory.
* Each file in each input directory has a virtual path constructed by concatenating the virtual path to the path within the directory.  For example if `d2` is the directory `node_modules/bootstrap/dist`, and is mounted to the virtual path `/vendor/bootstrap`, then `js/bootstrap.min.js` has the virtual path `/vendor/bootstrap/js/bootstrap.min.js`.
* The files are considered in precedence order, which applies when two or more files have the same virtual path.  Of those files, the file which to be used is the one in the frontmost directory of the stack.  For example you might have a stack with two directories, `partials-bootstrap` and `partials-blog-podcas`.  You could have a base template `partials-blog-podcast/blog-news-river.html.ejs`, and another instance of this template as `partials-bootstrap/blog-news-river.html.ejs`.  With the precedence order just described the file in `partials-bootstrap` would be used.

In this example `partials-blog-podcast/blog-news-river.html.ejs` is said to be _hidden_ by `partials-bootstrap/blog-news-river.html.ejs`, because the latter is higher in the order of precedence.

The _kinds_ of files considered in AkashaCMS are:

* _Assets_ are files which are simply copied to the output directory unchanged.
* _Documents_ are files which are rendered from Markdown, AsciiDoc, or other formats, into HTML.
* _Layouts_ are template files describing the overall page layout.
* _Partials_ are template files describing the format of snippets on the page.

With `@akashacms/stacked-dirs`, AkashaRender (the core of AkashaCMS) constructs four Directory Stacks based on individual project configuration.


