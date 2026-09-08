import { ethers, network } from "hardhat";

/**
 * How creator fees move on the real Pons V2: launch through the router on a
 * fork, buy from a stranger, then look at where the fee sits (curve vs
 * escrow) and whether a sweep can be triggered from outside.
 *
 *   FORK_URL=https://rpc.mainnet.chain.robinhood.com npx hardhat run scripts/fork-fees.ts
 */
const PONS_FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";

async function main() {
  const [deployer, creator, stranger] = await ethers.getSigners();
  console.log(`network ${network.name} block ${await ethers.provider.getBlockNumber()}`);
  const router = await (await ethers.getContractFactory("PeachRouter")).deploy(PONS_FACTORY, deployer.address, deployer.address);
  await router.waitForDeployment();
  const ponsFee = await router.ponsLaunchFee();
  const tx = await router.connect(creator).launch(
    {
      name: "Fee Peach",
      symbol: "FEEP",
      logo: "",
      description: "",
      x: "",
      telegram: "",
      website: "",
      creatorTaxBps: 0,
      salt: ethers.hexlify(ethers.randomBytes(32)),
      developerBuy: 0n,
      minTokensOut: 0n,
    },
    { value: ponsFee },
  );
  const receipt = await tx.wait();
  const launched = receipt!.logs
    .map((l) => {
      try {
        return router.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((p) => p?.name === "Launched")!;
  const [token, curve, , splitter] = launched.args as unknown as [string, string, string, string];
  console.log("token", token, "curve", curve, "splitter", splitter);

  const curveC = new ethers.Contract(
    curve,
    [
      "function buy(uint256,uint256,address) payable returns (uint256)",
      "function sell(uint256,uint256,address) returns (uint256)",
      "function quoteFeeBalance() view returns (uint256)",
      "function creatorTaxBalance() view returns (uint256)",
      "function protocolFeeShareBps() view returns (uint256)",
      "function feeBps() view returns (uint256)",
      "function sweepFees(uint256)",
      "function rescueFees()",
      "function feeEscrow() view returns (address)",
      "function protocolFeeRecipient() view returns (address)",
    ],
    ethers.provider,
  );
  const escrow = new ethers.Contract(await router.feeEscrow(), ["function balanceOf(address) view returns (uint256)"], ethers.provider);

  const spend = ethers.parseEther("0.05");
  await (await curveC.connect(stranger).buy(spend, 0, stranger.address, { value: spend })).wait();
  console.log("after buy: quoteFeeBalance", ethers.formatEther(await curveC.quoteFeeBalance()), "creatorTaxBalance", ethers.formatEther(await curveC.creatorTaxBalance()));
  console.log("feeBps", (await curveC.feeBps()).toString(), "protocolFeeShareBps", (await curveC.protocolFeeShareBps()).toString());
  console.log("escrow.balanceOf(splitter)", ethers.formatEther(await escrow.balanceOf(splitter)), "router.pendingFees", ethers.formatEther(await router.pendingFees(token)));

  for (const [label, signer] of [["stranger", stranger], ["creator", creator]] as const) {
    for (const arg of [0n, 1n, ethers.MaxUint256]) {
      try {
        await curveC.connect(signer).sweepFees.staticCall(arg);
        const t = await curveC.connect(signer).sweepFees(arg);
        await t.wait();
        console.log(`sweepFees(${arg === ethers.MaxUint256 ? "max" : arg}) from ${label}: OK`);
        break;
      } catch (e) {
        console.log(`sweepFees(${arg === ethers.MaxUint256 ? "max" : arg}) from ${label}: revert ${(e as Error).message.slice(0, 120)}`);
      }
    }
  }
  console.log("after sweep attempts: quoteFeeBalance", ethers.formatEther(await curveC.quoteFeeBalance()), "escrow.balanceOf(splitter)", ethers.formatEther(await escrow.balanceOf(splitter)), "pendingFees", ethers.formatEther(await router.pendingFees(token)));

  // A second buy — does the curve sweep on its own past some threshold?
  for (let i = 0; i < 5; i++) {
    const v = ethers.parseEther("0.2");
    await (await curveC.connect(stranger).buy(v, 0, stranger.address, { value: v })).wait();
  }
  console.log("after 5×0.2 ETH buys: quoteFeeBalance", ethers.formatEther(await curveC.quoteFeeBalance()), "escrow.balanceOf(splitter)", ethers.formatEther(await escrow.balanceOf(splitter)), "pendingFees", ethers.formatEther(await router.pendingFees(token)));

  const pending = await router.pendingFees(token);
  if (pending > 0n) {
    const before = await ethers.provider.getBalance(creator.address);
    await (await router.connect(stranger).collectFees(token)).wait();
    console.log("collected: creator delta", ethers.formatEther((await ethers.provider.getBalance(creator.address)) - before));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
