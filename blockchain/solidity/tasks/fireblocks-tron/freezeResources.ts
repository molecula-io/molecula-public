// eslint-disable-next-line import/no-extraneous-dependencies
import {
    BasePath,
    Fireblocks,
    TransactionOperation,
    TransferPeerPathType,
} from '@fireblocks/ts-sdk';
import { readFileSync } from 'fs';
import { scope } from 'hardhat/config';
import path from 'path';

/**
 * [UNDER DEVELOPMENT] — This script defines two Hardhat tasks for freezing TRX on the TRON blockchain
 * using Fireblocks for secure signing and broadcasting.
 *
 * ⚠️ Status: These tasks are temporary. Their final implementation,
 * parameters, and scope may change based on further feedback from the business team.
 *
 * Tasks:
 *  - `freeze-energy`: Freeze TRX for ENERGY resources on behalf of a receiver address.
 *  - `freeze-bandwith`: Freeze TRX for BANDWIDTH resources on behalf of a receiver address.
 *
 * Both tasks:
 *  - Use TronWeb to construct the freeze transaction (V2 version).
 *  - Use the Fireblocks SDK to sign and submit the raw transaction via the Fireblocks API.
 *  - Require the operator to provide a TRON receiver address and TRX amount (in SUN).
 *
 * Prerequisites:
 *  - A valid Fireblocks API key and secret key must be available.
 *  - The secret key path must be correct relative to the script location.
 *  - Fireblocks vault account ID and assetId must be configured for your environment.
 *
 * Usage Example:
 *   npx hardhat freezeResourcesScope freeze-energy --receiver `TRON_ADDRESS` --amount `TRX_IN_SUN`
 *   npx hardhat freezeResourcesScope freeze-bandwith --receiver `TRON_ADDRESS` --amount `TRX_IN_SUN`
 */

// Create a Hardhat task scope for TRON resource freezing operations via Fireblocks.
// This scope groups tasks related to freezing TRX for ENERGY or BANDWIDTH resources
// on the TRON blockchain using secure transaction signing and broadcasting.
const freezeResourcesScope = scope(
    'freezeResourcesScope',
    'Scope for TRON resource freezing tasks using Fireblocks and TronWeb.',
);

/**
 * Task: freeze-energy
 * Freezes TRX to allocate ENERGY resources for a specified TRON address using Fireblocks.
 * The transaction is constructed via TronWeb, signed, and broadcast using Fireblocks.
 *
 * Required params:
 *   - receiver: The TRON address that will receive ENERGY.
 *   - amount:   The amount of TRX to freeze, in SUN (1 TRX = 1,000,000 SUN).
 *
 * Notes:
 *   - The Fireblocks assetId is set to 'TRX_TEST' ('TRX' will be used later for mainnet).
 *   - Update Vault Account ID and assetId if needed for your environment.
 */
freezeResourcesScope
    .task('freeze-energy', 'Freeze TRX for ENERGY using Fireblocks')
    .addParam('receiver', 'The TRON address to receive ENERGY')
    .addParam('amount', 'Amount of TRX (in SUN)')
    .setAction(async (taskArgs, hre) => {
        // Validate that the provided address is a valid TRON address
        if (!hre.tronweb.isAddress(taskArgs.receiver)) {
            throw new Error(`Invalid TRON address provided: ${taskArgs.receiver}`);
        }

        const resource = 'ENERGY';

        // Build the path to the Fireblocks secret key file
        const secretPath = path.join(__dirname, '../../configs/fireblocks/fireblocks_secret.key');

        // Initialize a Fireblocks SDK instance with your API credentials and secret key
        const fireblocks = new Fireblocks({
            apiKey: process.env.FIREBLOCKS_API_KEY as string,
            basePath: BasePath.US, // Use BasePath.EU for EU region if needed
            secretKey: readFileSync(secretPath, 'utf8'),
        });

        try {
            // Build a TRON freeze transaction using tronweb
            const tx = await hre.tronweb.transactionBuilder.freezeBalanceV2(
                Number(taskArgs.amount), // Amount of TRX to freeze, in SUN
                resource, // Resource type (can be 'ENERGY' or 'BANDWIDTH')
                taskArgs.receiver, // TRON address to receive the resource
            );

            // Prepare the Fireblocks transaction payload for raw transaction broadcast
            const payload = {
                assetId: 'TRX_TEST', // Use 'TRX' for mainnet, 'TRX_TEST' for testnet
                note: `Freeze ${hre.tronweb.fromSun(taskArgs.amount)} TRX for ${resource}, receiver: ${taskArgs.receiver}`,
                source: {
                    type: TransferPeerPathType.VaultAccount,
                    id: String(1), // Might be replaced with required Vault Account ID
                },
                operation: TransactionOperation.Raw,
                extraParameters: {
                    rawMessageData: {
                        messages: [{ content: tx.raw_data_hex }],
                    },
                },
            };

            // Log the raw transaction hex for reference
            console.log('Freeze transaction raw hex:', tx.raw_data_hex);

            // Submit the transaction to Fireblocks for signing and broadcasting
            const result = await fireblocks.transactions.createTransaction({
                transactionRequest: payload,
            });

            // Log the Fireblocks transaction ID
            console.log('Fireblocks transaction submitted! ID:', result.data.id);
        } catch (err) {
            // Log errors in case the process fails
            console.error('Error freezing TRX for Energy:', err);
        }
    });

