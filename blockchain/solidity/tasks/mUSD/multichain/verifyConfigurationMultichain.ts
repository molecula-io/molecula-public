/*
 * Multichain Carbon verification task runner
 * - Runs per-network Hardhat tasks to verify Carbon configuration on Ethereum and Tron
 * - Adds clear logging, error handling, and small utilities to minimize duplicate code
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax, no-nested-ternary */
import { spawn } from 'child_process';
import { scope } from 'hardhat/config';

// Utility for determining environment-specific flags
import { getEnvironment } from '../../../scripts/utils/deployUtils';

// Define a scope name and description for our multichain verification configuration tasks
const multichainVerify = scope(
    'multichainVerify',
    'Scope for verifying required parameters on ethereum and tron networks',
);

/**
 * Task: verifyConfigurationCarbon
 * Description: Verifies Carbon configuration across Ethereum and Tron networks for a given environment.
 * Params:
 *   - environment: EnvironmentType string (e.g., 'devnet', 'mainnet/beta', 'mainnet/prod')
 */
multichainVerify
    .task(
        'сarbon',
        `Verify Carbon configuration on multiple networks

    This task verifies the configuration of Carbon contracts deployed on Ethereum and Tron networks.
    It checks contract state variables against expected configuration values and compares
    LayerZero configurations with the actual deployed contracts.
    
    Features Tron:

    - Verifies AccountantLZ, Oracle, RebaseToken, and Executor contracts
    - Checks LayerZero peer configurations and gas limits
    - Compares dstConfig with LayerZero Executor contract
    - Validates role assignments and access controls
    - Provides detailed verification results with pass/fail status
    - Handles Tron-specific address formats and contract interactions

    Features Ethereum:

    - Verifies AgentLZ, SupplyManager, and Executor contracts
    - Checks LayerZero peer configurations and gas limits
    - Compares dstConfig with LayerZero Executor contract
    - Validates role assignments and access controls
    - Provides detailed verification results with pass/fail status   
    `,
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

        // Loop through each network and execute the verification
        for (const network of networks) {
            console.log(`\n🚀 Verifying Carbon protocol configuration on ${network}...`);

            // Map test network names to task names used by Hardhat
            const taskName =
                network === 'sepolia' ? 'ethereum' : network === 'shasta' ? 'tron' : network;

            console.log(
                `Running: npx hardhat ${taskName}Verify verifyCarbon --network ${network} --environment ${setupEnvFlag}`,
            );

            // Spawn a subprocess to run the Hardhat task and await its completion
            await new Promise((resolve, reject) => {
                const child = spawn(
                    'npx',
                    [
                        'hardhat',
                        `${taskName}Verify`,
                        `сarbon`,
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
                        reject(new Error(`Setup failed on ${network} with exit code ${code}`));
                    } else {
                        resolve(null);
                    }
                });
            });
        }
    });
