/* eslint-disable no-await-in-loop, no-restricted-syntax, max-lines */

import { scope } from 'hardhat/config';

import { deployMrEth } from '../../scripts';
import { getEnvironment, readFromFile, writeToFile } from '../../scripts/utils/deployUtils';

const mrEthScope = scope('mrEth', 'Scope for mrETH');

mrEthScope
    .task('deploy', 'Deploys mrETH and core V2 contracts')
    .addParam('environment', 'Deployment environment')
    .setAction(async (taskArgs, hre) => {
        console.log('Environment:', taskArgs.environment);
        console.log('Network:', hre.network.name);

        const environment = getEnvironment(hre, taskArgs.environment);

        const deployedMrEth = await deployMrEth(hre, environment);

        const contractsMrEth = await readFromFile(`${environment}/contracts_mr_eth.json`);

        if (hre.network.name === 'holesky') {
            contractsMrEth.holesky = deployedMrEth;
        } else if (hre.network.name === 'hoodi') {
            contractsMrEth.hoodi = deployedMrEth;
        } else {
            contractsMrEth.eth = deployedMrEth;
        }

        writeToFile(`${environment}/contracts_mr_eth.json`, contractsMrEth);
        console.log('Deployment and file write completed successfully.');
    });
