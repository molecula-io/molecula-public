/* eslint-disable no-await-in-loop, no-restricted-syntax */
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsCarbon, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { OAPP_GAS_LIMITS_BY_ENV } from '../../../../configs/layerzero/omniConfig';

import {
    formatGasLimitMsgType,
    GAS_LIMIT_BASE,
    GAS_LIMIT_UNIT,
    readFromFile,
} from '../../../utils';

export async function setAgentLZGasLimits(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
) {
    const contractsCarbon: ContractsCarbon = await readFromFile(
        `${environment}/contracts_carbon.json`,
    );

    const agentLZ = await hre.ethers.getContractAt(
        'AgentLZ',
        contractsCarbon.eth.agentLZ, // ← replace with actual address
    );
    const { agentGasLimits } = OAPP_GAS_LIMITS_BY_ENV[environment];

    for (const { msgType, baseGas, unitGas } of agentGasLimits) {
        // Optional: skip if both are 0
        if (baseGas === 0 && unitGas === 0) {
            console.log(`Skipped (msgType: 0x${msgType.toString(16)}) — both base and unit are 0`);
            continue;
        }

        try {
            const currentBaseGas = await agentLZ.gasLimit(
                formatGasLimitMsgType(msgType, GAS_LIMIT_BASE),
            );
            const currentUnitGas = await agentLZ.gasLimit(
                formatGasLimitMsgType(msgType, GAS_LIMIT_UNIT),
            );

            if (currentBaseGas === BigInt(baseGas) && currentUnitGas === BigInt(unitGas)) {
                console.log(`Skipped for (msgType: 0x${msgType.toString(16)})`);
                console.log(`   → base: ${baseGas.toString()}, unit: ${unitGas.toString()}`);
                continue;
            }

            const tx = await agentLZ.setGasLimit(msgType, baseGas, unitGas);
            await tx.wait(); // Wait for transaction to be mined before proceeding

            console.log(`Set gasLimit for (msgType: 0x${msgType.toString(16)})`);
            console.log(`   → base: ${baseGas.toString()}, unit: ${unitGas.toString()}`);
        } catch (err) {
            console.error(`Failed to set gasLimit for (msgType: 0x${msgType.toString(16)})`);
            console.error(`   ↪︎ Reason: ${err.reason || err.message}`);
        }
    }
}
