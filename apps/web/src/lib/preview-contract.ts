// SPDX-License-Identifier: Apache-2.0
/**
 * Join the published Preview Night Messenger contract and call createInbox,
 * addMember, postEnvelope, and ackDelivery through a connected Lace wallet.
 */
import {
  fromHex,
  toHex,
  type Identity,
  type MidnightConnectedApiStub,
  type PublicIdentity,
} from "@midnight-messenger/shared";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/v9/compact-js";
import { Contract } from "../generated/night_messenger/contract/index.js";
import { buildPreviewProviders } from "./preview-providers";
import {
  PREVIEW_CONTRACT_FALLBACK,
  decodePreviewReceipt,
  previewInboxExists,
  type PreviewDecodedReceipt,
} from "./preview-receipt";

type MemberPrivateState = {
  sk: string;
  inbox?: string;
  blind?: string;
  path?: unknown;
};

function u8(value: string | Uint8Array): Uint8Array {
  return typeof value === "string" ? fromHex(value.replace(/^0x/, "")) : value;
}

function witnesses() {
  return {
    localSecretKey: ({ privateState }: { privateState: MemberPrivateState }) => [
      privateState,
      u8(privateState.sk),
    ],
    memberPath: (
      { privateState, ledger: l }: { privateState: MemberPrivateState; ledger: { members: { member: (i: Uint8Array) => boolean; lookup: (i: Uint8Array) => { findPathForLeaf: (leaf: Uint8Array) => unknown } } } },
      leaf: Uint8Array,
    ) => {
      const inbox = privateState.inbox ? u8(privateState.inbox) : undefined;
      const tree = inbox && l.members.member(inbox) ? l.members.lookup(inbox) : undefined;
      const p = privateState.path ?? (tree ? tree.findPathForLeaf(leaf) : undefined);
      if (!p) throw new Error("not a member (no Merkle path)");
      return [privateState, p];
    },
    authorBlind: ({ privateState }: { privateState: MemberPrivateState }) => [
      privateState,
      u8(privateState.blind ?? "00".repeat(32)),
    ],
  };
}

function compiledContract() {
  return CompiledContract.make("night_messenger", Contract).pipe(
    CompiledContract.withWitnesses(witnesses() as never),
  );
}

async function joinContract(
  api: MidnightConnectedApiStub,
  identity: Identity,
  ps: MemberPrivateState,
  contractAddress = PREVIEW_CONTRACT_FALLBACK,
) {
  const providers = await buildPreviewProviders(api, identity);
  const deployed = await findDeployedContract(providers, {
    compiledContract: compiledContract() as never,
    contractAddress,
    privateStateId: `nm:${toHex(identity.member)}`,
    initialPrivateState: ps,
  });
  return { providers, deployed };
}

export type PreviewSendArgs = {
  api: MidnightConnectedApiStub;
  me: Identity;
  contact: PublicIdentity;
  inbox: Uint8Array;
  seed: Uint8Array;
  create: boolean;
  commitment: string;
  blind: string;
  members: string[];
  contractAddress?: string;
};

export async function previewSend(args: PreviewSendArgs): Promise<PreviewDecodedReceipt> {
  const address = args.contractAddress ?? PREVIEW_CONTRACT_FALLBACK;
  const inboxHex = toHex(args.inbox);
  const exists = await previewInboxExists(inboxHex, { contractAddress: address });
  if (!exists) {
    if (!args.create) {
      throw new Error("This DM inbox does not exist yet on Preview, and this client is not its creator.");
    }
    const { deployed: owner } = await joinContract(
      args.api,
      args.me,
      { sk: toHex(args.me.chainSecret), inbox: inboxHex },
      address,
    );
    const tx = owner.callTx as unknown as {
      createInbox: (seed: Uint8Array) => Promise<unknown>;
      addMember: (inbox: Uint8Array, member: Uint8Array) => Promise<unknown>;
      postEnvelope: (inbox: Uint8Array, commitment: Uint8Array) => Promise<unknown>;
    };
    try {
      await tx.createInbox(u8(args.seed));
    } catch (e) {
      const msg = (e as Error).message || "";
      if (!/already|exists/i.test(msg)) throw e;
    }
    for (const member of args.members) {
      try {
        await tx.addMember(u8(args.inbox), u8(member));
      } catch (e) {
        const msg = (e as Error).message || "";
        if (!/already|exists|member/i.test(msg)) throw e;
      }
    }
  }
  const { deployed } = await joinContract(
    args.api,
    args.me,
    { sk: toHex(args.me.chainSecret), inbox: inboxHex, blind: args.blind },
    address,
  );
  const tx = deployed.callTx as unknown as {
    postEnvelope: (inbox: Uint8Array, commitment: Uint8Array) => Promise<unknown>;
  };
  await tx.postEnvelope(u8(args.inbox), u8(args.commitment));
  return decodePreviewReceipt(args.commitment, { contractAddress: address });
}

export async function previewAck(args: {
  api: MidnightConnectedApiStub;
  me: Identity;
  commitment: string;
  inbox?: string;
  contractAddress?: string;
}): Promise<PreviewDecodedReceipt> {
  const address = args.contractAddress ?? PREVIEW_CONTRACT_FALLBACK;
  const { deployed } = await joinContract(
    args.api,
    args.me,
    { sk: toHex(args.me.chainSecret), inbox: args.inbox },
    address,
  );
  const tx = deployed.callTx as unknown as {
    ackDelivery: (commitment: Uint8Array) => Promise<unknown>;
  };
  await tx.ackDelivery(u8(args.commitment));
  return decodePreviewReceipt(args.commitment, { contractAddress: address });
}

export { previewInboxExists, decodePreviewReceipt };
