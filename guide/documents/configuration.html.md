---
layout: ebook-page.html.njk
title: Installing and configuring the Stacked Directories package
# bookHomeURL: 'toc.html'
---

The `@akashacms/stacked-dirs` package is available through _npm_.  That means installation into an _npm_ project is:

```
$ npm init -y
... set up the project
$ npm install @akashacms/stacked-dirs --save
... more project setup
```

It will be installed with the package name `@akashacms/stacked-dirs`.

Three packages are installed as well:  

* `mime` - to automatically determine MIME-types for files
* `chokidar` - to handle scanning for files, and generating events on any file update
* `minimatch` - is used in matching file names against "_glob_" patterns when ignoring certain files

In your code, a basic configuration is:

```js
let events = [];
const name = 'example.com';
const watcher = new DirsWatcher(name);
watcher.on('change', (name, info) => {
    // console.log(`watcher on 'change' for ${info.vpath}`);
    // Take action for _change_ event
    events.push({
        event: 'change',
        name, info
    });
});
watcher.on('add', (name, info) => {
    // console.log(`watcher on 'add' for ${info.vpath}`);
    // Take action for _add_ event
    events.push({
        event: 'add',
        name, info
    });
});
watcher.on('unlink', (name, info) => {
    // console.log(`watcher on 'unlink' for ${info.vpath}`);
    // Take action for _unlink_ event
    events.push({
        event: 'unlink',
        name, info
    });
});
await watcher.watch([
    { mount: 'documents-main',  mountPoint: '/' },
    { mount: 'documents-guide', mountPoint: 'guide' },
    { mount: 'documents-blog',  mountPoint: 'blog' }
]);
```

The array passed to the `watch` method is where you describe the directory stack.

Internally, _DirsWatcher_ uses _Chokidar_ to scan the files.  Chokidar sends its own set of events which are internally used by DirsWatcher.  The events sent by DirsWatcher are derived from the ones sent by Chokidar, depending on the directory stack configuration.

One thing this means is initially DirsWatcher will emit a number of _add_ events, one for each file, because Chokidar is making its initial scan of the directories.  Once the initial scan is finished, DirsWatcher goes to the _Ready_ state.  This state is accessed from an exported field.

```js
let ready = await watcher.isReady;
```

The _isReady_ field is a Promise.  The Promise is resolved once the DirsWatcher has finished the initial directory scan.  The resolved value will he _true_ if the scan was successful, and _false_ otherwise.

If that turns out to not be reliable, in the test suite we found it necessary to do this instead:

```js
let ready = await new Promise((resolve, reject) => {
    try {
        watcher.on('ready', (name) => {
            // console.log(`watcher on 'ready' for ${name}`);
            resolve(name); 
        });
    } catch (err) { reject(err); }
});
```

The effect is the same, which is to use `await` to wait for the `ready` event to be sent.  This way is more explicit, however.

# Configuring the directory stack

As we see above, the directory stack is an array of objects.  Each object describes one directory in the stack.

The fields in these objects are:

* `mounted`: The file system path that is to be used
* `mountPoint`: The virtual path it is mounted to, where `/` represents a directory mounted at the root of the virtual space
* `ignore`: An array of glob patterns of files that should be ignored.  This can be used to weed out files like `.DS_Store`.




