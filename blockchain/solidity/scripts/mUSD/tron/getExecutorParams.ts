import { tronweb } from 'hardhat';

import { DevnetContractsExecutor } from '@molecula-monorepo/blockchain.addresses/deploy';

import { abi as executorABI } from '../../../artifacts/contracts/executor/Executor.sol/Executor.json';
import { shastaConfig } from '../../../configs';

async function getExecutorParams() {
    // Get the deployed Executor contract address for Tron (Shasta)
    const executorAddress = tronweb.address.fromHex(DevnetContractsExecutor.tron.executor);

    const executor = tronweb.contract(executorABI, executorAddress);

    const priceFeed = await executor.methods.priceFeed?.().call({
        // @ts-ignore (passing private option)
        isConstant: true,
    });
    const priceFeedAddress = tronweb.address.fromHex(priceFeed.toString());
    console.log('priceFeed contract', priceFeedAddress);

    const workerFeeLib = await executor.methods.workerFeeLib?.().call({
        // @ts-ignore (passing private option)
        isConstant: true,
    });
    const workerFeeLibAddress = tronweb.address.fromHex(workerFeeLib.toString());
    console.log('workerFeeLib contract', workerFeeLibAddress);

    const dstConfig = await executor.methods
        .dstConfig?.(shastaConfig.LAYER_ZERO_ETHEREUM_EID)
        .call({
            // @ts-ignore (passing private option)
            isConstant: true,
        });
    console.log('dstConfig', dstConfig);
}

getExecutorParams()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
