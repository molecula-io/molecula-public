import { tronweb } from 'hardhat';

import { DevnetContractsExecutor } from '@molecula-monorepo/blockchain.addresses/deploy';

import { abi as executorABI } from '../../../artifacts/contracts/executor/Executor.sol/Executor.json';
import { shastaConfig } from '../../../configs';

async function getExecutorParams() {
    // Get the deployed Executor contract address for Tron (Shasta)
    const executorAddress = tronweb.address.fromHex(DevnetContractsExecutor.tron.executor);

    const executor = tronweb.contract(executorABI, executorAddress);

    // @ts-ignore (Missing types for contracts)
    const priceFeed = await executor.methods.priceFeed().call({ _isConstant: true });
    const priceFeedAddress = tronweb.address.fromHex(priceFeed.toString());
    console.log('priceFeed contract', priceFeedAddress);

    // @ts-ignore (Missing types for contracts)
    const workerFeeLib = await executor.methods.workerFeeLib().call({ _isConstant: true });
    const workerFeeLibAddress = tronweb.address.fromHex(workerFeeLib.toString());
    console.log('workerFeeLib contract', workerFeeLibAddress);

    // @ts-ignore (Missing types for contracts)
    const dstConfig = await executor.methods
        .dstConfig(shastaConfig.LAYER_ZERO_ETHEREUM_EID)
        .call({ _isConstant: true });
    console.log('dstConfig', dstConfig);
}

getExecutorParams()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
