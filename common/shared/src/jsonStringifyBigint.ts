/**
 * Safely convert object with bigint fields to json string.
 * @param data - Object to json string
 * @param space - A string or number that's used to insert white space into the output JSON string for readability purposes.
 */
export function jsonStringifyBigint(data: unknown, space: string | number = 4): string {
    return JSON.stringify(
        data,
        (_key, value) => {
            // Teach BigInt to be stringified with JSON.stringify
            // See: https://github.com/GoogleChromeLabs/jsbi/issues/30
            return typeof value === 'bigint' ? value.toString() : value;
        },
        space,
    );
}
