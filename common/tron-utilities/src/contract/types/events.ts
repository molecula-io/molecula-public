/**
 * Filter for load events
 */
export type LoadEventsFilter = {
    /**
     * Block number
     */
    blockNumber: number;

    /**
     * Block timestamp
     */
    timestamp: number;

    /**
     * Limit
     */
    limit?: number;
};
