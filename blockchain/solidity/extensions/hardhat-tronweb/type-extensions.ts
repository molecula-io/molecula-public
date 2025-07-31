import 'hardhat/types/runtime';
import { type TronWeb } from 'tronweb';

/**
 * Type Extensions for Hardhat TronWeb Plugin
 *
 * This module extends the Hardhat Runtime Environment (HRE) TypeScript types
 * to include the TronWeb instance. This provides proper type checking and
 * IntelliSense support when using `hre.tronweb` in scripts and tasks.
 *
 * The extension adds a `tronweb` property to the HRE interface, which
 * contains a fully configured TronWeb instance ready for blockchain
 * interactions.
 *
 * Type Safety Benefits:
 * - Prevents runtime errors from undefined `hre.tronweb`
 * - Provides autocomplete for TronWeb methods and properties
 * - Ensures consistent typing across all hardhat scripts
 *
 * Example Usage with TypeScript:
 * ```typescript
 * // TypeScript will recognize hre.tronweb as TronWeb instance
 * const contract = await hre.tronweb.contract().at(contractAddress);
 * const balance = await hre.tronweb.trx.getBalance(address);
 * ```
 */
declare module 'hardhat/types/runtime' {
    // This is an example of an extension to the Hardhat Runtime Environment.
    // This new field will be available in tasks' actions, scripts, and tests.
    export interface HardhatRuntimeEnvironment {
        /**
         * Pre-configured TronWeb instance for Tron blockchain interactions
         *
         * This instance is automatically initialized with:
         * - Network RPC URL from hardhat config
         * - Account derived from mnemonic configuration
         * - Private key set for transaction signing
         *
         * The instance is lazy-loaded, meaning it's only created when
         * first accessed, improving startup performance.
         */
        tronweb: TronWeb;
    }
}
