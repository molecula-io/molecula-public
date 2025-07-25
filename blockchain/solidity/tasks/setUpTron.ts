/* eslint-disable @typescript-eslint/no-explicit-any */
import { scope } from 'hardhat/config';

import type { HardhatNetworkHDAccountsConfig } from 'hardhat/types/config';

import {
    setupOAppDVN,
    setAccountantLZGasLimits,
    setCarbonOwner,
    setupUsdtOftDVN,
    syncExecutorParams,
} from '../scripts/tron';
import { getEnvironment } from '../scripts/utils/deployUtils';

const tronSetupScope = scope('tronSetupScope', 'Scope for tron setup configuration');

tronSetupScope
    .task('setCarbonOwner', 'Carbon set owner')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n TRON Deployment');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const accounts = hre.network.config.accounts as HardhatNetworkHDAccountsConfig;
        const environment = getEnvironment(hre, taskArgs.environment);
        // Execute the migration function with the retrieved parameters
        await setCarbonOwner(hre, accounts.mnemonic, accounts.path, environment)
            .then(() => {
                console.log('Set Carbon owner completed successfully.');
            })
            .catch(error => {
                console.error('Set failed:', error.message);
                console.error(error.stack); // Log full error stack trace for debugging
                process.exit(1); // Exit with an error code to indicate failure
            });
    });

tronSetupScope
    .task('setupCarbonDVN', 'Carbon OApp DVN config setup')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n TRON Deployment');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const accounts = hre.network.config.accounts as HardhatNetworkHDAccountsConfig;
        const environment = getEnvironment(hre, taskArgs.environment);
        // Execute the migration function with the retrieved parameters
        await setupOAppDVN(hre, accounts.mnemonic, accounts.path, environment)
            .then(() => {
                console.log('Setup of OApp DVN is completed successfully.');
            })
            .catch(error => {
                console.error('Set failed:', error.message);
                console.error(error.stack); // Log full error stack trace for debugging
                process.exit(1); // Exit with an error code to indicate failure
            });
    });

tronSetupScope
    .task('setupUsdtOftDVN', 'UsdtOFT OApp DVN config setup')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n TRON Deployment');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name); // Log the Hardhat network being used

        const accounts = hre.network.config.accounts as HardhatNetworkHDAccountsConfig;
        const environment = getEnvironment(hre, taskArgs.environment);

        // Execute the migration function with the retrieved parameters
        await setupUsdtOftDVN(hre, accounts.mnemonic, accounts.path, environment)
            .then(() => {
                console.log('UsdtOFT DVN setup completed successfully.');
            })
            .catch(error => {
                console.error('Set failed:', error.message);
                console.error(error.stack); // Log full error stack trace for debugging
                process.exit(1); // Exit with an error code to indicate failure
            });
    });

tronSetupScope
    .task('setupCarbonGasLimits', 'Setup AccountantLZ Gas Limits for LZ cross-chain messaging')
    .addParam('environment', 'Deployment environment') // Required parameter for specifying the set script environment
    .setAction(async (taskArgs, hre) => {
        console.log('\n TRON Deployment');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name); // Log the Hardhat network being used

        const accounts = hre.network.config.accounts as HardhatNetworkHDAccountsConfig;
        const environment = getEnvironment(hre, taskArgs.environment);

        // Execute the migration function with the retrieved parameters
        await setAccountantLZGasLimits(hre, accounts.mnemonic, accounts.path, environment)
            .then(() => {
                console.log('AcoountantLZ gasLimit setup completed successfully.');
            })
            .catch(error => {
                console.error('Set failed:', error.message);
                console.error(error.stack); // Log full error stack trace for debugging
                process.exit(1); // Exit with an error code to indicate failure
            });
    });

tronSetupScope
    .task(
        'syncExecutorParams',
        "Syncronizes the Custom Executor contract's per-destination config from the LZ Executor",
    )
    .addParam('environment', 'Deployment environment') // Required parameter for specifying the set script environment
    .setAction(async (taskArgs, hre) => {
        console.log('Environment:', taskArgs.environment); // Log the selected migration environment
        console.log('Network:', hre.network.name); // Log the Hardhat network being used

        // Retrieve environment details using the helper function
        const accounts = hre.network.config.accounts as HardhatNetworkHDAccountsConfig;
        const environment = getEnvironment(hre, taskArgs.environment);

        // Execute the migration function with the retrieved parameters
        await syncExecutorParams(hre, accounts.mnemonic, accounts.path, environment)
            .then(() => {
                console.log('Executor parametrs syncronization completed completed successfully.');
            })
            .catch(error => {
                console.error('Set failed:', error.message);
                console.error(error.stack); // Log full error stack trace for debugging
                process.exit(1); // Exit with an error code to indicate failure
            });
    });
