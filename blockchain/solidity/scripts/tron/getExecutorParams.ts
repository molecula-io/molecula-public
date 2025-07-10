import { TronWeb } from 'tronweb';

import { DevnetContractsExecutor } from '@molecula-monorepo/blockchain.addresses/deploy';

import { abi as executorABI } from '../../artifacts/contracts/executor/Executor.sol/Executor.json';
import { shastaConfig } from '../../configs/tron/shastaTyped';

async function getExecutorParams() {
    // Create TronWeb instance
    const tronWeb = new TronWeb({
        fullHost: shastaConfig.RPC_URL,
    });
    // Get private key
    const accountInfo = tronWeb.fromMnemonic(
        process.env.TRON_SEED_PHRASE as string,
        "m/44'/195'/0'/0/0",
    );
    if (accountInfo instanceof Error) {
        throw new Error('Invalid account information returned from fromMnemonic.');
    }
    const privateKey = accountInfo.privateKey.substring(2);
    tronWeb.setPrivateKey(privateKey);

    // Get the deployed Executor contract address for Tron (Shasta)
    const executorAddress = tronWeb.address.fromHex(DevnetContractsExecutor.tron.executor);

    const executor = tronWeb.contract(executorABI, executorAddress);

    // @ts-ignore (Missing types for contracts)
    const priceFeed = await executor.methods.priceFeed().call({ _isConstant: true });
    const priceFeedAddress = TronWeb.address.fromHex(priceFeed.toString());
    console.log('priceFeed contract', priceFeedAddress);

    // @ts-ignore (Missing types for contracts)
    const workerFeeLib = await executor.methods.workerFeeLib().call({ _isConstant: true });
    const workerFeeLibAddress = TronWeb.address.fromHex(workerFeeLib.toString());
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
