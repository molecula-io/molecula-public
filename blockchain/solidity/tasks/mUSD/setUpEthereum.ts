import { scope } from 'hardhat/config';

import {
    setOAppPeer,
    setCarbonOwner,
    setCoreOwner,
    setNitrogenOwner,
    setupUsdtOftDVN,
    syncExecutorParams,
    setAgentLZGasLimits,
    setupOAppDVN,
} from '../../scripts/mUSD/ethereum';

import { getEnvironment, readFromFile } from '../../scripts/utils/deployUtils';

const ethereumSetupScope = scope('ethereumSetupScope', 'Scope for set ethereum script flow');

ethereumSetupScope
    .task('setNitrogenOwner', 'Nitrogen set owner')
    .addParam('environment', 'Deployment environment') // Required parameter for specifying the set script environment
    .setAction(async (taskArgs, hre) => {
        console.log('Environment:', taskArgs.environment); // Log the selected migration environment
        console.log('Network:', hre.network.name); // Log the Hardhat network being used

        // Retrieve environment details using the helper function
        const environment = getEnvironment(hre, taskArgs.environment);

        // Execute the migration function with the retrieved parameters
        await setNitrogenOwner(hre, environment)
            .then(() => {
                console.log('Set Nitrogen owner completed successfully.');
            })
            .catch(error => {
                console.error('Set failed:', error.message);
                console.error(error.stack); // Log full error stack trace for debugging
                process.exit(1); // Exit with an error code to indicate failure
            });
    });

ethereumSetupScope
    .task('setCoreOwner', 'Core set owner')
    .addParam('environment', 'Deployment environment') // Required parameter for specifying the set script environment
    .setAction(async (taskArgs, hre) => {
        console.log('Environment:', taskArgs.environment); // Log the selected migration environment
        console.log('Network:', hre.network.name); // Log the Hardhat network being used

        // Retrieve environment details using the helper function
        const environment = getEnvironment(hre, taskArgs.environment);

        // Execute the migration function with the retrieved parameters
        await setCoreOwner(hre, environment)
            .then(() => {
                console.log('Set Core owner completed successfully.');
            })
            .catch(error => {
                console.error('Set failed:', error.message);
                console.error(error.stack); // Log full error stack trace for debugging
                process.exit(1); // Exit with an error code to indicate failure
            });
    });

ethereumSetupScope
    .task('setCarbonAccountantLZ', 'Carbon set accountantLZ')
    .addParam('environment', 'Deployment environment') // Required parameter for specifying the set script environment
    .setAction(async (taskArgs, hre) => {
        console.log('Environment:', taskArgs.environment); // Log the selected migration environment
        console.log('Network:', hre.network.name); // Log the Hardhat network being used

        // Retrieve environment details using the helper function
        const environment = getEnvironment(hre, taskArgs.environment);

        const contractsCarbon = await readFromFile(`${environment}/contracts_carbon.json`);

        // Execute the migration function with the retrieved parameters
        await setOAppPeer(hre, environment, {
            agentLZ: contractsCarbon.eth.agentLZ,
            accountantLZ: contractsCarbon.tron.accountantLZ,
        })
            .then(() => {
                console.log('Set Carbon accountantLZ completed successfully.');
            })
            .catch(error => {
                console.error('Set failed:', error.message);
                console.error(error.stack); // Log full error stack trace for debugging
                process.exit(1); // Exit with an error code to indicate failure
            });
    });

ethereumSetupScope
    .task('setCarbonOwner', 'Carbon set owner')
    .addParam('environment', 'Deployment environment') // Required parameter for specifying the set script environment
    .setAction(async (taskArgs, hre) => {
        console.log('Environment:', taskArgs.environment); // Log the selected migration environment
        console.log('Network:', hre.network.name); // Log the Hardhat network being used

        // Retrieve environment details using the helper function
        const environment = getEnvironment(hre, taskArgs.environment);

        // Execute the migration function with the retrieved parameters
        await setCarbonOwner(hre, environment)
            .then(() => {
                console.log('Set Carbon owner completed successfully.');
            })
            .catch(error => {
                console.error('Set failed:', error.message);
                console.error(error.stack); // Log full error stack trace for debugging
                process.exit(1); // Exit with an error code to indicate failure
            });
    });

