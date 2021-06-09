---
layout: ebook-page.html.ejs
title: Stacked Directory events
# bookHomeURL: 'toc.html'
---

Once you have configured a DirsWatcher instance (see [](configuration.html)), you will have a JavaScript object that is sending out events.  It uses the normal EventEmitter interface paradigm.

The recommended usage is:

```js
const watcher = new DirsWatcher('watcher-name');

watcher.on('change', (name, vpinfo) => { ... });
watcher.on('add', (name, vpinfo) => { ... });
watcher.on('unlink', (name, vpinfo) => { ... });
watcher.on('ready', (name, vpinfo) => { ... });

await watcher.watch([ ... ]);
```

This ensures the event handlers are configured before DirsWatcher starts watching the directories in the stack.  In this way, your application will not miss any events.

The DirsWatcher instance will stay active until your application calls the `watcher.close` method.  One effect is that Node.js will not exit until you do so, because it is keeping the Node.js event loop active.

# The Add event

_Add_ events are sent for files added to the directory stack.

These events are sent with the signature:

```js
function (name, vpinfo) { ... }
```

The `name` parameter contains the name of the DirsWatcher instance.  The `vpinfo` parameter contains a data structure describing the file and any instances in the directory stack.  That structure is discussed below.

While performing the initial scan of the directories _Add_ events are sent for every file.  Once the `ready` event is sent, the initial scan is stopped.  Afterward _Add_ events are only sent for newly added files.

Whether an event is sent depends on the position of the added file within the directory stack.  Remember the discussion of precedence order in [](index.html).

With a directory stack:

```js
await watcher.watch([
    { mounted: 'documents-main',  mountPoint: '/' },
    { mounted: 'documents-guide', mountPoint: 'guide' },
    { mounted: 'documents-blog',  mountPoint: 'blog' }
]);
```

Then consider these files:

Directory        | Path 
-----------------|------
`documents-main` | `blog/2021/announcement.html.md`
`documents-blog` | `2021/announcement.html.md`

Both of these files have the same virtual path, `blog/2021/announcement.html.md`.  This means the copy in `documents-main` overrides the copy in `documents-blog`.

Given a stack like this, is it always appropriate to send the _Add_ event?  If the added file is hidden by another file, it does not make sense to send the Add event, and DirsWatcher does not do so.

Consider if only `documents-main/blog/2021/announcement.html.md` exists.  If you then add the second file, `documents-blog/2021/announcement.html.md`, both have the same virtual path.  Since the first file has higher precedence, adding the second file will suppress the Add event.

If it's the other way around, that only `documents-blog/2021/announcement.html.md` exists, and you then add `documents-main/blog/2021/announcement.html.md`.  In this case the Add event will be generated because the newly added file has higher precedence.

The _vpinfo_ object has this structure:

* `fspath`: Full file system path name
* `vpath`: Virtual path for the file
* `mime`: MIME type
* `mounted`: The directory where this file was found
* `mountPoint`: Virtual directory to which the parent directory is mounted
* `pathInMounted`: The path for this file relative to the `mounted` directory
* `stack`: An array of `vpinfo` instances corresponding to all instances of the virtual path within the configured directory stack


# The Change event

_Change_ events are sent for files which have changed.

These events are sent with the signature:

```js
function (name, vpinfo) { ... }
```

The `name` parameter contains the name of the DirsWatcher instance.  The `vpinfo` parameter contains a data structure describing the file and any instances in the directory stack.  That structure is the same as was discussed for the _Add_ event.

Whether an event is sent depends on the position of the added file within the directory stack.  Remember the discussion of precedence order in [](index.html).

The considerations are almost identical to the discussion for the _Add_ event.  Namely, if the changed file is hidden by another file, the _Change_ event is not sent.

Consider these files:

Directory        | Path 
-----------------|------
`documents-main` | `blog/2021/announcement.html.md`
`documents-blog` | `2021/announcement.html.md`

A change to `documents-blog/2021/announcement.html.md` does not trigger a _Change_ event.

A change to `documents-main/blog/2021/announcement.html.md` does trigger a _Change_ event.

There is a third instance for the _Change_ event, which has to do with deleting files.  If the file being deleted hides another file, then a change event is sent showing the file which has been uncovered.  That is, if `documents-main/blog/2021/announcement.html.md` is deleted, then a _Change_ event is emitted describing `documents-blog/2021/announcement.html.md`.

# The Unlink event

_Unlink_ events are sent for files which have been deleted.

These events are sent with the signature:

```js
function (name, vpinfo) { ... }
```

The `name` parameter contains the name of the DirsWatcher instance.  The `vpinfo` parameter contains a data structure describing the file and any instances in the directory stack.  That structure is the same as was discussed for the _Add_ event, but there is no `stack` member.

Whether an event is sent depends on the position of the added file within the directory stack.  Remember the discussion of precedence order in [](index.html).

If the deleted file is hidden by another file, no _Unlink_ event is sent.

If deleting the front-most file causes a hidden file to be revealed, a _Change_ event is sent instead.

If there is only one file for the virtual path in the stack, then an _Unlink_ event is sent.

# The Ready event

_Ready_ events are sent when Chokidar emits its _Ready_ event.  This means, the Ready event is sent when the initial directory scan is completed.

These events are sent with the signature:

```js
function (name) { ... }
```

The `name` parameter contains the name of the DirsWatcher instance. 







