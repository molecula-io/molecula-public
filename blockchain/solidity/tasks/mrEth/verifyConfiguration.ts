/* eslint-disable @typescript-eslint/no-explicit-any */
import { scope } from 'hardhat/config';

import { verifyMrEth } from '../../scripts/mrEth';
import { getEnvironment } from '../../scripts/utils/deployUtils';

const ethereumVerifyScope = scope(
    'ethereumVerify',
    'Scope for ethereum verification configuration',
);

ethereumVerifyScope
    .task(
        'mrEth',
        `Verify mrETH configuration

    This task verifies the configuration of MrETH contracts deployed on Ethereum networks.
    It checks contract state variables against expected configuration values and validates
    the proper setup of MrETH ecosystem components.

    Features:
    - Verifies CoreV2 suite (SupplyManagerV2, mrETH token, vaults)
    - Validates DepositManagerPool configuration and parameters
    - Checks role assignments and access controls
    - Compares deployed contract states with configuration values
    - Provides detailed verification results with pass/fail status
    `,
    )
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n Ethereum MrETH Configuration Verification');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);
        // Execute the migration function with the retrieved parameters
        await verifyMrEth(hre, environment);
        console.log(`Verify MrETH configuration task completed on ${hre.network.name}`);
    });
