// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

/// @dev Contract for testing MultisigWallet.sol.
contract TestSeqno {
    /// @dev Number updated by calling `inc()`.
    uint256 public seqno;

    /// @dev Increases seqno by the count.
    /// @param count Value to add to seqno.
    function inc(uint256 count) external {
        seqno += count;
    }

    /// @dev Increases seqno by the count.
    /// @param count Value to add to seqno.
    function incAndPay(uint256 count) external payable {
        seqno += count;
    }

    /// @dev Increases seqno by 1.
    function touch() external payable {
        unchecked {
            ++seqno;
        }
    }

    /// @dev Increases seqno by 10 when receiving ether.
    receive() external payable {
        seqno += 10;
    }
}
