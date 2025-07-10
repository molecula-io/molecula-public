import { ethers } from 'hardhat';

import { DevnetContractsExecutor } from '@molecula-monorepo/blockchain.addresses/deploy';

import { sepoliaConfig } from '../../configs/ethereum/sepoliaTyped';

async function getExecutorParams() {
    const executor = await ethers.getContractAt('Executor', DevnetContractsExecutor.eth.executor);

    const priceFeed = await executor.priceFeed();
    console.log('priceFeed contract', priceFeed);

    const workerFeeLib = await executor.workerFeeLib();
    console.log('workerFeeLib contract', workerFeeLib);

    const dstConfig = await executor.dstConfig(sepoliaConfig.LAYER_ZERO_TRON_EID);
    console.log('dstConfig', dstConfig);
}

getExecutorParams()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
