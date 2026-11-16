#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Night Messenger on Midnight Preprod (ledger 9): deploy once, then a live drill
 *   deploy -> createInbox -> addMember(alice) -> addMember(bob)
 *   -> postEnvelope(alice, commitment of a real sealed envelope)
 *   -> ackDelivery(bob) -> read the ledger back and verify the author tag.
 *
 * Stack: midnight-js 5.0.0, wallet-sdk 2.0.0, proof server 9.0.0,
 * Compact toolchain 0.36.0 (language 0.28.0, compact-runtime 0.21.0).
 *
 * Needs (env):
 *   MIDNIGHT_WALLET_SEED (hex) or MIDNIGHT_WALLET_MNEMONIC (never printed),
 *   BLOCKFROST_MIDNIGHT_PREPROD_ID or BLOCKFROST_PROJECT_ID (a Blockfrost
 *     "Midnight Preprod" project id). Midnight retired its hosted Preprod
 *     indexer and RPC on 9 October 2026 (indexer returns HTTP 410);
 *     Blockfrost is the public Preprod provider and every request needs a
 *     project token. Or set MIDNIGHT_INDEXER_URL, MIDNIGHT_INDEXER_WS_URL,
 *     MIDNIGHT_NODE and MIDNIGHT_NODE_WS yourself.
 *   PRIVATE_STATE_PASSWORD, NM_SECRETS (dir for demo member secrets, 0700),
 *   NM_OUT (compiled managed/night_messenger with keys/).
 *   A local proof server 9.0.0 (default http://127.0.0.1:6300).
 *
 * The 9 November 2026 Preprod ledger 9 upgrade cleared DUST registrations
 * that were not backed by cNIGHT, so this script re-registers any unregistered
 * tNIGHT UTXOs with registerNightUtxosForDustGeneration. Wallet SDK 2.0.0 can
 * throw ProtocolVersionMismatchError on the first registration call; we retry
 * that error (midnight-examples#93 / PR #111).
 *
 * This script does not sign up for Blockfrost, does not send email, and does
 * not touch mainnet. Public results (no secrets) go to NM_PUBLIC_RECORD
 * (deployments/preprod.json).
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { deployContract, findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/v9/compact-js";
import { ContractState } from "@midnight-ntwrk/compact-runtime";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { createLedger9WalletProvider, createLedger9MidnightProvider } from "@midnight-ntwrk/midnight-js-types";
import { networks } from "@midnight-ntwrk/midnight-js-utils";
import { FluentWalletBuilder, MidnightWalletProvider, syncWallet } from "@midnight-ntwrk/testkit-js";
import { NetworkId } from "@midnightntwrk/wallet-sdk";
import { unshieldedToken } from "@midnightntwrk/ledger-v9";
import { WebSocket } from "ws";
import * as Rx from "rxjs";

const COMPILER = "compactc 0.36.0";
const RUNTIME = "compact-runtime 0.21.0, midnight-js 5.0.0, wallet-sdk 2.0.0, proof server 9.0.0";
const FAUCET = "https://midnight-tmnight-preprod.nethermind.dev/";
const TX_TTL_SECONDS = Number(process.env.MIDNIGHT_TX_TTL_SECONDS ?? 3600);
const DUST_REGISTRATION_RETRY_ATTEMPTS = 5;
const DUST_REGISTRATION_RETRY_DELAY_MS = 2_000;
const PROTOCOL_VERSION_MISMATCH_TAG =
  "@midnightntwrk/wallet-sdk-abstractions/WalletTransaction/ProtocolVersionMismatchError";

const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is required`);
  return v;
};
const BF = (process.env.BLOCKFROST_MIDNIGHT_PREPROD_ID ?? process.env.BLOCKFROST_PROJECT_ID ?? "").trim();
const PROOF = process.env.MIDNIGHT_PROOF_SERVER ?? "http://127.0.0.1:6300";
const OUT = need("NM_OUT");
const SECRETS = need("NM_SECRETS");
const RECORD = process.env.NM_PUBLIC_RECORD ?? "";
const E2EE = process.env.NM_E2EE ?? path.resolve(OUT, "../../../../packages/shared/src/e2ee.ts");
const DRY = process.argv.includes("--dry-run");

const redact = (s) =>
  String(s?.stack ?? s)
    .replace(/([?&]project_id=)[^&\s"']*/g, "$1…")
    .replace(/nightpreprod[A-Za-z0-9]+/g, "nightpreprod…");
const log = (...a) => console.error(new Date().toISOString(), ...a.map(redact));
const logger = { info: (...a) => log(...a), warn: (...a) => log(...a), error: (...a) => log(...a), debug: () => {} };
const hex = (b) => Buffer.from(b).toString("hex");
const u8 = (h) => new Uint8Array(Buffer.from(h, "hex"));
const json = (v) => `${JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x), 2)}\n`;

function parseSeedHex(value) {
  const h = String(value).trim().replace(/^0x/, "");
  if (!/^[0-9a-fA-F]+$/.test(h) || h.length % 2 !== 0) {
    throw new Error("MIDNIGHT_WALLET_SEED must be a hex string of even length");
  }
  return new Uint8Array(Buffer.from(h, "hex"));
}

function preprodEndpoints() {
  if (process.env.MIDNIGHT_INDEXER_URL && process.env.MIDNIGHT_INDEXER_WS_URL && process.env.MIDNIGHT_NODE && process.env.MIDNIGHT_NODE_WS) {
    return {
      networkId: "preprod",
      walletNetworkId: NetworkId.NetworkId.PreProd,
      indexer: process.env.MIDNIGHT_INDEXER_URL,
      indexerWS: process.env.MIDNIGHT_INDEXER_WS_URL,
      node: process.env.MIDNIGHT_NODE,
      nodeWS: process.env.MIDNIGHT_NODE_WS,
      proofServer: PROOF,
      faucet: FAUCET,
    };
  }
  if (!BF) {
    throw new Error(
      "Preprod indexer/RPC require a Blockfrost Midnight Preprod project id. " +
        "Midnight retired indexer.preprod.midnight.network and rpc.preprod.midnight.network on 9 October 2026 " +
        "(the indexer returns HTTP 410). Set BLOCKFROST_MIDNIGHT_PREPROD_ID or BLOCKFROST_PROJECT_ID, " +
        "or set MIDNIGHT_INDEXER_URL, MIDNIGHT_INDEXER_WS_URL, MIDNIGHT_NODE and MIDNIGHT_NODE_WS. " +
        `tNIGHT faucet (captcha in a browser): ${FAUCET}`,
    );
  }
  const net = networks.preprod(BF);
  return {
    networkId: "preprod",
    walletNetworkId: NetworkId.NetworkId.PreProd,
    indexer: net.indexer.queryURL,
    indexerWS: net.indexer.subscriptionURL,
    node: net.nodeURL ?? `https://rpc.midnight-preprod.blockfrost.io?project_id=${encodeURIComponent(BF)}`,
    nodeWS: net.nodeWsURL ?? `wss://rpc.midnight-preprod.blockfrost.io?project_id=${encodeURIComponent(BF)}`,
    proofServer: PROOF,
    faucet: FAUCET,
  };
}

