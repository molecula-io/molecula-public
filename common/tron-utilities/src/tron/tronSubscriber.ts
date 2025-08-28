import dotenv from 'dotenv';

import type { GetEventResultOptions, Contract as TronContract } from 'tronweb';

import { BlockKeeper } from '@molecula-monorepo/common.evm-utilities/src/helpers';

import { Log } from '@molecula-monorepo/common.logs';

import type { TronEventCallback, TronEventsLoadOptions, InternalTronEvent } from '../types';

import { MAX_PART_SIZE, tronEventsLoad } from './tronEventsLoader';

// Configure dotenv and get the env variables
dotenv.config();
const { TRON_SUBSCRIPTION_INTERVAL_MULTIPLIER } = process.env;

const subscriptionIntervalMultiplier = TRON_SUBSCRIPTION_INTERVAL_MULTIPLIER
    ? Number(TRON_SUBSCRIPTION_INTERVAL_MULTIPLIER)
    : 1;

const loadNewEventsInterval = 3_000 * subscriptionIntervalMultiplier;

export class TronSubscriber {
    // Properties

    /**
     * Contract instance to watch.
     */
    private contract: TronContract;

    /**
     * Contract method to watch event.
     */
    private method: string;

    /**
     * Subscription interval.
     */
    private newEventsInterval: NodeJS.Timeout | undefined;

    /**
     * Last processed block.
     */
    private blockKeeper: BlockKeeper = new BlockKeeper(100);

    /**
     * Logger instance.
     */
    private log: Log;

    /**
     * Subscription start timestamp.
     */
    private startTimestamp: number = Date.now();

    // Constructor
    public constructor(contract: TronContract, method: string) {
        this.contract = contract;
        this.method = method;

        if (!this.contract.address) {
            throw new Error('Failed to define contract address');
        }

        const addressShort = this.contract.address.slice(0, 6);

        this.log = new Log(`Tron Subscriber ${this.method}~${addressShort}`);
    }

    // Public methods

    /**
     * Start to watch contract events.
     * @param callback - a callback function.
     */
    public start = async <FilterName, Result>(callback: TronEventCallback<FilterName, Result>) => {
        // Init subscriber first if it's needed
        const lastBlockTimestamp = this.blockKeeper.findNewestBlock();
        if (!lastBlockTimestamp) {
            // load last event to save the last timestamp
            const events = await this.loadLastEvents<FilterName, Result>({
                limit: 1,
                orderBy: 'block_timestamp,desc',
            });

            events.map(event =>
                this.blockKeeper.addTransaction(event.timestamp, event.transaction),
            );
        }

        // start check new events
        this.newEventsInterval = setInterval(() => {
            this.checkNewEvents(callback);
        }, loadNewEventsInterval);
    };

    /**
     * Stop watching the current subscription.
     */
    public stop = () => {
        // Clear interval if exists
        if (this.newEventsInterval) {
            clearInterval(this.newEventsInterval);
        }
    };

    /**
     * Load last events for subscriber instance with provided params.
     * @param params - contain size to fetch, sinceTimestamp to start with (optional) and sort order.
     * @param options - contain partSize to specify the maximum portion to load (default 200).
     * @returns loaded events array.
     */
    public async loadLastEvents<FilterName, Result>(
        params: GetEventResultOptions,
        options?: TronEventsLoadOptions,
    ): Promise<InternalTronEvent<FilterName, Result>[]> {
        return tronEventsLoad<FilterName, Result>(
            {
                log: this.log,
                method: this.method,
                contract: this.contract,
            },
            params,
            options,
        );
    }

    /**
     * Load new events if exists
     */
    private async checkNewEvents<FilterName, Result>(
        callback: TronEventCallback<FilterName, Result>,
    ): Promise<void> {
        const sinceTimestamp = this.blockKeeper.findNewestBlock();

        const events = await this.loadLastEvents<FilterName, Result>({
            orderBy: 'block_timestamp,desc',
            limit: MAX_PART_SIZE,
            minBlockTimestamp: sinceTimestamp ? sinceTimestamp + 1 : this.startTimestamp,
        });

        events.forEach(event => {
            this.processEvent<FilterName, Result>(event, callback);
        });
    }

    /**
     * Function to process an event.
     * @param event - an event to process.
     */
    private processEvent<FilterName, Result>(
        event: InternalTronEvent<FilterName, Result>,
        callback: TronEventCallback<FilterName, Result>,
    ): boolean {
        // Callback an event if it's not processed yet
        const processed = this.blockKeeper.checkTransaction({
            block: event.timestamp,
            hash: event.transaction,
            add: true,
        });

        if (!processed) {
            callback(undefined, event);
        }

        return processed;
    }
}
