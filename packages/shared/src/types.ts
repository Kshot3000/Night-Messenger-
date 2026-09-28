/** Core domain types for Midnight Messenger MVP */

export type PrivacyLayer = 'on_chain' | 'off_chain' | 'selective';

export type MessageVisibility = 'encrypted' | 'committed' | 'selectively_disclosed';

export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'unavailable';

export interface Participant {
  id: string;
  displayName: string;
  addressPreview?: string;
  avatarHue?: number;
}

export interface Conversation {
  id: string;
  peer: Participant;
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
  hasCommitment?: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  visibility: MessageVisibility;
  commitmentId?: string;
  disclosed?: {
    delivery?: boolean;
    membership?: boolean;
    attributes?: string[];
  };
}

export interface WalletSession {
  status: WalletStatus;
  injectionKey?: string;
  walletName?: string;
  rdns?: string;
  addressPreview?: string;
  shieldedAddress?: string;
  apiVersion?: string;
  error?: string;
}

export interface SelectiveDisclosureRequest {
  messageId: string;
  kind: 'delivery' | 'membership' | 'attribute';
  attributeKey?: string;
}

export interface SelectiveDisclosureResult {
  ok: boolean;
  proofStub?: string;
  disclosedAt?: string;
  error?: string;
  stubbed: true;
}

export interface PrivacyLegendItem {
  layer: PrivacyLayer;
  title: string;
  summary: string;
}
