/* eslint-disable class-methods-use-this */
import { action, computed, observable, when, makeObservable } from 'mobx';

import { Log } from '@molecula-monorepo/common.logs';

/**
 * Common store class with useful `load` and `unload` methods and their processing
 */
export class CommonStore {
    /**
     * Log instance of the store
     */
    public log = new Log(this.constructor.name);

    /**
     * Flag either the store is initialized
     */
    public initialized: boolean = false;

    /**
     * Flag either the store is loading
     */
    protected loading: boolean = false;

    // Life-cycle

    /**
     * Method to load the store
     */
    public load = async () => {
        this.startLoading();
        try {
            await this.onLoad();
            this.initializeEnd();
        } catch (error) {
            // Note: this should never happen when the store is written properly!
            this.log.error(`Failed to load "${this.constructor.name}" store with error:`, error);
        } finally {
            this.stopLoading();
        }
    };

    /**
     * Method to load the store if needed, i.e. not already loading and not yet initialized
     */
    public loadIfNeeded = async () => {
        if (this.loading || this.initialized) {
            return;
        }
        await this.load();
    };

    /**
     * Method to unload the stores
     */
    public unload = async () => {
        try {
            if (!this.initialized) {
                if (!this.loading) {
                    // No need to unload
                    return;
                }

                // Wait until loaded and initialized to unloads...

                // Unconditionally display the following warning to catch slowly loading services:
                const displayWarningTimeoutInSeconds = 2; // 2 seconds
                const timeout = setTimeout(() => {
                    console.warn(
                        `CANNOT UNLOAD "${this.constructor.name}" DUE TO WAITING FOR ITS INITIALIZATION FOR MORE THAN ${displayWarningTimeoutInSeconds} SECONDS...`,
                    );
                }, displayWarningTimeoutInSeconds * 1000);

                await when(() => !this.loading && this.initialized, {
                    name: 'wait for the store initialization',
                });

                clearTimeout(timeout);
            }

            await this.onUnload();
            this.initializeReset();
        } catch (error) {
            // Note: this should never happen when the store is written properly!
            this.log.error('Unloading error:', error);
        }
    };

    /**
     * @virtual method of {@link CommonStore}.
     * Supposed to be overridden. Used to load the store data.
     */
    protected onLoad = async (): Promise<void> => {
        throw new Error('CommonStore: onLoad method must be overridden');
    };

    /**
     * @virtual method of {@link CommonStore}.
     * Supposed to be overridden. Used to unload the store data.
     */
    protected onUnload = async (): Promise<void> => {
        throw new Error('CommonStore: onUnload method must be overridden');
    };

    public constructor() {
        makeObservable<
            CommonStore,
            'loading' | 'initializeEnd' | 'initializeReset' | 'startLoading' | 'stopLoading'
        >(this, {
            initialized: observable,
            loading: observable,
            load: action,
            loadIfNeeded: action,
            unload: action,
            isLoading: computed,
            initializeEnd: action,
            initializeReset: action,
            startLoading: action,
            stopLoading: action,
        });
    }

    // Getters

    /**
     * Check if the store is loading
     */
    public get isLoading() {
        return this.loading;
    }

    // Actions

    /**
     * Method to wait until the store is initialized
     */
    public waitUntilInitialized = async (): Promise<void> => {
        if (this.initialized) {
            // Store should be loaded as it's initialized!
            return;
        }

        // Check if it's initialized after being loaded
        await when(() => this.initialized, { name: 'wait until the store is initialized' });
    };

    // Internals

    /**
     * Mark that the store has been initialized
     */
    private initializeEnd = () => {
        this.initialized = true;
    };

    /**
     * Remove the store initialization mark
     */
    private initializeReset = () => {
        this.initialized = false;
    };

    /**
     * Mark the store has started loading
     */
    private startLoading = () => {
        this.loading = true;
    };

    /**
     * Mark the store has stopped loading
     */
    private stopLoading = () => {
        this.loading = false;
    };
}
