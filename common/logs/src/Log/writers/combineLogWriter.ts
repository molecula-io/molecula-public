import type { LogWriter } from '../types';

/**
 * Combine writer
 */
export class CombineLogWriter implements LogWriter {
    private readonly loggers: LogWriter[];

    public constructor(loggers: LogWriter[]) {
        this.loggers = loggers;
    }

    public debug(source: string, ...args: unknown[]) {
        this.loggers.forEach(log => log.debug(source, ...args));
    }

    public info(source: string, ...args: unknown[]) {
        this.loggers.forEach(log => log.info(source, ...args));
    }

    public warning(source: string, ...args: unknown[]) {
        this.loggers.forEach(log => log.warning(source, ...args));
    }

    public error(source: string, ...args: unknown[]) {
        this.loggers.forEach(log => log.error(source, ...args));
    }
}
