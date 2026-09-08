// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPonsFeeEscrow} from "./interfaces/IPonsV2.sol";

/**
 * One per launch. Pons pays the token's creator fees to this contract (it is
 * registered as the creator-fee recipient at launch); anyone can call
 * `collect()` and the balance is split — the creator's share to the creator,
 * the pad's share to the treasury. Nothing else is configurable: both
 * addresses and the split are fixed at deployment.
 */
contract FeeSplitter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant BPS = 10_000;

    address public immutable creator;
    address public immutable treasury;
    IPonsFeeEscrow public immutable escrow;
    /// The pad's share of every collection, in basis points.
    uint16 public immutable padBps;

    event Collected(uint256 toCreator, uint256 toPad);
    event CollectedToken(address indexed token, uint256 toCreator, uint256 toPad);

    error ZeroAddress();
    error BadSplit();
    error TransferFailed();

    constructor(address creator_, address treasury_, IPonsFeeEscrow escrow_, uint16 padBps_) {
        if (creator_ == address(0) || treasury_ == address(0) || address(escrow_) == address(0)) {
            revert ZeroAddress();
        }
        if (padBps_ > BPS) revert BadSplit();
        creator = creator_;
        treasury = treasury_;
        escrow = escrow_;
        padBps = padBps_;
    }

    /// The escrow pays in native ETH.
    receive() external payable {}

    /// Native fees waiting for a collect: still in escrow plus already here.
    function pending() external view returns (uint256) {
        return escrow.balanceOf(address(this)) + address(this).balance;
    }

    /// Pulls native fees from the escrow and splits everything held here.
    function collect() external nonReentrant returns (uint256 toCreator, uint256 toPad) {
        if (escrow.balanceOf(address(this)) > 0) {
            escrow.claim();
        }
        uint256 total = address(this).balance;
        if (total == 0) return (0, 0);
        toPad = (total * padBps) / BPS;
        toCreator = total - toPad;
        _pay(creator, toCreator);
        _pay(treasury, toPad);
        emit Collected(toCreator, toPad);
    }

    /// Same, for a launch paired with an ERC-20 instead of ETH.
    function collectToken(IERC20 token)
        external
        nonReentrant
        returns (uint256 toCreator, uint256 toPad)
    {
        if (escrow.balanceOfToken(address(token), address(this)) > 0) {
            escrow.claimToken(address(token));
        }
        uint256 total = token.balanceOf(address(this));
        if (total == 0) return (0, 0);
        toPad = (total * padBps) / BPS;
        toCreator = total - toPad;
        if (toCreator > 0) token.safeTransfer(creator, toCreator);
        if (toPad > 0) token.safeTransfer(treasury, toPad);
        emit CollectedToken(address(token), toCreator, toPad);
    }

    function _pay(address to, uint256 amount) private {
        if (amount == 0) return;
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
