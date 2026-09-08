import { ethers, network } from "hardhat";

/**
 * Replays a launch through Strawberry Pad's router on a fork and traces the
 * internal calls, to read exactly what the Pons forwarder and factory
 * accept. Diagnostics only; nothing is broadcast.
 *
 *   FORK_URL=https://rpc.mainnet.chain.robinhood.com npx hardhat run scripts/trace-launch.ts
 */
const SROUTER = "0xf84876f12a9a11750db9c80dfa1c5e600c7b0e3c";
const CREATOR = "0x0fedea6105a69997350526b73ac556c58956c7d7";
const KNOWN: Record<string, string> = {
  "0xf84876f12a9a11750db9c80dfa1c5e600c7b0e3c": "S-ROUTER",
  "0xe33e9e479df8802cb0866d5d05258bec4cf62948": "FORWARDER",
  "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e": "FACTORY",
  "0xd3afeb2a57f70ef218aa82451c51b2fb0416ac9e": "ESCROW",
  "0x263ed295dafae1d9aadd6e56c4b6f9f38ee019dd": "PONS-SAFE",
  "0x3711cea4feade896c913c68f01eda97cb06d1a42": "LAUNCH-DEPLOYER",
};

const routerIface = new ethers.Interface([
  "function launch((string,string,string,string,string,string,uint16,bool,bytes32,bytes32,uint256,uint256,uint256) p) payable",
]);

type StructLog = { op: string; depth: number; stack: string[]; memory?: string[] };

function hexWord(s: string): string {
  return s.replace(/^0x/, "").padStart(64, "0");
}

function readMemory(memory: string[] | undefined, offset: number, size: number): string {
  if (!memory) return "";
  const joined = memory.map((w) => w.replace(/^0x/, "")).join("");
  return joined.slice(offset * 2, (offset + size) * 2);
}

function words(hex: string, max = 40): string[] {
  const out: string[] = [];
  for (let i = 0; i < hex.length && out.length < max; i += 64) out.push(hex.slice(i, i + 64));
  return out;
}

async function main() {
  console.log(`network ${network.name} block ${await ethers.provider.getBlockNumber()}`);
  await network.provider.send("hardhat_impersonateAccount", [CREATOR]);
  await network.provider.send("hardhat_setBalance", [CREATOR, "0x" + ethers.parseEther("10").toString(16)]);
  const creator = await ethers.getSigner(CREATOR);

  const econ = "0xa9fc75d4203a33fe660e8fa32c74c3aa41c1fda4bf23d3a39b6bc22a1f8b1ca7";
  const salt = ethers.hexlify(ethers.randomBytes(32));
  const devBuy = ethers.parseEther("0.01");
  const data = routerIface.encodeFunctionData("launch", [
    ["Trace Peach", "TPEACH", "ipfs://bafkreitrace", "Fork trace only.", "https://x.com/Peachpad_", "https://peachpad.fun", 0, true, econ, salt, 0, devBuy, 0],
  ]);
  const value = ethers.parseEther("0.0005") + devBuy;

  // Dry run first for a readable failure.
  try {
    await ethers.provider.call({ from: CREATOR, to: SROUTER, data, value });
  } catch (e) {
    console.log("dry run reverted:", (e as Error).message.slice(0, 400));
  }

  const tx = await creator.sendTransaction({ to: SROUTER, data, value, gasLimit: 12_000_000 });
  const receipt = await tx.wait();
  console.log("status", receipt?.status, "gas", receipt?.gasUsed.toString(), "logs", receipt?.logs.length);
  for (const l of receipt?.logs ?? []) {
    console.log("  log", KNOWN[l.address.toLowerCase()] ?? l.address, l.topics[0].slice(0, 10), l.topics.length, l.data.length);
  }

  const trace = (await network.provider.send("debug_traceTransaction", [
    receipt!.hash,
    { disableStorage: true, disableStack: false, enableMemory: true, disableMemory: false },
  ])) as { structLogs: StructLog[] };

  console.log("\n=== internal calls (op depth target selector value | first words)");
  for (const log of trace.structLogs) {
    if (log.op !== "CALL" && log.op !== "STATICCALL" && log.op !== "DELEGATECALL" && log.op !== "CREATE" && log.op !== "CREATE2") continue;
    const st = log.stack;
    const top = (i: number) => st[st.length - 1 - i];
    if (log.op === "CREATE" || log.op === "CREATE2") {
      const size = parseInt(top(2), 16);
      console.log(`${log.op} d${log.depth} initcode ${size}B`);
      continue;
    }
    const to = "0x" + hexWord(top(1)).slice(24);
    const hasValue = log.op === "CALL";
    const value = hasValue ? BigInt("0x" + top(2)) : 0n;
    const inOff = parseInt(top(hasValue ? 3 : 2), 16);
    const inSize = parseInt(top(hasValue ? 4 : 3), 16);
    const input = readMemory(log.memory, inOff, inSize);
    const sel = "0x" + input.slice(0, 8);
    const name = KNOWN[to.toLowerCase()] ?? to;
    if (inSize <= 4) {
      console.log(`${log.op} d${log.depth} ${name} ${sel} value=${ethers.formatEther(value)}`);
      continue;
    }
    if (log.op === "STATICCALL" && !KNOWN[to.toLowerCase()]) continue;
    console.log(`${log.op} d${log.depth} ${name} ${sel} value=${ethers.formatEther(value)} size=${inSize}`);
    if (log.op === "CALL" && inSize > 4) {
      for (const [i, w] of words(input.slice(8), 36).entries()) {
        const ascii = Buffer.from(w, "hex").toString("latin1").replace(/[^\x20-\x7e]/g, ".");
        console.log(`    ${String(i).padStart(2)} ${w} ${/[a-z]{3}/i.test(ascii) ? ascii : ""}`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
