// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPonsFactoryV2, IPonsLaunchForwarder, IPonsCurve, IPonsFeeEscrow} from "../interfaces/IPonsV2.sol";

/**
 * Just enough Pons to test the router: a factory that mints a token and a
 * curve, a forwarder that launches then buys, a curve that sells tokens at
 * a flat price and credits a 1% fee to the escrow for the creator-fee
 * recipient, and an escrow that pays on claim. Numbers are simple on
 * purpose; the real curve is exercised on a fork (scripts/fork-check.ts).
 */
contract MockLaunchedToken is ERC20 {
    constructor(string memory name_, string memory symbol_, address to, uint256 supply)
        ERC20(name_, symbol_)
    {
        _mint(to, supply);
    }
}

contract MockFeeEscrow is IPonsFeeEscrow {
    using SafeERC20 for IERC20;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) private _tokenBalances;

    function credit(address account) external payable {
        balanceOf[account] += msg.value;
    }

    function creditToken(address token, address account, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        _tokenBalances[token][account] += amount;
    }

    function balanceOfToken(address token, address account) external view override returns (uint256) {
        return _tokenBalances[token][account];
    }

    function claim() external override {
        uint256 amount = balanceOf[msg.sender];
        balanceOf[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "escrow: pay failed");
    }

    function claimToken(address token) external override {
        uint256 amount = _tokenBalances[token][msg.sender];
        _tokenBalances[token][msg.sender] = 0;
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}

contract MockCurve is IPonsCurve {
    uint256 public constant FEE_BPS = 100;

    address public immutable override token;
    MockFeeEscrow public immutable escrow;
    address public feeRecipient;
    uint256 public immutable override launchSupply;
    uint256 public immutable override graduationThreshold;
    /// Wei per whole token (1e18 units), flat.
    uint256 public immutable pricePerToken;

    uint256 public override realQuoteReserve;
    bool public override graduated;
    mapping(address => bool) public snipeTaxExempt;
    uint256 public lastQuoteAmount;

    constructor(
        address token_,
        MockFeeEscrow escrow_,
        address feeRecipient_,
        uint256 launchSupply_,
        uint256 graduationThreshold_,
        uint256 pricePerToken_
    ) {
        token = token_;
        escrow = escrow_;
        feeRecipient = feeRecipient_;
        launchSupply = launchSupply_;
        graduationThreshold = graduationThreshold_;
        pricePerToken = pricePerToken_;
    }

    function exemptFromSnipeTax(address who) external {
        snipeTaxExempt[who] = true;
    }

    function getReserves() external view override returns (uint256 quote, uint256 tokens) {
        return (realQuoteReserve + 1 ether, IERC20(token).balanceOf(address(this)));
    }

    function buy(uint256 quoteAmount, uint256 minTokensOut, address recipient)
        external
        payable
        override
        returns (uint256 tokensOut)
    {
        require(quoteAmount == msg.value, "curve: value mismatch");
        lastQuoteAmount = quoteAmount;
        uint256 fee = (msg.value * FEE_BPS) / 10_000;
        uint256 spend = msg.value - fee;
        tokensOut = (spend * 1e18) / pricePerToken;
        require(tokensOut >= minTokensOut, "curve: slippage");
        realQuoteReserve += spend;
        escrow.credit{value: fee}(feeRecipient);
        IERC20(token).transfer(recipient, tokensOut);
        if (realQuoteReserve >= graduationThreshold) graduated = true;
    }
}

