/*
 * AgentLZ Contract Verification Module
 *
 * This module contains functions for verifying AgentLZ contract configuration
 * on Ethereum networks. It handles LayerZero endpoint verification, peer configuration,
 * gas limits, and OApp configuration validation.
 */
/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType, ContractsCarbon } from '@molecula-monorepo/blockchain.addresses';

import { APPROVER_SALT } from '../../../../configs';
import { OAPP_GAS_LIMITS_BY_ENV } from '../../../../configs/layerzero/omniConfig';
import type { EthereumNetworkConfig } from '../../../../configs/mUSD/ethereum/types';
import type { AgentLZ } from '../../../../typechain-types';
import type {
    VerificationResult,
    ContractVerification,
} from '../../../utils/configurationVerificationUtils';
import { checkValue } from '../../../utils/configurationVerificationUtils';
import { getEthereumAddress } from '../../../utils/deployUtils';

import { verifyGasLimits } from './verifyGasLimits';
import { verifyLayerZeroConfig } from './verifyLayerZeroConfig';

/**
 * Verifies peer configuration for LayerZero contracts
 * Compares expected peer address with actual peer address stored in contract
 * Handles both Ethereum and Tron address formats
 * @param contract - Contract instance to verify peer for
 * @param variableName - Name of the peer variable (e.g., 'peers(TRON_EID)')
 * @param remoteEid - Remote endpoint ID to check peer for
 * @param expectedPeerAddress - Expected peer address (can be Tron or Ethereum format)
 * @param environment - Environment type for address conversion
 * @param hre - Hardhat runtime environment
 * @param results - Array to store verification results
 */
async function verifyPeerConfiguration(
    contract: AgentLZ,
    variableName: string,
    remoteEid: number,
    expectedPeerAddress: string,
    environment: EnvironmentType,
    hre: HardhatRuntimeEnvironment,
    results: VerificationResult[],
): Promise<void> {
    if (remoteEid <= 0) {
        throw new Error('Invalid remote EID provided');
    }

    const peer = await contract.peers(remoteEid);

    // Convert expected peer address to bytes32 format (like in setOAppPeer)
    let expectedPeerBytes32 = APPROVER_SALT;

    if (expectedPeerAddress) {
        // Check if it's a Tron address (starts with 'T')
        if (expectedPeerAddress.startsWith('T')) {
            // Use the same method as in deployCarbon.ts
            const accountantLzHexaDecimal = getEthereumAddress(environment, expectedPeerAddress);
            expectedPeerBytes32 = hre.ethers.zeroPadValue(accountantLzHexaDecimal, 32);
        } else {
            // It's already an Ethereum address
            expectedPeerBytes32 = hre.ethers.zeroPadValue(expectedPeerAddress, 32);
        }
    }

    results.push({
        variableName,
        ...checkValue(expectedPeerBytes32, peer),
    });
}

/**
 * Verifies AgentLZ contract configuration
 * Checks LayerZero endpoint, authorized configurator, supply manager, peer configuration, and gas limits
 * @param hre - Hardhat runtime environment
 * @param contracts - Deployed contracts object
 * @param config - Configuration object with expected values
 * @param environment - Environment type (devnet, mainnet/beta, mainnet/prod)
 * @returns ContractVerification object with verification results
 */
export async function verifyAgentLZContract(
    hre: HardhatRuntimeEnvironment,
    contracts: ContractsCarbon,
    config: EthereumNetworkConfig,
    environment: EnvironmentType,
): Promise<ContractVerification> {
    console.log(`\n📋 Verifying AgentLZ contract: ${contracts.eth.agentLZ}`);

    const agentLZ: AgentLZ = await hre.ethers.getContractAt('AgentLZ', contracts.eth.agentLZ);
    const results: VerificationResult[] = [];

    // Verify owner of the contract
    const actualOwner = await agentLZ.owner();
    results.push({
        variableName: 'owner',
        ...checkValue(config.OWNER, actualOwner),
    });

    // Verify authorized LZ configurator
    const actualAuthorizedLZConfigurator = await agentLZ.authorizedLZConfigurator();
    results.push({
        variableName: 'authorizedLZConfigurator',
        ...checkValue(config.AGENT_AUTHORIZED_LZ_CONFIGURATOR, actualAuthorizedLZConfigurator),
    });

    // Verify LayerZero endpoint
    const actualEndpoint = await agentLZ.endpoint();
    results.push({
        variableName: 'LAYER_ZERO_ENDPOINT',
        ...checkValue(config.LAYER_ZERO_ENDPOINT, actualEndpoint),
    });

    // Verify supply manager
    const actualSupplyManager = await agentLZ.SUPPLY_MANAGER();
    results.push({
        variableName: 'SUPPLY_MANAGER',
        ...checkValue(contracts.eth.supplyManager, actualSupplyManager),
    });

    // Verify LayerZero destination chain ID
    const actualDstEid = await agentLZ.DST_EID();
    results.push({
        variableName: 'DST_EID',
        ...checkValue(config.LAYER_ZERO_TRON_EID, actualDstEid),
    });

    // Verify USDT address
    const actualUsdt = await agentLZ.USDT();
    results.push({
        variableName: 'USDT',
        ...checkValue(config.USDT_ADDRESS, actualUsdt),
    });

    // Verify USDT OFT address
    const actualUsdtOft = await agentLZ.USDT_OFT();
    results.push({
        variableName: 'USDT_OFT',
        ...checkValue(config.USDT_OFT, actualUsdtOft),
    });

    // Verify Oracle data update flag
    const actualUpdateOracleData = await agentLZ.updateOracleData();
    results.push({
        variableName: 'updateOracleData',
        ...checkValue(true, actualUpdateOracleData),
    });

    // Verify LayerZero peer configuration
    // Get AccountantLZ address from deployed contracts
    const accountantLZAddress = contracts.tron.accountantLZ;
    if (accountantLZAddress) {
        // Verify LayerZero peer configuration for TRON_EID
        await verifyPeerConfiguration(
            agentLZ,
            'peers(TRON_EID)',
            config.LAYER_ZERO_TRON_EID,
            accountantLZAddress,
            environment,
            hre,
            results,
        );
    } else {
        results.push({
            variableName: 'peers(TRON_EID)',
            expectedValue: 'AccountantLZ address not found',
            actualValue: 'Cannot verify peer without AccountantLZ address',
            isMatch: false,
        });
    }

    // Verify Gas Limits configuration
    const gasLimitsConfig = OAPP_GAS_LIMITS_BY_ENV[environment];
    if (gasLimitsConfig && gasLimitsConfig.agentGasLimits) {
        await verifyGasLimits(agentLZ, gasLimitsConfig.agentGasLimits, results);
    } else {
        results.push({
            variableName: 'gasLimits',
            expectedValue: 'Configured',
            actualValue: 'Gas limits configuration not found for environment',
            isMatch: false,
        });
    }

    // Verify LayerZero OApp configuration
    await verifyLayerZeroConfig(
        hre,
        contracts.eth.agentLZ,
        config.LAYER_ZERO_TRON_EID,
        config,
        environment,
        results,
    );

    return {
        contractAddress: contracts.eth.agentLZ,
        contractName: 'AgentLZ',
        results,
    };
}
