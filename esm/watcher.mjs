
/* The intention was to have TypeScript compile ES6 modules 

But.. When it came to using the "mime" package there was no 
default export, and the getType function was not found.

It was found to work more correctly to compile to CommonJS module.
In such a case, the mime package loaded correctly and used with no problem */

export {
    VPathData,
    DirsWatcher,
    mimedefine
} from '../dist/watcher.js';
