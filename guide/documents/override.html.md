---
layout: ebook-page.html.njk
title: The DirsWatcher API, and creating custom instances
---

The DirsWatcher class is defined as a regular JavaScript class.  In the recommended structure we show this:

```js
const watcher = new DirsWatcher(name);
```

This makes `watcher` into an instance of this class.  You can create as many DirsWatcher instances as your application requires, and each will execute independently.

The _name_ parameter is simply the name of this instance, and is passed along with events so that your application can be certain of which DirsWatcher has sent the event.

The API of this object starts with the EventEmitter class.  See: https://nodejs.org/api/events.html#events_class_eventemitter

The primary method, `on('event-name', handler function)`, lets your application subscribe to the DirsWatcher events.  All other EventEmitter methods are available.

The attribute `dirs` returns the configured directory stack.

The attribute `name` returns the _name_ of the DirsWatcher instance.

Calling the `watch` method tells DirsWatcher the directory stack configuration to use, and begins the process of scanning for and reporting on files.  If `watch` has already been called an error will be thrown.  To call `watch` a second time, first call `close` then call `watch`.

The `onChange`, `onAdd`, `onUnlink`, and `onReady` methods handle sending the corresponding events.  These methods are listening to the Chokidar instance, and interpret the data it provides into the `vpinfo` data structure described in [](events.html)

The `getWatched` method calls the Chokidar `getWatched` method and returns a list of files being watched.

The `vpathForFSPath` method computes the `vpinfo` object for a given filesystem path.  It does not track down the `stack` entry in this object.

The `stackForVPath` method finds all files in the directory corresponding to the supplied virtual path.

The `close` method shuts down the Chokidar instance, the side effect being that this DirsWatcher instance will no longer be listening for events.  To shut down a Node.js application, it is necessary to call this method for each DirsWatcher instance your application creates.

# Creating a custom DirsWatcher instance

Your application may want to change the behavior, such as using a different data structure than the `vpinfo` object.

Your application can implement a custom instance like so:

```js
class MyDirsWatcher extends DirsWatcher {
    ...
}
```

Then you go to town writing your own methods.


