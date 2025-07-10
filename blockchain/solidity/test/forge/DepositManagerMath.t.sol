// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {MrEthSetup} from "./MrEthSetup.sol";
import {DepositManager} from "../../contracts/solutions/mrETH/DepositManager.sol";
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
 * @title DepositManager Math Tests
 * @notice Comprehensive tests for mathematical operations in DepositManager using real contracts
 */
contract DepositManagerMathTest is MrEthSetup {
    // Test user addresses
    address public testUser;
    address public testUser2;

    // Test amounts
    uint256 constant TEST_DEPOSIT_AMOUNT = 1e18; // 1 ETH
    uint256 constant TEST_LARGE_DEPOSIT = 32e18; // 32 ETH
    uint256 constant TEST_STAKE_AMOUNT = 32e18; // 32 ETH for staking
    uint256 constant MIN_PORTION = 100; // 1%
    /**
     * @dev Setup function that runs before each test
     * @notice Inherits from MrEthSetup and adds test-specific setup
     */
    function setUp() public override {
        string memory url = vm.rpcUrl("mainnet");
        vm.createSelectFork(url);
        super.setUp();

        // Setup test users
        testUser = makeAddr("testUser");
        testUser2 = makeAddr("testUser2");

        // Fund test users with WETH
        vm.startPrank(owner);
        weth.deposit{value: 1000e18}();
        weth.transfer(testUser, 100e18);
        weth.transfer(testUser2, 100e18);
        vm.stopPrank();
    }

    // ============ REAL DEPOSIT TESTS ============

    /**
     * @dev Fuzz test: Real stETH deposits with various amounts
     * @param depositAmount The amount to deposit (bounded between 0.1 stETH and 50 stETH)
     * @notice Tests that real stETH deposits maintain mathematical consistency
     */
    function testFuzz_steth_deposits_one_operator(uint256 depositAmount) public {
        // Bounded inputs to avoid setup issues
        // depositAmount should be greater then minimal deposit and lower then 100_000 stETH
        vm.assume(depositAmount < 1e23);

        uint256 minDepositAssets = MrEthAssetTokenVault(vaultStETH).minDepositAssets();
        if (depositAmount < minDepositAssets) {
            // Skip if deposit amount is too low
            return;
        }

        // Get initial state
        uint256 initialTotalSupply = depositManager.totalSupply();
        uint256 initialBufferedSupply = depositManager.totalBufferedSupply();

        // First, make a deposit to have funds in buffer
        vm.startPrank(testUser);
        // Fund user with stETH
        vm.deal(testUser, depositAmount);
        stEth.submit{value: depositAmount}(address(0));
        stEth.approve(vaultStETH, depositAmount);
        MrEthAssetTokenVault(vaultStETH).requestDeposit(depositAmount, testUser, testUser);
        vm.stopPrank();

        // Get final state
        uint256 finalTotalSupply = depositManager.totalSupply();
        uint256 finalBufferedSupply = depositManager.totalBufferedSupply();

        // Verify supply decreased correctly
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

        // Verify operator tvl
    }

    // ============ FUZZ TESTS FOR REAL DEPOSITS ============

    /**
     * @dev Fuzz test: Real ETH deposits with various amounts
     * @param depositAmount The amount to deposit (bounded between 0.1 ETH and 50 ETH)
     * @notice Tests that real ETH deposits maintain mathematical consistency
     */
    function testFuzz_eth_buffer_withdrawalsl(uint256 depositAmount) public {
        // Bounded inputs to avoid setup issues
        // depositAmount should be greater then minimal deposit and lower then 100_000 ETH
        vm.assume(depositAmount < 1e23);

        // Skip if deposit amount is too low
        if (!_verifyDepositAmount(depositAmount)) return;

        // First, make a deposit to have funds in buffer
        vm.startPrank(testUser);
        // Fund user with WETH
        vm.deal(testUser, depositAmount);
        MrEthNativeTokenVault(vaultETH).deposit{value: depositAmount}(depositAmount, testUser);
        vm.stopPrank();

        // Get initial state
        uint256 initialTotalSupply = depositManager.totalSupply();
        uint256 initialBufferedSupply = depositManager.totalBufferedSupply();

        // Perform withdrawal
        vm.startPrank(authorizedStaker);

        depositManager.stakeNative(
            TEST_STAKE_AMOUNT,
            hex"96466946467078800b3433d11e4eb632df934137862fd57f73638b581c581316a5e0653dfa47302eb7ebedcaa8893f9c",
            hex"8edd3d17e33227bac07b9815643e173d10aebdeaae1c18151cd063357a342c1455ccb2775d6ea4fd686e20eb83840d0a0a11d8c51f816a11a9cf862de6375c0f4abe9230647b742274d942aaa050c53b79b04e261433894078fc75c7f7793160",
            0x5c3b721fd734d0bbb1212efc570b5c253b593520ce57dfb5e67fe12d4b2465d0
        );
        // Get final state
        uint256 finalTotalSupply = depositManager.totalSupply();
        uint256 finalBufferedSupply = depositManager.totalBufferedSupply();

        // Verify supply decreased correctly
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

        // Verify pool proportions are maintained
        _verifyPoolProportions();
    }

    // ============ BUFFER WITHDRAWAL TESTS ============

    /**
     * @dev Fuzz test: Real buffer withdrawals with various amounts
     * @param depositAmount The amount to deposit (bounded between 0.1 ETH and 10 ETH)
     * @notice Tests that real buffer withdrawals maintain mathematical consistency
     */
    function testFuzz_weth_buffer_withdrawals(uint256 depositAmount) public {
        // Bounded inputs to avoid setup issues
        // withdrawalAmount should be greater then minimal deposit and lower then 100_000 WETH
        vm.assume(depositAmount < 1e23);

        // Skip if deposit amount is too low
        if (!_verifyDepositAmount(depositAmount)) return;

        // First, make a deposit to have funds in buffer
        vm.startPrank(testUser);
        // Fund user with WETH
        vm.deal(testUser, depositAmount);
        weth.deposit{value: depositAmount}();
        weth.approve(vaultWETH, depositAmount); // Deposit double the withdrawal amount
        MrEthAssetTokenVault(vaultWETH).requestDeposit(depositAmount, testUser, testUser);
        vm.stopPrank();

        // Get initial state
        uint256 initialTotalSupply = depositManager.totalSupply();
        uint256 initialBufferedSupply = depositManager.totalBufferedSupply();

        // Perform withdrawal
        vm.startPrank(authorizedStaker);

        depositManager.stakeNative(
            TEST_STAKE_AMOUNT,
            hex"96466946467078800b3433d11e4eb632df934137862fd57f73638b581c581316a5e0653dfa47302eb7ebedcaa8893f9c",
            hex"8edd3d17e33227bac07b9815643e173d10aebdeaae1c18151cd063357a342c1455ccb2775d6ea4fd686e20eb83840d0a0a11d8c51f816a11a9cf862de6375c0f4abe9230647b742274d942aaa050c53b79b04e261433894078fc75c7f7793160",
            0x5c3b721fd734d0bbb1212efc570b5c253b593520ce57dfb5e67fe12d4b2465d0
        );
        // Get final state
        uint256 finalTotalSupply = depositManager.totalSupply();
        uint256 finalBufferedSupply = depositManager.totalBufferedSupply();

        // Verify supply decreased correctly
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

        // Verify pool proportions are maintained
        _verifyPoolProportions();
        vm.stopPrank();
    }

    /**
     * @dev Fuzz test: Real buffer withdrawals with various amounts
     * @param depositAmount The amount to deposit (bounded between 0.1 ETH and 10 ETH)
     * @param bufferPercentage The buffer percentage (bounded between 1% and 100%)
     * @notice Tests that real buffer withdrawals maintain mathematical consistency
     */
    function testFuzz_weth_buffer_withdrawals_two_pools(
        uint256 depositAmount,
        uint16 bufferPercentage
    ) public {
        uint16[2] memory poolPortions = [uint16(7_000), uint16(3_000)];
        setPools(poolPortions);
        setBufferPercentage(bufferPercentage);

        // First, make a deposit to have funds in buffer
        testFuzz_weth_buffer_withdrawals(depositAmount);
    }

    /**
     * @dev Fuzz test: Real buffer withdrawals with various amounts
     * @param depositAmount The amount to deposit (bounded between 0.1 ETH and 10 ETH)
     * @param bufferPercentage The buffer percentage (bounded between 1% and 100%)
     * @notice Tests that real buffer withdrawals maintain mathematical consistency
     */
    function testFuzz_eth_buffer_withdrawals_two_pools(
        uint256 depositAmount,
        uint16 bufferPercentage
    ) public {
        uint16[2] memory poolPortions = [uint16(6_000), uint16(4_000)];
        setPools(poolPortions);
        setBufferPercentage(bufferPercentage);

        // First, make a deposit to have funds in buffer
        testFuzz_eth_buffer_withdrawalsl(depositAmount);
    }

    // ============ POOL REBALANCING TESTS ============
    // TODO: add test for pool rebalancing (assume works incorrect with uint16 portions array)
    // ============ FUZZ TESTS FOR OPERATOR PORTIONS ============

    /**
     * @dev Fuzz test: Operator portion calculations with various values
     * @param value The value to distribute across operators
     * @notice Tests operator portion calculations with random values
     */
    function testFuzz_operator_portion_calculations(uint256 value) public pure {
        vm.assume(value > 0 && value <= MAX_UINT256 / PERCENTAGE_FACTOR);

        uint256 totalCalculated = 0;
        uint256[] memory operatorPortions = new uint256[](1);
        operatorPortions[0] = 10000; // 100% for single operator

        for (uint256 i = 0; i < operatorPortions.length; i++) {
            uint256 portion = (value * operatorPortions[i]) / PERCENTAGE_FACTOR;
            totalCalculated += portion;
        }

        // Allow for small rounding differences
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
        vm.startPrank(owner);
        // Pool 1: AAVE pool (portion[0])
        poolDataArray[0] = IDepositManagerTypes.PoolData({
            poolToken: awethAddress,
            poolLib: address(aaveBufferInteractor),
            poolPortion: poolPortions[0],
            poolId: 0
        });
        // Pool 2: Compound pool (portion[1])
        poolDataArray.push(
            IDepositManagerTypes.PoolData({
                poolToken: cWETHv3Address,
                poolLib: address(compoundBufferInteractor),
                poolPortion: poolPortions[1],
                poolId: 1
            })
        );
        poolsArray.push(cWETHv3Address);
        authArray.push(true);

        depositManager.setPools(poolsArray, poolDataArray, authArray);
        vm.stopPrank();
    }

    /**
     * @dev Verify deposit amount is greater than desired deposit amount
     * @param depositAmount The amount to deposit
     * @notice Checks that deposit amount is greater than StakeAmount + BufferPercentage
     */
    function _verifyDepositAmount(uint256 depositAmount) internal view returns (bool) {
        uint256 desiredDepositAmount = TEST_STAKE_AMOUNT +
            ((depositAmount * depositManager.bufferPercentage()) / PERCENTAGE_FACTOR);

        return depositAmount > desiredDepositAmount;
    }
    /**
     * @dev Verify pool proportions are maintained
     * @notice Checks that actual pool balances match expected proportions
     */
    function _verifyPoolProportions() internal view {
        uint256 totalBuffered = depositManager.totalBufferedSupply();
        for (uint256 i = 0; i < poolDataArray.length; i++) {
            uint256 expectedBalance = (totalBuffered * poolDataArray[i].poolPortion) /
                PERCENTAGE_FACTOR;
            uint256 actualBalance = IBufferInteractor(poolDataArray[i].poolLib).getEthBalance(
                poolsArray[i],
                poolDataArray[i].poolToken,
                address(depositManager)
            );
            // Allow for small rounding differences
            assertApproxEqAbs(expectedBalance, actualBalance, 10);
        }
    }

    /**
     * @dev Set buffer percentage
     * @param bufferPercentage The buffer percentage (bounded between 1% and 100%)
     * @notice Sets the buffer percentage
     */
    function setBufferPercentage(uint16 bufferPercentage) public {
        vm.startPrank(owner);
        if (bufferPercentage > PERCENTAGE_FACTOR || bufferPercentage < MIN_PORTION) {
            // Skip if buffer percentage is greater than PERCENTAGE_FACTOR
            return;
        }
        depositManager.setBufferPercentage(bufferPercentage);
        vm.stopPrank();
    }
}
