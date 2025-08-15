// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

// Import the AgentLZ contract and its interface
import {AgentLZ} from "../../contracts/solutions/Carbon/ethereum/AgentLZ.sol";
import {IAgent} from "../../contracts/common/interfaces/IAgent.sol";

// Import options and fee structures used by OApp contracts
import {IOAppOptionsType3, EnforcedOptionParam} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/interfaces/IOAppOptionsType3.sol";

// Import the mock AccountantLZ, UsdtOFT, and USDT contracts for testing cross-chain operations
import {MockAccountantLZ} from "../../contracts/mock/lz/MockAccountantLZ.sol";
import {MockRebaseTokenCommon} from "../../contracts/mock/core/MockRebaseTokenCommon.sol";
import {MockTronOracle} from "../../contracts/mock/core/MockTronOracle.sol";
import {MockUsdtOFT} from "../../contracts/mock/USDT/MockUsdtOFT.sol";
import {MockUSDT} from "../../contracts/mock/USDT/MockUsdt.sol";
import {MoleculaPoolTreasuryV2} from "../../contracts/core/MoleculaPoolTreasuryV2.sol";

// Import options builder and test helper utility functions
import {OptionsBuilder} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TestHelperOz5} from "@layerzerolabs/test-devtools-evm-foundry/contracts/TestHelperOz5.sol";

// Import LayerZero Packet interface for cross-chain message verification
import {Packet} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ISendLib.sol";

import {OperationStatus} from "../../contracts/common/rebase/structures/OperationStatus.sol";

// Import the SupplyManager contract used on the Ethereum side of the test
import {SupplyManager} from "../../contracts/core/SupplyManager.sol";
import {IWhitelistedExecutor} from "../../contracts/coreV2/interfaces/IWhitelistedExecutor.sol";

