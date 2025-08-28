/* eslint-disable no-await-in-loop, no-restricted-syntax, max-lines */

import { scope } from 'hardhat/config';

import { deploymrETHMockAavePool, deployUSDT, deployUsdtOFT } from '../../scripts';

const mockScope = scope('mock', 'Scope for mock contracts');

mockScope.task('deployUsdtOft', 'Deploys UsdtOFT contract').setAction(async (_taskArgs, hre) => {
    console.log('Network:', hre.network.name);
    console.log('Deploying UsdtOFT...');
    await deployUsdtOFT(hre);
});

mockScope.task('deployUsdt', 'Deploys USDT contract').setAction(async (_taskArgs, hre) => {
    console.log('Network:', hre.network.name);
    console.log('Deploying USDT...');
    await deployUSDT(hre);
});

mockScope
    .task('deployAavePool', 'Deploys mock AavePool contract')
    .setAction(async (_taskArgs, hre) => {
        console.log('Network:', hre.network.name);
        console.log('Deploying MockAavePool...');
        await deploymrETHMockAavePool(hre);
    });
