/* eslint-disable @typescript-eslint/no-explicit-any */
import { scope } from 'hardhat/config';

import {
    verifyCarbonConfiguration,
    verifyNitrogenConfiguration,
} from '../../scripts/mUSD/ethereum';
import { getEnvironment } from '../../scripts/utils/deployUtils';

const ethereumVerifyScope = scope(
    'ethereumVerify',
    'Scope for ethereum verification configuration',
);

ethereumVerifyScope
    .task('сarbon', 'Verify Carbon configuration on Ethereum')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n Ethereum Carbon Configuration Verification');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);
        // Execute the migration function with the retrieved parameters
        await verifyCarbonConfiguration(hre, environment).then(() => {
            console.log(`Verify Carbon configuration task completed on ${hre.network.name}`);
        });
    });

ethereumVerifyScope
    .task(
        'nitrogen',
        `Ethereum Nitrogen Configuration Verification Script
 
    This task verifies the configuration of Nitrogen contracts deployed on Ethereum networks.
    It checks contract state variables against expected configuration values and validates
    contract relationships and access controls.

    Features:
    - Verifies AccountantAgent, RebaseToken, SupplyManager, NitrogenTokenVault, and MUSDLock contracts
    - Checks contract relationships and dependencies
    - Validates role assignments and access controls
    - Provides detailed verification results with pass/fail status

    `,
    )
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n Ethereum Nitrogen Configuration Verification');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);
        // Execute the migration function with the retrieved parameters
        await verifyNitrogenConfiguration(hre, environment);
        console.log(`Verify Nitrogen configuration task completed on ${hre.network.name}`);
    });
