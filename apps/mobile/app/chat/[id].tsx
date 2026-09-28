import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import {
  MOCK_CONVERSATIONS,
  MOCK_MESSAGES,
  MOCK_PEER_SELF_ID,
  createStubMessengerApi,
  type ChatMessage,
} from "@midnight-messenger/shared";
import { colors } from "@/theme/colors";

const api = createStubMessengerApi();

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const conv = MOCK_CONVERSATIONS.find((c) => c.id === id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const listRef = useRef<FlatList>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: conv?.peer.displayName ?? "Chat" });
  }, [navigation, conv]);

  useEffect(() => {
    setMessages(MOCK_MESSAGES[id] ?? []);
  }, [id]);

  async function send() {
    const body = text.trim();
    if (!body || !id) return;
    const msg = await api.sendMessage(id, body);
    setMessages((prev) => [...prev, msg]);
    setText("");
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={88}
    >
      <View style={styles.privacyBar}>
        <Text style={styles.privacyTxt}>
          E2EE body · optional on-chain commitment · selective proofs
        </Text>
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = item.senderId === MOCK_PEER_SELF_ID;
          return (
            <View style={[styles.bubbleWrap, mine ? styles.mine : styles.theirs]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.body, mine && styles.bodyMine]}>{item.body}</Text>
              </View>
              <Text style={styles.meta}>
                {item.visibility === "committed" ? "Committed · " : "E2EE · "}
                {new Date(item.createdAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          );
        }}
      />
      <View style={styles.compose}>
        <TextInput
          style={styles.input}
          placeholder="Message…"
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
          multiline
          accessibilityLabel="Message"
        />
        <Pressable
          style={[styles.send, !text.trim() && styles.sendDisabled]}
          onPress={send}
          disabled={!text.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send"
        >
          <Text style={styles.sendTxt}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  privacyBar: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.elevated,
  },
  privacyTxt: { color: colors.muted, fontSize: 11, textAlign: "center" },
  list: { padding: 16, paddingBottom: 8 },
  bubbleWrap: { marginBottom: 12, maxWidth: "82%" },
  mine: { alignSelf: "flex-end", alignItems: "flex-end" },
  theirs: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  bubbleTheirs: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  bodyMine: { color: colors.onAccent },
  meta: { color: colors.muted, fontSize: 10, marginTop: 4 },
  compose: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.elevated,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },
  send: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendDisabled: { opacity: 0.4 },
  sendTxt: { color: colors.onAccent, fontWeight: "700", fontSize: 14 },
});