const finalized = (label, f) => {
  const p = f?.public ?? f?.deployTxData?.public ?? {};
  const txId = p.txId ?? p.tx?.id ?? p.tx?.txId;
  const blockHeight = p.blockHeight ?? p.tx?.blockHeight;
  if (!txId || blockHeight == null) throw new Error(`${label}: no txId/blockHeight; not claiming success`);
  if (p.status && p.status !== "SucceedEntirely") throw new Error(`${label}: status ${p.status}`);
  return { txId: String(txId), blockHeight, status: p.status ?? null };
};

function isProtocolVersionMismatchError(err) {
  if (err == null || typeof err !== "object") return false;
  const rec = err;
  // Wallet SDK 2.0.0 throws ProtocolVersionMismatchError from WalletFacade.accept
  // via WalletTransaction.unwrapWithin. Effect TaggedError sets both `name` and
  // `_tag` to this string; constructor.name is the short class name.
  return (
    rec._tag === PROTOCOL_VERSION_MISMATCH_TAG ||
    rec.name === PROTOCOL_VERSION_MISMATCH_TAG ||
    rec.constructor?.name === "ProtocolVersionMismatchError"
  );
}

/**
 * Wallet SDK 2.0.0 can throw ProtocolVersionMismatchError on the first
 * `registerNightUtxosForDustGeneration` call made immediately after sync on a
 * Ledger 9 chain (midnight-examples#93). The facade's `currentVersion()` can
 * lag the wallets' reported sync progress. Retry a few times with a short
 * delay until the SDK is fixed.
 */
