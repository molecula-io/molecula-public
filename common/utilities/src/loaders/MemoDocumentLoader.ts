import isEqual from 'lodash/isEqual';

import { Log } from '@molecula-monorepo/common.logs';

import type { AsyncStorage } from '../types';

import { MemoStorageManager } from './MemoStorageManager';

import type { DocumentLoader, DocumentLoaderListener } from './types';

type MemoDocumentLoaderOptions<Document> = {
    /**
     * Key used to store the fetched document with.
     */
    key: string;
    /**
     * Storage used to store the fetched document in.
     */
    storage: AsyncStorage;
    /**
     * Fetcher used to load the document.
     */
    documentFetcher: (listener: DocumentLoaderListener<Document>) => void;
    /**
     * Stop running the fetcher if needed (optional).
     */
    stopDocumentFetching?: () => void;
};

const log = new Log('MemoDocumentLoader');

// Let's provide an ID to let MemoStorageManager identify the source of the storage
const storageManagerID = 'MemoDocumentLoader';
// Let's limit the MemoStorageManager to 100 last items to cache as per LRU approach
const storageManagerLimit = 100;

export type MemoDocumentLoaderListener<Document> = (
    error: Error | undefined,
    document?: Document,
    memoized?: boolean, // either the listener returned a memoized result or not
) => void;

/**
 * `MemoDocumentLoader` is an example of DocumentLoader which can be used to load the document
 * and at the same time cache the result in storage in order to reuse it next time we need it.
 */
export class MemoDocumentLoader<Document> implements DocumentLoader<Document> {
    /**
     * An error instance which might occur when fetching the document.
     */
    private fetchError?: Error;

    /**
     * An instance of the fetched document.
     */
    private documentFetched?: Document | undefined;

    /**
     * A document fetcher function passed in the constructor.
     */
    private documentFetcher: (listener: DocumentLoaderListener<Document>) => void;

    /**
     * A key value for storage passed in the constructor.
     */
    private key: string;

    /**
     * A listener which should be triggered each time the document is loaded or updated.
     */
    private listener?: MemoDocumentLoaderListener<Document>;

    /**
     * An indicator that the document has started to load with the fetcher.
     */
    private loading: boolean = false;

    /**
     * An indicator that the document has been loaded with the fetcher.
     */
    private loaded: boolean = false;

    /**
     * A function to stop fetching the document.
     */
    private stopDocumentFetching?: () => void;

    /**
     * A storage to cache the document in.
     */
    private storageManager: MemoStorageManager;

    public constructor({
        documentFetcher,
        key,
        stopDocumentFetching,
        storage,
    }: MemoDocumentLoaderOptions<Document>) {
        this.documentFetcher = documentFetcher;
        this.key = key;
        if (stopDocumentFetching) {
            this.stopDocumentFetching = stopDocumentFetching;
        }

        this.storageManager = new MemoStorageManager({
            id: storageManagerID,
            storage,
            storeLimit: storageManagerLimit,
        });
    }

    // Getters
    public get document(): Document | undefined {
        return this.documentFetched;
    }

    public get error(): Error | undefined {
        return this.fetchError;
    }

    public get hasLoaded(): boolean {
        return this.loaded;
    }

    public get isActive(): boolean {
        return !!this.listener;
    }

    public get isLoading(): boolean {
        return this.loading;
    }

    // Actions
    public reset() {
        delete this.documentFetched;
        delete this.fetchError;

        this.loaded = false;
        this.loading = false;

        this.unsubscribe();
    }

    private /* used to be public */ prepare() {
        // N.B. This method should be public for `CollectionLoader` since
        // this semaphore is required for the correct work of MultiLoader.
        this.loading = true;
    }

    public subscribe(listener: MemoDocumentLoaderListener<Document>) {
        // Check if the subscription can take place
        if (this.listener != null) {
            // TODO: Think of providing an ability to subscribe on changes from multiple spots!
            const error = new Error('Attempt to subscribe on the same loader twice!');
            log.error('Failed to load the document with error:', error);
            this.fetchError = error;
            listener(error);
            return;
        }

        // Assign the listener and activate the subscription.
        this.listener = listener;

        // Check if ready to load the document
        if (!this.isLoading) {
            // It looks like unlike loading the collections this preparation is not required,
            // since we do not tend to load documents using multi-loader, and extra semaphore
            // won't be needed here. Let's comment the code below for now >>>

            /*
            const error = new Error('Not prepared to load the document');
            log.error('Failed to load the document with error:', error);
            this.fetchError = error;
            listener(error);
            return;
            */

            // Instead, prepare to load automatically
            this.prepare();
        }

        // Process the document cached in the storage first
        (async () => {
            try {
                // Do not load the cached document if it's already been fetched
                // e.g. when unsubscribed the loader and re-subscribed it again
                if (this.documentFetched) {
                    return;
                }

                // Load the cached document from the storage
                const cachedDocument = await this.storageManager.getItem(this.key);

                // Check the cached document is not empty and set it as a fetched document
                // only if the document haven't been loaded yet with the fetcher
                if (cachedDocument != null && !this.documentFetched) {
                    this.completeLoadingDocument(JSON.parse(cachedDocument) as Document, false);
                }
            } catch (error) {
                log.error('Failed to get the cached document from the storage with error:', error);
                // Do nothing, but log an error
            }
        })();

        // Load the document with the fetcher
        this.documentFetcher((error: Error | undefined, document: Document | undefined) => {
            if (error) {
                log.error('Failed to fetch the document with error:', error);

                // Set the fetch error
                this.fetchError = error;

                // Complete loading with error
                this.completeLoadingDocument(undefined, true);
                return;
            }

            // Uncomment if need to read the fetched document:
            // log.debug('Fetched document:', document);

            // Delete the fetch error
            delete this.fetchError;

            // Complete loading the document
            this.completeLoadingDocument(document, true);
        });
    }

    public unsubscribe() {
        if (this.stopDocumentFetching) {
            this.stopDocumentFetching();
        }

        if (this.listener) {
            delete this.listener;
        }
    }

    // Internals
    private completeLoadingDocument(document: Document | undefined, loadedWithFetcher: boolean) {
        if (loadedWithFetcher) {
            // Mark the document has been loaded with the fetcher
            this.loaded = true;
            this.loading = false;

            // Store the document in storage using `this.key`
            (async () => {
                try {
                    // Check if the document is present and not already saved
                    if (document && !isEqual(this.document, document)) {
                        await this.storageManager.setItem(this.key, JSON.stringify(document));
                    }
                } catch (error) {
                    log.error('Failed to cache the document in the storage with error:', error);
                    // Do nothing, but log an error
                }
            })();
        }

        // Set the fetched document
        this.documentFetched = document;

        // Find out if it was memoized
        const memoized: boolean | undefined = this.document
            ? !loadedWithFetcher // The document has been loaded from the memo storage
            : undefined; // The document has not been loaded at all

        // Trigger the document loader listener
        if (this.listener) {
            this.listener(this.error, this.document, memoized);
        }
    }
}
