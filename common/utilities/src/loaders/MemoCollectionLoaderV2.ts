/* eslint-disable max-lines */
import isEqual from 'lodash/isEqual';

import { computed, makeObservable, observable } from 'mobx';

import { Log } from '@molecula-monorepo/common.logs';

import { MemoStorageManager } from './MemoStorageManager';

import type {
    BaseCollectionItem,
    CollectionLoader,
    CollectionLoaderListener,
    MemoCollectionLoaderListener,
    MemoCollectionLoaderOptions,
} from './types';
import { replaceItemWithNewOne } from './utils';

const log = new Log('MemoCollectionLoader');

/**
 * An ID to identify the source of the storage.
 */
const storageManagerID = 'MemoCollectionLoader';

/**
 * An amount to limit with to last 100 items in order to cache as per LRU approach.
 */
const storageManagerLimit = 100;

/**
 * `MemoCollectionLoaderV2` is an example of CollectionLoader which can be used to load the items
 * and at the same time cache the result in storage in order to reuse it next time we need it.
 *
 * Also, `MemoCollectionLoaderV2` is second version of MemoCollectionLoader which does not reducing data
 * into dictionary format, but works with raw data presentation which helps to serve data in same
 * order as it comes from server.
 */
export class MemoCollectionLoaderV2<Item extends BaseCollectionItem>
    implements CollectionLoader<Item>
{
    /**
     * A private MobX observable error instance which might occur when fetching the collection.
     */
    private fetchError: Error | undefined = undefined;

    /**
     * A key value for storage passed in the constructor.
     */
    private key: string;

    /**
     * Amount of items to be fetched in one portion passed in the constructor.
     */
    private limit: number;

    /**
     * Top items fetcher passed in the constructor.
     */
    private topItemsFetcher: (listener: CollectionLoaderListener<Item>) => void;

    /**
     * More items fetcher passed in the constructor.
     */
    private moreItemsFetcher: (after: Item) => Promise<Item[]>;

    /**
     * A function to fetch one item by key.
     */
    private oneItemFetcher?: (key: string) => Promise<Item | null>;

    /**
     * An optional function to stop fetching the collection.
     */
    private stopItemsFetching?: () => void;

    /**
     * An optional function to subscribe to items update.
     */
    private itemSubscription?: (
        key: string,
        listener: MemoCollectionLoaderListener<Item>,
    ) => () => void;

    /**
     * A listener which should be triggered each time the top items are loaded or updated.
     */
    private listener?: MemoCollectionLoaderListener<Item>;

    /**
     * An indicator that the collection has started to load with items fetcher.
     */
    private loading: boolean = false;

    /**
     * An indicator that the top items of the collection have been loaded with the fetcher.
     */
    private topItemsLoaded: boolean = false;

    /**
     * An indicator that the collection can load more items.
     */
    private canLoadMoreItems: boolean = false;

    /**
     * A storage to cache the top loaded items in.
     */
    private storageManager: MemoStorageManager;

    /**
     * Top items of the collection (fetched with the `topItemsFetcher`).
     */
    private topItems: Item[] | null = null;

    /**
     * More items of the collection (fetched with the `moreItemsFetcher`).
     */
    private moreItems: Item[] | null = null;

    /**
     * Saved top items array in the storage. Used to avoid re-saving the same items.
     */
    private savedTopItems: Item[] = [];

    /**
     * Items subscription disposers.
     */
    private itemSubscriptionDisposers: { [key: string]: (() => void) | null } = {};

    public constructor({
        key,
        storage,
        limit,
        topItemsFetcher,
        moreItemsFetcher,
        oneItemFetcher,
        stopItemsFetching,
        itemSubscription,
    }: MemoCollectionLoaderOptions<Item>) {
        this.key = key;

        this.limit = limit;

        this.topItemsFetcher = topItemsFetcher;
        this.moreItemsFetcher = moreItemsFetcher;

        if (oneItemFetcher) {
            this.oneItemFetcher = oneItemFetcher;
        }
        if (stopItemsFetching) {
            this.stopItemsFetching = stopItemsFetching;
        }
        if (itemSubscription) {
            this.itemSubscription = itemSubscription;
        }

        this.storageManager = new MemoStorageManager({
            id: storageManagerID,
            storage,
            storeLimit: storageManagerLimit,
        });

        makeObservable<
            MemoCollectionLoaderV2<Item>,
            | 'items'
            | 'loading'
            | 'isLoading'
            | 'moreItems'
            | 'topItems'
            | 'canLoadMoreItems'
            | 'fetchError'
        >(this, {
            items: computed,
            loading: observable,
            isLoading: computed,
            canLoadMoreItems: observable,
            canLoadMore: computed,
            moreItems: observable,
            topItems: observable,
            fetchError: observable,
            error: computed,
        });
    }

    // Getters
    public get items(): Item[] {
        // Combine existing items by assigning the MOST ACTUAL items at last (which are `topItems`).
        const itemsCombined = [...(this.topItems || []), ...(this.moreItems || [])];

        // Sort all the items by the `time` in DESCENDING order.
        return itemsCombined;
    }

    /**
     * @remarks
     * As per MobX docs "Setters are automatically marked as actions."
     * See: {@link https://mobx.js.org/computeds.html#computed-setter}
     */
    private set error(error: Error | undefined) {
        this.fetchError = error;
    }

    public get error(): Error | undefined {
        return this.fetchError;
    }

    public get hasLoadedTopItems(): boolean {
        return this.topItemsLoaded;
    }

    public get isActive(): boolean {
        return !!this.listener;
    }

    public get isLoading(): boolean {
        return this.loading;
    }

    /**
     * @remarks
     * As per MobX docs "Setters are automatically marked as actions."
     * See: {@link https://mobx.js.org/computeds.html#computed-setter}
     */
    private set isLoading(loading: boolean) {
        this.loading = loading;
    }

    public get canLoadMore(): boolean {
        return this.canLoadMoreItems;
    }

    /**
     * @remarks
     * As per MobX docs "Setters are automatically marked as actions."
     * See: {@link https://mobx.js.org/computeds.html#computed-setter}
     */
    private set canLoadMore(canLoadMore: boolean) {
        this.canLoadMoreItems = canLoadMore;
    }

    // Actions
    public reset() {
        // Delete the loaded collection items (top & more)
        this.topItems = null;
        this.moreItems = null;

        // Delete the error
        this.error = undefined;

        // Mark the loader has not loaded the top items
        this.topItemsLoaded = false;

        // Mark the loader is not loading
        this.isLoading = false;

        // Unsubscribe the fetchers
        this.unsubscribe();
    }

    public prepare() {
        // N.B. This method should be called before the subscription since
        // this semaphore is required for the correct work of MultiLoader!
        this.isLoading = true;
    }

    public async subscribe(listener: MemoCollectionLoaderListener<Item>) {
        // Check if the subscription can take place
        if (this.listener != null) {
            // TODO: Think of providing an ability to subscribe on changes from multiple spots!
            const error = new Error('Attempt to subscribe on the same loader twice!');
            log.error('Failed to load the collection with error:', error);
            this.error = error;
            listener(error);
            return;
        }

        // Assign the listener and activate the subscription.
        this.listener = listener;

        // Check if ready to load the collection
        if (!this.isLoading) {
            const error = new Error('Not prepared to load the collection');
            log.error('Failed to load the collection with error:', error);
            this.error = error;
            listener(error);
            return;
        }

        // Process the items cached in the storage first
        (async () => {
            try {
                // Do not load the cached items if they're already been fetched
                // e.g. when unsubscribed the loader and re-subscribed it again
                if (this.topItems) {
                    return;
                }

                // Load the cached items from the storage
                const cachedItems = await this.storageManager.getItem(this.key);

                // Check the cached items are not empty and set them as the top items
                // only if they haven't been loaded yet with the fetcher
                if (cachedItems != null && !this.topItems) {
                    // Find the saved top items array
                    this.savedTopItems = JSON.parse(cachedItems) as Item[];

                    // Fill the top items dictionary with it
                    this.topItems = this.savedTopItems;

                    // Complete loading the cached collection from the storage
                    this.completeLoadingCollection(false);
                }
            } catch (error) {
                log.error('Failed to get the cached collection from the storage:', error);
                // Do nothing, but log an error
            }
        })();

        // Load the top items with the fetcher
        this.topItemsFetcher((error: Error | undefined, items: Item[] | undefined) => {
            if (error) {
                log.error('Failed to fetch the collection with error:', error);

                // Set the error
                this.error = error;

                if (items === undefined) {
                    // Complete loading with error
                    this.completeLoadingCollection(true);
                    return;
                }
            } else if (this.error) {
                // Remove the error if any
                this.error = undefined;
            }

            log.debug('Fetched items:', items);

            if (items !== undefined) {
                // Set the fetched top items
                const fetchedTopItems = items;

                // Check if the top items already have been loaded with the fetcher
                if (!this.topItemsLoaded) {
                    // Mark the items have been loaded with the fetcher
                    this.topItemsLoaded = true;

                    // Set the `canLoadMoreItems` flag in case we query items for the first time
                    this.canLoadMore = items.length >= this.limit;

                    // Reassign the top items with the fetched items
                    this.topItems = fetchedTopItems;
                } else {
                    // Combine existing top items with the updates received from the fetcher
                    // this.topItems = [...(this.topItems || []), ...fetchedTopItems];
                    this.topItems = [...fetchedTopItems];
                }

                // Complete loading the collection
                this.completeLoadingCollection(true);
            }
        });
    }

    public unsubscribe() {
        if (this.stopItemsFetching) {
            this.stopItemsFetching();
        }
        if (this.listener) {
            delete this.listener;
        }
    }

    public async loadMore(): Promise<void> {
        if (this.isLoading || !this.canLoadMore) {
            // Already loading or cannot load more
            return;
        }

        if (!this.lastItem) {
            // Do not have the last item
            return;
        }

        // Mark the loader to be loading items by preparing it
        this.prepare();

        try {
            // Load more items after the last one as a dictionary
            const moreItems = await this.moreItemsFetcher(this.lastItem);

            // Update more items dictionary with the loaded items
            this.moreItems = [...(this.moreItems || []), ...moreItems];

            // Check if can load more items
            this.canLoadMore = moreItems.length >= this.limit;
        } catch (error) {
            log.error('Failed to load more collection items with error:', error);
            this.error = error as Error;
        } finally {
            // Complete loading the collection
            this.completeLoadingCollection(true);
        }
    }

    public async loadItem(key: string): Promise<void> {
        const { oneItemFetcher } = this;

        if (!oneItemFetcher) {
            log.error('oneItemFetcher is not defined');
            return;
        }

        try {
            const updatedItem = await oneItemFetcher(key);
            this.updateItem(updatedItem);

            // Trigger a callback that an item was updated and update a cache if needed
            this.completeLoadingCollection(true);
        } catch (error) {
            log.error('Failed to load one collection item with error:', error);
            this.error = error as Error;
        }
    }

    public subscribeToItem(key: string): void {
        if (this.itemSubscriptionDisposers[key]) {
            log.debug('Already subscribed to item:', key);
            return;
        }

        if (!this.itemSubscription) {
            log.error('"itemSubscription" is not defined');
            return;
        }

        if (!this.listener) {
            log.error('"listener" is not defined');
            return;
        }

        this.itemSubscriptionDisposers[key] = this.itemSubscription(
            key,
            (error: Error | undefined, items: Item[] | undefined, stopListening?: boolean) => {
                items?.forEach(item => {
                    const existedItem = this.getItem(key);

                    this.updateItem(
                        {
                            ...existedItem,
                            ...item,
                        },
                        !!stopListening,
                    );
                });
                this.listener && this.listener(error, items);
            },
        );
    }

    public unsubscribeFromItem(key: string): void {
        const disposer = this.itemSubscriptionDisposers[key];
        if (!disposer) {
            log.error('Subscription is not found for the key:', key);
            return;
        }

        disposer();

        delete this.itemSubscriptionDisposers[key];
    }

    public getItem(key: string): Item | undefined {
        const { items } = this;
        return items.find(i => i.key === key);
    }

    // Internals

    private get lastItem(): Item | undefined {
        return this.items[this.items.length - 1];
    }

    private updateItem(item: Item | null, unsubscribeOnUpdate: boolean = false) {
        if (!item) {
            return;
        }

        // Should update an item only in case the top items are already loaded
        if (this.topItems) {
            this.topItems = replaceItemWithNewOne(item, this.topItems);

            if (this.moreItems) {
                this.moreItems = replaceItemWithNewOne(item, this.moreItems);
            } else {
                this.moreItems = [item];
            }
        }

        if (unsubscribeOnUpdate) {
            this.unsubscribeFromItem(item.key);
        }
    }

    private completeLoadingCollection(loadedWithFetcher: boolean) {
        if (loadedWithFetcher) {
            // Mark the top items of the collections have been loaded with the fetcher (for sure)
            this.topItemsLoaded = true;

            // Mark the collection is not loading with the fetcher
            this.isLoading = false;

            // Store the top items in storage using `this.key`
            (async () => {
                try {
                    // Get the sorted top items limited to the one portion amount to save
                    const topItems = this.items.slice(0, this.limit).filter(Boolean);

                    // Check if the top items are not empty and not already saved
                    if (topItems.length > 0 && !isEqual(this.savedTopItems, topItems)) {
                        await this.storageManager.setItem(this.key, JSON.stringify(topItems));
                        this.savedTopItems = topItems;
                    }
                } catch (error) {
                    log.error('Failed to cache the top items in the storage with error:', error);
                    // Do nothing, but log an error
                }
            })();
        }

        const memoized: boolean | undefined = this.topItems
            ? !loadedWithFetcher // The collection has been loaded from the memo storage
            : undefined; // The collection has not been loaded at all

        if (this.listener) {
            this.listener(this.error, this.items, memoized);
        }
    }
}
