// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {Test, console2} from "forge-std/Test.sol";
import {MrEthSetup} from "./MrEthSetup.sol";
import {DepositManagerPool} from "../../contracts/solutions/mrETH/DepositManagerPool.sol";
import {DepositManagerRestaker} from "../../contracts/solutions/mrETH/DepositManagerRestaker.sol";
import {DepositManagerLib} from "../../contracts/solutions/mrETH/libraries/DepositManagerLib.sol";
import {IDepositManagerTypes} from "../../contracts/solutions/mrETH/interfaces/IDepositManagerTypes.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AaveBufferLib} from "../../contracts/solutions/mrETH/libraries/AaveBufferLib.sol";
import {CompoundBufferLib} from "../../contracts/solutions/mrETH/libraries/CompoundBufferLib.sol";
import {IWETH} from "../../contracts/solutions/mrETH/external/interfaces/IWETH.sol";
import {MrEthAssetTokenVault} from "../../contracts/solutions/mrETH/TokenVault/MrEthAssetTokenVault.sol";
import {MrEthNativeTokenVault} from "../../contracts/solutions/mrETH/TokenVault/MrEthNativeTokenVault.sol";
import {ITokenVault} from "../../contracts/coreV2/TokenVault/interfaces/ITokenVault.sol";
import {IRebaseERC20V2} from "../../contracts/coreV2/Tokens/interfaces/IRebaseERC20V2.sol";
import {INativeTokenVault} from "../../contracts/coreV2/TokenVault/interfaces/ITokenVault.sol";
import {IBufferInteractor} from "../../contracts/solutions/mrETH/interfaces/IBufferInteractor.sol";

/**
 * @title DepositManager Math Tests.
 * @notice Comprehensive tests for mathematical operations in DepositManager using real contracts
 */