/**
 * Task: freeze-bandwith
 * Freezes TRX to allocate BANDWIDTH resources for a specified TRON address using Fireblocks.
 * The transaction is constructed via TronWeb and  signature request broadcasted using Fireblocks.
 *
 * Required params:
 *   - receiver: The TRON address that will receive BANDWIDTH.
 *   - amount:   The amount of TRX to freeze, in SUN (1 TRX = 1,000,000 SUN).
 *
 * Notes:
 *   - The Fireblocks assetId is set to 'TRX_TEST' ('TRX' will be used later for mainnet).
 *   - Update Vault Account ID and assetId if needed for your environment.
 */
freezeResourcesScope
    .task('freeze-bandwith', 'Freeze TRX for BANDWIDTH using Fireblocks')
    .addParam('receiver', 'The TRON address to receive BANDWIDTH')
    .addParam('amount', 'Amount of TRX (in SUN)')
    .setAction(async (taskArgs, hre) => {
        // Validate that the provided address is a valid TRON address
        if (!hre.tronweb.isAddress(taskArgs.receiver)) {
            throw new Error(`Invalid TRON address provided: ${taskArgs.receiver}`);
        }

        const resource = 'BANDWIDTH';

        // Build the path to the Fireblocks secret key file
        const secretPath = path.join(__dirname, '../../configs/fireblocks/fireblocks_secret.key');

        // Initialize a Fireblocks SDK instance with your API credentials and secret key
        const fireblocks = new Fireblocks({
            apiKey: process.env.FIREBLOCKS_API_KEY as string,
            basePath: BasePath.US, // Use BasePath.EU for EU region if needed
            secretKey: readFileSync(secretPath, 'utf8'),
        });

        try {
            // Build a TRON freeze transaction using tronweb
            const tx = await hre.tronweb.transactionBuilder.freezeBalanceV2(
                Number(taskArgs.amount), // Amount of TRX to freeze, in SUN
                resource, // Resource type (can be 'ENERGY' or 'BANDWIDTH')
                taskArgs.receiver, // TRON address to receive the resource
            );

            // Prepare the Fireblocks transaction payload for raw transaction broadcast
            const payload = {
                assetId: 'TRX_TEST', // Use 'TRX' for mainnet, 'TRX_TEST' for testnet
                note: `Freeze ${hre.tronweb.fromSun(taskArgs.amount)} TRX for ${resource}, receiver: ${taskArgs.receiver}`,
                source: {
                    type: TransferPeerPathType.VaultAccount,
                    id: String(1), // Might be replaced with required Vault Account ID
                },
                operation: TransactionOperation.Raw,
                extraParameters: {
                    rawMessageData: {
                        messages: [{ content: tx.raw_data_hex }],
                    },
                },
            };

            // Log the raw transaction hex for reference
            console.log('Freeze transaction raw hex:', tx.raw_data_hex);

            // Submit the transaction to Fireblocks for signing and broadcasting
            const result = await fireblocks.transactions.createTransaction({
                transactionRequest: payload,
            });

            // Log the Fireblocks transaction ID
            console.log('Fireblocks transaction submitted! ID:', result.data.id);
        } catch (err) {
            // Log errors in case the process fails
            console.error('Error freezing TRX for Energy:', err);
        }
    });
