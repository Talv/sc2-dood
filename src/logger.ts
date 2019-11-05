import { createLogger, format, transports } from 'winston';
import * as util from 'util';

export const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({
            alias: 'time',
            format: 'hh:mm:ss.SSS',
        }),
        format.ms(),
        format.prettyPrint({ colorize: false, depth: 2 }),
        format.printf(info => {
            const out = [
                `${info.time} ${info.level.substr(0, 3).toUpperCase()} ${info.message}`
            ];

            if (info.durationMs) {
                out[out.length - 1] += ` ${info.ms}`;
            }

            const splat: any[] = info[<any>Symbol.for('splat')];
            if (Array.isArray(splat)) {
                const dump = splat.length === 1 ? splat.pop() : splat;
                out.push(util.inspect(dump, {
                    colors: false,
                    depth: 3,
                    compact: true,
                    maxArrayLength: 500,
                    breakLength: 140,
                }));
            }

            return out.join('\n');
        }),
    ),
    transports: [
        new transports.Console(),
    ],
});
