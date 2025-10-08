/* eslint-disable @typescript-eslint/no-explicit-any */
import { scope } from 'hardhat/config';

import { verifyCarbonConfiguration } from '../../scripts/mUSD/tron';
import { getEnvironment } from '../../scripts/utils/deployUtils';

const tronVerifyScope = scope('tronVerify', 'Scope for tron verification configuration');

tronVerifyScope
    .task('сarbon', 'Verify Carbon configuration on Tron')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('\n Tron Carbon Configuration Verification');
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);
        // Execute the migration function with the retrieved parameters
        await verifyCarbonConfiguration(hre, environment).then(() => {
            console.log(`Verify Carbon configuration task completed on ${hre.network.name}`);
        });
    });
