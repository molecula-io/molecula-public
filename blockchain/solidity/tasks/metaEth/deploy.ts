/* eslint-disable no-await-in-loop, no-restricted-syntax, max-lines */

import { scope } from 'hardhat/config';

import { deployAndInitMetaEth, getEnvironment, getMetaEthConfig, writeToFile } from '../../scripts';

const metaEthScope = scope('metaEth', 'Scope for metaEth solution');

metaEthScope
    .task('deploy', 'Deploys MetaEth solution')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);
        const { config, account, chainId } = await getMetaEthConfig(hre, environment);

        const withPoolTokens = hre.network.name !== 'sepolia';
        const result = {
            eth: await deployAndInitMetaEth(hre, config, account, chainId, withPoolTokens),
        };

        writeToFile(`${environment}/contracts_meta_eth.json`, result);
    });
