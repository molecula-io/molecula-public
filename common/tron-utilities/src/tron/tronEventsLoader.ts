/* eslint-disable no-await-in-loop */

import type { Contract as TronContract, EventResponse, GetEventResultOptions } from 'tronweb';

import type { Log } from '@molecula-monorepo/common.logs';

import type { TronBaseEvent, TronEventsLoadOptions, InternalTronEvent } from '../types';

/**
 * Subscriber info
 */
type Subscriber = {
    /**
     * Tron smart contract
     */
    contract: TronContract;

    /**
     * Logger for sending errors
     */
    log: Log;

    /**
     * Event method name to load
     */
    method: string;
};

/**
 * Load events from tronWeb api
 */
async function loadPartEvents<FilterName, Result>(
    subscriber: Subscriber,
    params: GetEventResultOptions,
): Promise<InternalTronEvent<FilterName, Result>[]> {
    try {
        if (!subscriber.contract.address) {
            throw new Error('Failed to define contract address');
        }

        const events: EventResponse =
            await subscriber.contract.tronWeb.event.getEventsByContractAddress(
                subscriber.contract.address,
                {
                    eventName: subscriber.method,
                    // https://tronweb.network/docu/docs/API%20List/event/getEventsByContractAddress
                    ...params,
                },
            );

        return events.data
            ? events.data.map(data => {
                  return {
                      transaction: data.transaction_id,
                      timestamp: data.block_timestamp,
                      block: data.block_number,
                      name: subscriber.method as FilterName,
                      result: data.result as Result,
                      index: data.event_index,
                  };
              })
            : [];
    } catch (error) {
        subscriber.log.error('Failed to find the last events with error:', error);
        return [];
    }
}

/**
 * Information about how many recent events have the same timestamp
 */
type EventsBlockInfo = {
    /**
     * Timestamp of first event
     */
    minTimestamp: number | undefined;

    /**
     * Timestamp of last event
     */
    maxTimestamp: number | undefined;
};

/**
 * Count recent events that have the same timestamp
 * @param events - Tron events list
 */
function countEventsInOneBlock(events: TronBaseEvent[]): EventsBlockInfo {
    const blockInfo: EventsBlockInfo = {
        minTimestamp: undefined,
        maxTimestamp: undefined,
    };

    for (let i = events.length - 1; i >= 0; i -= 1) {
        const event = events[i]!;

        if (blockInfo.minTimestamp === undefined || event.timestamp < blockInfo.minTimestamp) {
            blockInfo.minTimestamp = event.timestamp;
        }

        if (blockInfo.maxTimestamp === undefined || event.timestamp > blockInfo.maxTimestamp) {
            blockInfo.maxTimestamp = event.timestamp;
        }
    }

    return blockInfo;
}

// What is the maximum that the tron server can give
const MAX_DOWNLOAD_COUNT = 200;

// Hum much do we want to receive from the server per download
export const MAX_PART_SIZE = 199;

/**
 * Asynchronously loads by part Tron network events
 * @param subscriber - Subscriber used to perform event loading.
 * @param params - Parameters for loading events.
 * @param options - Optional options for loader
 */
export async function tronEventsLoad<FilterName, Result>(
    subscriber: Subscriber,
    params: GetEventResultOptions,
    options?: TronEventsLoadOptions,
) {
    const { limit: totalSize, maxBlockTimestamp, minBlockTimestamp, orderBy: order } = params;

    const orderBy: 'block_timestamp,desc' | 'block_timestamp,asc' = order ?? 'block_timestamp,desc';

    const { partSize } = options || {};

    const partSizeSafe = partSize || MAX_PART_SIZE;

    if (partSizeSafe <= 0 || partSizeSafe > MAX_PART_SIZE) {
        throw new Error(
            `Invalid parameter; partSize must be greater than 0 and less than or equal to ${MAX_PART_SIZE}`,
        );
    }

    let events: InternalTronEvent<FilterName, Result>[] = [];

    let complete: boolean = false;

    // Information about how many recent events
    let prevEventsBlockInfo: EventsBlockInfo | null = null;

    // Loaded transaction to avoid event duplication
    const loadedTransactions: Record<string, boolean> = {};

    // HACK for small partSize loading
    // Some events could have same timestamp and small part load returns only doubled events
    // So we need to increase loadSize temporary to get all events
    let doublesCompensator: number = 0;

    do {
        // How many events need to be loaded now
        const loadSize = totalSize
            ? Math.min(totalSize - events.length, partSizeSafe)
            : partSizeSafe;

        // The final quantity, taking into account that the maximum you can load is 200
        const totalSizeFinal = Math.min(loadSize, MAX_DOWNLOAD_COUNT);

        const range: { minBlockTimestamp?: number; maxBlockTimestamp?: number } = {};

        if (orderBy === 'block_timestamp,desc') {
            const max = prevEventsBlockInfo?.minTimestamp ?? maxBlockTimestamp;

            // For descending order, we need to update the maximum timestamp
            if (max) {
                range.maxBlockTimestamp = max;
            }
        }

        if (orderBy === 'block_timestamp,asc') {
            const min = prevEventsBlockInfo?.maxTimestamp ?? minBlockTimestamp;

            // For ascending order, we need to update the minimum timestamp
            if (min) {
                range.minBlockTimestamp = min;
            }
        }

        const iterationLoadSize = totalSizeFinal + doublesCompensator;

        // Loading events from the Tron network
        const loadedEvents = await loadPartEvents<FilterName, Result>(subscriber, {
            ...params,
            limit: iterationLoadSize,
            ...range,
        });

        // Count how many recent events have the same timestamp and what was the last timestamp
        const nextEventsBlockInfo = countEventsInOneBlock(loadedEvents);

        // Loaded events, excluding duplicates from the previous iteration
        const loadedWithoutDoubles = loadedEvents.filter(event => {
            const has = loadedTransactions[event.transaction];
            loadedTransactions[event.transaction] = true;
            return !has;
        });

        if (!loadedWithoutDoubles.length && loadedEvents.length === iterationLoadSize) {
            // Too many doubles
            doublesCompensator += 1;
        } else {
            doublesCompensator = 0;
        }

        events = events.concat(loadedWithoutDoubles);

        // We complete the download if we downloaded as much as required
        // or in the current iteration less was downloaded than we requested
        if (events.length === totalSize || loadedEvents.length < iterationLoadSize) {
            complete = true;
        }

        prevEventsBlockInfo = nextEventsBlockInfo;
    } while (!complete);

    return events;
}
