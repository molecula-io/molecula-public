/* eslint-disable no-await-in-loop, no-restricted-syntax, max-lines */

import { scope } from 'hardhat/config';

import { deployMetaEth } from '../../scripts/metaEth/deployMetaEth';
import { getEnvironment, writeToFile } from '../../scripts/utils/deployUtils';

const metaEthScope = scope('metaEth', 'Scope for metaEth solution');

metaEthScope
    .task('deploy', 'Deploys MetaEth solution')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);

        const result = {
            eth: await deployMetaEth(hre, environment),
        };

        writeToFile(`${environment}/contracts_meta_eth.json`, result);
    });
