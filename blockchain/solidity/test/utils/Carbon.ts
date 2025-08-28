/* eslint-disable camelcase */
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { ethMainnetBetaConfig, tronMainnetBetaConfig } from '../../configs';

import { generateRandomWallet } from './Common';
import { deployNitrogenWithUSDT } from './NitrogenCommon';
import { grantERC20, grantETH } from './grant';

export const INITIAL_SUPPLY = 100n * 10n ** 18n;
export const enforcedOptionData = '0x00030100110100000000000000000000000000030d40';

export async function deployCarbon() {
    const { moleculaPool, supplyManager, poolOwner, rebaseTokenOwner, user0, user1 } =
        await deployNitrogenWithUSDT();

    // Contracts are deployed using the first signer/account by default
    const [owner, user] = await ethers.getSigners();
    const poolKeeper = await generateRandomWallet();
    expect(owner).to.exist;
    expect(user).to.exist;

    // if POOL_KEEPER do not have DAI then transfer it
    const DAI = await ethers.getContractAt('IERC20', ethMainnetBetaConfig.DAI_ADDRESS);
    const initBalance = await DAI.balanceOf(poolKeeper);
    if (initBalance < INITIAL_SUPPLY) {
        const val = INITIAL_SUPPLY - initBalance;
        // grant DAI for initial supply
        await grantERC20(poolKeeper.address, DAI, val);
    }
    expect(await DAI.balanceOf(poolKeeper)).to.equal(INITIAL_SUPPLY);
    // Grant ETH to POOL_KEEPER
    await grantETH(poolKeeper.address, ethers.parseEther('20'));

    // deploy mock LayerZero Endpoint
    const MockLZEndpoint = await ethers.getContractFactory('MockLZEndpoint');
    const mockLZEndpoint = await MockLZEndpoint.connect(owner!).deploy();

    // deploy MockUsdtOFT without LZ
    const MockUsdtOFT = await ethers.getContractFactory('MockUsdtOFTNoLZ');
    const mockUsdtOFT = await MockUsdtOFT.deploy(
        ethMainnetBetaConfig.LAYER_ZERO_ARBITRUM_EID,
        ethMainnetBetaConfig.LAYER_ZERO_CELO_EID,
        ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
        ethMainnetBetaConfig.LAYER_ZERO_TRON_EID,
        ethMainnetBetaConfig.LAYER_ZERO_TRON_EID,
        ethMainnetBetaConfig.USDT_ADDRESS,
        await mockLZEndpoint.getAddress(),
        owner!.address,
    );

    // usdtOFT initial balance
    const initialBalance = 10_000_000_000n;

    // increase usdtOFT balance of USDT token
    const USDT = await ethers.getContractAt('IERC20', ethMainnetBetaConfig.USDT_ADDRESS);
    await grantERC20(await mockUsdtOFT.getAddress(), USDT, initialBalance);

    // increase usdtOFT credits for tron eid
    await mockUsdtOFT.increaseCredits(ethMainnetBetaConfig.LAYER_ZERO_TRON_EID, initialBalance);

    // increase usdtOFT credits for eth eid
    await mockUsdtOFT.increaseCredits(ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID, initialBalance);

    // set enforced options for usdtOFT
    await mockUsdtOFT.setEnforcedOptions([
        {
            eid: ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
            msgType: 1,
            options: enforcedOptionData,
        },
        {
            eid: ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
            msgType: 2,
            options: enforcedOptionData,
        },
        {
            eid: ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
            msgType: 3,
            options: enforcedOptionData,
        },
    ]);

    // calc agent LZ future address
    const trxCount = await owner!.getNonce();
    const agentLZFutureAddress = ethers.getCreateAddress({
        from: owner!.address,
        nonce: trxCount,
    });

    // deploy agentLZ
    const AgentLZ = await ethers.getContractFactory('AgentLZ');

    const agentLZ = await AgentLZ.connect(owner!).deploy(
        owner!.address,
        owner!.address,
        await mockLZEndpoint.getAddress(),
        await supplyManager.getAddress(),
        ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
        ethMainnetBetaConfig.USDT_ADDRESS,
        await mockUsdtOFT.getAddress(),
    );
    expect(await agentLZ.getAddress()).to.equal(agentLZFutureAddress);

    await supplyManager.setAgent(await agentLZ.getAddress(), true);

    // deploy Tron contracts

    const Oracle = await ethers.getContractFactory('TronOracle');
    const oracle = await Oracle.connect(owner!).deploy(
        tronMainnetBetaConfig.MUSD_TOKEN_INITIAL_SUPPLY,
        tronMainnetBetaConfig.MUSD_TOKEN_INITIAL_SUPPLY,
        owner!.address,
        owner!.address,
    );

    const AccountantLZ = await ethers.getContractFactory('AccountantLZ');
    const accountantLZ = await AccountantLZ.connect(owner!).deploy(
        owner!.address,
        owner!.address,
        await mockLZEndpoint.getAddress(),
        ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
        ethMainnetBetaConfig.USDT_ADDRESS,
        await mockUsdtOFT.getAddress(),
        await oracle.getAddress(),
    );

    await oracle.setAuthorizedUpdater(await accountantLZ.getAddress());

    const RebaseTokenCommon = await ethers.getContractFactory('RebaseTokenTron');
    const rebaseTokenTron = await RebaseTokenCommon.connect(owner!).deploy(
        owner!.address,
        await accountantLZ.getAddress(),
        0n,
        await oracle.getAddress(),
        'mUSD release candidate',
        'mUSDrec',
        tronMainnetBetaConfig.MUSD_TOKEN_DECIMALS,
        tronMainnetBetaConfig.MUSD_TOKEN_MIN_DEPOSIT,
        tronMainnetBetaConfig.MUSD_TOKEN_MIN_REDEEM,
    );

    await accountantLZ.setUnderlyingToken(await rebaseTokenTron.getAddress());

    // deploy mUSDLock
    const MUSDLock = await ethers.getContractFactory('MUSDLock');
    const mUSDLock = await MUSDLock.connect(owner!).deploy(await rebaseTokenTron.getAddress());

    // set peers for AccountantLZ and AgentLZ
    const bytes32FromAddressAccountant = ethers.zeroPadValue(await accountantLZ.getAddress(), 32);
    const bytes32FromAddressAgent = ethers.zeroPadValue(await agentLZ.getAddress(), 32);

    await agentLZ.setPeer(
        ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
        bytes32FromAddressAccountant,
    );
    await accountantLZ.setPeer(
        ethMainnetBetaConfig.LAYER_ZERO_ETHEREUM_EID,
        bytes32FromAddressAgent,
    );

    // Deploy mock lz message decoder
    const MockLZMessageDecoder = await ethers.getContractFactory('MockLZMessageDecoder');
    const lzMessageDecoder = await MockLZMessageDecoder.connect(owner!).deploy();

    return {
        moleculaPool,
        supplyManager,
        agentLZ,
        oracle,
        accountantLZ,
        rebaseTokenTron,
        mUSDLock,
        mockLZEndpoint,
        lzMessageDecoder,
        poolOwner,
        rebaseTokenOwner,
        user0,
        user1,
        USDT,
        mockUsdtOFT,
        poolKeeper,
    };
}