async function registerNightUtxosForDustGenerationRetrying(register) {
  let lastError;
  for (let attempt = 1; attempt <= DUST_REGISTRATION_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await register();
    } catch (err) {
      lastError = err;
      if (!isProtocolVersionMismatchError(err) || attempt === DUST_REGISTRATION_RETRY_ATTEMPTS) throw err;
      log(
        `DUST registration hit ProtocolVersionMismatchError (attempt ${attempt}/${DUST_REGISTRATION_RETRY_ATTEMPTS}); retrying in ${DUST_REGISTRATION_RETRY_DELAY_MS}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, DUST_REGISTRATION_RETRY_DELAY_MS));
    }
  }
  throw lastError;
}

/**
 * Re-register tNIGHT for DUST after the Preprod ledger 9 upgrade, which cleared
 * registrations that were not backed by cNIGHT. Registers every unregistered
 * NIGHT UTXO, even if some DUST still appears in the wallet.
 */
async function ensureDustRegistered(wallet, keystore, { dustWaitTimeoutMs = 900_000 } = {}) {
  const state = await Rx.firstValueFrom(wallet.state());
  const night = unshieldedToken().raw;
  const unregistered = state.unshielded.availableCoins.filter(
    (coin) => coin.utxo.type === night && !coin.meta.registeredForDustGeneration,
  );
  const dustNow = state.dust.balance(new Date());
  if (unregistered.length === 0) {
    log(`no unregistered tNIGHT UTXOs; DUST balance=${dustNow}`);
  } else {
    log(`re-registering ${unregistered.length} tNIGHT UTXO(s) for DUST generation (ledger 9 Preprod upgrade cleared prior registrations)…`);
    const recipe = await registerNightUtxosForDustGenerationRetrying(() =>
      wallet.registerNightUtxosForDustGeneration(
        unregistered,
        keystore.getPublicKey(),
        (payload) => keystore.signDataAsync(payload),
      ),
    );
    const txId = await wallet.submitTransaction(await wallet.finalizeRecipe(recipe));
    log(`DUST registration tx submitted: ${txId}`);
  }
  const deadline = Date.now() + dustWaitTimeoutMs;
  for (;;) {
    const s = await Rx.firstValueFrom(wallet.state());
    const dust = s.dust.balance(new Date());
    if (dust > 0n) {
      log(`tDUST ready: ${dust}`);
      return { dustBalance: dust };
    }
    if (Date.now() >= deadline) throw new Error("tDUST is 0 after waiting for registration to generate fees");
    await new Promise((r) => setTimeout(r, 10_000));
  }
}

async function main() {
  if (!fs.existsSync(path.join(OUT, "keys", "postEnvelope.prover"))) throw new Error("no prover keys: run the full ZK compile (`pnpm compile:contracts`)");
  if (!(await fetch(`${PROOF}/health`).then((r) => r.ok).catch(() => false))) {
    throw new Error(`proof server ${PROOF} is not healthy (docker run -p 6300:6300 midnightntwrk/proof-server:9.0.0 -- midnight-proof-server -v)`);
  }
  const { Contract, ledger, pureCircuits: P } = await import(pathToFileURL(path.join(OUT, "contract/index.js")).href);
  const E = await import(pathToFileURL(E2EE).href);
  if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket;

  fs.mkdirSync(SECRETS, { recursive: true, mode: 0o700 });
  const runFile = path.join(SECRETS, "night-messenger-preprod-run.json");
  const run = fs.existsSync(runFile) ? JSON.parse(fs.readFileSync(runFile, "utf8")) : { txs: {} };
  const rand = () => hex(globalThis.crypto.getRandomValues(new Uint8Array(32)));
  run.ownerSk ??= rand();
  run.aliceSk ??= rand();
  run.bobSk ??= rand();
  run.inboxSeed ??= run.inboxId ?? rand(); // createInbox now takes a creator-bound seed, not a raw id
  const save = () => {
    fs.writeFileSync(runFile, json(run), { mode: 0o600 });
    if (RECORD) fs.writeFileSync(RECORD, json(publicRecord(run)));
  };
  save();

  let env;
  try {
    env = preprodEndpoints();
  } catch (e) {
    if (DRY) {
      log(`dry run: ${run.contractAddress ? `contract ${run.contractAddress}` : "would deploy"}; ${redact(e)}; no wallet, no txs`);
      return;
    }
    throw e;
  }

  const publicData = indexerPublicDataProvider(env.indexer, env.indexerWS);
  const readLedger = async (a) => {
    const read = await publicData.queryContractState(a);
    if (!read) return null;
    return ledger(read.contractState.deserialize({ v9: ContractState }).data);
  };
  if (DRY) {
    log(`dry run: ${run.contractAddress ? `contract ${run.contractAddress}` : "would deploy"}; no wallet, no txs`);
    return;
  }

  const seed = process.env.MIDNIGHT_WALLET_SEED;
  const mnemonic = process.env.MIDNIGHT_WALLET_MNEMONIC;
  if (!seed && !mnemonic) throw new Error("set MIDNIGHT_WALLET_SEED (hex) or MIDNIGHT_WALLET_MNEMONIC");

  const builder = FluentWalletBuilder.forEnvironment(env);
  if (mnemonic) builder.withMnemonic(mnemonic.trim().replace(/\s+/g, " "));
  else builder.withSeed(parseSeedHex(seed));
  const { wallet, seeds, keystore } = await builder.buildWithoutStarting();
  const rawAddr = keystore.getBech32Address();
  const address = rawAddr?.asString?.() ?? String(rawAddr ?? "");
  try {
    await wallet.start(seeds);
    log(`syncing wallet as ${address || "(address pending)"} (Preprod dust sync can take a while)…`);
    try {
      await syncWallet(wallet, 5_000, 3_600_000);
    } catch (e) {
      log("testkit syncWallet failed, waiting on isSynced + Settled instead:", e);
      await Rx.firstValueFrom(
        wallet.state().pipe(
          Rx.throttleTime(5_000),
          Rx.filter((s) => s.isSynced === true && s.protocol?._tag === "Settled"),
          Rx.timeout({
            first: 3_600_000,
            with: () => Rx.throwError(() => new Error("wallet sync timeout")),
          }),
        ),
      );
    }
    const nightState = await Rx.firstValueFrom(wallet.state());
    const night = unshieldedToken().raw;
    const nightBal = nightState.unshielded.balances?.[night] ?? 0n;
    if (nightBal <= 0n) {
      throw new Error(
        `No tNIGHT at ${address}. Request it from the free Preprod faucet in a browser (${FAUCET}), then re-run. ` +
          "The faucet page uses a captcha; this script will not open it or sign up for anything.",
      );
    }
    log(`tNIGHT balance=${nightBal}`);
    const dust = await ensureDustRegistered(wallet, keystore, { dustWaitTimeoutMs: 900_000 });
    if (dust.dustBalance <= 0n) throw new Error("tDUST is 0");

    const wp = await MidnightWalletProvider.withWallet(logger, env, wallet, seeds, keystore);
    const zk = new NodeZkConfigProvider(OUT);
    const providers = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: "night-messenger-private-state",
        signingKeyStoreName: "night-messenger-signing-keys",
        privateStoragePasswordProvider: () => need("PRIVATE_STATE_PASSWORD"),
        accountId: String(wp.getCoinPublicKey()),
      }),
      publicDataProvider: publicData,
      zkConfigProvider: zk,
      proofProvider: httpClientProofProvider(PROOF, zk),
      walletProvider: createLedger9WalletProvider(wp),
      midnightProvider: createLedger9MidnightProvider((tx) => wp.submitTx(tx)),
      config: { networkId: env.networkId, ttlSeconds: TX_TTL_SECONDS },
    };
    const witnesses = {
      localSecretKey: ({ privateState }) => [privateState, u8(privateState.sk)],
      memberPath: ({ privateState, ledger: l }, leaf) => {
        const inbox = privateState.inbox ? (typeof privateState.inbox === "string" ? u8(privateState.inbox) : privateState.inbox) : undefined;
        const tree = inbox && l.members.member(inbox) ? l.members.lookup(inbox) : undefined;
        const p = privateState.path ?? (tree ? tree.findPathForLeaf(leaf) : undefined);
        if (!p) throw new Error("not a member (no Merkle path)");
        return [privateState, p];
      },
      authorBlind: ({ privateState }) => [privateState, u8(privateState.blind ?? "00".repeat(32))],
    };
    const compiled = CompiledContract.make("night_messenger", Contract).pipe(
      CompiledContract.withWitnesses(witnesses),
      CompiledContract.withCompiledFileAssets(OUT),
    );
    const join = (id, ps) =>
      findDeployedContract(providers, {
        compiledContract: compiled,
        contractAddress: run.contractAddress,
        privateStateId: id,
        initialPrivateState: ps,
      });

    let owner;
    if (!run.contractAddress) {
      log("deployContract night_messenger…");
      const d = await deployContract(providers, {
        compiledContract: compiled,
        privateStateId: "nmOwner",
        initialPrivateState: { sk: run.ownerSk },
      });
      run.contractAddress = String(d.deployTxData.public.contractAddress);
      run.txs.deploy = finalized("deploy", d.deployTxData);
      try {
        run.deployer = keystore.getBech32Address().asString?.() ?? String(keystore.getBech32Address());
      } catch {
        run.deployer = address || null;
      }
      run.deployedAt = new Date().toISOString();
      save();
      owner = d;
    } else owner = await join("nmOwner", { sk: run.ownerSk });
    log("contract", run.contractAddress);

    const inbox = P.inboxIdFor(P.memberCommitment(u8(run.ownerSk)), u8(run.inboxSeed));
    run.inboxId = hex(inbox);
    save();
    let l = await readLedger(run.contractAddress);
    if (!l.inboxes.member(inbox)) run.txs.createInbox = finalized("createInbox", await owner.callTx.createInbox(u8(run.inboxSeed)));
    for (const who of ["alice", "bob"]) {
      const m = P.memberCommitment(u8(run[`${who}Sk`]));
      l = await readLedger(run.contractAddress);
      const epoch = l.inboxes.lookup(inbox).epoch;
      if (!l.leaves.member(P.memberLeaf(inbox, epoch, m))) {
        run.txs[`addMember_${who}`] = finalized(`addMember ${who}`, await owner.callTx.addMember(inbox, m));
      }
      save();
    }
    if (!run.commitment) {
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
      const alice = await join("nmAlice", { sk: run.aliceSk, blind: run.blind, inbox: run.inboxId });
      run.txs.postEnvelope = finalized("postEnvelope", await alice.callTx.postEnvelope(inbox, u8(run.commitment)));
      save();
    }
    l = await readLedger(run.contractAddress);
    if (!l.acks.member(P.ackNullifier(u8(run.commitment), u8(run.bobSk)))) {
      const bob = await join("nmBob", { sk: run.bobSk, inbox: run.inboxId });
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
    await wallet.stop().catch(() => {});
  }
}

function publicRecord(run) {
  return {
    network: "midnight-preprod",
    status: run.contractAddress ? (run.check?.authorTagMatches ? "deployed-drill-passed" : "deployed") : "not-deployed",
    contract: "contracts/src/night_messenger.compact",
    compiler: COMPILER,
    language: "0.28.0",
    runtime: RUNTIME,
    contractAddress: run.contractAddress ?? null,
    explorer: run.contractAddress ? `https://preprod.midnightexplorer.com/contracts/0x${run.contractAddress}` : null,
    deployer: run.deployer ?? null,
    deployedAt: run.deployedAt ?? null,
    inboxId: run.inboxId ?? null,
    commitment: run.commitment ?? null,
    txs: Object.fromEntries(
      Object.entries(run.txs ?? {}).map(([k, v]) => [k, { ...v, explorer: v?.txId ? `https://preprod.midnightexplorer.com/transactions/0x${v.txId}` : null }]),
    ),
    check: run.check ?? null,
  };
}

main().catch((e) => {
  log("FAILED", e);
  process.exit(1);
});
