/* eslint-disable max-classes-per-file */
/* eslint-disable class-methods-use-this */
import { jsonStringifyBigint } from '@molecula-monorepo/common.shared';

import { type DatsLogData, LogLevel, type LogWriter } from '../types';

/**
 * Log writer with dats-infra format
 */
export class DatsInfraWriter implements LogWriter {
    private formatLog(level: LogLevel, source: string, ...args: unknown[]): string {
        let message: string;
        if (typeof args[0] === 'string') {
            message = args.shift() as string;
        } else {
            message = jsonStringifyBigint(args[0]);
        }

        let stackTrace: string | undefined;
        // get stack trace and parse Error
        const filteredArgs = args.map(arg => {
            if (arg instanceof Error) {
                const error = arg as Error;
                stackTrace = error.stack;

                return {
                    message: error.message,
                    details: 'details' in error ? error.details : undefined,
                };
            }
            return arg;
        });

        // log data with dats-infra format
        const logData: DatsLogData = {
            '@timestamp': new Date().toISOString(),
            source,
            message: `${message}`,
            level,
            stack_trace: stackTrace,
            args: filteredArgs,
        };

        return jsonStringifyBigint(logData, 0);
    }

    public debug(source: string, ...args: unknown[]) {
        console.log(this.formatLog(LogLevel.debug, source, ...args));
    }

    public info(source: string, ...args: unknown[]) {
        console.info(this.formatLog(LogLevel.info, source, ...args));
    }

    public warning(source: string, ...args: unknown[]) {
        console.warn(this.formatLog(LogLevel.warn, source, ...args));
    }

    public error(source: string, ...args: unknown[]) {
        console.error(this.formatLog(LogLevel.error, source, ...args));
    }
}
