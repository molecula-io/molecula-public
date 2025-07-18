/* eslint-disable class-methods-use-this */

import kleur from 'kleur';

import { LogLevel, type LogWriter } from '../types';

/**
 * Default console writer for node
 */
export class DefaultWriter implements LogWriter {
    private formatLog(level: LogLevel, source: string, ...args: unknown[]): unknown[] {
        const time = new Date().toISOString();

        let levelColor;
        let levelText: string;
        switch (level) {
            case LogLevel.debug:
                levelColor = kleur.bold().green;
                levelText = 'DEBUG';
                break;
            case LogLevel.info:
                levelColor = kleur.bold().blue;
                levelText = 'INFO';
                break;
            case LogLevel.warn:
                levelColor = kleur.bold().cyan;
                levelText = 'WARN';
                break;
            case LogLevel.error:
                levelColor = kleur.bold().red;
                levelText = 'ERROR';
                break;
            default:
                levelColor = kleur.bold().reset;
                levelText = `UNKNOWN_LEVEL_${level}`;
                break;
        }

        return [kleur.gray(time), levelColor(levelText.padEnd(7)), `[${source}]`, ...args];
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
