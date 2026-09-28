import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { PRODUCT } from "@midnight-messenger/shared";
import { colors } from "@/theme/colors";

export default function WalletScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Connect Lace</Text>
      <Text style={styles.body}>
        On Android, Midnight wallet connect will use the platform connector when available.
        For now this is a placeholder — the web app enumerates window.midnight via Object.values
        (never hardcodes mnLace).
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>TODO</Text>
        <Text style={styles.cardBody}>
          Deep-link / WalletConnect-style Lace flow. Until then, explore chats with mock data.
        </Text>
      </View>
      <Pressable
        style={styles.btn}
        onPress={() => Linking.openURL(PRODUCT.repoUrl)}
        accessibilityRole="link"
      >
        <Text style={styles.btnTxt}>View open-source repo</Text>
      </Pressable>
      <Text style={styles.hint}>100% free · no paywalls</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 24 },
  title: { color: colors.text, fontSize: 24, fontWeight: "700", letterSpacing: -0.3 },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 10 },
  card: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
  },
  cardTitle: { color: colors.accentSoft, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  cardBody: { color: colors.text, fontSize: 14, marginTop: 8, lineHeight: 20 },
  btn: {
    marginTop: 24,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  hint: { textAlign: "center", color: colors.muted, marginTop: 16, fontSize: 12 },
});
