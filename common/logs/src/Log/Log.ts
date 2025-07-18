/* eslint-disable max-classes-per-file */
import { Environment } from '../Environment';

import type { LogWriter } from './types';

import { DefaultWriter } from './writers';

export const defaultWriter: LogWriter = new DefaultWriter();

/**
 * Settings for particular log level (debugs, infos, warnings or errors).
 */
class LogLevelSettings {
    public enabled: boolean;

    public explicitlyEnabledSources: Set<string>;

    public explicitlyDisabledSources: Set<string>;

    public constructor() {
        this.enabled = true;
        this.explicitlyDisabledSources = new Set<string>();
        this.explicitlyEnabledSources = new Set<string>();
    }

    public setEnabled(enabled: boolean) {
        this.enabled = enabled;
    }

    public enableFor(logs: Log[]) {
        logs.forEach(log => {
            this.explicitlyEnabledSources.add(log.source);
            this.explicitlyDisabledSources.delete(log.source);
        });
    }

    public disableFor(logs: Log[]) {
        logs.forEach(log => {
            this.explicitlyDisabledSources.add(log.source);
            this.explicitlyEnabledSources.delete(log.source);
        });
    }

    /**
     * Returns true if this level is enabled for specified log.
     */
    public isEnabledFor(log: Log): boolean {
        if (this.explicitlyDisabledSources.has(log.source)) {
            return false;
        }
        if (this.explicitlyEnabledSources.has(log.source)) {
            return true;
        }
        return this.enabled;
    }
}

/**
 * Settings for logging.
 */
export class LogSettings {
    public static shared = new LogSettings();

    public static defaultWriter = defaultWriter;

    public debugs: LogLevelSettings;

    public infos: LogLevelSettings;

    public warnings: LogLevelSettings;

    public errors: LogLevelSettings;

    public writer: LogWriter;

    // Constructor
    public constructor() {
        this.writer = defaultWriter;
        this.debugs = new LogLevelSettings();
        this.infos = new LogLevelSettings();
        this.warnings = new LogLevelSettings();
        this.errors = new LogLevelSettings();
    }

    // Actions
    public enableDebug() {
        this.debugs.setEnabled(true);
    }

    public enableAll() {
        this.debugs.setEnabled(true);
        this.infos.setEnabled(true);
        this.warnings.setEnabled(true);
        this.errors.setEnabled(true);
    }

    public disableDebug() {
        this.debugs.setEnabled(false);
    }

    public disableAll() {
        this.debugs.setEnabled(false);
        this.infos.setEnabled(false);
        this.warnings.setEnabled(false);
        this.errors.setEnabled(false);
    }
}

/**
 * Log for specified source.
 */
export class Log {
    public source: string;

    public settings: LogSettings;

    public constructor(source: string) {
        this.source = source;
        this.settings = LogSettings.shared;
    }

    public debug(...args: unknown[]) {
        if (this.settings.debugs.isEnabledFor(this)) {
            this.settings.writer.debug(this.source, ...args);
        }
    }

    public info(...args: unknown[]) {
        this.settings.writer.info(this.source, ...args);
    }

    public warning(...args: unknown[]) {
        this.settings.writer.warning(this.source, ...args);
    }

    public error(...args: unknown[]) {
        const production = Environment.isProduction;
        // Should ALWAYS log errors in production!
        if (production || this.settings.errors.isEnabledFor(this)) {
            this.settings.writer.error(this.source, ...args);
        }
    }
}
