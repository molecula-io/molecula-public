// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {MockToken} from "../../contracts/mock/core/MockToken.sol";
import {MockOracleV2} from "../../contracts/mock/coreV2/MockOracleV2.sol";
import {CoreV2OFTVault} from "../../contracts/coreV2/OFTVault/CoreV2OFTVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ValueValidator} from "./../../contracts/common/ValueValidator.sol";
import {ERC7540Operator} from "../../contracts/coreV2/TokenVault/ERC7540Operator.sol";
import {IOAppCore} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppCore.sol";
import {ICommonOFTVault} from "../../contracts/coreV2/OFTVault/interfaces/ICommonOFTVault.sol";

// Import options builder and test helper utility functions
import {OptionsBuilder} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import {TestHelperOz5} from "@layerzerolabs/test-devtools-evm-foundry/contracts/TestHelperOz5.sol";

/**
 * @dev Minimal test harness that exposes the internal OFTVault function for direct unit testing.
 *      We avoid the LZ stack here to craft malformed payload/EID pairs and assert reverts precisely.
 *      The constructor mirrors the real one so the instance is valid in every other way.
 */
contract OFTVaultHarness is CoreV2OFTVault {
    constructor(
        address endpoint,
        uint32 ethereumEid,
        address initialOwner,
        address issuer,
        address oracleAddress
    ) CoreV2OFTVault(endpoint, ethereumEid, initialOwner, issuer, oracleAddress) {}

    function exposed_process(uint256 srcEid, bytes calldata payload) external {
        _processReceivedMessage(srcEid, payload);
    }
}

/**
 * @title LZOFTVaultTest
 * @notice Integration-like tests for OFTVault across two mock chains using LayerZero test helpers.
 * @dev Key behaviors asserted:
 *      - From Ethereum source (`_LOCAL_EID_V2 == _ETHEREUM_EID`), payload includes supply sync `(pool, shares) => 128 bytes`.
 *      - From non-Ethereum source, payload is `(shares, receiver) => 64 bytes`.
 *      - Mint and burn flows on the destination and source chains respectively.
 *      - `onlyOwner` and `onlyOperator(owner)` guards and their edge cases.
 *      - Invalid payload and EID permutations revert with `InvalidMessage`.
 */
