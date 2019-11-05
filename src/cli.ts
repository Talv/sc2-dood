import * as path from 'path';
import * as fs from 'fs-extra';
import * as program from 'commander';
import { logger } from './logger';
import { ObjectsSAXHandler, ObjectsWriter, ObjectsGalaxyWriter, UserTypeWriter } from './main';

type DFormatType = 'galaxy' | 'xml';

interface DumpArgs {
    srcMap: string[];
    outMap: string;
    outFile: string;
    formatType: DFormatType;
}

async function doDump(args: DumpArgs) {
    args = Object.assign({
        srcMap: [],
        formatType: 'galaxy',
    } as DumpArgs, args);

    if (!args.srcMap || !args.srcMap.length) {
        logger.error(`"srcMap" argument required`);
        process.exit(1);
    }
    if (!args.outMap) {
        logger.error(`"outMap" argument required`);
        process.exit(1);
    }

    if (!await fs.pathExists(args.outMap)) {
        logger.error(`"${args.outMap}" doesn't exist`);
        process.exit(1);
    }

    let writer: ObjectsWriter;
    if (args.formatType === 'galaxy') {
        if (!args.outFile) {
            args.outFile = 'objs-doodads.galaxy';
        }
        writer = new ObjectsGalaxyWriter();
    }
    else if (args.formatType === 'xml') {
        if (!args.outFile) {
            args.outFile = path.join('Base.SC2Data', 'Doodads.xml');
        }
        writer = new UserTypeWriter();
    }
    else {
        logger.error(`Unsupported format type "${args.formatType}"`);
        process.exit(1);
    }

    logger.info(`Processing..`);
    writer.open(fs.createWriteStream(path.join(args.outMap, args.outFile), { flags: 'w'}));
    writer.begin();

    const reader = new ObjectsSAXHandler(writer);
    for (const key in args.srcMap) {
        await reader.processSource(args.srcMap[key]);
    }
    reader.close();

    writer.end();
    writer.close();
}

function collect(value: string, previous: string[]) {
    return previous.concat([value]);
}

program
    .name('s2dood')
    .version('0.3.0')
    .option('-s, --src-map <path>', 'source SC2Map(s)', collect, [])
    .option('-o, --out-map <path>', 'target SC2Map')
    .option('-O, --out-file <path>', 'output filename')
    .option('-F, --format-type <format>', 'output format: galaxy or xml (User Data)', void 0, 'galaxy')
    // .command('dump')
    // .action(doDump)
;

// program.on('command:*', () => {
//     logger.error('unknown command');
// })

program.parse(process.argv);
doDump(program as any);
