/* eslint-disable class-methods-use-this */
/* eslint-disable max-classes-per-file */
import * as sentry from '@sentry/browser';

import { argsToString } from '@molecula-monorepo/common.shared';

import type { LogWriter } from '../types';

class SentryLogger {
    public constructor(environment: string, dsn: string) {
        if (!dsn) {
            return;
        }

        sentry.init({
            dsn,
            environment,

            // Set tracesSampleRate to 1.0 to capture 100%
            // of transactions for performance monitoring.
            // We recommend adjusting this value in production
            tracesSampleRate: 1.0,
        });
    }

    // eslint-disable-next-line class-methods-use-this
    public log(level: sentry.SeverityLevel, message: string) {
        sentry.captureMessage(message, level);
    }
}

/**
 * Log writer to sentry
 */
export class SentryWriter implements LogWriter {
    private readonly sentryLogger: SentryLogger;

    public constructor(environment: string, dsn: string) {
        this.sentryLogger = new SentryLogger(environment, dsn);
    }

    public debug() {}

    public info(source: string, ...args: unknown[]) {
        this.sentryLogger.log('info', argsToString([source, ...args]));
    }

    public warning(source: string, ...args: unknown[]) {
        this.sentryLogger.log('warning', argsToString([source, ...args]));
    }

    public error(source: string, ...args: unknown[]) {
        this.sentryLogger.log('error', argsToString([source, ...args]));
    }
}
