import type { BaseContract, EventLog, Log as EthLog, ContractEventPayload } from 'ethers';

import type {
    TypedContractEvent as CommonTypedContractEvent,
    TypedListener as CommonTypedListener,
} from '@molecula-monorepo/common.evm-contracts/src/types'; // fix circular dependencies with this

import { Log } from '@molecula-monorepo/common.logs';
import type {
    TypedContractEvent,
    TypedListener,
} from '@molecula-monorepo/solidity/typechain-types/common';

import { BlockKeeper } from '../helpers';

// Ethereum produce 4 blocks in a minute (once in a 15 seconds)
const loadNewEventsInterval = 15_000;

/**
 * Each 20th subscription request use enlarged depth to avoid events missing
 * Value 20 equal to `once in a 5 minutes`, think it should be enough
 */
const healthCheckInterval = 20;

type Listener<T> = T extends TypedContractEvent
    ? TypedListener<T>
    : T extends CommonTypedContractEvent
      ? CommonTypedListener<T>
      : never;

export class EthereumSubscriber<
    B extends BaseContract,
    T extends TypedContractEvent | CommonTypedContractEvent,
> {
    /**
     * Contract instance to watch.
     */
    private contract: B;

    /**
     * Contract event to watch.
     */
    private event: T;

    /**
     * Last processed block.
     */
    private blockKeeper: BlockKeeper = new BlockKeeper(100);

    /**
     * Logger instance.
     */
    private log: Log;

    /**
     * Blocks amount before current to load events by default
     */
    private defaultDepth: number = -10;

    /**
     * Subscription start block
     */
    private startBlock: number | undefined;

    /**
     * Subscription interval.
     */
    private newEventsInterval: NodeJS.Timeout | undefined;

    // Constructor

    public constructor(contract: B, event: T) {
        this.log = new Log(`Ethereum Subscriber`);

        this.contract = contract;
        this.event = event;
    }

    // Public methods

    /**
     * Start to watch contract events.
     * @param callback - a callback function.
     */
    public start = async (callback: Listener<T>) => {
        // Init subscriber first if it's needed
        if (!this.startBlock) {
            // Actually always defined
            const lastBlock = (await this.contract.runner?.provider?.getBlock('latest'))?.number;
            if (lastBlock) {
                this.startBlock = lastBlock;
            }
        }

        const lastBlockTimestamp = this.blockKeeper.findNewestBlock();
        if (!lastBlockTimestamp) {
            // Block keeper is empty, try to add initial data there
            // These events are created before the subscription starts, no need to process them
            const events = await this.loadLastEvents(this.defaultDepth);

            events.map(event =>
                this.blockKeeper.addTransaction(event.blockNumber, event.transactionHash),
            );
        }

        let counter: number = 0;

        this.newEventsInterval = setInterval(async () => {
            const lastBlock = this.blockKeeper.findNewestBlock();

            counter += 1;

            // Don't use this depth for each request because it could consume a lot of credits (if using infura infrastructure)
            // https://docs.infura.io/api/learn/pricing/credit-cost
            const depth =
                counter !== healthCheckInterval
                    ? this.defaultDepth
                    : (lastBlock ?? this.startBlock ?? this.defaultDepth);

            const events = await this.loadLastEvents(depth);

            events.forEach(event => {
                // @ts-ignore (No idea how get original event, but this data is enough)
                this.processEvent(callback, ...event.args, { log: event });
            });

            if (counter === 20) {
                counter = 0;
            }
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

    // Internals

    /**
     * Load last events for subscriber instance with provided params.
     * @param fromBlock - a block to start a search search from.
     * Note: set negative value to set blocks amount before the latest.
     * @param toBlock - a block to finish a search to.
     * Note: sets `latest` if not provided.
     * @returns an event logs array.
     */
    private async loadLastEvents(
        fromBlock: number,
        toBlock?: number,
    ): Promise<(EventLog | EthLog)[]> {
        try {
            const events = await this.contract.queryFilter(this.event, fromBlock, toBlock);

            return events;
        } catch (error) {
            this.log.error('Failed to find the last events with error:', error);
            return [];
        }
    }

    /**
     * Function to process an event.
     * @param callback - a callback function.
     * @param event - an event to process.
     */
    private processEvent(callback: Listener<T>, ...args: Parameters<Listener<T>>): boolean {
        // Extract event payload from event data
        const payload: ContractEventPayload | undefined = args.find(x => {
            if (typeof x === 'object' && 'log' in x) {
                return true;
            }

            return false;
        });

        // Set `true` as default to avoid trigger restart if got event with no payload data
        // Actually it shouldn't be, but looks more logical
        let processed: boolean = true;

        if (payload?.log) {
            const { blockNumber, transactionHash } = payload.log;

            // Check is event already processed
            processed = this.blockKeeper.checkTransaction({
                block: blockNumber,
                hash: transactionHash,
                add: true,
            });

            if (!processed) {
                // Callback event data
                callback(...args);
            }
        }

        return processed;
    }
}
