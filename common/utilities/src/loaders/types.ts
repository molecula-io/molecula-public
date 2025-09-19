import type { AsyncStorage } from '../types';

// DocumentLoader
export type DocumentLoaderListener<Document> = (
    error: Error | undefined,
    document?: Document,
) => void;

/**
 * Document loader should provide an ability to fetch the document and subscribe on it's updates.
 */
export interface DocumentLoader<Document> {
    /**
     * Resets the document loader by unsubscribing from all events
     * and setting the loader to its initial state.
     */
    reset(): void;

    /**
     * Subscribe on the document loader events, which should either return the fetched document
     * or return an error in case of any failure
     * @param listener - responsible to provide an up-to-date document or an error
     */
    subscribe(listener: DocumentLoaderListener<Document>): void;

    /**
     * Unsubscribe from document loader events.
     * Might do NOTHING in case there is no need to stop fetching the document.
     */
    unsubscribe(): void;

    /**
     * Get the fetched document at any moment if present.
     */
    readonly document: Document | undefined;

    /**
     * Get the fetch error at any moment if present.
     */
    readonly error: Error | undefined;

    /**
     * Get the indicator if the document has been loaded with the fetcher.
     */
    readonly hasLoaded: boolean;

    /**
     * Get the indicator if the loader is active (subscribed).
     */
    readonly isActive: boolean;

    /**
     * Get the indicator if the loader is loading the document with the fetcher.
     */
    readonly isLoading: boolean;
}

// CollectionLoader
/**
 * Each collection item should have a unique key and its time to order.
 */
export type BaseCollectionItem = { time: number; key: string };

export type CollectionLoaderListener<Item> = (error: Error | undefined, items?: Item[]) => void;

/**
 * Collection loader should provide an ability to fetch the items in descending order (by time)
 * and subscribe on their updates.
 */
export interface CollectionLoader<Item> {
    /**
     * Resets the collection loader by unsubscribing from all events
     * and setting the loader to its initial state.
     */
    reset(): void;

    /**
     * Indicates that the loader is about to load collection items.
     */
    prepare(): void;

    /**
     * Subscribe on the collection loader events, which should either return the fetched items
     * or return an error in case of any failure
     * N.B. Should be called ONCE prepared (normally used with MultiCollectionLoader)
     * @param listener - responsible to provide an up-to-date top items or an error
     */
    subscribe(listener: CollectionLoaderListener<Item>): void;

    /**
     * Unsubscribe from collection loader events.
     * Might do NOTHING in case there is no need to stop fetching the items.
     */
    unsubscribe(): void;

    /**
     * Load more items of the collection.
     */
    loadMore(): Promise<void>;

    /**
     * Get the indicator if more items can be loaded.
     */
    readonly canLoadMore: boolean;

    /**
     * Get the indicator if the top items of the collection have been loaded with the fetcher.
     *
     * Might be useful if you want to distinguish the first load
     * (ie to show skeletons) from other items loading (like pull-to-refresh)
     */
    readonly hasLoadedTopItems: boolean;

    /**
     * Get the indicator if the loader is active (subscribed).
     */
    readonly isActive: boolean;

    /**
     * Get the indicator if the loader is loading the items with the fetcher.
     */
    readonly isLoading: boolean;

    /**
     * Get the fetched items at any moment (an array is empty if not fetched).
     */
    readonly items: Item[];

    /**
     * Get the fetch error at any moment if present.
     */
    readonly error: Error | undefined;
}

export type MemoCollectionLoaderOptions<Item extends BaseCollectionItem> = {
    /**
     * Key used to store the fetched collection items with.
     */
    key: string;
    /**
     * Storage used to store the fetched collection items in.
     */
    storage: AsyncStorage;
    /**
     * Amount of items to be fetched in one portion (i.e. first top items & each more items call)
     */
    limit: number;

    /**
     * Fetcher used to load the top items and receive updates.
     */
    topItemsFetcher: (listener: CollectionLoaderListener<Item>) => void;
    /**
     * Fetcher to load more items.
     */
    moreItemsFetcher: (after: Item) => Promise<Item[]>;
    /**
     * A function to fetch one item by key.
     */
    oneItemFetcher?: (key: string) => Promise<Item | null>;
    /**
     * Stop running the fetcher if needed (optional).
     */
    stopItemsFetching?: () => void;
    /**
     * A function to subscribe to items update.
     */
    itemSubscription?: (key: string, listener: MemoCollectionLoaderListener<Item>) => () => void;
};

export type MemoCollectionLoaderListener<Item> = (
    error: Error | undefined,
    items?: Item[],
    memoized?: boolean, // either the listener returned a memoized result or not
) => void;
