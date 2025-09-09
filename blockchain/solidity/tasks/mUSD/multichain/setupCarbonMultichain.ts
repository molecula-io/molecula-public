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
 * Task: setCarbonOwner
 * Description: Sets up the Carbon contracts' Owner across target networks.
 * Params:
 *   - environment: the deployment environment (e.g., devnet or mainnet)
 */
multichainSetupScope
    .task('setCarbonOwner', 'Setup Carbon to multiple networks')
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

        // Loop through each network and execute the setup
        for (const network of networks) {
            console.log(`\n🚀 Setting up Carbon Owner on ${network}...`);

            // Map test network names to task names used by Hardhat
            const taskName =
                network === 'sepolia' ? 'ethereum' : network === 'shasta' ? 'tron' : network;

            console.log(
                `Running: npx hardhat ${taskName}SetupScope setCarbonOwner --network ${network} --environment ${setupEnvFlag}`,
            );

            // Spawn a subprocess to run the Hardhat task and await its completion
            await new Promise((resolve, reject) => {
                const child = spawn(
                    'npx',
                    [
                        'hardhat',
                        `${taskName}SetupScope`,
                        `setCarbonOwner`,
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

/**
 * Task: setupCarbonDVN
 * Description: Sets up Carbon Decentralized Verification Nodes (DVNs) parameters across networks.
 * Params:
 *   - environment: the deployment environment (e.g., devnet or mainnet)
 */
multichainSetupScope
    .task('setupCarbonDVN', 'Setup Carbon DVNs across multiple networks')
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

        for (const network of networks) {
            console.log(`\n🚀 Setting up Carbon DVN on ${network}...`);

            // Map test network names to task names used by Hardhat
            const taskName =
                network === 'sepolia' ? 'ethereum' : network === 'shasta' ? 'tron' : network;

            console.log(
                `Running: npx hardhat ${taskName}SetupScope setupCarbonDVN --network ${network} --environment ${setupEnvFlag}`,
            );

            await new Promise((resolve, reject) => {
                const child = spawn(
                    'npx',
                    [
                        'hardhat',
                        `${taskName}SetupScope`,
                        `setupCarbonDVN`,
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
                    if (code !== 0) {
                        reject(new Error(`Setup failed on ${network} with exit code ${code}`));
                    } else {
                        resolve(null);
                    }
                });
            });
        }
    });

/**
 * Task: setupCarbonGasLimits
 * Description: Configures Carbon gas limits for LayerZero messaging across networks.
 * Params:
 *   - environment: the deployment environment (e.g., devnet or mainnet)
 */
multichainSetupScope
    .task('setupCarbonGasLimits', 'Setup Carbon LZ GasLimits across multiple networks')
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

        for (const network of networks) {
            console.log(`\n🚀 Setting up Carbon gasLimits on ${network}...`);

            // Map test network names to task names used by Hardhat
            const taskName =
                network === 'sepolia' ? 'ethereum' : network === 'shasta' ? 'tron' : network;

            console.log(
                `Running: npx hardhat ${taskName}SetupScope setupCarbonGasLimits --network ${network} --environment ${setupEnvFlag}`,
            );

            await new Promise((resolve, reject) => {
                const child = spawn(
                    'npx',
                    [
                        'hardhat',
                        `${taskName}SetupScope`,
                        `setupCarbonGasLimits`,
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
                    if (code !== 0) {
                        reject(new Error(`Setup failed on ${network} with exit code ${code}`));
                    } else {
                        resolve(null);
                    }
                });
            });
        }
    });

/**
 * Task: migrateAccountantAgentLZMultichain
 * Description: Migrates AccountantLZ and AgentLZ (Ethereum and Tron) across multiple networks.
 * Params:
 *   - environment: the deployment environment (e.g., devnet or mainnet)
 */
multichainSetupScope
    .task(
        'migrateAccountantAgentLZMultichain',
        'Migrates AccountantLZ and AgentLZ (Ethereum and Tron)',
    )
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log(`\n Environment: ${taskArgs.environment}`);

        const deployEnvFlag = getEnvironment(hre, taskArgs.environment);

        const networks: string[] =
            taskArgs.environment === 'devnet' ? ['sepolia', 'shasta'] : ['ethereum', 'tron'];
        console.log('Networks:', networks);

        // Deploy AccountantLZ and AgentLZ on Ethereum and Tron
        for (const network of networks) {
            console.log(`\n🚀 Migrating AccountantLZ / AgentLZ to ${network}...`);

            const taskName =
                network === 'sepolia' ? 'ethereum' : network === 'shasta' ? 'tron' : network;

            console.log(
                `Running: npx hardhat ${taskName}Scope deployCarbon --network ${network} --environment ${deployEnvFlag}`,
            );

            await new Promise((resolve, reject) => {
                const child = spawn(
                    'npx',
                    [
                        'hardhat',
                        `${taskName}Scope`,
                        `migrateAccountantAgentLZ`,
                        '--network',
                        network,
                        '--environment',
                        deployEnvFlag,
                    ],
                    {
                        stdio: 'inherit',
                    },
                );

                child.on('close', code => {
                    if (code !== 0) {
                        reject(new Error(`Deployment failed on ${network} with exit code ${code}`));
                    } else {
                        resolve(null);
                    }
                });
            });
        }

        console.log(`\n🚀 Deploying AccountantLZ / AgentLZ completed successfully.`);

        // Setup LayerZero configuration for AccountantLZ / AgentLZ
        console.log(`\n⏳ Setting up LayerZero configuration for AccountantLZ / AgentLZ...`);
        await new Promise((resolve, reject) => {
            const child = spawn(
                'npx',
                [
                    'hardhat',
                    'multichainSetupScope',
                    'setupCarbonDVN',
                    '--environment',
                    taskArgs.environment,
                ],
                {
                    stdio: 'inherit',
                },
            );

            child.on('close', code => {
                if (code !== 0) {
                    reject(
                        new Error(`LayerZero configuration setup failed with exit code ${code}`),
                    );
                } else {
                    resolve(null);
                }
            });
        });
        console.log(
            `\n✅ LayerZero configuration for AccountantLZ / AgentLZ setup completed successfully.`,
        );

        // Setup gas limits for AccountantLZ / AgentLZ
        console.log(`\n⏳ Setting up gas limits for AccountantLZ / AgentLZ...`);
        await new Promise((resolve, reject) => {
            const child = spawn(
                'npx',
                [
                    'hardhat',
                    'multichainSetupScope',
                    'setupCarbonGasLimits',
                    '--environment',
                    taskArgs.environment,
                ],
                {
                    stdio: 'inherit',
                },
            );

            child.on('close', code => {
                if (code !== 0) {
                    reject(new Error(`Gas limits setup failed with exit code ${code}`));
                } else {
                    resolve(null);
                }
            });
        });
        console.log(`\n✅ Gas limits for AccountantLZ / AgentLZ setup completed successfully.`);

        // Setup owner for AccountantLZ / AgentLZ
        console.log(`\n⏳ Setting up owner for AccountantLZ / AgentLZ...`);
        await new Promise((resolve, reject) => {
            const child = spawn(
                'npx',
                [
                    'hardhat',
                    'multichainSetupScope',
                    'setCarbonOwner',
                    '--environment',
                    taskArgs.environment,
                ],
                {
                    stdio: 'inherit',
                },
            );

            child.on('close', code => {
                if (code !== 0) {
                    reject(new Error(`Owner setup failed with exit code ${code}`));
                } else {
                    resolve(null);
                }
            });
        });
        console.log(`\n✅ Owner for AccountantLZ / AgentLZ setup completed successfully.`);

        console.log(
            '\n⚠️ Please, setup SupplyManager to work with the deployed AgentLZ separately.',
        );
        console.log(
            '\n⚠️ Please, setup RebaseToken to work with the deployed AccountantLZ separately.',
        );
        console.log(
            '\n⚠️ Please, setup Oracle to make the deployed AccountantLZ authorized to update it separately.',
        );
    });
