/* eslint-disable @typescript-eslint/no-explicit-any */
import { scope } from 'hardhat/config';

import { verifyMetaEth } from '../../scripts/metaEth';
import { getEnvironment } from '../../scripts/utils/deployUtils';

const ethereumVerifyScope = scope(
    'ethereumVerify',
    'Scope for ethereum verification configuration',
);

ethereumVerifyScope
    .task(
        'metaEth',
        `Verify MetaEth configuration

    This task verifies the configuration of MetaETH contracts deployed on Ethereum networks.
    It checks contract state variables against expected configuration values and validates
    the proper setup of MetaETH ecosystem components including pools, tokens, and vaults.

    Features:
    - Verifies MetaPoolTreasury contract configuration
    - Validates SupplyManagerV2 and RebaseTokenV2 contracts
    - Checks wmetaETH and PriceChecker configurations
    - Verifies multiple TokenVault contracts (stETH, wETH, weETH, rsETH, ezETH, ETH)
    - Validates role assignments and access controls
    - Provides detailed verification results with pass/fail status
    `,
    )
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\nEthereum MetaEth Configuration Verification');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);
        // Execute the migration function with the retrieved parameters
        await verifyMetaEth(hre, environment);
        console.log(`Verify MetaEth configuration task completed on ${hre.network.name}`);
    });
