import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const PONS_FEE = ethers.parseEther("0.0005");

function params(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Apricot",
    symbol: "APRICOT",
    logo: "ipfs://bafkreiapricot",
    description: "A stone fruit.",
    x: "https://x.com/apricot",
    telegram: "",
    website: "https://apricot.fun",
    creatorTaxBps: 0,
    salt: ethers.hexlify(ethers.randomBytes(32)),
    developerBuy: 0n,
    minTokensOut: 0n,
    ...overrides,
  };
}

/**
 * Router in front of the mock Pons: factory + escrow + one curve per launch.
 *
 *   deployer  owns the router
 *   treasury  receives the pad's 10%
 *   creator   launches
 *   trader    buys on the curve (fees accrue)
 *   anyone    triggers collection
 */
async function deployFixture() {
  const [deployer, treasury, creator, trader, anyone, ponsSink] = await ethers.getSigners();
  const factory = await (await ethers.getContractFactory("MockPonsFactory")).deploy(ponsSink.address);
  const factoryAddress = await factory.getAddress();
  const router = await (await ethers.getContractFactory("PeachRouter")).deploy(factoryAddress, treasury.address, deployer.address);
  const routerAddress = await router.getAddress();
  const escrow = await ethers.getContractAt("MockFeeEscrow", await factory.feeEscrow());
  return { deployer, treasury, creator, trader, anyone, ponsSink, factory, router, routerAddress, escrow };
}

