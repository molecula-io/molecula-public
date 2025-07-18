export type LogWriter = {
    debug: (source: string, ...args: unknown[]) => void;
    info: (source: string, ...args: unknown[]) => void;
    warning: (source: string, ...args: unknown[]) => void;
    error: (source: string, ...args: unknown[]) => void;
};

/**
 * Dats infra log format
 */
export type DatsLogData = {
    '@timestamp': string;
    message: string;
    level: LogLevel;
    stack_trace?: string | undefined;
    [key: string | symbol]: unknown;
};

export enum LogLevel {
    debug = 1,
    info = 2,
    warn = 3,
    error = 4,
}
