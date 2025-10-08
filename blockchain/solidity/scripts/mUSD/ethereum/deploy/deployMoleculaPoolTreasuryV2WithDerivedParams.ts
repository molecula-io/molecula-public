import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import {
    type EnvironmentType,
    type ContractsNitrogen,
    type EVMAddress,
    type PoolData,
} from '@molecula-monorepo/blockchain.addresses';

import { DEPLOY_GAS_LIMIT } from '../../../../configs';
import { getConfig, readFromFile } from '../../../utils/deployUtils';

/**
 * Deploys MoleculaPoolTreasuryV2 contract and returns its address.
 * - Loads config and existing deployments.
 * - Prepares the complete token list (including any new tokens).
 * - Pulls ownership/guardian/keeper params from V1.
 * - Deploys contract and attempts on-chain verification.
 *
 * @param hre - Hardhat environment object
 * @param environment - Deployment environment identifier (devnet/mainnet/etc)
 */
export async function deployMoleculaPoolTreasuryV2WithDerivedParams(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
) {
    // 1. Load environment-specific config, which includes pool tokens and whitelist
    const { config } = await getConfig(hre, environment);

    // 2. Read the JSON file with previously deployed contract addresses
    const contractsNitrogen: ContractsNitrogen = await readFromFile(
        `${environment}/contracts_nitrogen.json`,
    );

    // 3. Start with the token list from config, used as a constructor argument
    const tokens: PoolData[] = [...config.MOLECULA_POOL_TOKENS];

    // 4. If mUSDe token is present (deployed), add it to the token list for V2
    if (contractsNitrogen.eth.mUSDe !== '') {
        tokens.push({ token: contractsNitrogen.eth.mUSDe as EVMAddress, n: 0 });
    }

    // 5. Attach to existing MoleculaPoolTreasury (V1) contract to fetch key roles
    const moleculaPoolTreasury = await hre.ethers.getContractAt(
        'MoleculaPoolTreasury',
        contractsNitrogen.eth.moleculaPool,
    );

    // 6. Prepare the constructor arguments for V2 contract (in correct order):
    //    - Use V1's owner address (may not be the deployer)
    //    - All pool token addresses
    //    - V1's poolKeeper
    //    - supplyManager address from deployments
    //    - the environment's whitelist
    //    - V1's guardian address
    const constructorArguments: [
        string,
        string,
        string[],
        string,
        string,
        { target: string; selector: string }[],
        string,
        string,
    ] = [
        (config.INITIAL_USDT_SUPPLY * 10n ** 12n).toString(),
        await moleculaPoolTreasury.owner(), // Owner for V2
        tokens.map(x => x.token), // ERC20 token addresses
        await moleculaPoolTreasury.poolKeeper(), // Pool keeper role
        contractsNitrogen.eth.supplyManager, // SupplyManager address
        config.WHITE_LIST, // Whitelist addresses
        await moleculaPoolTreasury.guardian(), // Guardian role
        hre.ethers.ZeroAddress,
    ];

    // 7. Load the contract factory for V2
    const MoleculaPoolTreasuryV2 = await hre.ethers.getContractFactory('MoleculaPoolTreasuryV2');

    // 8. Deploy MoleculaPoolTreasuryV2 contract with prepared params and set gas limit
    const moleculaPoolTreasuryV2 = await MoleculaPoolTreasuryV2.deploy(...constructorArguments, {
        gasLimit: DEPLOY_GAS_LIMIT,
    });
    await moleculaPoolTreasuryV2.waitForDeployment(); // Wait until deployment is mined

    // 9. Fetch the deployed contract address for output/logging
    const address = await moleculaPoolTreasuryV2.getAddress();
    console.log(`MoleculaPoolTreasuryV2 deployed at: ${address}`);

    // 10. Attempt to verify the contract on Etherscan/Explorer after a short delay (indexing)
    try {
        await new Promise<void>(res => {
            setTimeout(res, 5000); // Wait 5s for explorer to index
        });
        await hre.run('verify:verify', {
            address,
            constructorArguments,
        });
        console.log(`MoleculaPoolTreasuryV2 successfully verified at: ${address}`);
    } catch (e) {
        // Verification may fail if explorer is behind, but deployment still succeeded
        console.error(`Failed to verify MoleculaPoolTreasuryV2 with error:`, e);
    }

    // Return the address of the newly deployed contract
    return {
        moleculaPoolV2: address,
    };
}
