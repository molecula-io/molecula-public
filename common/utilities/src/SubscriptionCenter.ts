import { Log } from '@molecula-monorepo/common.logs';

export type Listener<Notification, Result = void> = (
    notification: Notification,
) => Promise<Result> | Result;
export type Subscription<Notification, Result = void> = {
    listener: Listener<Notification, Result>;
};

const log = new Log('SubscriptionCenter');

export class SubscriptionCenter<Notification, Result = void> {
    // Properties

    private subscriptions: Subscription<Notification, Result>[] = [];

    // Actions

    /**
     * Method to subscribe on the subscription center.
     * @param listener - a listener to handle the subscription.
     * @returns a subscription disposer.
     */
    public subscribe(listener: Listener<Notification, Result>): () => void {
        const subscription = { listener };
        this.subscriptions.push(subscription);
        return () => {
            const index = this.subscriptions.indexOf(subscription);
            if (index >= 0) {
                this.subscriptions.splice(index, 1);
            } else {
                // Normally should never happen, since the listener must be removed only once
                log.error('Failed to remove an already removed listener from the subscriptions');
            }
        };
    }

    /**
     * Method to unsubscribe from all the subscriptions in the subscriptions center.
     */
    public unsubscribeAll() {
        this.subscriptions = [];
    }

    /**
     * Method to broadcast the notification to the subscriptions made by the subscription center.
     * @param notification - a notification to broadcast.
     * @returns a list of results provided by all the subscriptions.
     */
    public async broadcast(notification: Notification): Promise<Result[]> {
        return Promise.all(this.subscriptions.map(({ listener }) => listener(notification)));
    }
}
