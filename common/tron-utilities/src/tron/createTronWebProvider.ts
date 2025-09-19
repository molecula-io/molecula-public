import type { AxiosInstance } from 'axios';
import axiosThrottle from 'axios-request-throttle';
import { TronWeb, type Types } from 'tronweb';

type TronWebParams = Types.TronWebOptions & {
    /**
     * An optional account's seed phrase or key.
     * Note, this parameter has a higher priority than a "privateKey" provided by {@link TronWebOptions}.
     */
    phraseOrKey?: string;
};

/**
 * Utility to create a tronWeb provider.
 * @param tronWebOptions - options to connect to Tron via TronWeb.
 */
export function createTronWebProvider(tronWebOptions: TronWebParams) {
    const { phraseOrKey, ...options } = tronWebOptions;

    const tronWebProvider = new TronWeb(options);

    if (phraseOrKey) {
        let privateKey: string;

        // Extract private key from incoming params
        if (phraseOrKey.includes(' ')) {
            const accountInfo = tronWebProvider.fromMnemonic(phraseOrKey, "m/44'/195'/0'/0/0");
            if (accountInfo instanceof Error) {
                throw new Error('Invalid account information returned from fromMnemonic.');
            }
            privateKey = accountInfo.privateKey.substring(2);
        } else {
            privateKey = phraseOrKey;
        }

        // Add private key into tronweb instance
        tronWebProvider.setPrivateKey(privateKey);
    }

    // Limit the amount of queries done per second on a client
    if (
        'fullNode' in tronWebProvider &&
        tronWebProvider.fullNode &&
        typeof tronWebProvider.fullNode === 'object' &&
        'instance' in tronWebProvider.fullNode
    ) {
        axiosThrottle.use(tronWebProvider.fullNode.instance as AxiosInstance, {
            requestsPerSecond: 10,
        });
    }

    if (
        'eventServer' in tronWebProvider &&
        tronWebProvider.eventServer &&
        typeof tronWebProvider.eventServer === 'object' &&
        'instance' in tronWebProvider.eventServer
    ) {
        axiosThrottle.use(tronWebProvider.eventServer.instance as AxiosInstance, {
            requestsPerSecond: 10,
        });
    }

    return tronWebProvider;
}