/// @title LZCrossMessageTest
/// @notice This contract tests the cross-chain messaging flows between an AgentLZ
/// and a MockAccountantLZ. It wires up mock endpoints, configures OFT contracts on both chains,
/// deploys the Agent and Accountant contracts, and then simulates a deposit request flow.
/// In this example, we simulate a cross-chain deposit request where USDT tokens move from one chain
/// (Ethereum, represented by AgentLZ) to another (Tron, represented by AccountantLZ).
contract LZCrossMessageTest is TestHelperOz5 {
    using OptionsBuilder for bytes; // Allows fluent option building for cross-chain messaging options

    // Instance of AgentLZ and AccountantLZ (mock) which simulate cross-chain agents/accountants.
    AgentLZ public agentLZ;
    MockAccountantLZ public accountantLZ;

    // Instances of the USDT Omnichain Fungible Token (OFT) mocks for Ethereum and Tron.
    MockUsdtOFT public usdtOftEth;
    MockUsdtOFT public usdtOftTron;
    // Underlying USDT token mocks on Ethereum and Tron.
    MockUSDT public usdtEth;
    MockUSDT public usdtTron;
    // Mock RebaseERC20 token, used for testing rebase functionality.
    MockRebaseTokenCommon public tronRebase;

    // Instance of the MoleculaPoolTreasury on Ethereum.
    MoleculaPoolTreasuryV2 public mpTreasuryEth;

    // Instance of the Supply Manager on Ethereum.
    SupplyManager public spManagerEth;

    MockTronOracle public tronOracle;

    // Test user address.
    address alice = vm.addr(1);

    // Define mock endpoint IDs for chain A (Ethereum) and chain B (Tron).
    uint16 constant aEid = 1;
    uint16 constant bEid = 2;

    // Define initial USDT balance for alice on Tron and transferable credits for OFT contracts.
    uint256 constant aliceUsdtTronBalance = 10000 * 10 ** 6;
    uint256 constant usdtOftTransferableCredits = 1000000 * 10 ** 6;
    uint256 constant initialPoolBalance = 10 * 10 ** 6;

    /// @notice setUp initializes the testing environment.
    /// It sets up endpoints, deploys mock OFT contracts and underlying USDT tokens,
    /// configures enforced options for cross-chain messaging, and deploys AgentLZ and AccountantLZ.
    function setUp() public virtual override {
        // Provide alice with 1000 ether to cover transaction fees during tests.
        vm.deal(alice, 1000 ether);

        // Call the base setUp from TestHelperOz5 to prepare the endpoints and other utilities.
        super.setUp();

        // Initialize 2 mock endpoints using UltraLightNode as the library type.
        setUpEndpoints(2, LibraryType.UltraLightNode);

        // Deploy 2 USDT_OFT instances across endpoints:
        // _deployOApps returns addresses for the two OFTs deployed on different chains.
        {
            address[] memory oaps = setupOApps(type(MockUsdtOFT).creationCode, 1, 2);
            usdtOftEth = MockUsdtOFT(payable(oaps[0]));
            usdtOftTron = MockUsdtOFT(payable(oaps[1]));

            // Deploy underlying USDT tokens for each chain.
            usdtEth = new MockUSDT();
            usdtOftEth.setInnerToken(address(usdtEth));
            usdtTron = new MockUSDT();
            usdtOftTron.setInnerToken(address(usdtTron));

            // Mint USDT tokens for alice on the Tron side.
            usdtTron.mint(alice, aliceUsdtTronBalance);
        }

        // Mint and deposit transferable credits into the Ethereum USDT_OFT.
        {
            usdtEth.mint(address(this), usdtOftTransferableCredits);
            usdtEth.approve(address(usdtOftEth), usdtOftTransferableCredits);
            usdtOftEth.depositLocal(usdtOftTransferableCredits);
            // Set token credits on the Ethereum OFT, linking it to the Tron endpoint.
            usdtOftEth.increaseCredits(usdtOftTron.eid(), usdtOftTransferableCredits);
        }

        // Prepare enforced option parameters for chain A and chain B.
        {
            // Build messaging options with enforced execution parameters (gas limit, etc.).
            bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(
                200000,
                0
            );
            EnforcedOptionParam[] memory paramsA = new EnforcedOptionParam[](3);
            EnforcedOptionParam[] memory paramsB = new EnforcedOptionParam[](3);
            // For chain A (Ethereum USDT_OFT), enforce options for 3 message types towards chain B.
            paramsA[0] = EnforcedOptionParam({eid: bEid, msgType: 1, options: options});
            paramsA[1] = EnforcedOptionParam({eid: bEid, msgType: 2, options: options});
            paramsA[2] = EnforcedOptionParam({eid: bEid, msgType: 3, options: options});
            // Similarly, for chain B (Tron USDT_OFT), enforce options for 3 message types towards chain A.
            paramsB[0] = EnforcedOptionParam({eid: aEid, msgType: 1, options: options});
            paramsB[1] = EnforcedOptionParam({eid: aEid, msgType: 2, options: options});
            paramsB[2] = EnforcedOptionParam({eid: aEid, msgType: 3, options: options});

            // Set the enforced options on both USDT_OFT contracts.
            IOAppOptionsType3(address(usdtOftEth)).setEnforcedOptions(paramsA);
            IOAppOptionsType3(address(usdtOftTron)).setEnforcedOptions(paramsB);
        }

        // Mint and deposit transferable credits on the Tron side.
        {
            usdtTron.mint(address(this), usdtOftTransferableCredits);
            usdtTron.approve(address(usdtOftTron), usdtOftTransferableCredits);
            usdtOftTron.depositLocal(usdtOftTransferableCredits);
            // Link token credits on Tron OFT to the Ethereum endpoint.
            usdtOftTron.increaseCredits(usdtOftEth.eid(), usdtOftTransferableCredits);
        }
        uint256 nonce = vm.getNonce(address(this));
        {
            address[] memory tokens = new address[](1);
            tokens[0] = address(usdtEth);

            IWhitelistedExecutor.WhiteList[]
                memory whiteList = new IWhitelistedExecutor.WhiteList[](1);
            whiteList[0] = IWhitelistedExecutor.WhiteList({
                target: address(usdtEth),
                selector: usdtEth.approve.selector
            });

            address spEthPredict = vm.computeCreateAddress(address(this), nonce + 1);

            // Deploy a Supply Manager instance on Ethereum.
            mpTreasuryEth = new MoleculaPoolTreasuryV2(
                address(this),
                tokens,
                address(this),
                spEthPredict,
                whiteList,
                address(this),
                address(0)
            );
            usdtEth.mint(address(mpTreasuryEth), initialPoolBalance);

            spManagerEth = new SupplyManager(
                address(this),
                address(this),
                address(mpTreasuryEth),
                8000
            );
            assertEq(address(spManagerEth), spEthPredict);
        }

        // Deploy the AgentLZ contract using the helper _deployOApp. The AgentLZ is deployed on Ethereum.
        // Pass parameters including owner, endpoint, supply manager, destination endpoint ID, and token addresses.
        agentLZ = AgentLZ(
            _deployOApp(
                type(AgentLZ).creationCode,
                abi.encode(
                    address(this),
                    address(this),
                    address(endpoints[aEid]),
                    address(spManagerEth),
                    bEid,
                    address(usdtEth),
                    address(usdtOftEth)
                )
            )
        );
        {
            nonce = vm.getNonce(address(this));
            address oraclePredict = vm.computeCreateAddress(address(this), nonce + 1);

            // Deploy the MockAccountantLZ on the Tron side.
            accountantLZ = MockAccountantLZ(
                _deployOApp(
                    type(MockAccountantLZ).creationCode,
                    abi.encode(
                        address(this),
                        address(this),
                        address(endpoints[bEid]),
                        aEid,
                        address(usdtTron),
                        address(usdtOftTron),
                        oraclePredict
                    )
                )
            );

            tronOracle = new MockTronOracle(address(this), address(accountantLZ), address(this));
            assertEq(address(tronOracle), oraclePredict);
        }
        tronRebase = new MockRebaseTokenCommon(
            address(this),
            address(accountantLZ),
            0,
            address(tronOracle)
        );

        // Wire the two OFT-based OApps together so they can simulate cross-chain communications.
        {
            address[] memory ofts = new address[](2);
            ofts[0] = address(agentLZ);
            ofts[1] = address(accountantLZ);
            this.wireOApps(ofts);
        }

        // Configure the AccountantLZ contract:
        // Set its underlying token (for invoking onlyUnderlyingToken functions) and gas limits for specific messages.
        {
            accountantLZ.setUnderlyingToken(address(tronRebase));
            accountantLZ.setGasLimit(0x01, 200000, 0); // e.g., gas limit for request deposit messages.
            accountantLZ.setGasLimit(0x03, 260000, 0); // e.g., gas limit for request redeem messages.

            spManagerEth.setAgent(address(agentLZ), true);
            agentLZ.setGasLimit(0x04, 200000, 0);
            agentLZ.setGasLimit(0x06, 200000, 0);
        }
    }

    /// @notice Tests that the constructors have correctly set up the AgentLZ and AccountantLZ contracts.
    /// It verifies owner addresses, destination endpoint IDs, and USDT/token configurations.
    function test_constructor() public view {
        // Verify that the owners of AgentLZ and AccountantLZ are set correctly.
        assertEq(agentLZ.owner(), address(this));
        assertEq(accountantLZ.owner(), address(this));

        // Verify the destination endpoint IDs.
        assertEq(agentLZ.DST_EID(), 2);
        assertEq(accountantLZ.DST_EID(), 1);

        // Confirm that the USDT tokens and OFT contracts are properly assigned.
        assertEq(address(agentLZ.USDT()), address(usdtEth));
        assertEq(address(accountantLZ.USDT()), address(usdtTron));
        assertEq(address(agentLZ.USDT_OFT()), address(usdtOftEth));
        assertEq(address(accountantLZ.USDT_OFT()), address(usdtOftTron));

        // Additionally, verify the endpoint IDs of the OFT instances and their underlying token assignments.
        assertEq(usdtOftEth.eid(), 1);
        assertEq(usdtOftTron.eid(), 2);
        assertEq(address(usdtOftEth.innerToken()), address(usdtEth));
        assertEq(address(usdtOftTron.innerToken()), address(usdtTron));
    }

    /// @notice Fuzz test for sending a request deposit message from the AccountantLZ.
    /// It simulates a user deposit flow where tokens are transferred cross-chain.
    /// @param amount The deposit amount (must be less than alice's balance on Tron).
    function testFuzz_SendRequestDepositMessage(uint256 amount) public {
        // Constrain the fuzzed amount: it must be > 10**6 and less than alice's USDT balance on Tron.
        vm.assume(amount < aliceUsdtTronBalance);
        vm.assume(amount > 10 ** 6);

        // Simulate alice approving AccountantLZ to spend her tokens.
        vm.startPrank(alice);
        usdtTron.approve(address(accountantLZ), amount);
        vm.stopPrank();

        // Verify that initially, the AgentLZ contract has no USDT balance.
        assertEq(usdtEth.balanceOf(address(agentLZ)), 0);
        // Query the fee for a specific message type (here 0x01 represents, e.g., a deposit request).
        (uint256 fee, , ) = accountantLZ.quote(0x01);
        // Ensure the fee is greater than a minimum threshold.
        assertGt(fee, 200000);

        // Call the requestDeposit function on AccountantLZ with the fee provided.
        vm.startPrank(alice);
        uint256 requestId = tronRebase.requestDeposit{value: fee}(amount, alice, alice);
        vm.stopPrank();

        // Verify that messages (packets) have been correctly sent on the corresponding endpoints.
        verifyPackets(aEid, addressToBytes32(address(usdtOftEth)));
        verifyPackets(aEid, addressToBytes32(address(agentLZ)));

        // Calculate the fee amount applied (assumed as 0.1% fee).
        // Expected deposit value after fee deduction.

        uint256 expectedAmount = amount - ((amount * 10) / 10000);
        {
            // Retrieve the deposit information from the AgentLZ contract.
            (AgentLZ.DepositStatus status, uint256 queryId, uint256 value, uint256 shares) = agentLZ
                .deposits(requestId);

            // Check that the deposit information matches the expected results.
            assertEq(queryId, requestId);
            // Shares are still zero until the deposit is confirmed.
            assertEq(shares, 0);
            // Deposit status is expected to be "ReadyToConfirm" (represented by 1).
            assertEq(uint8(status), 1);
            // The deposited value should be equal to the expected amount after fee deduction.
            assertEq(value, expectedAmount);
            // Verify that the AgentLZ contract's USDT balance now equals the deposited value.
            assertEq(usdtEth.balanceOf(address(agentLZ)), value);
        }
        {
            (fee, , ) = agentLZ.quote(0x06, 0);
            vm.startPrank(alice);
            agentLZ.confirmDeposit{value: fee}(requestId);
            vm.stopPrank();
        }
        {
            // Retrieve the deposit information from the AgentLZ contract.
            (
                AgentLZ.DepositStatus confirmedStatus,
                uint256 reqId,
                uint256 deposited,
                uint256 confirmedShares
            ) = agentLZ.deposits(requestId);

            // Check that the deposit information matches the expected results.
            assertEq(reqId, requestId);
            // Deposit status is expected to be "Executed" (represented by 2).
            assertEq(uint8(confirmedStatus), 2);
            // The deposited value should be equal to the expected amount after fee deduction.
            assertEq(deposited, expectedAmount);
            // Verify that the AgentLZ contract's USDT balance now equals the deposited value.
            assertEq(usdtEth.balanceOf(address(mpTreasuryEth)), initialPoolBalance + deposited);

            // Verify that the USDT balance of the AccountantLZ contract has increased by the deposited value.
            verifyPackets(bEid, addressToBytes32(address(accountantLZ)));
            assertEq(tronRebase.balanceOf(alice), confirmedShares);
        }
        {
            // Retrieve the deposit information from the AgentLZ contract.
            (address user, uint256 assets, OperationStatus opStatus) = tronRebase.depositRequests(
                requestId
            );
            // Check that the deposit information matches the expected results.
            assertEq(user, alice);
            // Deposit status is expected to be "Confirmed" (represented by 2).
            assertEq(uint8(opStatus), 2);
            assertEq(amount, assets);
        }
    }

    function test_transferOwnership2StepAccountant() public {
        accountantLZ.transferOwnership(alice);
        assertEq(accountantLZ.owner(), address(this));
        assertEq(accountantLZ.pendingOwner(), alice);

        vm.startPrank(vm.addr(2));
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, vm.addr(2))
        );
        accountantLZ.acceptOwnership();
        vm.stopPrank();

        vm.startPrank(alice);
        accountantLZ.acceptOwnership();
        vm.stopPrank();
        assertEq(accountantLZ.owner(), alice);
        assertEq(accountantLZ.pendingOwner(), address(0));

        vm.startPrank(alice);
        accountantLZ.transferOwnership(address(this));
        vm.stopPrank();
        assertEq(accountantLZ.owner(), alice);
        assertEq(accountantLZ.pendingOwner(), address(this));
        vm.startPrank(address(this));
        accountantLZ.acceptOwnership();
        vm.stopPrank();
        assertEq(accountantLZ.owner(), address(this));
        assertEq(accountantLZ.pendingOwner(), address(0));
    }

    function test_transferOwnership2StepAgent() public {
        {
            agentLZ.transferOwnership(alice);
            assertEq(agentLZ.owner(), address(this));
            assertEq(agentLZ.pendingOwner(), alice);
        }
        {
            vm.startPrank(vm.addr(2));
            vm.expectRevert(
                abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, vm.addr(2))
            );
            agentLZ.acceptOwnership();
            vm.stopPrank();
        }
        {
            vm.startPrank(alice);
            agentLZ.acceptOwnership();
            vm.stopPrank();
            assertEq(agentLZ.owner(), alice);
            assertEq(agentLZ.pendingOwner(), address(0));
        }
        {
            vm.startPrank(alice);
            agentLZ.transferOwnership(address(this));
            vm.stopPrank();
            assertEq(agentLZ.owner(), alice);
            assertEq(agentLZ.pendingOwner(), address(this));
        }
        {
            vm.startPrank(address(this));
            agentLZ.acceptOwnership();
            vm.stopPrank();
            assertEq(agentLZ.owner(), address(this));
            assertEq(agentLZ.pendingOwner(), address(0));
        }
    }

    function test_revertWhen_OwnableUnauthorizedAccount() public {
        assertEq(accountantLZ.pendingOwner(), address(0));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.startPrank(alice);
        accountantLZ.transferOwnership(alice);
        vm.stopPrank();
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.startPrank(alice);
        agentLZ.transferOwnership(alice);
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.startPrank(alice);
        accountantLZ.acceptOwnership();
        vm.stopPrank();
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.startPrank(alice);
        agentLZ.acceptOwnership();
        vm.stopPrank();
    }
}
