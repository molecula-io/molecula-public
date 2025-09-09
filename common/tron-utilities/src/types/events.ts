export type InternalTronEvent<EventName, Result> = {
    /**
     * Block number
     */
    block: number;

    /**
     * Event index
     */
    index: number;

    /**
     * Block timestamp
     */
    timestamp: number;

    /**
     * Event name
     */
    name: EventName;

    /**
     * Transaction hash
     */
    transaction: string;

    /**
     * Event data
     */
    result: Result;
};

export type TronBaseEvent = {
    /**
     * Transaction id.
     */
    transaction: string;

    /**
     * Block timestamp
     */
    timestamp: number;
};

export type TronEvent<T> = TronBaseEvent & T;

export type TronEventCallback<FilterName, Result> = (
    err: object | undefined,
    data?: InternalTronEvent<FilterName, Result>,
) => void | Promise<void>;

/**
 * Local loader options
 */
export type TronEventsLoadOptions = {
    /**
     * How much to download in one step; maximum: 200
     */
    partSize?: number;
};
