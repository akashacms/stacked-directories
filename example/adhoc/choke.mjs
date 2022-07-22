
import { inspect } from 'util';
import { default as chokidar } from 'chokidar';

let watcher;

const start = new Date();
let count = 0;

try {
    await new Promise((resolve, reject) => {
        try {
            watcher = chokidar.watch(process.argv[2]);
            watcher
            .on('error', async (error) => {
                console.error(error);
                reject(error);
            })
            .on('add', (fpath, stats) => {
                // console.log(`add ${fpath} ${inspect(stats)}`);
                count++;
            })
            .on('change', (fpath, stats) => {
                // console.log(`change ${fpath} ${inspect(stats)}`);
            })
            .on('ready', async () => {
                // console.log(`ready`);
                await close();

                const finish = new Date();

                console.log(`time ${(finish - start) / 1000} seconds - ${count} files`);

                resolve();
            });
        } catch (err) { reject(err); }
    });

} catch (errr) { console.error(errr); }

async function close() {
    await watcher.close();
    watcher = undefined;
}
