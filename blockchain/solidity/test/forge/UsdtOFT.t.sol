// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.22;

// Import dependencies for packets, options builder, messaging fee structures, and messaging receipts.
import {Packet} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ISendLib.sol";
import {OptionsBuilder} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import {MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import {SendParam, OFTReceipt} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";

// Import mocks for USDT_OFT and USDT contracts.
import {MockUsdtOFT} from "../../contracts/mock/USDT/MockUsdtOFT.sol";
import {MockUSDT} from "../../contracts/mock/USDT/MockUsdt.sol";

// Import the test helper that contains basic setup functions for Foundry tests.
import {TestHelperOz5} from "@layerzerolabs/test-devtools-evm-foundry/contracts/TestHelperOz5.sol";

/// @dev This contract inherits from TestHelperOz5 to leverage its endpoint and OApp setup utilities.
contract UsdtOFTTest is TestHelperOz5 {
    using OptionsBuilder for bytes; // Enables fluent usage of the OptionsBuilder library on bytes data.

    // Instances of the two mock USDT_OFT contracts (simulating two different chains/endpoints).
    MockUsdtOFT public usdtOFTA;
    MockUsdtOFT public usdtOFTB;

    // Instances of the underlying USDT tokens for each chain.
    MockUSDT public usdtA;
    MockUSDT public usdtB;

    // Test user address.
    address alice = vm.addr(1);

    // Endpoint IDs for our mock endpoints.
    uint16 constant aEid = 1;
    uint16 constant bEid = 2;

    // Define initial transferable credits for the USDT_OFT contract and the initial USDT balance for Alice.
    uint256 constant usdtOftTransferableCredits = 1000000 * 10 ** 6;
    uint256 constant aliceUsdtABalance = 10000 * 10 ** 6;

    function setUpOFTs() internal {
        // This function is intentionally left empty as the setup is done in the setUp function.
        // It is here to satisfy the inheritance structure of TestHelperOz5.
        // Deploy two USDT_OFT contracts (one for each endpoint) using the provided creation code.
        // The setupOApps function deploys the contracts and returns an array of their addresses.
        {
            address[] memory oaps = setupOApps(type(MockUsdtOFT).creationCode, 1, 2);

            // Initialize the two USDT_OFT contracts from the deployed addresses.
            usdtOFTA = MockUsdtOFT(payable(oaps[0]));
            usdtOFTB = MockUsdtOFT(payable(oaps[1]));
        }

        // Deploy two separate USDT token mocks for chain A and chain B.
        {
            usdtA = new MockUSDT();
            usdtOFTA.setInnerToken(address(usdtA)); // Set the inner token (USDT) for the first OFT.
            usdtB = new MockUSDT();
            usdtOFTB.setInnerToken(address(usdtB)); // Set the inner token (USDT) for the second OFT.
        }

        // Mint USDT tokens for alice on chain A.
        usdtA.mint(alice, aliceUsdtABalance);

        // Mint USDT tokens for this test contract and deposit them as transferable credits for usdtOFTA.
        {
            usdtA.mint(address(this), usdtOftTransferableCredits);
            usdtA.approve(address(usdtOFTA), usdtOftTransferableCredits);
            usdtOFTA.depositLocal(usdtOftTransferableCredits);
            // Link transferable credits on chain A to chain B by setting token credits.
            usdtOFTA.increaseCredits(usdtOFTB.eid(), usdtOftTransferableCredits);
        }

        // Perform similar operations for chain B: minting, approving and depositing credits into usdtOFTB.
        {
            usdtB.mint(address(this), usdtOftTransferableCredits);
            usdtB.approve(address(usdtOFTB), usdtOftTransferableCredits);
            usdtOFTB.depositLocal(usdtOftTransferableCredits);
            // Link transferable credits on chain B to chain A.
            usdtOFTB.increaseCredits(usdtOFTA.eid(), usdtOftTransferableCredits);
        }
    }

    /**
     * @notice The setUp function initializes the test environment.
     * It sets up endpoints, deploys and configures mock contracts, mints tokens, and deposits credits.
     */
    function setUp() public virtual override {
        // Allocate an initial balance of 1000 ether to alice for testing purposes.
        vm.deal(alice, 1000 ether);

        // Call parent setup (from TestHelperOz5) to prepare the testing environment.
        super.setUp();

        // Setup two mock endpoints using the provided UltraLightNode library implementation.
        setUpEndpoints(2, LibraryType.UltraLightNode);

        // Call the function to set up the USDT_OFT contracts and their inner tokens.
        setUpOFTs();
    }

    /**
     * @notice Tests the constructor setup for USDT_OFT contracts.
     * Checks that the owner, endpoint ID (eid), and inner token addresses are correctly set.
     */
    function test_constructor() public view {
        // Verify that the deployer of the mock OFT is set as the owner.
        assertEq(usdtOFTA.owner(), address(this));
        assertEq(usdtOFTB.owner(), address(this));

        // Check that the endpoint IDs are correctly assigned.
        assertEq(usdtOFTA.eid(), 1);
        assertEq(usdtOFTB.eid(), 2);

        // Confirm that the inner token addresses are correctly linked to the respective USDT mocks.
        assertEq(address(usdtOFTA.innerToken()), address(usdtA));
        assertEq(address(usdtOFTB.innerToken()), address(usdtB));
    }

    /**
     * @notice Test quoting fees for a send message using the USDT_OFT.
     * It builds send options and parameters, queries for the messaging fee,
     * and asserts that the returned fees match the expected conditions.
     */
    function test_QuoteSendMessage() public view {
        // Create additional options for the send operation, e.g., a specific executor gas allocation.
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(200000, 0);

        // Build a mock SendParam struct for fee estimation.
        SendParam memory sendParam = SendParam({
            dstEid: bEid, // Destination endpoint.
            to: bytes32(uint256(uint160(address(alice)))), // Convert alice's address into a bytes32 format.
            amountLD: 10e6, // Define amount for estimation (e.g., 10 USDT with 6 decimals).
            minAmountLD: 0, // Set a minimal acceptable amount.
            extraOptions: options, // Include the previously built options.
            composeMsg: "", // No composed message needed.
            oftCmd: "" // No special OFT command needed.
        });

        // Query the fee for sending using our mock USDT_OFT.
        MessagingFee memory fee = usdtOFTA.quoteSend(sendParam, false);

        // Assert that the native fee exceeds a defined value (200000 in this case) and that lzTokenFee is zero.
        assertGt(fee.nativeFee, 200000);
        assertEq(fee.lzTokenFee, 0);
    }

    /**
     * @notice Fuzz test for quoting OFT messages.
     * It uses variable amounts (constrained by vm.assume) to verify that the fee is applied properly
     * and that the expected amount received is as calculated.
     *
     * @param amount The fuzzed transfer amount for testing.
     */
    function testFuzz_QuoteOftMessage(uint256 amount) public view {
        // Limit the amount to avoid overflow and to be within realistic bounds.
        vm.assume(amount < 10000000000 * 10 ** 6);

        // Create options for the send operation with a specific executor gas requirement.
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(200000, 0);

        // Create a SendParam object with the fuzzed amount.
        SendParam memory sendParam = SendParam({
            dstEid: bEid,
            to: bytes32(uint256(uint160(address(alice)))),
            amountLD: amount,
            minAmountLD: 0,
            extraOptions: options,
            composeMsg: "",
            oftCmd: ""
        });

        // Quote OFT fees and receipt using the provided parameters.
        (, , OFTReceipt memory oftReceipt) = usdtOFTA.quoteOFT(sendParam);

        // Calculate the fee based on a 0.1% rate (10/10000) and the expected amount after fee deduction.
        uint256 expectedAmount = amount - ((amount * 10) / 10000);
        // Verify that the expected amount matches the amount received as per the OFT receipt.
        assertEq(expectedAmount, oftReceipt.amountReceivedLD);
    }

    /**
     * @notice Fuzz test for sending a message via the USDT_OFT.
     * It performs the full send flow from approving tokens to sending and then verifying the received amount.
     *
     * @param amount The fuzzed transfer amount for the send operation.
     */
    function testFuzz_SendMessage(uint256 amount) public {
        // Ensure the amount to send is within alice's USDT balance and is positive.
        vm.assume(amount < aliceUsdtABalance);
        vm.assume(amount > 0);
        // Calculate the fee and expected received amount.
        uint256 expectedAmount = amount - ((amount * 10) / 10000);

        // Build options for the send operation.
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(200000, 0);

        // Setup the SendParam structure for the send operation.
        SendParam memory sendParam = SendParam({
            dstEid: bEid,
            to: bytes32(uint256(uint160(address(alice)))),
            amountLD: amount,
            minAmountLD: expectedAmount, // Minimum acceptable received amount.
            extraOptions: options,
            composeMsg: "",
            oftCmd: ""
        });

        // Get the OFT receipt for the given SendParam.
        (, , OFTReceipt memory oftReceipt) = usdtOFTA.quoteOFT(sendParam);
        // Query the messaging fee for the send operation.
        MessagingFee memory fee = usdtOFTA.quoteSend(sendParam, false);

        // Impersonate alice to send tokens.
        vm.startPrank(alice);
        usdtA.approve(address(usdtOFTA), amount);

        {
            // Capture the initial credits available in the USDT_OFT contracts for verification.
            uint256 usdtOftACreditsBefore = usdtOFTA.credits(bEid);
            uint256 usdtOftALocalCreditsBefore = usdtOFTA.credits(aEid);

            // Assert initial balances: alice should have USDT on chain A and none on chain B.
            assertEq(usdtB.balanceOf(alice), 0);
            assertEq(usdtA.balanceOf(alice), aliceUsdtABalance);

            // Execute the send operation; using fee.nativeFee as the value to satisfy fee requirements.
            usdtOFTA.send{value: fee.nativeFee}(sendParam, fee, address(alice));
            // Verify that a packet has been sent to the destination endpoint (chain B).
            verifyPackets(bEid, addressToBytes32(address(usdtOFTB)));

            // Assert that after the send, alice's USDT balance on chain B reflects the expected transferred amount.
            assertEq(usdtB.balanceOf(alice), oftReceipt.amountReceivedLD);
            // Also check that alice's balance on chain A decreased by the sent amount.
            assertEq(usdtA.balanceOf(alice), aliceUsdtABalance - amount);
            // Confirm the fee deduction calculation.
            assertEq(expectedAmount, oftReceipt.amountReceivedLD);

            // Verify that the credits for the USDT_OFT contract on both the local and destination endpoints are updated.
            assertEq(usdtOFTA.credits(aEid), usdtOftALocalCreditsBefore + expectedAmount);
            assertEq(usdtOFTA.credits(bEid), usdtOftACreditsBefore - expectedAmount);
        }
    }
}
