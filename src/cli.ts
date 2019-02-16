import * as fs from 'fs';
import { Spinner } from 'cli-spinner';
import { ObjectsParser, ObjectsGalaxyWriter } from './main';
import * as program from 'commander';

const sp = new Spinner({
    text: 'Processing..',
});

program
    .name('s2dood')
    .version('0.2.0')
    .command('dump <in-objects> <out-galaxy>')
    .action((objectsPath: string, exportPath: string, cmd: program.Command) => {
        if (!fs.existsSync(objectsPath)) {
            console.error(`objects file doesn't exit`);
            return;
        }
        sp.start();

        const writer = new ObjectsGalaxyWriter();
        writer.open(fs.createWriteStream(exportPath, { flags: 'w'}));
        writer.start();
        const reader = new ObjectsParser(writer);
        reader.write(fs.readFileSync(objectsPath, 'utf8'));
        reader.close();
        writer.close();

        sp.stop(true);
        console.log(`Exported ${writer.oc} entries\n`);
    })
;

program.on('command:*', () => {
    console.error('unknown command');
})

program.parse(process.argv);
