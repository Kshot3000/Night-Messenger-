import type {
  ChatMessage,
  Conversation,
  SelectiveDisclosureRequest,
  SelectiveDisclosureResult,
} from './types';

export interface MessengerApi {
  listConversations(): Promise<Conversation[]>;
  listMessages(conversationId: string): Promise<ChatMessage[]>;
  sendMessage(conversationId: string, body: string): Promise<ChatMessage>;
  proveDisclosure(req: SelectiveDisclosureRequest): Promise<SelectiveDisclosureResult>;
}

export const MOCK_PEER_SELF_ID = 'me';

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'c1',
    peer: { id: 'p1', displayName: 'Ada', avatarHue: 265, addressPreview: 'mn_shield…7k2a' },
    lastMessagePreview: 'Proof of delivery ready when you are.',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    unreadCount: 2,
    hasCommitment: true,
  },
  {
    id: 'c2',
    peer: { id: 'p2', displayName: 'Orion', avatarHue: 210, addressPreview: 'mn_shield…9xq1' },
    lastMessagePreview: 'Sealed the invite — ciphertext only off-chain.',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    unreadCount: 0,
    hasCommitment: true,
  },
  {
    id: 'c3',
    peer: { id: 'p3', displayName: 'Nyx', avatarHue: 300, addressPreview: 'mn_shield…4m8p' },
    lastMessagePreview: 'Selective disclose timestamp only?',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    unreadCount: 1,
    hasCommitment: false,
  },
];

export const MOCK_MESSAGES: Record<string, ChatMessage[]> = {
  c1: [
    {
      id: 'm1',
      conversationId: 'c1',
      senderId: 'p1',
      body: 'Hey — Night Messenger looking sharp.',
      createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
      status: 'delivered',
      visibility: 'encrypted',
    },
    {
      id: 'm2',
      conversationId: 'c1',
      senderId: MOCK_PEER_SELF_ID,
      body: 'Committed existence on-chain; body stays E2EE.',
      createdAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
      status: 'delivered',
      visibility: 'committed',
      commitmentId: 'commit_stub_ada_01',
    },
    {
      id: 'm3',
      conversationId: 'c1',
      senderId: 'p1',
      body: 'Proof of delivery ready when you are.',
      createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      status: 'delivered',
      visibility: 'encrypted',
    },
  ],
  c2: [
    {
      id: 'm4',
      conversationId: 'c2',
      senderId: MOCK_PEER_SELF_ID,
      body: 'Drafting the selective DM circuit stubs.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      status: 'delivered',
      visibility: 'committed',
      commitmentId: 'commit_stub_orion_01',
    },
    {
      id: 'm5',
      conversationId: 'c2',
      senderId: 'p2',
      body: 'Sealed the invite — ciphertext only off-chain.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      status: 'delivered',
      visibility: 'encrypted',
    },
  ],
  c3: [
    {
      id: 'm6',
      conversationId: 'c3',
      senderId: 'p3',
      body: 'Selective disclose timestamp only?',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      status: 'delivered',
      visibility: 'encrypted',
    },
  ],
};

/** Stub API — local mocks. TODO: Midnight contract client + encrypted relay. */
export function createStubMessengerApi(): MessengerApi {
  return {
    async listConversations() {
      return MOCK_CONVERSATIONS;
    },
    async listMessages(conversationId: string) {
      return MOCK_MESSAGES[conversationId] ?? [];
    },
    async sendMessage(conversationId: string, body: string) {
      const msg: ChatMessage = {
        id: `local_${Date.now()}`,
        conversationId,
        senderId: MOCK_PEER_SELF_ID,
        body,
        createdAt: new Date().toISOString(),
        status: 'sent',
        visibility: 'encrypted',
      };
      if (!MOCK_MESSAGES[conversationId]) MOCK_MESSAGES[conversationId] = [];
      MOCK_MESSAGES[conversationId].push(msg);
      return msg;
    },
    async proveDisclosure(req: SelectiveDisclosureRequest): Promise<SelectiveDisclosureResult> {
      return {
        ok: true,
        stubbed: true,
        proofStub: `proof_stub_${req.kind}_${req.messageId}`,
        disclosedAt: new Date().toISOString(),
      };
    },
  };
}
