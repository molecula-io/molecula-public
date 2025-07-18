/* eslint-disable class-methods-use-this */

import { LogLevel, type LogWriter } from '../types';

/**
 * Default console writer for web
 */
export class DefaultWriter implements LogWriter {
    private formatLog(level: LogLevel, source: string, ...args: unknown[]): unknown[] {
        const time = new Date().toISOString();

        let levelText: string;
        switch (level) {
            case LogLevel.debug:
                levelText = 'DEBUG';
                break;
            case LogLevel.info:
                levelText = 'INFO';
                break;
            case LogLevel.warn:
                levelText = 'WARN';
                break;
            case LogLevel.error:
                levelText = 'ERROR';
                break;
            default:
                levelText = `UNKNOWN_LEVEL_${level}`;
                break;
        }

        return [time, levelText, `[${source}]`, ...args];
    }

    public debug(source: string, ...args: unknown[]) {
        console.log(...this.formatLog(LogLevel.debug, source, ...args));
    }

    public info(source: string, ...args: unknown[]) {
        console.info(...this.formatLog(LogLevel.info, source, ...args));
    }

    public warning(source: string, ...args: unknown[]) {
        console.warn(...this.formatLog(LogLevel.warn, source, ...args));
    }

    public error(source: string, ...args: unknown[]) {
        console.error(...this.formatLog(LogLevel.error, source, ...args));
    }
}
