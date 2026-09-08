// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPonsFactoryV2, IPonsLaunchForwarder, IPonsFeeEscrow} from "./interfaces/IPonsV2.sol";
import {FeeSplitter} from "./FeeSplitter.sol";

/**
 * Peach Pad — launch middleware for Pons V2.
 *
 * `launch()` deploys a FeeSplitter for the creator, launches the token on
 * Pons with that splitter registered as the creator-fee recipient, and
 * optionally buys the developer allocation for the creator in the same
 * transaction (through Pons' own launch-and-buy forwarder, so the creator
 * is exempt from the snipe tax). From then on Pons pays creator fees into
 * the escrow for the splitter, and `collectFees(token)` — callable by
 * anyone — pushes them out 90% to the creator, 10% to the pad treasury.
 *
 * The router itself never holds fees. It holds no tokens either: the
 * developer buy is delivered straight to the creator by the curve.
 */
contract PeachRouter is Ownable2Step, ReentrancyGuard {
    uint16 public constant BPS = 10_000;
    /// The pad's share of creator fees: 10%.
    uint16 public constant PAD_BPS = 1_000;
    /// Pons launch config used for every launch (the only one deployed today).
    uint256 public constant LAUNCH_CONFIG_ID = 0;
    /// Launches are paired with native ETH.
    address public constant NATIVE_PAIR = address(0);

    IPonsFactoryV2 public immutable ponsFactory;
    IPonsLaunchForwarder public immutable ponsForwarder;
    IPonsFeeEscrow public immutable feeEscrow;

    address public treasury;
    /// Charged on top of the Pons launch fee. Zero by default — same as the pad
    /// we are modelled on: the 10% of creator fees is the business.
    uint256 public padLaunchFee;
    bool public paused;

    struct LaunchParams {
        string name;
        string symbol;
        /// ipfs:// or https:// — stored here so the site can show it without
        /// an indexer.
        string logo;
        string description;
        string x;
        string telegram;
        string website;
        uint16 creatorTaxBps;
        /// CREATE2 salt for the token address. Any value; use a fresh one.
        bytes32 salt;
        /// Wei to spend on tokens for the creator in the same transaction.
        uint256 developerBuy;
        /// Slippage floor for that buy (0 accepts any fill).
        uint256 minTokensOut;
    }

    struct LaunchInfo {
        address token;
        address curve;
        address creator;
        address splitter;
        uint16 creatorTaxBps;
        uint256 developerBuy;
        uint64 launchedAt;
        uint64 launchBlock;
        string name;
        string symbol;
        string logo;
        string description;
    }

    address[] private _launches;
    mapping(address token => LaunchInfo) private _info;
    mapping(address creator => address[] tokens) private _byCreator;

    event Launched(
        address indexed token,
        address indexed curve,
        address indexed creator,
        address splitter,
        uint16 creatorTaxBps,
        uint256 developerBuy
    );
    event FeesCollected(address indexed token, uint256 toCreator, uint256 toPad);
    event TreasuryUpdated(address indexed treasury);
    event PadLaunchFeeUpdated(uint256 fee);
    event PausedUpdated(bool paused);

    error ZeroAddress();
    error Paused();
    error LaunchClosed();
    error WrongValue(uint256 expected, uint256 sent);
    error EmptyName();
    error EmptySymbol();
    error TaxTooHigh(uint256 max);
    error UnknownToken();
    error TransferFailed();

    constructor(IPonsFactoryV2 factory_, address treasury_, address owner_)
        Ownable(owner_)
    {
        if (address(factory_) == address(0) || treasury_ == address(0)) revert ZeroAddress();
        ponsFactory = factory_;
        feeEscrow = IPonsFeeEscrow(factory_.feeEscrow());
        ponsForwarder = IPonsLaunchForwarder(factory_.launchForwarder());
        if (address(feeEscrow) == address(0) || address(ponsForwarder) == address(0)) {
            revert ZeroAddress();
        }
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    // ───────────────────────────────────────────── launch ──

    /**
     * Launch on Pons through the pad. Send exactly
     * `totalLaunchFee() + params.developerBuy` wei.
     */
    function launch(LaunchParams calldata params)
        external
        payable
        nonReentrant
        returns (address token, address curve, address splitter)
    {
        if (paused) revert Paused();
        if (!canLaunchHere()) revert LaunchClosed();
        if (bytes(params.name).length == 0) revert EmptyName();
        if (bytes(params.symbol).length == 0) revert EmptySymbol();
        uint256 maxTax = ponsFactory.maxCreatorTaxBps();
        if (params.creatorTaxBps > maxTax) revert TaxTooHigh(maxTax);

        uint256 ponsFee = ponsFactory.launchFee();
        uint256 expected = ponsFee + padLaunchFee + params.developerBuy;
        if (msg.value != expected) revert WrongValue(expected, msg.value);

        splitter = address(new FeeSplitter(msg.sender, treasury, feeEscrow, PAD_BPS));

        // The factory exempts the deployer (this router) and the fee
        // recipient from the snipe tax itself; the creator is added here.
        address[] memory exempt = new address[](1);
        exempt[0] = msg.sender;

        IPonsFactoryV2.LaunchParams memory ponsParams = IPonsFactoryV2.LaunchParams({
            name: params.name,
            symbol: params.symbol,
            logo: params.logo,
            description: params.description,
            socials: IPonsFactoryV2.Socials({
                x: params.x,
                telegram: params.telegram,
                website: params.website,
                discord: "",
                extra: ""
            }),
            creatorFeeRecipient: splitter,
            creatorTaxBps: params.creatorTaxBps,
            buybackEnabled: true,
            economicsHash: ponsFactory.previewLaunchEconomics(LAUNCH_CONFIG_ID, NATIVE_PAIR),
            salt: params.salt
        });

        if (params.developerBuy > 0) {
            (token, curve) = ponsForwarder.launchAndBuy{value: ponsFee + params.developerBuy}(
                ponsParams,
                LAUNCH_CONFIG_ID,
                NATIVE_PAIR,
                params.developerBuy,
                params.minTokensOut,
                msg.sender,
                exempt
            );
        } else {
            (token, curve) = ponsFactory.launchToken{value: ponsFee}(
                ponsParams,
                LAUNCH_CONFIG_ID,
                NATIVE_PAIR,
                exempt
            );
        }

        _launches.push(token);
        _byCreator[msg.sender].push(token);
        _info[token] = LaunchInfo({
            token: token,
            curve: curve,
            creator: msg.sender,
            splitter: splitter,
            creatorTaxBps: params.creatorTaxBps,
            developerBuy: params.developerBuy,
            launchedAt: uint64(block.timestamp),
            launchBlock: uint64(block.number),
            name: params.name,
            symbol: params.symbol,
            logo: params.logo,
            description: params.description
        });

        if (padLaunchFee > 0) {
            (bool ok, ) = treasury.call{value: padLaunchFee}("");
            if (!ok) revert TransferFailed();
        }

        emit Launched(token, curve, msg.sender, splitter, params.creatorTaxBps, params.developerBuy);
    }

    // ───────────────────────────────────────────── fees ──

    /// Anyone can trigger; pays the creator and the treasury.
    function collectFees(address token)
        external
        nonReentrant
        returns (uint256 toCreator, uint256 toPad)
    {
        address splitter = _info[token].splitter;
        if (splitter == address(0)) revert UnknownToken();
        (toCreator, toPad) = FeeSplitter(payable(splitter)).collect();
        emit FeesCollected(token, toCreator, toPad);
    }

    /// Native fees waiting to be collected for a launch.
    function pendingFees(address token) external view returns (uint256) {
        address splitter = _info[token].splitter;
        if (splitter == address(0)) revert UnknownToken();
        return FeeSplitter(payable(splitter)).pending();
    }

    // ───────────────────────────────────────────── views ──

    /// Pons will accept a launch from this router right now.
    function canLaunchHere() public view returns (bool) {
        return ponsFactory.launchEnabled() && ponsFactory.canLaunch(address(this));
    }

    /// Pons' own launch fee, read live.
    function ponsLaunchFee() public view returns (uint256) {
        return ponsFactory.launchFee();
    }

    /// What `launch()` must be sent, before the developer buy.
    function totalLaunchFee() external view returns (uint256) {
        return ponsLaunchFee() + padLaunchFee;
    }

    function launchCount() external view returns (uint256) {
        return _launches.length;
    }

    function launchAt(uint256 index) external view returns (address) {
        return _launches[index];
    }

    /// Newest first. `offset` counts from the newest launch.
    function launches(uint256 offset, uint256 limit)
        external
        view
        returns (LaunchInfo[] memory page)
    {
        uint256 n = _launches.length;
        if (offset >= n) return page;
        uint256 count = n - offset;
        if (count > limit) count = limit;
        page = new LaunchInfo[](count);
        for (uint256 i = 0; i < count; i++) {
            page[i] = _info[_launches[n - 1 - offset - i]];
        }
    }

    function launchesOf(address creator) external view returns (address[] memory) {
        return _byCreator[creator];
    }

    function infoOf(address token) external view returns (LaunchInfo memory info) {
        info = _info[token];
        if (info.token == address(0)) revert UnknownToken();
    }

    function splitterOf(address token) external view returns (address) {
        return _info[token].splitter;
    }

    function creatorOf(address token) external view returns (address) {
        return _info[token].creator;
    }

    function curveOf(address token) external view returns (address) {
        return _info[token].curve;
    }

    // ───────────────────────────────────────────── admin ──

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setPadLaunchFee(uint256 fee) external onlyOwner {
        padLaunchFee = fee;
        emit PadLaunchFeeUpdated(fee);
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PausedUpdated(paused_);
    }

    /// ETH that ended up here by mistake goes to the treasury. The router is
    /// never meant to hold a balance.
    function sweep() external onlyOwner {
        uint256 amount = address(this).balance;
        if (amount == 0) return;
        (bool ok, ) = treasury.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /// Refunds from the curve or factory land here.
    receive() external payable {}
}