async function launchOne(fx: Awaited<ReturnType<typeof deployFixture>>, overrides: Partial<Record<string, unknown>> = {}) {
  const p = params(overrides);
  const devBuy = p.developerBuy as bigint;
  const tx = await fx.router.connect(fx.creator).launch(p, { value: PONS_FEE + devBuy });
  const receipt = await tx.wait();
  const parsed = receipt!.logs
    .map((l) => {
      try {
        return fx.router.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((e) => e?.name === "Launched")!;
  const [token, curve, , splitter] = parsed.args;
  return { token: token as string, curve: curve as string, splitter: splitter as string, p };
}

describe("PeachRouter", () => {
  describe("constructor", () => {
    it("wires the factory, forwarder, escrow, treasury and owner", async () => {
      const { router, factory, treasury, deployer } = await loadFixture(deployFixture);
      expect(await router.ponsFactory()).to.equal(await factory.getAddress());
      expect(await router.ponsForwarder()).to.equal(await factory.launchForwarder());
      expect(await router.feeEscrow()).to.equal(await factory.feeEscrow());
      expect(await router.treasury()).to.equal(treasury.address);
      expect(await router.owner()).to.equal(deployer.address);
      expect(await router.PAD_BPS()).to.equal(1000);
      expect(await router.padLaunchFee()).to.equal(0);
    });

    it("rejects zero addresses", async () => {
      const { factory, treasury, deployer } = await loadFixture(deployFixture);
      const Router = await ethers.getContractFactory("PeachRouter");
      await expect(Router.deploy(ethers.ZeroAddress, treasury.address, deployer.address)).to.be.revertedWithCustomError(Router, "ZeroAddress");
      await expect(Router.deploy(await factory.getAddress(), ethers.ZeroAddress, deployer.address)).to.be.revertedWithCustomError(Router, "ZeroAddress");
    });
  });

  describe("launch", () => {
    it("launches on Pons with a fresh splitter as the fee recipient", async () => {
      const fx = await loadFixture(deployFixture);
      const { token, curve, splitter, p } = await launchOne(fx);

      expect(await fx.factory.launches()).to.equal(1);
      expect(await fx.factory.lastLauncher()).to.equal(fx.routerAddress);
      expect(await fx.factory.lastPairToken()).to.equal(ethers.ZeroAddress);
      expect(await fx.factory.lastConfigId()).to.equal(0);
      expect(await fx.factory.lastExemptList()).to.deep.equal([fx.creator.address]);

      const last = await fx.factory.lastParams();
      expect(last.name).to.equal(p.name);
      expect(last.symbol).to.equal(p.symbol);
      expect(last.logo).to.equal(p.logo);
      expect(last.creatorFeeRecipient).to.equal(splitter);
      expect(last.buybackEnabled).to.equal(true);
      expect(last.economicsHash).to.equal(await fx.factory.previewLaunchEconomics(0, ethers.ZeroAddress));
      expect(last.salt).to.equal(p.salt);

      const s = await ethers.getContractAt("FeeSplitter", splitter);
      expect(await s.creator()).to.equal(fx.creator.address);
      expect(await s.treasury()).to.equal(fx.treasury.address);
      expect(await s.padBps()).to.equal(1000);
      expect(await s.escrow()).to.equal(await fx.factory.feeEscrow());

      const c = await ethers.getContractAt("MockCurve", curve);
      expect(await c.token()).to.equal(token);
      expect(await c.feeRecipient()).to.equal(splitter);
      expect(await c.snipeTaxExempt(fx.routerAddress)).to.equal(true);
      expect(await c.snipeTaxExempt(splitter)).to.equal(true);
      expect(await c.snipeTaxExempt(fx.creator.address)).to.equal(true);
    });

    it("records the launch for the views", async () => {
      const fx = await loadFixture(deployFixture);
      const a = await launchOne(fx, { name: "A", symbol: "AAA" });
      const b = await launchOne(fx, { name: "B", symbol: "BBB" });

      expect(await fx.router.launchCount()).to.equal(2);
      expect(await fx.router.launchAt(0)).to.equal(a.token);
      expect(await fx.router.launchAt(1)).to.equal(b.token);
      expect(await fx.router.launchesOf(fx.creator.address)).to.deep.equal([a.token, b.token]);
      expect(await fx.router.splitterOf(a.token)).to.equal(a.splitter);
      expect(await fx.router.creatorOf(a.token)).to.equal(fx.creator.address);
      expect(await fx.router.curveOf(a.token)).to.equal(a.curve);

      const info = await fx.router.infoOf(b.token);
      expect(info.name).to.equal("B");
      expect(info.symbol).to.equal("BBB");
      expect(info.logo).to.equal(b.p.logo);
      expect(info.description).to.equal(b.p.description);
      expect(info.launchBlock).to.be.gt(0);

      // Newest first, paginated.
      const page = await fx.router.launches(0, 10);
      expect(page.map((l) => l.token)).to.deep.equal([b.token, a.token]);
      const second = await fx.router.launches(1, 10);
      expect(second.map((l) => l.token)).to.deep.equal([a.token]);
      expect((await fx.router.launches(2, 10)).length).to.equal(0);
      expect((await fx.router.launches(0, 1)).map((l) => l.token)).to.deep.equal([b.token]);

      await expect(fx.router.infoOf(fx.trader.address)).to.be.revertedWithCustomError(fx.router, "UnknownToken");
    });

    it("forwards exactly the Pons fee and keeps nothing", async () => {
      const fx = await loadFixture(deployFixture);
      const before = await ethers.provider.getBalance(fx.ponsSink.address);
      await launchOne(fx);
      expect((await ethers.provider.getBalance(fx.ponsSink.address)) - before).to.equal(PONS_FEE);
      expect(await ethers.provider.getBalance(fx.routerAddress)).to.equal(0);
    });

    it("buys the developer allocation for the creator through the Pons forwarder", async () => {
      const fx = await loadFixture(deployFixture);
      const devBuy = ethers.parseEther("0.1");
      const { token, curve, splitter } = await launchOne(fx, { developerBuy: devBuy });
      const erc20 = await ethers.getContractAt("MockLaunchedToken", token);
      // MockCurve: 1% fee, 1e-9 ETH per token → 0.099 ETH buys 99,000,000 tokens.
      expect(await erc20.balanceOf(fx.creator.address)).to.equal(ethers.parseEther("99000000"));
      expect(await erc20.balanceOf(fx.routerAddress)).to.equal(0);
      const c = await ethers.getContractAt("MockCurve", curve);
      expect(await c.lastQuoteAmount()).to.equal(devBuy);
      expect(await ethers.provider.getBalance(fx.routerAddress)).to.equal(0);
      // The launch went through the forwarder, which exempted the creator.
      const forwarder = await ethers.getContractAt("MockLaunchForwarder", await fx.factory.launchForwarder());
      expect(await forwarder.lastBuyRecipient()).to.equal(fx.creator.address);
      expect(await fx.factory.lastLauncher()).to.equal(await forwarder.getAddress());
      expect(await fx.factory.lastExemptList()).to.deep.equal([fx.creator.address]);
      expect((await fx.factory.lastParams()).creatorFeeRecipient).to.equal(splitter);
      // The 1% went to the escrow, credited to the splitter.
      expect(await fx.router.pendingFees(token)).to.equal(ethers.parseEther("0.001"));
    });

    it("respects the slippage floor on the developer buy", async () => {
      const fx = await loadFixture(deployFixture);
      const devBuy = ethers.parseEther("0.1");
      await expect(
        fx.router.connect(fx.creator).launch(params({ developerBuy: devBuy, minTokensOut: ethers.parseEther("99000001") }), { value: PONS_FEE + devBuy }),
      ).to.be.revertedWith("curve: slippage");
    });

    it("requires the exact value", async () => {
      const fx = await loadFixture(deployFixture);
      await expect(fx.router.connect(fx.creator).launch(params(), { value: PONS_FEE - 1n }))
        .to.be.revertedWithCustomError(fx.router, "WrongValue")
        .withArgs(PONS_FEE, PONS_FEE - 1n);
      await expect(fx.router.connect(fx.creator).launch(params(), { value: PONS_FEE + 1n })).to.be.revertedWithCustomError(fx.router, "WrongValue");
      const devBuy = ethers.parseEther("0.01");
      await expect(fx.router.connect(fx.creator).launch(params({ developerBuy: devBuy }), { value: PONS_FEE })).to.be.revertedWithCustomError(fx.router, "WrongValue");
    });

    it("reads the Pons fee live", async () => {
      const fx = await loadFixture(deployFixture);
      await fx.factory.setLaunchFee(ethers.parseEther("0.002"));
      expect(await fx.router.ponsLaunchFee()).to.equal(ethers.parseEther("0.002"));
      expect(await fx.router.totalLaunchFee()).to.equal(ethers.parseEther("0.002"));
      await expect(fx.router.connect(fx.creator).launch(params(), { value: PONS_FEE })).to.be.revertedWithCustomError(fx.router, "WrongValue");
      await fx.router.connect(fx.creator).launch(params(), { value: ethers.parseEther("0.002") });
      expect(await fx.router.launchCount()).to.equal(1);
    });

    it("charges the pad launch fee to the treasury when set", async () => {
      const fx = await loadFixture(deployFixture);
      const padFee = ethers.parseEther("0.001");
      await fx.router.setPadLaunchFee(padFee);
      expect(await fx.router.totalLaunchFee()).to.equal(PONS_FEE + padFee);
      const before = await ethers.provider.getBalance(fx.treasury.address);
      await fx.router.connect(fx.creator).launch(params(), { value: PONS_FEE + padFee });
      expect((await ethers.provider.getBalance(fx.treasury.address)) - before).to.equal(padFee);
      expect(await ethers.provider.getBalance(fx.routerAddress)).to.equal(0);
    });

    it("validates name, symbol and creator tax", async () => {
      const fx = await loadFixture(deployFixture);
      await expect(fx.router.connect(fx.creator).launch(params({ name: "" }), { value: PONS_FEE })).to.be.revertedWithCustomError(fx.router, "EmptyName");
      await expect(fx.router.connect(fx.creator).launch(params({ symbol: "" }), { value: PONS_FEE })).to.be.revertedWithCustomError(fx.router, "EmptySymbol");
      await expect(fx.router.connect(fx.creator).launch(params({ creatorTaxBps: 1001 }), { value: PONS_FEE }))
        .to.be.revertedWithCustomError(fx.router, "TaxTooHigh")
        .withArgs(1000);
      await fx.router.connect(fx.creator).launch(params({ creatorTaxBps: 1000 }), { value: PONS_FEE });
      expect((await fx.factory.lastParams()).creatorTaxBps).to.equal(1000);
    });

    it("stops when paused or when Pons closes the gate", async () => {
      const fx = await loadFixture(deployFixture);
      await fx.router.setPaused(true);
      await expect(fx.router.connect(fx.creator).launch(params(), { value: PONS_FEE })).to.be.revertedWithCustomError(fx.router, "Paused");
      await fx.router.setPaused(false);

      await fx.factory.setLaunchEnabled(false);
      expect(await fx.router.canLaunchHere()).to.equal(false);
      await expect(fx.router.connect(fx.creator).launch(params(), { value: PONS_FEE })).to.be.revertedWithCustomError(fx.router, "LaunchClosed");
      await fx.factory.setLaunchEnabled(true);

      await fx.factory.setBlocked(fx.routerAddress, true);
      expect(await fx.router.canLaunchHere()).to.equal(false);
      await expect(fx.router.connect(fx.creator).launch(params(), { value: PONS_FEE })).to.be.revertedWithCustomError(fx.router, "LaunchClosed");
      await fx.factory.setBlocked(fx.routerAddress, false);
      expect(await fx.router.canLaunchHere()).to.equal(true);
    });

    it("emits Launched", async () => {
      const fx = await loadFixture(deployFixture);
      const devBuy = ethers.parseEther("0.01");
      await expect(fx.router.connect(fx.creator).launch(params({ developerBuy: devBuy, creatorTaxBps: 50 }), { value: PONS_FEE + devBuy }))
        .to.emit(fx.router, "Launched")
        .withArgs(
          (a: string) => ethers.isAddress(a),
          (a: string) => ethers.isAddress(a),
          fx.creator.address,
          (a: string) => ethers.isAddress(a),
          50,
          devBuy,
        );
    });
  });

  describe("fees", () => {
    it("splits collected fees 90/10 and anyone can trigger", async () => {
      const fx = await loadFixture(deployFixture);
      const { token, curve, splitter } = await launchOne(fx);
      const c = await ethers.getContractAt("MockCurve", curve);

      // 1 ETH of buys → 0.01 ETH of creator fees in escrow for the splitter.
      await c.connect(fx.trader).buy(ethers.parseEther("1"), 0, fx.trader.address, { value: ethers.parseEther("1") });
      expect(await fx.escrow.balanceOf(splitter)).to.equal(ethers.parseEther("0.01"));
      expect(await fx.router.pendingFees(token)).to.equal(ethers.parseEther("0.01"));

      const creatorBefore = await ethers.provider.getBalance(fx.creator.address);
      const treasuryBefore = await ethers.provider.getBalance(fx.treasury.address);
      await expect(fx.router.connect(fx.anyone).collectFees(token))
        .to.emit(fx.router, "FeesCollected")
        .withArgs(token, ethers.parseEther("0.009"), ethers.parseEther("0.001"));
      expect((await ethers.provider.getBalance(fx.creator.address)) - creatorBefore).to.equal(ethers.parseEther("0.009"));
      expect((await ethers.provider.getBalance(fx.treasury.address)) - treasuryBefore).to.equal(ethers.parseEther("0.001"));
      expect(await fx.escrow.balanceOf(splitter)).to.equal(0);
      expect(await ethers.provider.getBalance(splitter)).to.equal(0);
      expect(await fx.router.pendingFees(token)).to.equal(0);
    });

    it("also splits ETH sent straight to the splitter", async () => {
      const fx = await loadFixture(deployFixture);
      const { token, splitter } = await launchOne(fx);
      await fx.anyone.sendTransaction({ to: splitter, value: ethers.parseEther("1") });
      expect(await fx.router.pendingFees(token)).to.equal(ethers.parseEther("1"));
      const before = await ethers.provider.getBalance(fx.treasury.address);
      await fx.router.connect(fx.anyone).collectFees(token);
      expect((await ethers.provider.getBalance(fx.treasury.address)) - before).to.equal(ethers.parseEther("0.1"));
    });

    it("collecting with nothing pending is a no-op", async () => {
      const fx = await loadFixture(deployFixture);
      const { token } = await launchOne(fx);
      await expect(fx.router.collectFees(token)).to.emit(fx.router, "FeesCollected").withArgs(token, 0, 0);
    });

    it("rejects unknown tokens", async () => {
      const fx = await loadFixture(deployFixture);
      await expect(fx.router.collectFees(fx.trader.address)).to.be.revertedWithCustomError(fx.router, "UnknownToken");
      await expect(fx.router.pendingFees(fx.trader.address)).to.be.revertedWithCustomError(fx.router, "UnknownToken");
    });

    it("splits ERC-20 pair-token fees the same way", async () => {
      const fx = await loadFixture(deployFixture);
      const { splitter } = await launchOne(fx);
      const usd = await (await ethers.getContractFactory("MockLaunchedToken")).deploy("USD", "USD", fx.trader.address, ethers.parseEther("100"));
      const usdAddress = await usd.getAddress();
      await usd.connect(fx.trader).approve(await fx.escrow.getAddress(), ethers.parseEther("10"));
      await fx.escrow.connect(fx.trader).creditToken(usdAddress, splitter, ethers.parseEther("10"));
      const s = await ethers.getContractAt("FeeSplitter", splitter);
      await expect(s.connect(fx.anyone).collectToken(usdAddress)).to.emit(s, "CollectedToken").withArgs(usdAddress, ethers.parseEther("9"), ethers.parseEther("1"));
      expect(await usd.balanceOf(fx.creator.address)).to.equal(ethers.parseEther("9"));
      expect(await usd.balanceOf(fx.treasury.address)).to.equal(ethers.parseEther("1"));
    });

    it("fails loudly if a recipient refuses ETH", async () => {
      const fx = await loadFixture(deployFixture);
      const rejecting = await (await ethers.getContractFactory("RejectingReceiver")).deploy();
      await fx.router.setTreasury(await rejecting.getAddress());
      const { token, splitter } = await launchOne(fx);
      await fx.anyone.sendTransaction({ to: splitter, value: ethers.parseEther("1") });
      const s = await ethers.getContractAt("FeeSplitter", splitter);
      await expect(fx.router.collectFees(token)).to.be.revertedWithCustomError(s, "TransferFailed");
    });
  });

  describe("admin", () => {
    it("only the owner can change treasury, fee and pause", async () => {
      const fx = await loadFixture(deployFixture);
      await expect(fx.router.connect(fx.creator).setTreasury(fx.creator.address)).to.be.revertedWithCustomError(fx.router, "OwnableUnauthorizedAccount");
      await expect(fx.router.connect(fx.creator).setPadLaunchFee(1)).to.be.revertedWithCustomError(fx.router, "OwnableUnauthorizedAccount");
      await expect(fx.router.connect(fx.creator).setPaused(true)).to.be.revertedWithCustomError(fx.router, "OwnableUnauthorizedAccount");
      await expect(fx.router.connect(fx.creator).sweep()).to.be.revertedWithCustomError(fx.router, "OwnableUnauthorizedAccount");

      await expect(fx.router.setTreasury(ethers.ZeroAddress)).to.be.revertedWithCustomError(fx.router, "ZeroAddress");
      await expect(fx.router.setTreasury(fx.anyone.address)).to.emit(fx.router, "TreasuryUpdated").withArgs(fx.anyone.address);
      await expect(fx.router.setPadLaunchFee(5)).to.emit(fx.router, "PadLaunchFeeUpdated").withArgs(5);
      await expect(fx.router.setPaused(true)).to.emit(fx.router, "PausedUpdated").withArgs(true);
    });

    it("a new treasury applies to new splitters, not old ones", async () => {
      const fx = await loadFixture(deployFixture);
      const first = await launchOne(fx);
      await fx.router.setTreasury(fx.anyone.address);
      const second = await launchOne(fx);
      expect(await (await ethers.getContractAt("FeeSplitter", first.splitter)).treasury()).to.equal(fx.treasury.address);
      expect(await (await ethers.getContractAt("FeeSplitter", second.splitter)).treasury()).to.equal(fx.anyone.address);
    });

    it("sweeps stray ETH to the treasury", async () => {
      const fx = await loadFixture(deployFixture);
      await fx.anyone.sendTransaction({ to: fx.routerAddress, value: ethers.parseEther("0.3") });
      const before = await ethers.provider.getBalance(fx.treasury.address);
      await fx.router.sweep();
      expect((await ethers.provider.getBalance(fx.treasury.address)) - before).to.equal(ethers.parseEther("0.3"));
      await fx.router.sweep(); // nothing left: no-op
    });

    it("hands over ownership in two steps", async () => {
      const fx = await loadFixture(deployFixture);
      await fx.router.transferOwnership(fx.anyone.address);
      expect(await fx.router.owner()).to.equal(fx.deployer.address);
      await fx.router.connect(fx.anyone).acceptOwnership();
      expect(await fx.router.owner()).to.equal(fx.anyone.address);
    });
  });
});