ethereumSetupScope
    .task('setupCarbonDVN', 'Carbon OApp DVN config setup')
    .addParam('environment', 'Deployment environment') // Required parameter for specifying the set script environment
    .setAction(async (taskArgs, hre) => {
        console.log('Environment:', taskArgs.environment); // Log the selected migration environment
        console.log('Network:', hre.network.name); // Log the Hardhat network being used

        // Retrieve environment details using the helper function
        const environment = getEnvironment(hre, taskArgs.environment);

        // Execute the migration function with the retrieved parameters
        await setupOAppDVN(hre, environment)
            .then(() => {
                console.log('Setup of OApp DVN is completed successfully.');
            })
            .catch(error => {
                console.error('Set failed:', error.message);
                console.error(error.stack); // Log full error stack trace for debugging
                process.exit(1); // Exit with an error code to indicate failure
            });
    });

ethereumSetupScope
    .task('setupUsdtOftDVN', 'UsdtOFT OApp DVN config setup')
    .addParam('environment', 'Deployment environment') // Required parameter for specifying the set script environment
    .setAction(async (taskArgs, hre) => {
        console.log('Environment:', taskArgs.environment); // Log the selected migration environment
        console.log('Network:', hre.network.name); // Log the Hardhat network being used

        // Retrieve environment details using the helper function
        const environment = getEnvironment(hre, taskArgs.environment);

        // Execute the migration function with the retrieved parameters
        await setupUsdtOftDVN(hre, environment)
            .then(() => {
                console.log('UsdtOFT DVN setup completed completed successfully.');
            })
            .catch(error => {
                console.error('Set failed:', error.message);
                console.error(error.stack); // Log full error stack trace for debugging
                process.exit(1); // Exit with an error code to indicate failure
            });
    });

ethereumSetupScope
    .task('setupCarbonGasLimits', 'Setup AgentLZ Gas Limits for LZ cross-chain messaging')
    .addParam('environment', 'Deployment environment') // Required parameter for specifying the set script environment
    .setAction(async (taskArgs, hre) => {
        console.log('Environment:', taskArgs.environment); // Log the selected migration environment
        console.log('Network:', hre.network.name); // Log the Hardhat network being used

        // Retrieve environment details using the helper function
        const environment = getEnvironment(hre, taskArgs.environment);

        // Execute the migration function with the retrieved parameters
        await setAgentLZGasLimits(hre, environment)
            .then(() => {
                console.log('AgentLZ gasLimit setup completed completed successfully.');
            })
            .catch(error => {
                console.error('Set failed:', error.message);
                console.error(error.stack); // Log full error stack trace for debugging
                process.exit(1); // Exit with an error code to indicate failure
            });
    });

ethereumSetupScope
    .task(
        'syncExecutorParams',
        "Synchronizes the Custom Executor contract's per-destination config from the LZ Executor",
    )
    .addParam('environment', 'Deployment environment') // Required parameter for specifying the set script environment
    .setAction(async (taskArgs, hre) => {
        console.log('Environment:', taskArgs.environment); // Log the selected migration environment
        console.log('Network:', hre.network.name); // Log the Hardhat network being used

        // Retrieve environment details using the helper function
        const environment = getEnvironment(hre, taskArgs.environment);

        // Execute the migration function with the retrieved parameters
        await syncExecutorParams(hre, environment)
            .then(() => {
                console.log(
                    'Executor parameters synchronization completed completed successfully.',
                );
            })
            .catch(error => {
                console.error('Set failed:', error.message);
                console.error(error.stack); // Log full error stack trace for debugging
                process.exit(1); // Exit with an error code to indicate failure
            });
    });
