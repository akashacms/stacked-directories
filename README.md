# Automatically watch for changes in stacked directories

In applications like static website generators, it is desired to include a dynamic builder/previewer/watcher mode to automatically rebuild the website every time a file changes.  When a new file is added, or if an existing file is changed, or if an existing file is deleted (unlinked), some or all of the website must be rebuilt.  Then for full enjoyment, once the rebuild finishes a web browser tab can be automatically reloaded.  That way an author can be editing their file, type COMMAND-S to save the file, and automatically a good quality preview shows up in a web browser.

The `@akashacms/stacked-dirs` package was created to serve that purpose within the AkashaCMS ecosystem.  This package was designed to independent enough to be used by any other package, because there is no dependency on the rest of AkashaCMS.

The concept of _Stacked Directories_ comes from AkashaCMS.  That is, a particular kind of file might be supplied by bringing together multiple directories from multiple sources.

For example _Assets_ are a kind of file that in AkashaCMS are simply copied (no modification) into the output directory.  The website might use several JavaScript libraries, like Bootstrap and jPopper, each of which come from separate _npm_ packages.  Hence you'll end up using files from  `node_modules/bootstrap/dist`, `node_modules/bootstrap-icons`, and `node_modules/popper.js/dist` in the website, but these files would be copied into `/vendor/PROJECT-NAME` in the output directory.

That means you have the content of at least three different locations which are slotted into specific locations in the output directory.

With `@akashacms/stacked-dirs`, the 

In AkashaCMS, the general concept is 