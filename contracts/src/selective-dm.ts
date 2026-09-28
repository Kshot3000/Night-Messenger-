/**
 * Night Messenger — selective DM contract interface (STUB).
 *
 * TODO: replace with Compact sources + generated JS bindings.
 * Do not treat return values as real ZK proofs.
 */

export type CommitmentHex = string;
export type ThreadId = string;
export type ProofBytes = Uint8Array;

export interface CommitMessageInput {
  threadId: ThreadId;
  /** Hash of E2EE ciphertext — not plaintext */
  ciphertextHash: Uint8Array;
  salt: Uint8Array;
  /** Recipient public identity material (circuit-specific) */
  recipientCommitment: Uint8Array;
}

export interface CommitMessageResult {
  commitment: CommitmentHex;
  /** Ledger tx id once deployed */
  txId?: string;
}

export interface ProveDeliveryInput {
  commitment: CommitmentHex;
  ackNonce: Uint8Array;
}

export interface ProveMembershipInput {
  threadId: ThreadId;
}

export interface ProveAttributeInput {
  commitment: CommitmentHex;
  attributeKey: string;
  /** Revealed value or range proof public data — circuit-defined */
  publicAttribute: string;
}

/**
 * Selective DM contract port.
 * All methods throw until Compact implementation lands.
 */
export interface SelectiveDmContract {
  sendMessage(input: CommitMessageInput): Promise<CommitMessageResult>;
  proveDelivery(input: ProveDeliveryInput): Promise<ProofBytes>;
  proveMembership(input: ProveMembershipInput): Promise<ProofBytes>;
  proveAttribute(input: ProveAttributeInput): Promise<ProofBytes>;
}

export class UnimplementedSelectiveDmContract implements SelectiveDmContract {
  async sendMessage(_input: CommitMessageInput): Promise<CommitMessageResult> {
    throw new Error('TODO: Compact sendMessage / commitMessage not implemented');
  }
  async proveDelivery(_input: ProveDeliveryInput): Promise<ProofBytes> {
    throw new Error('TODO: Compact proveDelivery not implemented');
  }
  async proveMembership(_input: ProveMembershipInput): Promise<ProofBytes> {
    throw new Error('TODO: Compact proveMembership not implemented');
  }
  async proveAttribute(_input: ProveAttributeInput): Promise<ProofBytes> {
    throw new Error('TODO: Compact proveAttribute not implemented');
  }
}

/** Placeholder Compact sketch (not compiled). */
export const COMPACT_SKETCH = `
// selective_dm.compact — SKETCH ONLY, not valid Compact yet
// TODO: author real Compact against current Midnight toolchain

/* exported sendMessage, proveDelivery, proveMembership, proveAttribute */

// ledger {
//   sealed: Map[Bytes[32], SealedMeta]; // commitment -> meta
// }

// export circuit sendMessage(...): [...] { /* commit ciphertext hash */ }
// export circuit proveDelivery(...): [...] { /* ack without body */ }
// export circuit proveMembership(...): [...] { /* party of thread */ }
// export circuit proveAttribute(...): [...] { /* selective attr */ }
`.trim();