contract MockPonsFactory is IPonsFactoryV2 {
    uint256 public override launchFee = 0.0005 ether;
    bool public override launchEnabled = true;
    uint256 public override maxCreatorTaxBps = 1000;
    MockFeeEscrow public immutable escrowContract;
    address public override launchForwarder;
    address public feeSink;
    mapping(address => bool) public blocked;
    uint256 public launches;

    LaunchParams public lastParams;
    uint256 public lastConfigId;
    address public lastPairToken;
    address public lastLauncher;
    address[] public lastExempt;

    constructor(address feeSink_) {
        escrowContract = new MockFeeEscrow();
        feeSink = feeSink_;
        launchForwarder = address(new MockLaunchForwarder(this));
    }

    function feeEscrow() external view override returns (address) {
        return address(escrowContract);
    }

    function setLaunchEnabled(bool v) external {
        launchEnabled = v;
    }

    function setLaunchFee(uint256 v) external {
        launchFee = v;
    }

    function setBlocked(address who, bool v) external {
        blocked[who] = v;
    }

    function canLaunch(address launcher) external view override returns (bool) {
        return !blocked[launcher];
    }

    function previewLaunchEconomics(uint256 launchConfigId, address pairToken)
        public
        pure
        override
        returns (bytes32)
    {
        return keccak256(abi.encode("econ", launchConfigId, pairToken));
    }

    function lastExemptList() external view returns (address[] memory) {
        return lastExempt;
    }

    function launchToken(
        LaunchParams calldata params,
        uint256 launchConfigId,
        address pairToken,
        address[] calldata snipeTaxExempt
    ) external payable override returns (address token, address curve) {
        require(launchEnabled, "factory: disabled");
        require(!blocked[msg.sender], "factory: launcher blocked");
        require(msg.value == launchFee, "factory: bad fee");
        require(pairToken == address(0), "factory: pair not approved");
        require(
            params.economicsHash == previewLaunchEconomics(launchConfigId, pairToken),
            "factory: stale economics"
        );
        require(params.creatorTaxBps <= maxCreatorTaxBps, "factory: tax");
        require(params.creatorFeeRecipient != address(0), "factory: recipient");

        uint256 supply = 1_000_000_000 ether;
        MockLaunchedToken t = new MockLaunchedToken{salt: params.salt}(
            params.name,
            params.symbol,
            address(this),
            supply
        );
        MockCurve c = new MockCurve(
            address(t),
            escrowContract,
            params.creatorFeeRecipient,
            supply,
            4.2 ether,
            1e9 // 1e-9 ETH per token
        );
        t.transfer(address(c), supply);
        c.exemptFromSnipeTax(msg.sender);
        c.exemptFromSnipeTax(params.creatorFeeRecipient);
        for (uint256 i = 0; i < snipeTaxExempt.length; i++) c.exemptFromSnipeTax(snipeTaxExempt[i]);

        lastParams = params;
        lastConfigId = launchConfigId;
        lastPairToken = pairToken;
        lastLauncher = msg.sender;
        delete lastExempt;
        for (uint256 i = 0; i < snipeTaxExempt.length; i++) lastExempt.push(snipeTaxExempt[i]);
        launches++;

        (bool ok, ) = feeSink.call{value: msg.value}("");
        require(ok, "factory: sink");
        return (address(t), address(c));
    }
}

contract MockLaunchForwarder is IPonsLaunchForwarder {
    MockPonsFactory public immutable factory;
    address public lastBuyRecipient;

    error ZeroAmount();
    error NotApprovedLauncher();

    constructor(MockPonsFactory factory_) {
        factory = factory_;
    }

    function launchAndBuy(
        IPonsFactoryV2.LaunchParams calldata params,
        uint256 launchConfigId,
        address pairToken,
        uint256 buyAmount,
        uint256 minTokensOut,
        address buyRecipient,
        address[] calldata snipeTaxExempt
    ) external payable override returns (address token, address curve) {
        if (buyAmount == 0) revert ZeroAmount();
        if (!factory.canLaunch(msg.sender)) revert NotApprovedLauncher();
        uint256 fee = factory.launchFee();
        require(msg.value == fee + buyAmount, "forwarder: value");
        (token, curve) = factory.launchToken{value: fee}(params, launchConfigId, pairToken, snipeTaxExempt);
        MockCurve(curve).exemptFromSnipeTax(buyRecipient);
        MockCurve(curve).buy{value: buyAmount}(buyAmount, minTokensOut, buyRecipient);
        lastBuyRecipient = buyRecipient;
    }
}

/// A treasury that refuses ETH, to test the failure path.
contract RejectingReceiver {
    receive() external payable {
        revert("no thanks");
    }
}
