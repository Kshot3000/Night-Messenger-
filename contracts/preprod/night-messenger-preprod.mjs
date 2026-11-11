#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Night Messenger on Midnight Preprod: deploy once, then a live drill
 *   deploy -> createInbox -> addMember(alice) -> addMember(bob)
 *   -> postEnvelope(alice, commitment of a real sealed envelope)
 *   -> ackDelivery(bob) -> read the ledger back and verify the author tag.
 *
 * STATUS: written to the same pattern as ShieldPass's working Preprod drill
 * (midnight-js 4.1.1, wallet-sdk 1.2.0, proof server 8.1.0) but NOT RUN yet:
 * it needs a funded Preprod wallet (tNIGHT + registered tDUST) and a Blockfrost
 * Midnight Preprod project id, neither of which is in this repository.
 *
 * Needs (env): MIDNIGHT_WALLET_SEED or MIDNIGHT_WALLET_MNEMONIC (never printed),
 *   BLOCKFROST_MIDNIGHT_PREPROD_ID (nightpreprod…) or MIDNIGHT_INDEXER_URL/_WS_URL,
 *   PRIVATE_STATE_PASSWORD, NM_SECRETS (dir for demo member secrets, 0700),
 *   NM_OUT (compiled managed/night_messenger with keys/), MIDNIGHT_WALLET_FACADE
 *   (Midnight-GrokBot-Agent packages/preprod-hello-stub/src/wallet-facade.mjs).
 * Run from a workspace that has @midnight-ntwrk/midnight-js-* 4.1.1 installed.
 * Public results (no secrets) go to NM_PUBLIC_RECORD (deployments/preprod.json).
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { deployContract, findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { WebSocket } from "ws";

const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is required`);
  return v;
};
const BF = (process.env.BLOCKFROST_MIDNIGHT_PREPROD_ID ?? "").trim();
const Q = BF ? `?project_id=${encodeURIComponent(BF)}` : "";
const INDEXER = process.env.MIDNIGHT_INDEXER_URL || (BF ? `https://midnight-preprod.blockfrost.io/api/v0${Q}` : "");
const INDEXER_WS = process.env.MIDNIGHT_INDEXER_WS_URL || (BF ? `wss://midnight-preprod.blockfrost.io/api/v0/ws${Q}` : "");
const PROOF = process.env.MIDNIGHT_PROOF_SERVER ?? "http://127.0.0.1:6300";
const OUT = need("NM_OUT");
const SECRETS = need("NM_SECRETS");
const RECORD = process.env.NM_PUBLIC_RECORD ?? "";
const E2EE = process.env.NM_E2EE ?? path.resolve(OUT, "../../../../packages/shared/src/e2ee.ts");
const DRY = process.argv.includes("--dry-run");

const redact = (s) => String(s?.stack ?? s).replace(/([?&]project_id=)[^&\s"']*/g, "$1…").replace(/nightpreprod[A-Za-z0-9]+/g, "nightpreprod…");
const log = (...a) => console.error(new Date().toISOString(), ...a.map(redact));
const hex = (b) => Buffer.from(b).toString("hex");
const u8 = (h) => new Uint8Array(Buffer.from(h, "hex"));
const json = (v) => `${JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x), 2)}\n`;
const finalized = (label, f) => {
  const p = f?.public ?? {};
  if (!p.txId || p.blockHeight == null) throw new Error(`${label}: no txId/blockHeight; not claiming success`);
  if (p.status && p.status !== "SucceedEntirely") throw new Error(`${label}: status ${p.status}`);
  return { txId: String(p.txId), blockHeight: p.blockHeight, status: p.status ?? null };
};

async function main() {
  if (!INDEXER) throw new Error("set BLOCKFROST_MIDNIGHT_PREPROD_ID or MIDNIGHT_INDEXER_URL");
  if (!fs.existsSync(path.join(OUT, "keys", "postEnvelope.prover"))) throw new Error("no prover keys: run the full ZK compile");
  if (!(await fetch(`${PROOF}/health`).then((r) => r.ok).catch(() => false))) throw new Error(`proof server ${PROOF} is not healthy`);
  const { Contract, ledger, pureCircuits: P } = await import(pathToFileURL(path.join(OUT, "contract/index.js")).href);
  const E = await import(pathToFileURL(E2EE).href);
  setNetworkId("preprod");
  if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket;

  fs.mkdirSync(SECRETS, { recursive: true, mode: 0o700 });
  const runFile = path.join(SECRETS, "night-messenger-preprod-run.json");
  const run = fs.existsSync(runFile) ? JSON.parse(fs.readFileSync(runFile, "utf8")) : { txs: {} };
  const rand = () => hex(globalThis.crypto.getRandomValues(new Uint8Array(32)));
  run.ownerSk ??= rand();
  run.aliceSk ??= rand();
  run.bobSk ??= rand();
  run.inboxId ??= rand();
  const save = () => {
    fs.writeFileSync(runFile, json(run), { mode: 0o600 });
    if (RECORD) fs.writeFileSync(RECORD, json(publicRecord(run)));
  };
  save();

  const publicData = indexerPublicDataProvider(INDEXER, INDEXER_WS);
  const readLedger = async (a) => {
    const s = await publicData.queryContractState(a);
    return s ? ledger(s.data ?? s) : null;
  };
  if (DRY) {
    log(`dry run: ${run.contractAddress ? `contract ${run.contractAddress}` : "would deploy"}; no wallet, no txs`);
    return;
  }

  const W = await import(pathToFileURL(need("MIDNIGHT_WALLET_FACADE")).href);
  const ctx = await W.buildPreprodWalletFromEnv();
  try {
    await W.waitUntilConnected(ctx.wallet, { timeoutMs: 180_000 });
    await W.waitForNightBalance(ctx.wallet, ctx.unshieldedKeystore, { timeoutMs: 900_000 });
    log("syncing wallet (Preprod dust sync can take ~30 min)…");
    await W.waitForSynced(ctx.wallet, { timeoutMs: 3_600_000 });
    const dust = await W.ensureDustRegistered(ctx.wallet, ctx.unshieldedKeystore, { dustWaitTimeoutMs: 900_000 });
    if (dust.dustBalance <= 0n) throw new Error("tDUST is 0");
    const wp = W.makeWalletMidnightProvider(ctx.wallet, ctx.shieldedSecretKeys, ctx.dustSecretKey);
    const zk = new NodeZkConfigProvider(OUT);
    const providers = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: "night-messenger-private-state",
        signingKeyStoreName: "night-messenger-signing-keys",
        privateStoragePasswordProvider: () => need("PRIVATE_STATE_PASSWORD"),
        accountId: String(ctx.unshieldedKeystore.getBech32Address()),
      }),
      publicDataProvider: publicData,
      zkConfigProvider: zk,
      proofProvider: httpClientProofProvider(PROOF, zk),
      walletProvider: wp,
      midnightProvider: wp,
    };
    // Private state is JSON hex; witnesses convert.
    const witnesses = {
      localSecretKey: ({ privateState }) => [privateState, u8(privateState.sk)],
      memberPath: ({ privateState, ledger: l }, leaf) => [privateState, l.members.findPathForLeaf(leaf)],
      authorBlind: ({ privateState }) => [privateState, u8(privateState.blind ?? "00".repeat(32))],
    };
    const compiled = CompiledContract.withCompiledFileAssets(CompiledContract.withWitnesses(CompiledContract.make("night_messenger", Contract), witnesses), OUT);
    const join = (id, ps) => findDeployedContract(providers, { compiledContract: compiled, contractAddress: run.contractAddress, privateStateId: id, initialPrivateState: ps });

    let owner;
    if (!run.contractAddress) {
      log("deployContract night_messenger…");
      const d = await deployContract(providers, { compiledContract: compiled, privateStateId: "nmOwner", initialPrivateState: { sk: run.ownerSk }, args: [] });
      run.contractAddress = String(d.deployTxData.public.contractAddress);
      run.txs.deploy = { txId: String(d.deployTxData.public.txId), blockHeight: d.deployTxData.public.blockHeight ?? null };
      run.deployer = ctx.unshieldedAddress;
      run.deployedAt = new Date().toISOString();
      save();
      owner = d;
    } else owner = await join("nmOwner", { sk: run.ownerSk });
    log("contract", run.contractAddress);

    const inbox = u8(run.inboxId);
    let l = await readLedger(run.contractAddress);
    if (!l.inboxes.member(inbox)) run.txs.createInbox = finalized("createInbox", await owner.callTx.createInbox(inbox));
    for (const who of ["alice", "bob"]) {
      const m = P.memberCommitment(u8(run[`${who}Sk`]));
      l = await readLedger(run.contractAddress);
      if (!l.memberIndex.member(P.memberLeaf(inbox, m))) run.txs[`addMember_${who}`] = finalized(`addMember ${who}`, await owner.callTx.addMember(inbox, m));
      save();
    }
    if (!run.commitment) {
      // A real sealed envelope; only its 32-byte commitment goes on-chain.
      const a = await E.createIdentity("Alice");
      const b = await E.createIdentity("Bob");
      a.chainSecret = u8(run.aliceSk);
      a.member = await E.memberCommitment(a.chainSecret);
      const s = await E.seal(a, await E.publicIdentity(b), "Night Messenger Preprod drill", { inbox });
      run.commitment = hex(s.commitment);
      run.blind = s.payload.blind;
      run.expectedAuthorTag = hex(s.authorTag);
      save();
    }
    l = await readLedger(run.contractAddress);
    if (!l.posts.member(u8(run.commitment))) {
      const alice = await join("nmAlice", { sk: run.aliceSk, blind: run.blind });
      run.txs.postEnvelope = finalized("postEnvelope", await alice.callTx.postEnvelope(inbox, u8(run.commitment)));
      save();
    }
    l = await readLedger(run.contractAddress);
    if (!l.acks.member(P.ackNullifier(u8(run.commitment), u8(run.bobSk)))) {
      const bob = await join("nmBob", { sk: run.bobSk });
      run.txs.ackDelivery = finalized("ackDelivery", await bob.callTx.ackDelivery(u8(run.commitment)));
      save();
    }
    l = await readLedger(run.contractAddress);
    run.check = {
      authorTagMatches: hex(l.posts.lookup(u8(run.commitment)).authorTag) === run.expectedAuthorTag,
      acks: String(l.ackCount.lookup(u8(run.commitment))),
    };
    save();
    if (!run.check.authorTagMatches) throw new Error("author tag on Preprod does not match");
    log("DRILL OK", JSON.stringify(run.check));
  } finally {
    await ctx.wallet.stop().catch(() => {});
  }
}

function publicRecord(run) {
  return {
    network: "midnight-preprod",
    status: run.contractAddress ? (run.check?.authorTagMatches ? "deployed-drill-passed" : "deployed") : "not-deployed",
    contract: "contracts/src/night_messenger.compact",
    compiler: "compactc 0.31.1",
    runtime: "compact-runtime 0.16.0, midnight-js 4.1.1, proof server 8.1.0",
    contractAddress: run.contractAddress ?? null,
    explorer: run.contractAddress ? `https://preprod.midnightexplorer.com/contracts/0x${run.contractAddress}` : null,
    deployer: run.deployer ?? null,
    deployedAt: run.deployedAt ?? null,
    inboxId: run.inboxId,
    commitment: run.commitment ?? null,
    txs: Object.fromEntries(Object.entries(run.txs ?? {}).map(([k, v]) => [k, { ...v, explorer: v?.txId ? `https://preprod.midnightexplorer.com/transactions/0x${v.txId}` : null }])),
    check: run.check ?? null,
  };
}

main().catch((e) => {
  log("FAILED", e);
  process.exit(1);
});
