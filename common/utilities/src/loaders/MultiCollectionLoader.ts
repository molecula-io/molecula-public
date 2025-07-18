import cloneDeep from 'lodash/cloneDeep';
import merge from 'lodash/merge';

import { Log } from '@molecula-monorepo/common.logs';

import type { BaseCollectionItem, CollectionLoader, CollectionLoaderListener } from './types';

type MultiCollectionLoaderOptions<Item extends BaseCollectionItem> = {
    /**
     * An array of loaders which tend to load the items of specified type
     */
    loaders: CollectionLoader<Item>[];
};

const log = new Log('MultiCollectionLoader');

/**
 * `MultiCollectionLoader` is an example of CollectionLoader which can be used to load the items
 * from a set of loaders which tend to load the same type of Items.
 */
export class MultiCollectionLoader<Item extends BaseCollectionItem>
    implements CollectionLoader<Item>
{
    /**
     * An error instance which might occur when fetching the collection.
     */
    private fetchError?: Error;

    /**
     * An array of loaders passed in the constructor.
     */
    private loaders: CollectionLoader<Item>[];

    /**
     * A listener which should be triggered each time the top items are loaded or updated.
     */
    private listener?: CollectionLoaderListener<Item>;

    /**
     * Merged items of the collection.
     */
    private mergedItems?: { [key: string]: Item };

    /**
     * Array of `time` properties of the last item for each `active` loaders.
     */
    private lastItemTimeForActiveLoaders: number[] = [];

    /**
     * Array with loaders responses marks.
     */
    private loadersResponses: boolean[] = [];

    public constructor({ loaders }: MultiCollectionLoaderOptions<Item>) {
        if (!loaders.length) {
            throw new Error('No loaders have been passed to a MultiCollectionLoader');
        }

        this.loaders = loaders;
        this.lastItemTimeForActiveLoaders = new Array(this.loaders.length);
        this.loadersResponses = new Array(this.loaders.length).fill(false);
    }

    // Getters
    public get items(): Item[] {
        if (!this.mergedItems) {
            return [];
        }

        // Sort all the items by the `time` in DESCENDING order.
        const sortedItems = Object.values(this.mergedItems).sort((a, b) => b.time - a.time);

        // Show only the "visible" items which we can show by trimming the items,
        // knowing the last visible item time taken when checking all the loaders

        // The items can be "trimmed" as described above only in tws cases
        // 1) Multi-collection loader is not loading and some loader `canLoadMore`
        // 2) All loaders have responded, but the multi-loader is still loading,
        // e.g. could happen if one of `loader` is MemoCollectionLoader instance.
        if ((!this.isLoading && this.canLoadMore) || (this.isLoading && this.hasAllResponses)) {
            const lastVisibleItemTime = this.getLastVisibleItemTime();
            return sortedItems.filter(item => lastVisibleItemTime <= item.time);
        }

        return sortedItems;
    }

    public get error(): Error | undefined {
        return this.fetchError;
    }

    public get hasLoadedTopItems(): boolean {
        return this.loaders.every(loader => loader.hasLoadedTopItems);
    }

    public get isActive(): boolean {
        return !!this.listener;
    }

    public get isLoading(): boolean {
        // The multi-loader is loading in case some of its loaders are still loading
        return this.loaders.some(loader => loader.isLoading);
    }

    public get canLoadMore(): boolean {
        // The multi-loader can load more in case some of its loaders can load more
        // and at the same time loaders are not loading at the moment.
        return this.loaders.some(loader => loader.canLoadMore) && !this.isLoading;
    }

    // Actions
    public reset() {
        // Delete the loaded collection items (top & more)
        delete this.mergedItems;

        // Delete the fetch error
        delete this.fetchError;

        // Clean the flags for the last items `time`
        this.lastItemTimeForActiveLoaders = new Array(this.loaders.length);

        // Clean the responses from the loaders
        this.cleanLoadersResponses();

        // Reset all loaders
        this.loaders.forEach(loader => loader.reset());

        // Unsubscribe the loader
        this.unsubscribe();
    }

    public prepare() {
        // Mark all loaders that we are about to load the collection
        this.loaders.forEach(loader => loader.prepare());
    }

    public async subscribe(listener: CollectionLoaderListener<Item>) {
        // Check if the subscription can take place
        if (this.listener != null) {
            // TODO: Think of providing an ability to subscribe on changes from multiple spots!
            const error = new Error('Attempt to subscribe on the same loader twice!');
            log.error('Failed to load the multi-collection with error:', error);
            this.fetchError = error;
            listener(error);
            return;
        }

        // Assign the listener and activate the subscription.
        this.listener = listener;

        // Check if ready to load the collection
        if (!this.isLoading) {
            const error = new Error('Not prepared to load the collection');
            log.error('Failed to load the multi-collection with error:', error);
            this.fetchError = error;
            listener(error);
            return;
        }

        // Load the items for each loader
        this.loaders.forEach(loader => {
            loader.subscribe(() => {
                // Append new items from the loader
                this.appendItems(loader);
                // Complete loading if needed
                this.completeLoadingCollectionIfReady();
            });
        });
    }

    public unsubscribe() {
        // Unsubscribe all loaders
        this.loaders.forEach(loader => loader.unsubscribe());

        // Delete the multi collection loader listener
        if (this.listener) {
            delete this.listener;
        }
    }

    public async loadMore(): Promise<void> {
        if (this.isLoading || !this.canLoadMore) {
            // Already loading or cannot load more
            return;
        }

        // Mark that loaders have not responded yet
        this.cleanLoadersResponses();

        // Load more for each loader
        await Promise.all(
            this.loaders.map(async (loader, index) => {
                // Wrap each iteration independently in order to finish all of them, instead of
                // rejecting await Promise.all which will stop in case of any failure occurrences
                try {
                    await loader.loadMore();
                } catch (error) {
                    log.error(
                        `Failed to load more items from the (${index}) loader with error:`,
                        error,
                    );
                    // Do not complete loading the collection, just save an error (just in case)
                    this.fetchError = error as Error;
                }
            }),
        );
    }

    // Internals
    /**
     * Method to check if each loader has responded
     */
    private get hasAllResponses(): boolean {
        return this.loadersResponses.every(Boolean);
    }

    /**
     * Method to mark the loader has responded
     * @param index - index of the loader
     */
    private markLoaderHasResponded(index: number) {
        if (index < 0 || index >= this.loaders.length) {
            throw new Error('Wrong loader index to mark');
        }

        this.loadersResponses[index] = true;
    }

    /**
     * Method to clean the marks for each loader that it has responded
     */
    private cleanLoadersResponses(): void {
        this.loadersResponses = new Array(this.loaders.length).fill(false);
    }

    /**
     * @returns the last visible in this multi-collection item timestamp
     */
    private getLastVisibleItemTime(): number {
        // We need to select the MOST RECENT time among all loaders which can load more items
        return this.lastItemTimeForActiveLoaders.reduce((acc, curr) => {
            return curr != null ? Math.max(acc, curr) : acc;
        }, 0);
    }

    /**
     * Method to append loaded items and find the save the time of the last item for the loader
     */
    private appendItems(loader: CollectionLoader<Item>) {
        // Find the index of the loader
        const index = this.loaders.indexOf(loader);
        if (index < 0) {
            throw new Error(
                'Something is wrong. Failed to find the loader in MultiCollectionLoader',
            );
        }

        // Mark the loader has responded
        this.markLoaderHasResponded(index);

        // Check if loader returned an error
        if (loader.error) {
            // MultiCollectionLoader reflects only the latest received error from any of the loader
            this.fetchError = loader.error;
            return;
        }

        // Save last item time for the given loader
        if ((loader.canLoadMore || loader.isLoading) && loader.items && loader.items.length > 0) {
            // It's an active loader, save its last item time to learn the last visible one later
            this.lastItemTimeForActiveLoaders[index] = loader.items[loader.items.length - 1]!.time;
        } else {
            // Finished loading, its last item time doesn't affect pagination anymore!
            delete this.lastItemTimeForActiveLoaders[index];
        }

        // Merge the items
        const itemsDictionary = { ...this.mergedItems };
        loader.items.forEach(item => {
            const loadedItem = itemsDictionary[item.key];
            if (!loadedItem) {
                // Item is not yet loaded, store its COPY in the items dictionary!

                // Note, that it's important to store the copy of the item instead of
                // storing the item itself, as it might be modified in MultiCollectionLoader,
                // e.g. with `lodash/merge` function below. Meanwhile we do not want to modify
                // an original item loaded with the regular CollectionLoader, since its properties
                // might be used internally by CollectionLoader's instance logic, e.g. when loading
                // more items relaying on the item's info data and such properties as `updated`, etc
                itemsDictionary[item.key] = cloneDeep(item);
            } else {
                // Merge already loaded item with the newly appending item

                // Ensure to pick the highest `time` when merging two items
                const time = Math.max(loadedItem.time, item.time);
                const mergedItem = merge(loadedItem, item); // Note, that `loadedItem` is modifying
                mergedItem.time = time;

                // Store the merged item in the dictionary
                itemsDictionary[item.key] = mergedItem;
            }
        });
        this.mergedItems = itemsDictionary;
    }

    private completeLoadingCollectionIfReady() {
        // Cannot complete loading the collection if it's still loading
        // and not all loaders have responded
        if (this.isLoading && !this.hasAllResponses) {
            return;
        }

        // Trigger the listener
        if (this.listener) {
            this.listener(this.error, this.items);
        }
    }
}
