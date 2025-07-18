/* eslint-disable class-methods-use-this */
/* eslint-disable max-classes-per-file */
import type { LogWriter } from '../types';

/**
 * Log writer to sentry
 * TODO: setup for React Native
 */
export class SentryWriter implements LogWriter {
    // @ts-ignore
    // eslint-disable-next-line no-useless-constructor,@typescript-eslint/no-unused-vars,no-empty-function
    public constructor(environment: string, dsn: string) {}

    public debug() {}

    public info() {}

    public warning() {}

    public error() {}
}
