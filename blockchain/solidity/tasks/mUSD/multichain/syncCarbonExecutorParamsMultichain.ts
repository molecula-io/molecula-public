/* eslint-disable no-await-in-loop, no-restricted-syntax, no-nested-ternary */
import { spawn } from 'child_process';
import { scope } from 'hardhat/config';

// Utility for determining environment-specific flags
import { getEnvironment } from '../../../scripts/utils/deployUtils';

// Define a scope name and description for our multichain setup tasks
const multichainSetupScope = scope(
    'multichainSetupScope',
    'Scope for setting up required parameters on ethereum and tron networks',
);

/**
 * Task: syncCarbonExecutorParams
 * Description: Synchronizes the Custom Executor contract's per-destination config from the LZ Executor on both chains for Carbon.
 * Params:
 *   - environment: the deployment environment (e.g., devnet or mainnet)
 */
multichainSetupScope
    .task(
        'syncCarbonExecutorParams',
        'Synchronizes Carbon Executor parameters across multiple networks',
    )
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        // Log the chosen environment
        console.log(`\n Environment: ${taskArgs.environment}`);

        // Determine the correct flag based on environment
        const setupEnvFlag = getEnvironment(hre, taskArgs.environment);

        // Choose networks: devnet uses testnets, otherwise main networks
        const networks =
            taskArgs.environment === 'devnet' ? ['sepolia', 'shasta'] : ['ethereum', 'tron'];
        console.log('Networks:', networks);

        // Loop through each network and execute the syncExecutorParams task
        for (const network of networks) {
            console.log(`\n🚀 Synchronizing Carbon Executor parameters on ${network}...`);

            // Map test network names to task names used by Hardhat
            const taskName =
                network === 'sepolia' ? 'ethereum' : network === 'shasta' ? 'tron' : network;

            console.log(
                `Running: npx hardhat ${taskName}SetupScope syncExecutorParams --network ${network} --environment ${setupEnvFlag}`,
            );

            // Spawn a subprocess to run the Hardhat task and await its completion
            await new Promise((resolve, reject) => {
                const child = spawn(
                    'npx',
                    [
                        'hardhat',
                        `${taskName}SetupScope`,
                        `syncExecutorParams`,
                        '--network',
                        network,
                        '--environment',
                        setupEnvFlag,
                    ],
                    {
                        stdio: 'inherit', // Inherit stdio so logs appear in console
                    },
                );

                child.on('close', code => {
                    // Reject if the process exits with an error code
                    if (code !== 0) {
                        reject(
                            new Error(
                                `Executor parameters sync failed on ${network} with exit code ${code}`,
                            ),
                        );
                    } else {
                        resolve(null);
                    }
                });
            });
        }

        console.log('\n✅ Carbon Executor parameters synchronization completed successfully.');
    });

export {};
