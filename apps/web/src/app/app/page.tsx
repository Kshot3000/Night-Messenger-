import type { Metadata } from "next";
import { ChatShell } from "@/components/ChatShell";

export const metadata: Metadata = {
  title: "Chats",
  description: "Explore Night Messenger: a working local messaging preview.",
};

export default function AppPage() {
  return <ChatShell />;
}
