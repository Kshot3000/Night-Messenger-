import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";

function grayFromHue(hue: number) {
  const light = 38 + (Math.abs(Math.round(hue)) % 40);
  return light;
}

export function Avatar({
  name,
  hue = 200,
  size = 48,
  online,
}: {
  name: string;
  hue?: number;
  size?: number;
  online?: boolean;
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const light = grayFromHue(hue ?? 200);
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: `hsl(0, 0%, ${light}%)`,
          },
        ]}
      >
        <Text style={[styles.letter, { fontSize: size * 0.38 }]}>{initial}</Text>
      </View>
      {online ? (
        <View
          style={[
            styles.dot,
            {
              width: Math.max(10, size * 0.28),
              height: Math.max(10, size * 0.28),
              borderRadius: 99,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  letter: { color: colors.onAccent, fontWeight: "700" },
  dot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.bg,
  },
});
