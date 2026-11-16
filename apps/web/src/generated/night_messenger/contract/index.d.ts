import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type InboxRecord = { owner: Uint8Array;
                            epoch: Uint8Array;
                            members: bigint;
                            active: boolean
                          };

export type PostRecord = { inboxId: Uint8Array;
                           authorTag: Uint8Array;
                           seq: bigint
                         };

export type Witnesses<PS> = {
  localSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  memberPath(context: __compactRuntime.WitnessContext<Ledger, PS>,
             leaf_0: Uint8Array): [PS, { leaf: Uint8Array,
                                         path: { sibling: { field: bigint },
                                                 goes_left: boolean
                                               }[]
                                       }];
  authorBlind(context: __compactRuntime.WitnessContext<Ledger, PS>,
              commitment_0: Uint8Array): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  createInbox(context: __compactRuntime.CircuitContext<PS>, seed_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  addMember(context: __compactRuntime.CircuitContext<PS>,
            inboxId_0: Uint8Array,
            member_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  removeMember(context: __compactRuntime.CircuitContext<PS>,
               inboxId_0: Uint8Array,
               member_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  closeInbox(context: __compactRuntime.CircuitContext<PS>, inboxId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  postEnvelope(context: __compactRuntime.CircuitContext<PS>,
               inboxId_0: Uint8Array,
               commitment_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  ackDelivery(context: __compactRuntime.CircuitContext<PS>,
              commitment_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  revealAuthor(context: __compactRuntime.CircuitContext<PS>,
               commitment_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
}

export type ProvableCircuits<PS> = {
  createInbox(context: __compactRuntime.CircuitContext<PS>, seed_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  addMember(context: __compactRuntime.CircuitContext<PS>,
            inboxId_0: Uint8Array,
            member_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  removeMember(context: __compactRuntime.CircuitContext<PS>,
               inboxId_0: Uint8Array,
               member_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  closeInbox(context: __compactRuntime.CircuitContext<PS>, inboxId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  postEnvelope(context: __compactRuntime.CircuitContext<PS>,
               inboxId_0: Uint8Array,
               commitment_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  ackDelivery(context: __compactRuntime.CircuitContext<PS>,
              commitment_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  revealAuthor(context: __compactRuntime.CircuitContext<PS>,
               commitment_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
}

export type PureCircuits = {
  memberCommitment(sk_0: Uint8Array): Uint8Array;
  ownerCommitment(sk_0: Uint8Array): Uint8Array;
  memberLeaf(inboxId_0: Uint8Array, epoch_0: Uint8Array, member_0: Uint8Array): Uint8Array;
  inboxIdFor(creator_0: Uint8Array, seed_0: Uint8Array): Uint8Array;
  nextEpoch(epoch_0: Uint8Array): Uint8Array;
  authorTag(commitment_0: Uint8Array, member_0: Uint8Array, blind_0: Uint8Array): Uint8Array;
  ackNullifier(commitment_0: Uint8Array, sk_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  memberCommitment(context: __compactRuntime.CircuitContext<PS>,
                   sk_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  ownerCommitment(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  memberLeaf(context: __compactRuntime.CircuitContext<PS>,
             inboxId_0: Uint8Array,
             epoch_0: Uint8Array,
             member_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  inboxIdFor(context: __compactRuntime.CircuitContext<PS>,
             creator_0: Uint8Array,
             seed_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  nextEpoch(context: __compactRuntime.CircuitContext<PS>, epoch_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  authorTag(context: __compactRuntime.CircuitContext<PS>,
            commitment_0: Uint8Array,
            member_0: Uint8Array,
            blind_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  ackNullifier(context: __compactRuntime.CircuitContext<PS>,
               commitment_0: Uint8Array,
               sk_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  createInbox(context: __compactRuntime.CircuitContext<PS>, seed_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  addMember(context: __compactRuntime.CircuitContext<PS>,
            inboxId_0: Uint8Array,
            member_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  removeMember(context: __compactRuntime.CircuitContext<PS>,
               inboxId_0: Uint8Array,
               member_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  closeInbox(context: __compactRuntime.CircuitContext<PS>, inboxId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  postEnvelope(context: __compactRuntime.CircuitContext<PS>,
               inboxId_0: Uint8Array,
               commitment_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  ackDelivery(context: __compactRuntime.CircuitContext<PS>,
              commitment_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  revealAuthor(context: __compactRuntime.CircuitContext<PS>,
               commitment_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
}

export type Ledger = {
  inboxes: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): InboxRecord;
    [Symbol.iterator](): Iterator<[Uint8Array, InboxRecord]>
  };
  members: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): {
      isFull(): boolean;
      checkRoot(rt_0: { field: bigint }): boolean;
      root(): __compactRuntime.MerkleTreeDigest;
      firstFree(): bigint;
      pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
      findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined;
      history(): Iterator<__compactRuntime.MerkleTreeDigest>
    }
  };
  leaves: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  posts: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): PostRecord;
    [Symbol.iterator](): Iterator<[Uint8Array, PostRecord]>
  };
  readonly postCount: bigint;
  acks: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  ackCount: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  revealedAuthors: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  readonly inboxCount: bigint;
  readonly membersAdded: bigint;
  readonly deliveryCount: bigint;
}

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): Promise<__compactRuntime.ConstructorResult<PS>>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
export declare const expectedVk: Record<string, string>;
export declare const circuitSignatures: __compactRuntime.CircuitSignatures;
export declare const declaredInterfaces: __compactRuntime.DeclaredInterfaces;