contract DepositManagerMathTest is MrEthSetup {
    // Test user addresses.
    address public testUser;
    address public testUser2;

    // Test amounts.
    uint256 constant TEST_DEPOSIT_AMOUNT = 1e18; // 1 ETH.
    uint256 constant TEST_LARGE_DEPOSIT = 32e18; // 32 ETH.
    uint256 constant TEST_STAKE_AMOUNT = 32e18; // 32 ETH for staking.
    uint256 constant MIN_PORTION = 100; // 1%.
    /**
     * @dev Set up the function that runs before each test.
     * @notice Inherits from `MrEthSetup` and adds a test-specific setup.
     */
    function setUp() public override {
        string memory url = vm.rpcUrl("mainnet");
        uint256 blockNumber = vm.envUint("FORK_BLOCK_NUMBER");
        // Create a fork from the Mainnet at a choosen block number.
        vm.createSelectFork(url, blockNumber);
        super.setUp();

        // Set up test users.
        testUser = makeAddr("testUser");
        testUser2 = makeAddr("testUser2");

        // Fund test users with WETH.
        vm.startPrank(owner);
        weth.deposit{value: 1000e18}();
        weth.transfer(testUser, 100e18);
        weth.transfer(testUser2, 100e18);
        vm.stopPrank();
    }

    // ============ REAL DEPOSIT TESTS ============

    /**
     * @dev Fuzz test: Real stETH deposits with various amounts.
     * @param depositAmount Amount to deposit (bounded between 0.1 stETH and 50 stETH).
     * @notice Tests that real stETH deposits maintain mathematical consistency.
     */
    function testFuzz_steth_deposits_one_operator(uint256 depositAmount) public {
        // Bounded inputs to avoid setup issues.
        // `depositAmount` must be greater than the minimal deposit and lower than 100_000 stETH.
        vm.assume(depositAmount < 1e23);

        uint256 minDepositAssets = MrEthAssetTokenVault(stEthVault).minDepositAssets();
        if (depositAmount < minDepositAssets) {
            // Skip if the deposit amount is too low.
            return;
        }

        // Get the initial state.
        uint256 initialTotalSupply = depositManagerPool.totalSupply();
        (uint256 initialBufferedSupply, ) = depositManagerPool.totalBufferedSupply();

        // First, make a deposit to have funds in the Buffer.
        vm.startPrank(testUser);
        // Fund user with stETH.
        vm.deal(testUser, depositAmount);
        stEth.submit{value: depositAmount}(address(0));
        stEth.approve(stEthVault, depositAmount);
        MrEthAssetTokenVault(stEthVault).requestDeposit(depositAmount, testUser, testUser);
        vm.stopPrank();

        // Get the final state.
        uint256 finalTotalSupply = depositManagerPool.totalSupply();
        (uint256 finalBufferedSupply, ) = depositManagerPool.totalBufferedSupply();

        // Verify that the supply has decreased correctly.
        assertApproxEqAbs(
            finalTotalSupply,
            initialTotalSupply + depositAmount,
            10e2,
            "Total supply should increase by deposit amount change by withdrawal amount"
        );
        assertApproxEqAbs(
            finalBufferedSupply,
            initialBufferedSupply,
            10e2,
            "Buffered supply should not change by deposit amount"
        );

        // Verify operator TVL.
    }

    // ============ FUZZ TESTS FOR REAL DEPOSITS ============

    /**
     * @dev Fuzz test: Real ETH deposits with various amounts.
     * @param depositAmount Amount to deposit (bounded between 0.1 ETH and 50 ETH).
     * @notice Tests that real ETH deposits maintain mathematical consistency.
     */
    function testFuzz_eth_buffer_withdrawalsl(uint256 depositAmount) public {
        // Bounded inputs to avoid setup issues.
        // `depositAmount` must be greater than the minimal deposit and lower than 100_000 ETH.
        vm.assume(depositAmount < 1e23);

        // Skip if the deposit amount is too low.
        if (!_verifyDepositAmount(depositAmount)) return;

        // First, make a deposit to have funds in the Buffer.
        vm.startPrank(testUser);
        // Fund user with WETH.
        vm.deal(testUser, depositAmount);
        MrEthNativeTokenVault(ethVault).deposit{value: depositAmount}(depositAmount, testUser);
        vm.stopPrank();

        // Get the initial state.
        uint256 initialTotalSupply = depositManagerPool.totalSupply();
        (uint256 initialBufferedSupply, ) = depositManagerPool.totalBufferedSupply();

        // Perform the withdrawal.
        vm.startPrank(authorizedStaker);

        bytes memory stakeNativeData = abi.encodeWithSelector(
            depositManagerRestaker.stakeNative.selector,
            TEST_STAKE_AMOUNT,
            hex"a9cb9301da65d3cc128eedb9d130587e749058692a74ba8b5bcccaa6360c3dc67fe4303c292a61a146e24541deb09ad7",
            hex"8fea10e797b30b91e3d7fa00c07f78b1b62ecf56e0d5d35fb1508a489bb233b39af14bef6328cc8b67d4589e9e3444fd0612e706f109ab433dd30d3a09c6bd81ec27f00475ffc15f7a0dc07bd30c620fa44af4937b249d98527d85356cf0706e",
            0xdf1c3a71df63a78fb612ee70afac1045b2a788333ed8be183127e8e81d2184bd
        );
        (bool success, ) = address(depositManagerPool).call(stakeNativeData);
        require(success, "stakeNative failed");

        // Get the final state.
        uint256 finalTotalSupply = depositManagerPool.totalSupply();
        (uint256 finalBufferedSupply, ) = depositManagerPool.totalBufferedSupply();

        // Verify that the supply has decreased correctly.
        assertApproxEqAbs(
            finalTotalSupply,
            initialTotalSupply,
            10e2,
            "Total supply should not change by withdrawal amount"
        );
        assertApproxEqAbs(
            finalBufferedSupply,
            initialBufferedSupply - TEST_STAKE_AMOUNT,
            10e2,
            "Buffered supply should decrease by withdrawal amount"
        );

        // Verify that the Pool proportions are maintained.
        _verifyPoolProportions();
    }

    // ============ BUFFER WITHDRAWAL TESTS ============

    /**
     * @dev Fuzz test: Real buffer withdrawals with various amounts.
     * @param depositAmount Amount to deposit (bounded between 0.1 ETH and 10 ETH).
     * @notice Tests that real Buffer withdrawals maintain mathematical consistency.
     */
    function testFuzz_weth_buffer_withdrawals(uint256 depositAmount) public {
        // Bounded inputs to avoid setup issues.
        // `withdrawalAmount` must be greater than the minimal deposit and lower than 100_000 WETH.
        vm.assume(depositAmount < 1e23);

        // Skip if the deposit amount is too low.
        if (!_verifyDepositAmount(depositAmount)) return;

        // First, make a deposit to have funds in the Buffer.
        vm.startPrank(testUser);
        // Fund user with WETH.
        vm.deal(testUser, depositAmount);
        weth.deposit{value: depositAmount}();
        weth.approve(wEthVault, depositAmount); // Deposit double the withdrawal amount
        MrEthAssetTokenVault(wEthVault).requestDeposit(depositAmount, testUser, testUser);
        vm.stopPrank();

        // Get the initial state.
        uint256 initialTotalSupply = depositManagerPool.totalSupply();
        (uint256 initialBufferedSupply, ) = depositManagerPool.totalBufferedSupply();

        // Perform the withdrawal.
        vm.startPrank(authorizedStaker);

        bytes memory stakeNativeData = abi.encodeWithSelector(
            depositManagerRestaker.stakeNative.selector,
            TEST_STAKE_AMOUNT,
            hex"a9cb9301da65d3cc128eedb9d130587e749058692a74ba8b5bcccaa6360c3dc67fe4303c292a61a146e24541deb09ad7",
            hex"8fea10e797b30b91e3d7fa00c07f78b1b62ecf56e0d5d35fb1508a489bb233b39af14bef6328cc8b67d4589e9e3444fd0612e706f109ab433dd30d3a09c6bd81ec27f00475ffc15f7a0dc07bd30c620fa44af4937b249d98527d85356cf0706e",
            0xdf1c3a71df63a78fb612ee70afac1045b2a788333ed8be183127e8e81d2184bd
        );
        (bool success, ) = address(depositManagerPool).call(stakeNativeData);
        require(success, "stakeNative failed");

        // Get the final state.
        uint256 finalTotalSupply = depositManagerPool.totalSupply();
        (uint256 finalBufferedSupply, ) = depositManagerPool.totalBufferedSupply();

        // Verify that the supply has decreased correctly.
        assertApproxEqAbs(
            finalTotalSupply,
            initialTotalSupply,
            10e2,
            "Total supply should not change by withdrawal amount"
        );
        assertApproxEqAbs(
            finalBufferedSupply,
            initialBufferedSupply - TEST_STAKE_AMOUNT,
            10e2,
            "Buffered supply should decrease by withdrawal amount"
        );

        // Verify that the Pool proportions are maintained.
        _verifyPoolProportions();
        vm.stopPrank();
    }

    /**
     * @dev Fuzz test: Real buffer withdrawals with various amounts.
     * @param depositAmount Amount to deposit (bounded between 0.1 ETH and 10 ETH).
     * @param bufferPercentage Buffer percentage (bounded between 1% and 100%).
     * @notice Tests that real Buffer withdrawals maintain mathematical consistency.
     */
    function testFuzz_weth_buffer_withdrawals_two_pools(
        uint256 depositAmount,
        uint16 bufferPercentage
    ) public {
        // Set up the Pools and Buffer percentage and validate the fuzz data.
        vm.startPrank(owner);
        uint16[2] memory poolPortions = [uint16(7_000), uint16(3_000)];
        setPools(poolPortions);
        if (!setBufferPercentage(bufferPercentage)) return;

        // Bounded inputs to avoid setup issues.
        // `withdrawalAmount` must be greater than the minimal deposit and lower than 100_000 WETH.
        vm.assume(depositAmount < 1e23);

        // Skip if the deposit amount is too low.
        uint256 desiredDepositAmount = TEST_STAKE_AMOUNT +
            ((depositAmount * bufferPercentage) / PERCENTAGE_FACTOR);

        if (depositAmount < desiredDepositAmount) return;

        vm.stopPrank();

        // Test deposit and stake math.
        testFuzz_weth_buffer_withdrawals(depositAmount);
    }

    /**
     * @dev Fuzz test: Real buffer withdrawals with various amounts.
     * @param depositAmount Amount to deposit (bounded between 0.1 ETH and 10 ETH).
     * @param bufferPercentage Buffer percentage (bounded between 1% and 100%).
     * @notice Tests that real Buffer withdrawals maintain mathematical consistency.
     */
    function testFuzz_eth_buffer_withdrawals_two_pools(
        uint256 depositAmount,
        uint16 bufferPercentage
    ) public {
        vm.startPrank(owner);
        uint16[2] memory poolPortions = [uint16(6_000), uint16(4_000)];
        setPools(poolPortions);
        if (!setBufferPercentage(bufferPercentage)) return;

        // Bounded inputs to avoid setup issues.
        // `withdrawalAmount` must be greater than the minimal deposit and lower than 100_000 WETH.
        vm.assume(depositAmount < 1e23);

        // Skip if the deposit amount is too low.
        uint256 desiredDepositAmount = TEST_STAKE_AMOUNT +
            ((depositAmount * bufferPercentage) / PERCENTAGE_FACTOR);

        if (depositAmount < desiredDepositAmount) return;

        vm.stopPrank();

        // First, make a deposit to have funds in the Buffer.
        testFuzz_eth_buffer_withdrawalsl(depositAmount);
    }

    // ============ POOL REBALANCING TESTS ============
    // TODO: Add test for Pool rebalancing, assuming that it works incorrectly with the uint16 portions' array.
    // ============ FUZZ TESTS FOR OPERATOR PORTIONS ============

    /**
     * @dev Fuzz test: Operator portion calculations with various values.
     * @param value Value to distribute across operators.
     * @notice Tests operator portion calculations with random values.
     */
    function testFuzz_operator_portion_calculations(uint256 value) public pure {
        vm.assume(value > 0 && value <= MAX_UINT256 / PERCENTAGE_FACTOR);

        uint256 totalCalculated = 0;
        uint256[] memory operatorPortions = new uint256[](1);
        operatorPortions[0] = 10000; // 100% for the single operator.

        for (uint256 i = 0; i < operatorPortions.length; i++) {
            uint256 portion = (value * operatorPortions[i]) / PERCENTAGE_FACTOR;
            totalCalculated += portion;
        }

        // Allow for small rounding differences.
        uint256 difference = totalCalculated > value
            ? totalCalculated - value
            : value - totalCalculated;
        assertLe(
            difference,
            2,
            "Operator portion calculations must sum to original value (allow rounding)"
        );
    }

    // ============ HELPER FUNCTIONS ============

    function setPools(uint16[2] memory poolPortions) public {
        IDepositManagerTypes.SetPoolData[]
            memory setPoolData = new IDepositManagerTypes.SetPoolData[](2);

        poolsArray.push(cWETHv3Address);

        // Pool 1: AAVE Pool (`portion[0]`).
        setPoolData[0] = IDepositManagerTypes.SetPoolData({
            pool: poolsArray[0],
            auth: true,
            newPoolData: IDepositManagerTypes.PoolData({
                poolToken: awethAddress,
                poolLib: address(AaveBufferLib),
                poolPortion: poolPortions[0],
                poolId: 0
            })
        });

        // Pool 2: Compound Pool (`portion[1]`).
        setPoolData[1] = IDepositManagerTypes.SetPoolData({
            pool: cWETHv3Address,
            auth: true,
            newPoolData: IDepositManagerTypes.PoolData({
                poolToken: cWETHv3Address,
                poolLib: address(CompoundBufferLib),
                poolPortion: poolPortions[1],
                poolId: 1
            })
        });

        depositManagerPool.setPools(setPoolData, 2);
    }

    /**
     * @dev Verify that the deposit amount is greater than the desired deposit amount.
     * @param depositAmount Amount to deposit.
     * @notice Checks that deposit amount is greater than `StakeAmount + BufferPercentage`.
     */
    function _verifyDepositAmount(uint256 depositAmount) internal view returns (bool) {
        (, , , , , uint16 bufferPercentage) = depositManagerPool.config();
        uint256 desiredDepositAmount = TEST_STAKE_AMOUNT +
            ((depositAmount * bufferPercentage) / PERCENTAGE_FACTOR);

        return depositAmount > desiredDepositAmount;
    }
    /**
     * @dev Verify that the Pool proportions are maintained.
     * @notice Checks that actual Pool balances match the expected proportions.
     */
    function _verifyPoolProportions() internal view {
        (uint256 totalBuffered, ) = depositManagerPool.totalBufferedSupply();
        for (uint256 i = 0; i < poolDataArray.length; i++) {
            uint256 expectedBalance = (totalBuffered * poolDataArray[i].poolPortion) /
                PERCENTAGE_FACTOR;
            uint256 actualBalance = IBufferInteractor(poolDataArray[i].poolLib).getEthBalance(
                poolsArray[i],
                poolDataArray[i].poolToken,
                address(depositManagerPool)
            );
            // Allow for small rounding differences.
            assertApproxEqAbs(expectedBalance, actualBalance, 10);
        }
    }

    /**
     * @dev Set the Buffer percentage.
     * @param bufferPercentage Buffer percentage (bounded between 1% and 100%).
     * @notice Sets the Buffer percentage.
     */
    function setBufferPercentage(uint16 bufferPercentage) public returns (bool) {
        if (bufferPercentage > PERCENTAGE_FACTOR || bufferPercentage < MIN_PORTION) {
            // Skip if the Buffer percentage is greater than `PERCENTAGE_FACTOR`.
            return false;
        }

        depositManagerPool.setBufferPercentage(bufferPercentage);

        return true;
    }
}
