import type { Metadata } from "next";
import { ChatShell } from "@/components/ChatShell";

export const metadata: Metadata = {
  title: "Chats",
  description: "Night Messenger chat — selective privacy 1:1 DMs",
};

export default function AppPage() {
  return <ChatShell />;
}
