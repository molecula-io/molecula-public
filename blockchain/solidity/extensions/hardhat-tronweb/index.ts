import { extendEnvironment } from 'hardhat/config';
import { lazyObject } from 'hardhat/plugins';
import type { HardhatNetworkHDAccountsConfig, HttpNetworkUserConfig } from 'hardhat/types/config';

import { TronWeb } from 'tronweb';

/**
 * Hardhat TronWeb Plugin
 *
 * This plugin extends the Hardhat Runtime Environment (HRE) to provide
 * a pre-configured TronWeb instance that can be accessed via `hre.tronweb`.
 *
 * Features:
 * - Lazy initialization: TronWeb is only created when first accessed
 * - Network-aware configuration: Uses current network settings
 * - Mnemonic-based account setup: Derives accounts from hardhat config
 * - Error handling: Validates account setup and private key configuration
 *
 * Usage:
 * ```typescript
 * // In any hardhat script or task
 * const contract = await hre.tronweb.contract().at(contractAddress);
 * ```
 */
extendEnvironment(hre => {
    // We add a field to the Hardhat Runtime Environment here.
    // We use lazyObject to avoid initializing things until they are actually
    // needed.
    // eslint-disable-next-line no-param-reassign
    hre.tronweb = lazyObject(() => {
        // Extract network configuration from hardhat config
        const httpNetConfig = hre.network.config as HttpNetworkUserConfig;
        const accounts = hre.network.config.accounts as HardhatNetworkHDAccountsConfig;

        // Initialize TronWeb with network RPC URL
        const tronWeb = new TronWeb({
            fullHost: httpNetConfig.url!,
        });

        // Derive account from mnemonic using hardhat's account configuration
        // This ensures consistency with other hardhat tools (ethers, etc.)
        const info = tronWeb.fromMnemonic(accounts.mnemonic, accounts.path);

        // Validate that account derivation was successful
        if (info instanceof Error) {
            throw new Error('Invalid account information returned from fromMnemonic.');
        }

        // Set the private key for transaction signing
        // Remove '0x' prefix as TronWeb expects raw hex string
        tronWeb.setPrivateKey(info.privateKey.substring(2));

        // Verify that the account was properly configured
        // This ensures the TronWeb instance is ready for contract interactions
        if (!tronWeb.defaultAddress.base58) {
            throw new Error('Invalid private key');
        }

        return tronWeb;
    });
});
