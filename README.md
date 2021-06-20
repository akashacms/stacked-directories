# Automatically watch for changes in stacked directories

In applications like static website generators, it is desired to include a dynamic builder/previewer/watcher mode to automatically rebuild the website every time a file changes.  When a new file is added, or if an existing file is changed, or if an existing file is deleted (unlinked), some or all of the website must be rebuilt.  Then for full enjoyment, once the rebuild finishes a web browser tab can be automatically reloaded.  That way an author can be editing their file, type COMMAND-S to save the file, and automatically a good quality preview shows up in a web browser.

The `@akashacms/stacked-dirs` package was created to serve that purpose within the AkashaCMS ecosystem.  This package was designed to independent enough to be used by any other package, because there is no dependency on the rest of AkashaCMS.

The concept of _Stacked Directories_ comes from AkashaCMS.  For each type of file used in a website project -- documents, assets, layout templates, other templates -- we probably want to **assemble those files from multiple sources**, and we might want one source to be used in one directory path, another in another path, and so on.

For example _Assets_ are a kind of file that in AkashaCMS are simply copied (no modification) into the output directory.  The website might use several JavaScript libraries, like Bootstrap and jPopper, each of which come from separate _npm_ packages.  Hence you'll end up using these sets of files

* `node_modules/bootstrap/dist` would be used at `/vendor/bootstrap`
* `node_modules/bootstrap-icons` would be used at `/vendor/bootstrap-icons`
* `node_modules/popper.js/dist` would be used at `/vendor/popperjs`

That's simple enough, we're copying files from several directories into corresponding specific directories in the rendered output directory.  What's the big deal?  Wait, that's not all _Stacked Directories_ does.

Another feature is **overriding the files in a directory stack**.  To understand consider a different scenario, namely the templates.  Your static website generator could have several modules for adding functionality.  For example one module could implement blogging functionality, and among the templates it supplies is one for constructing _River of News_ displays.  Another module could be a theme, and it could override the template for _River of News_ display.  And your website could have its own customized _River of News_ template.

With _Stacked Directories_, the template directory from each plugin module is added to the templates directory stack.  When looking for a specific template, the first instance found in the directory stack is what's used.

The final feature is that _Stacked Directories_ **automatically watches for updates to every directory**, and emits _add_, _change_ and _unlink_ events as appropriate.  It also accounts for all the concerns named with the other two features.

With _Stacked Directories_ you have a leg up on building your own static website generator.  To prove this, the [source code repository](https://github.com/akashacms/stacked-directories) includes an example extremely simplified static website generator.