contract LZOFTVaultTest is TestHelperOz5 {
    // Mock endpoint IDs for the chain A (Ethereum) and chain B (TRON).
    uint16 constant ethEid = 1; // Local test harness endpoint ID for the "Ethereum side".
    uint16 constant tronEid = 2; // Local test harness endpoint ID for the "TRON side".

    CoreV2OFTVault public oftVaultEth;
    CoreV2OFTVault public oftVaultTron;

    // Issuer tokens on each chain mocked, acting as ERC20-like rebase tokens for minting and burning.
    MockToken public issuerEth;
    MockToken public issuerTron;

    // Mock Oracles tracking the total Pool and shares per chain.
    MockOracleV2 public ethOracle;
    MockOracleV2 public tronOracle;

    // Test user.
    address alice = vm.addr(1);
    uint256 constant aliceInitialTokenBalance = 10000 ether;

    // Initial Oracle state on the Ethereum side. These should be synced with TRON after the first bridge from ETH.
    uint256 constant ethInitialPool = 10 ether;
    uint256 constant ethInitialShares = 10 ether;

    /**
     * @dev Global setup:
     *  - Fund Alice with the native token for gas.
     *  - Initialize two mock endpoints (A & B), using `UltraLightNode`.
     *  - Deploy mock tokens and Oracles and two `OFTVault` instances.
     *  - IMPORTANT: In `OFTVault`’s constructor, the second param is the `Ethereum EID`, not shared decimals.
     *  - Wire OApps as peers and set LZ receive gas limits per-destination EID as the bridge will rely on these.
     */
    function setUp() public virtual override {
        // Fund Alice with the native ETH to cover transaction gas on the local VM.
        vm.deal(alice, 1000 ether);

        // Base setup from `TestHelperOz5` that creates endpoints' map and utilities.
        super.setUp();

        // Create two mock endpoints (`ethEid` & `tronEid`), using `UltraLightNode`.
        setUpEndpoints(2, LibraryType.UltraLightNode);

        // Deploy mocks.
        {
            issuerEth = new MockToken();
            issuerTron = new MockToken();

            // Ethereum Oracle starts with non-zero pool and shares. TRON starts at zero.
            ethOracle = new MockOracleV2(ethInitialPool, ethInitialShares, address(this));
            tronOracle = new MockOracleV2(0, 0, address(this));
        }

        // Deploy `OFTVaults`. NOTE: `1` below is the Ethereum EID used by the Vaults to identify ETH-origin messages.
        {
            oftVaultEth = CoreV2OFTVault(
                _deployOApp(
                    type(CoreV2OFTVault).creationCode,
                    abi.encode(
                        address(endpoints[ethEid]), // Local endpoint for Ethereum-side Vault.
                        ethEid, // << Ethereum EID in this test harness >>.
                        address(this), // Owner.
                        address(issuerEth), // ISSUER (mock token / minter-burner).
                        address(ethOracle) // ORACLE for supply sync.
                    )
                )
            );

            oftVaultTron = CoreV2OFTVault(
                _deployOApp(
                    type(CoreV2OFTVault).creationCode,
                    abi.encode(
                        address(endpoints[tronEid]), // Local endpoint for the TRON-side Vault.
                        ethEid, // << Ethereum EID again (same constant) >>.
                        address(this),
                        address(issuerTron),
                        address(tronOracle)
                    )
                )
            );
        }

        // Wire apps: register each Vault as the other's peer for cross-chain messages.
        {
            address[] memory ofts = new address[](2);
            ofts[0] = address(oftVaultEth);
            ofts[1] = address(oftVaultTron);
            this.wireOApps(ofts);
        }

        // Mint initial balances as independent mock tokens to Alice on both chains.
        {
            issuerEth.mint(address(alice), aliceInitialTokenBalance);
            issuerTron.mint(address(alice), aliceInitialTokenBalance);
        }

        // Transfer Oracle ownership to their respective Vaults that will set and sync totals on receipt.
        {
            ethOracle.transferOwnership(address(oftVaultEth));
            tronOracle.transferOwnership(address(oftVaultTron));
        }

        // Set gas limits for the LZ to receive step on both directions, being required by `_buildOptions`.
        {
            oftVaultEth.setLzReceiveGasLimit(tronEid, 200_000);
            oftVaultTron.setLzReceiveGasLimit(ethEid, 200_000);
        }
    }

    /**
     * @notice Verifies constructor wiring: owners, peers, oracles, and issuers.
     * @dev Peers are stored as `bytes32(address)`. We don’t assert internal EID constants (`_ETHEREUM_EID/_LOCAL_EID_V2`) since they’re internal.
     */
    function test_constructor() public view {
        // Owners are the test contracts (`address(this)`).
        assertEq(oftVaultEth.owner(), address(this));
        assertEq(oftVaultTron.owner(), address(this));

        // Peers must point to the other chain's Vault, encoded as a bytes32 address.
        assertEq(oftVaultEth.peers(tronEid), bytes32(uint256(uint160(address(oftVaultTron)))));
        assertEq(oftVaultTron.peers(ethEid), bytes32(uint256(uint160(address(oftVaultEth)))));

        // Oracle references must match deployment.
        assertEq(address(oftVaultEth.oracle()), address(ethOracle));
        assertEq(address(oftVaultTron.oracle()), address(tronOracle));

        // Issuer references must match deployment.
        assertEq(address(oftVaultEth.ISSUER()), address(issuerEth));
        assertEq(address(oftVaultTron.ISSUER()), address(issuerTron));

        // The asset (underlying token) for each Vault should match the respective issuer.
        assertEq(oftVaultEth.asset(), address(issuerEth));
        assertEq(oftVaultTron.asset(), address(issuerTron));
    }

    /**
     * @notice Fuzz: bridge from Ethereum → TRON.
     * @dev Since source is ETH (`_LOCAL_EID_V2 == _ETHEREUM_EID`), `payload = (shares, receiver, pool, sharesSupply) => 4 words = 128 bytes`.
     *      Flow:
     *        1) Alice quotes on ETH, gets the native fee + 128-byte payload.
     *        2) Alice calls `bridge()`, paying fee; ETH-side ISSUER burns.
     *        3) verifyPackets delivers to TRON; TRON vault decodes + syncs oracle + mints to Alice.
     */
    function testFuzz_BridgeMessageEthTron(uint256 amount) public {
        // Ensure Alice has enough tokens on ETH.
        vm.assume(amount < aliceInitialTokenBalance);

        // Snapshot balances.
        uint256 amountBeforeTron = issuerTron.balanceOf(alice);
        uint256 amountBeforeEth = issuerEth.balanceOf(alice);

        // Act as Alice who is also the `owner` param to satisfy `onlyOperator(owner))`.
        vm.startPrank(alice);

        // Quote bridge on ETH → TRON.
        (MessagingFee memory fee, bytes memory payload, ) = oftVaultEth.quote(
            amount,
            address(alice),
            tronEid
        );

        // From ETH, payload carries the supply sync: `4 items => 128 bytes`.
        assertEq(payload.length, 128);

        // Expect a burn on ETH issuer as an ERC20 transfer to `address(0)`.
        vm.expectEmit(address(issuerEth));
        emit IERC20.Transfer(address(alice), address(0), amount);

        // Execute the bridge with the quoted native message fee.
        oftVaultEth.bridge{value: fee.nativeFee}(amount, address(alice), address(alice), tronEid);

        // Before delivery, TRON Oracle should remain zeroed.
        (uint256 pool, uint256 shares) = tronOracle.getTotalSupply();
        assertEq(pool, 0);
        assertEq(shares, 0);

        // Deliver all pending LayerZero packets to TRON Vault.
        verifyPackets(tronEid, addressToBytes32(address(oftVaultTron)));

        // After delivery, TRON Oracle now mirrors the ETH initial oracle state synced via `_processReceivedMessage`.
        (pool, shares) = tronOracle.getTotalSupply();
        assertEq(pool, ethInitialPool);
        assertEq(shares, ethInitialShares);

        // ETH-side: Vault holds no tokens; Alice’s ETH-token balance reduced by `amount` (burned).
        assertEq(issuerEth.balanceOf(address(oftVaultEth)), 0);
        assertEq(issuerEth.balanceOf(alice), amountBeforeEth - amount);

        // TRON-side: Alice receives `amount`; Vault does not retain tokens.
        assertEq(issuerTron.balanceOf(alice), amountBeforeTron + amount);
        assertEq(issuerTron.balanceOf(address(oftVaultTron)), 0);

        vm.stopPrank();
    }

    /**
     * @notice Fuzz: bridge from TRON → Ethereum.
     * @dev Since source is non-ETH, `payload = (shares, receiver) => 2 words = 64 bytes`. No Oracle sync data included.
     *      Flow:
     *        1) Alice quotes on TRON → payload is 64 bytes.
     *        2) Alice calls `bridge()`; TRON-side ISSUER burns.
     *        3) `verifyPackets` delivers to ETH; ETH vault decodes + mints to Alice.
     */
    function testFuzz_BridgeMessageTronEth(uint256 amount) public {
        vm.assume(amount < aliceInitialTokenBalance);

        uint256 amountBeforeTron = issuerTron.balanceOf(alice);
        uint256 amountBeforeEth = issuerEth.balanceOf(alice);

        vm.startPrank(alice);

        // Quote bridge on TRON → ETH.
        (MessagingFee memory fee, bytes memory payload, ) = oftVaultTron.quote(
            amount,
            address(alice),
            ethEid
        );

        // From non-ETH, payload only has `(shares, receiver): 2 params => 64 bytes`.
        assertEq(payload.length, 64);

        // Expect burn on TRON issuer.
        vm.expectEmit(address(issuerTron));
        emit IERC20.Transfer(address(alice), address(0), amount);

        // Execute the bridge with the quoted native message fee.
        oftVaultTron.bridge{value: fee.nativeFee}(amount, address(alice), address(alice), ethEid);

        // Deliver pending packets TRON → ETH.
        verifyPackets(ethEid, addressToBytes32(address(oftVaultEth)));

        // TRON-side: Vault holds none; Alice burned `amount`.
        assertEq(issuerTron.balanceOf(address(oftVaultEth)), 0); // sanity on wrong-chain address
        assertEq(issuerTron.balanceOf(alice), amountBeforeTron - amount);

        // ETH-side: Alice receives `amount`; Vault holds none.
        assertEq(issuerEth.balanceOf(alice), amountBeforeEth + amount);
        assertEq(issuerEth.balanceOf(address(oftVaultTron)), 0);

        vm.stopPrank();
    }

    /**
     * @notice Owner can change the Oracle, where the state updates reflect immediately.
     * @dev We set it to a random address and then reset to the original Oracle to avoid polluting other tests.
     */
    function test_SetOracle() public {
        address newEthOracle = vm.addr(2); // Stand-in for a new Oracle contract.
        oftVaultEth.setOracle(address(newEthOracle));
        assertEq(address(oftVaultEth.oracle()), address(newEthOracle));

        // Reset to the original mock to keep the rest of tests consistent.
        oftVaultEth.setOracle(address(ethOracle));
        assertEq(address(oftVaultEth.oracle()), address(ethOracle));
    }

    /**
     * @notice Owner can tune per-destination reception of gas and overwrite it later.
     */
    function test_SetLzReceiveGasLimit() public {
        oftVaultEth.setLzReceiveGasLimit(tronEid, 300_000);
        assertEq(oftVaultEth.lzReceiveGasLimit(tronEid), 300_000);

        // Reset to baseline to avoid altering later tests that assume 200k.
        oftVaultEth.setLzReceiveGasLimit(tronEid, 200_000);
        assertEq(oftVaultEth.lzReceiveGasLimit(tronEid), 200_000);
    }

    /**
     * @notice Directly call the internal processor with mismatched (`srcEid`, `payload.length`) to assert `InvalidMessage`.
     * @dev Case 1: `srcEid == ETHEREUM_EID` but payload is `64 bytes (expected 128)` -> revert.
     *      Case 2: `srcEid != ETHEREUM_EID` but payload is `128 bytes (expected 64)` -> revert.
     */
    function testRevert_processReceivedMessage_InvalidMessage() public {
        // Deploy a harness that shares the same ETH endpoint and canonical ETH EID.
        OFTVaultHarness h = new OFTVaultHarness(
            address(endpoints[ethEid]), // Valid endpoint from `TestHelperOz5`.
            1, // Canonical Ethereum EID within the harness.
            address(this), // Owner.
            address(issuerEth), // Issuer (any valid address).
            address(ethOracle) // Oracle (valid address).
        );

        // --- Case 1: Looks like the ETH source, but payload too short (2 fields only).
        bytes memory shortPayload = abi.encode(uint256(1), address(0xBEEF)); // `2 * 32B = 64 bytes`.
        vm.expectRevert(ICommonOFTVault.InvalidMessage.selector);
        h.exposed_process(ethEid, shortPayload);

        // --- Case 2: Looks like non-ETH source, but payload too long (4 fields).
        bytes memory longPayload = abi.encode(uint256(1), address(0xBEEF), uint256(2), uint256(3)); // `4 * 32B = 128`.
        vm.expectRevert(ICommonOFTVault.InvalidMessage.selector);
        h.exposed_process(tronEid, longPayload);
    }

    /**
     * @notice Non-owner cannot call `setOracle()`.
     * @dev We assert the Ownable revert selector (`OwnableUnauthorizedAccount`) via `expectPartialRevert`.
     */
    function testRevert_SetOracle_OnlyOwner() public {
        address newEthOracle = vm.addr(2);

        vm.startPrank(alice);
        vm.expectPartialRevert(Ownable.OwnableUnauthorizedAccount.selector); // Ownable guard.
        oftVaultEth.setOracle(address(newEthOracle));
        vm.stopPrank();
    }

    /**
     * @notice Setting the Oracle to the zero address that is rejected by `ValueValidator`.
     */
    function testRevert_SetOracle_ZeroAddress() public {
        vm.expectRevert(ValueValidator.EZeroAddress.selector);
        oftVaultEth.setOracle(address(0));
    }

    /**
     * @notice Non-owner cannot call `setLzReceiveGasLimit()`.
     */
    function testRevert_SetLzReceiveGasLimit_OnlyOwner() public {
        vm.startPrank(alice);
        vm.expectPartialRevert(Ownable.OwnableUnauthorizedAccount.selector);
        oftVaultEth.setLzReceiveGasLimit(tronEid, 300_000);
        vm.stopPrank();
    }

    /**
     * @notice Zero EID or zero `gasLimit` are rejected by `ValueValidator`'s `notZero()`.
     */
    function testRevert_SetLzReceiveGasLimit_ZeroValue() public {
        // EID cannot be zero.
        vm.expectRevert(ValueValidator.EZeroValue.selector);
        oftVaultEth.setLzReceiveGasLimit(0, 200_000);

        // `gasLimit` cannot be zero.
        vm.expectRevert(ValueValidator.EZeroValue.selector);
        oftVaultEth.setLzReceiveGasLimit(tronEid, 0);
    }

    /**
     * @notice A non-operator attempting to bridge on behalf of `owner` must revert.
     * @dev We prepare a valid fee via `quote()`; a revert occurs inside `bridge()` due to `onlyOperator(owner)`.
     */
    function testRevert_Bridge_OnlyOperator() public {
        address bob = vm.addr(2);
        vm.deal(bob, 1000 ether);

        // Prepare a valid quote. Anyone can call `quote()` as it doesn't check operatorship.
        uint256 amount = 100 ether;
        (MessagingFee memory fee, , ) = oftVaultEth.quote(amount, address(alice), tronEid);

        // Bob attempts to bridge for Alice; should hit the `ERC7540Operator` guard.
        vm.startPrank(bob);
        vm.expectPartialRevert(ERC7540Operator.EInvalidOperator.selector);
        oftVaultEth.bridge{value: fee.nativeFee}(
            amount,
            address(alice),
            /* owner */ alice,
            tronEid
        );
        vm.stopPrank();
    }

    /**
     * @notice Quoting/bridging to an unknown EID should revert with `NoPeer` (peer not wired).
     * @dev We first expect revert on `quote()`; then do a valid quote and try to bridge to invalid EID (also revert).
     */
    function testRevert_Bridge_NoPeer() public {
        uint256 amount = 100 ether;
        uint16 invalidEid = 3; // No peer was wired for this EID in `setUp()`.

        vm.startPrank(alice);

        // `quote()` should revert because LZ cannot resolve a peer for `invalidEid`.
        vm.expectPartialRevert(IOAppCore.NoPeer.selector);
        (MessagingFee memory fee, , ) = oftVaultEth.quote(amount, address(alice), invalidEid);

        // Now quote a valid route to get a valid fee, but bridge to `invalidEid` (force revert at send time).
        (fee, , ) = oftVaultEth.quote(amount, address(alice), tronEid);
        vm.expectPartialRevert(IOAppCore.NoPeer.selector);
        oftVaultEth.bridge{value: fee.nativeFee}(
            amount,
            address(alice),
            address(alice),
            invalidEid
        );

        vm.stopPrank();
    }
}
