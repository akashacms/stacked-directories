
import { stat } from 'fs';
import { stat as stat_p } from 'fs/promises';

import { inspect } from 'util';

const fn = process.argv[2];

stat(fn, (err, stats) => {
    if (err) console.error(err);
    else {
        console.log(inspect(stats));
        console.log(inspect(stats.isSymbolicLink));
    }
});

try {
    const stats = await stat_p(fn);
    console.log(inspect(stats));
    console.log(inspect(stats.isSymbolicLink));
} catch (err) {
    console.error(err);
}