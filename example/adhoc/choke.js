
const { inspect } = require('util');
const chokidar = require('chokidar');

chokidar.watch(process.argv[2])
.on('error', async (error) => {
    console.error(error);
})
.on('add', (fpath, stats) => {
    console.log(`add ${fpath} ${inspect(stats)}`);
})
.on('change', (fpath, stats) => {
    console.log(`change ${fpath} ${inspect(stats)}`);
});
  