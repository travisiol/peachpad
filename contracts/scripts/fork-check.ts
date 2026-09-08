import { ethers, network } from "hardhat";

/**
 * Exercises the router against the REAL Pons V2 factory on a fork of
 * Robinhood Chain. Nothing is broadcast; the hardhat network is forked from
 * ROBINHOOD_RPC_URL at the latest block.
 *
 *   npx hardhat node --fork https://rpc.mainnet.chain.robinhood.com
 *   npm run fork:check
 *
 * Or in one process: FORK=1 npx hardhat run scripts/fork-check.ts
 */
const PONS_FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";

async function main() {
  const [deployer, creator, stranger] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  console.log(`network ${network.name} chainId ${chainId} block ${await ethers.provider.getBlockNumber()}`);

  const factoryCode = await ethers.provider.getCode(PONS_FACTORY);
  if (factoryCode === "0x") throw new Error("Not a Robinhood Chain fork: no factory code at " + PONS_FACTORY);

  const router = await (await ethers.getContractFactory("PeachRouter")).deploy(PONS_FACTORY, deployer.address, deployer.address);
  await router.waitForDeployment();
  console.log("router", await router.getAddress());
  console.log("feeEscrow", await router.feeEscrow());
  console.log("canLaunchHere", await router.canLaunchHere());
  const ponsFee = await router.ponsLaunchFee();
  console.log("ponsLaunchFee", ethers.formatEther(ponsFee));

  const devBuy = ethers.parseEther("0.01");
  const params = {
    name: "Fork Peach",
    symbol: "FPEACH",
    logo: "ipfs://bafkreiforkpeach",
    description: "Fork rehearsal, never broadcast.",
    x: "https://x.com/Peachpad_",
    telegram: "",
    website: "https://peachpad.fun",
    creatorTaxBps: 0,
    salt: ethers.hexlify(ethers.randomBytes(32)),
    developerBuy: devBuy,
    minTokensOut: 0n,
  };

  const tx = await router.connect(creator).launch(params, { value: ponsFee + devBuy });
  const receipt = await tx.wait();
  console.log("launch gas", receipt?.gasUsed.toString());
  const launched = receipt?.logs
    .map((l) => {
      try {
        return router.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((p) => p?.name === "Launched");
  if (!launched) throw new Error("no Launched event");
  const [token, curve, creatorAddr, splitter] = launched.args;
  console.log("token", token, "curve", curve, "creator", creatorAddr, "splitter", splitter);

  const erc20 = new ethers.Contract(token, ["function balanceOf(address) view returns (uint256)", "function name() view returns (string)", "function symbol() view returns (string)"], ethers.provider);
  console.log("token", await erc20.name(), await erc20.symbol(), "creator balance", ethers.formatEther(await erc20.balanceOf(creator.address)));

  const curveC = new ethers.Contract(
    curve,
    [
      "function realQuoteReserve() view returns (uint256)",
      "function graduationThreshold() view returns (uint256)",
      "function deployer() view returns (address)",
      "function buy(uint256,uint256,address) payable returns (uint256)",
      "function getReserves() view returns (uint256,uint256)",
      "function snipeTaxExempt(address) view returns (bool)",
    ],
    ethers.provider,
  );
  console.log("curve realQuoteReserve", ethers.formatEther(await curveC.realQuoteReserve()), "threshold", ethers.formatEther(await curveC.graduationThreshold()), "deployer/feeRecipient", await curveC.deployer());
  console.log("snipe-tax exempt: router", await curveC.snipeTaxExempt(await router.getAddress()), "splitter", await curveC.snipeTaxExempt(splitter), "creator", await curveC.snipeTaxExempt(creator.address));

  // A stranger buys; the 1% fee should accrue to the splitter in escrow.
  const spend = ethers.parseEther("0.05");
  await (await curveC.connect(stranger).buy(spend, 0, stranger.address, { value: spend })).wait();
  const pending = await router.pendingFees(token);
  console.log("pendingFees after a 0.05 ETH buy", ethers.formatEther(pending));

  const creatorBefore = await ethers.provider.getBalance(creator.address);
  const treasuryBefore = await ethers.provider.getBalance(deployer.address);
  const collect = await (await router.connect(stranger).collectFees(token)).wait();
  const paid = collect?.logs
    .map((l) => {
      try {
        return router.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((p) => p?.name === "FeesCollected");
  console.log("FeesCollected toCreator", ethers.formatEther(paid?.args[1] ?? 0n), "toPad", ethers.formatEther(paid?.args[2] ?? 0n));
  console.log("creator delta", ethers.formatEther((await ethers.provider.getBalance(creator.address)) - creatorBefore), "treasury delta", ethers.formatEther((await ethers.provider.getBalance(deployer.address)) - treasuryBefore));

  // And a launch without a developer buy goes straight through the factory.
  const tx2 = await router.connect(creator).launch({ ...params, symbol: "FPEACH2", salt: ethers.hexlify(ethers.randomBytes(32)), developerBuy: 0n }, { value: ponsFee });
  const r2 = await tx2.wait();
  console.log("launch without dev buy: status", r2?.status, "gas", r2?.gasUsed.toString(), "launchCount", (await router.launchCount()).toString());
  console.log("OK — router works against the real Pons factory on this fork.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
