import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
} from "react-native";
import { Link, useRouter } from "expo-router";
import {
  MOCK_CONVERSATIONS,
  PRODUCT,
  type Conversation,
} from "@midnight-messenger/shared";
import { colors } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";

function relative(iso: string) {
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 3600) return `${Math.max(1, Math.floor(sec / 60))}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

export default function ChatsScreen() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Conversation[]>([]);

  useEffect(() => {
    setItems(MOCK_CONVERSATIONS);
  }, []);

  const filtered = items.filter((c) =>
    c.peer.displayName.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <View>
          <Text style={styles.brand}>{PRODUCT.shortName}</Text>
          <Text style={styles.sub}>Free · selective privacy on Midnight</Text>
        </View>
        <Link href="/wallet" asChild>
          <Pressable style={styles.walletBtn} accessibilityRole="button">
            <Text style={styles.walletTxt}>Wallet</Text>
          </Pressable>
        </Link>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search"
        placeholderTextColor={colors.muted}
        value={q}
        onChangeText={setQ}
        accessibilityLabel="Search conversations"
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={filtered.length === 0 ? styles.emptyWrap : undefined}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>夜</Text>
            <Text style={styles.emptyTitle}>No chats yet</Text>
            <Text style={styles.emptyBody}>
              Mock conversations appear here so you can feel the product. Connect Lace when you are ready.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => router.push(`/chat/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Chat with ${item.peer.displayName}`}
          >
            <Avatar name={item.peer.displayName} hue={item.peer.avatarHue} online={item.unreadCount > 0} />
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.peer.displayName}
                </Text>
                <Text style={styles.time}>{relative(item.lastMessageAt)}</Text>
              </View>
              <View style={styles.rowBottom}>
                <Text style={styles.preview} numberOfLines={1}>
                  {item.lastMessagePreview}
                </Text>
                {item.unreadCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeTxt}>{item.unreadCount}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: { color: colors.text, fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  walletBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  walletTxt: { color: colors.accentSoft, fontWeight: "600", fontSize: 13 },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowPressed: { backgroundColor: colors.hover },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  name: { color: colors.text, fontSize: 16, fontWeight: "600", flex: 1 },
  time: { color: colors.muted, fontSize: 12 },
  preview: { color: colors.muted, fontSize: 13, flex: 1 },
  badge: {
    backgroundColor: colors.accent,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeTxt: { color: colors.onAccent, fontSize: 11, fontWeight: "700" },
  emptyWrap: { flexGrow: 1, justifyContent: "center" },
  empty: { alignItems: "center", paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "600" },
  emptyBody: { color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 20 },
});
