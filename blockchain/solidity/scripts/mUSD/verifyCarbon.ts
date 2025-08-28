import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';
import type { ContractsCarbon } from '@molecula-monorepo/blockchain.addresses/deploy';

import { readFromFile, getEnvironmentConfig } from '../utils/deployUtils';

import { verifyContract } from '../verificationUtils';

export async function runVerify(hre: HardhatRuntimeEnvironment) {
    const envType =
        hre.network.name === 'sepolia' ? EnvironmentType.devnet : EnvironmentType['mainnet/beta'];
    const config = getEnvironmentConfig(envType);

    const contractsConfig: ContractsCarbon = await readFromFile(`${envType}/contracts_carbon.json`);

    const account = (await hre.ethers.getSigners())[0]!;

    await verifyContract(hre, 'AgentLZ', contractsConfig.eth.agentLZ, [
        account.address,
        account.address,
        config.LAYER_ZERO_ENDPOINT,
        contractsConfig.eth.supplyManager,
        config.LAYER_ZERO_TRON_EID,
        config.USDT_ADDRESS,
        config.USDT_OFT,
    ]);
}

async function main() {
    const hardhat = await import('hardhat');
    const hre: HardhatRuntimeEnvironment = hardhat.default;

    await runVerify(hre);
}

main().catch(error => {
    console.error('Failed to verify:', error);
    process.exit(1);
});
