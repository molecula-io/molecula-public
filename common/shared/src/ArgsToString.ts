type AxiosNetworkError = {
    code: string;
    config: {
        baseURL: string;
        url: string;
        data: string;
        method: string;
    };
    message: string;
};

function axiosNetworkErrorToString({ code, config, message }: AxiosNetworkError) {
    return JSON.stringify({
        message,
        details: {
            code,
            config: {
                baseURL: config.baseURL,
                url: config.url,
                method: config.method,
                data: config.data,
            },
        },
    });
}

function isAxiosNetworkError(arg: unknown) {
    return (
        arg != null &&
        typeof arg === 'object' &&
        'name' in arg &&
        arg.name === 'AxiosError' &&
        'message' in arg &&
        arg.message === 'Network Error'
    );
}

/**
 * @param args - different types arguments array
 * @returns resulting string
 * Function to convert args to a string message.
 */
export function argsToString(args: unknown[]): string {
    return args
        .map<string>(arg => {
            // Check for regular string
            if (typeof arg === 'string') {
                return arg;
            }

            // Check for String instance
            if (arg instanceof String) {
                return arg.toString();
            }

            // Check for Error instance
            if (arg instanceof Error) {
                return arg.toString();
            }

            // Check for BigInt instance
            if (typeof arg === 'bigint') {
                return arg.toString();
            }

            // Check for Axios errors
            if (isAxiosNetworkError(arg)) {
                return axiosNetworkErrorToString(arg as never);
            }

            // Check for rest kind of Objects
            if (arg instanceof Object) {
                return JSON.stringify(
                    arg,
                    (_key, value) => {
                        // Teach BigInt to be stringified with JSON.stringify
                        // See: https://github.com/GoogleChromeLabs/jsbi/issues/30
                        return typeof value === 'bigint' ? value.toString() : value;
                    },
                    4,
                );
            }

            // Number or Boolean
            return `${arg}`;
        })
        .join(' ');
}
