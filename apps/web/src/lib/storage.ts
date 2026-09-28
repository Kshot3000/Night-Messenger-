const DISPLAY_NAME_KEY = "nm_display_name";
const ONBOARDED_KEY = "nm_onboarded";

export function getDisplayName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DISPLAY_NAME_KEY);
}

export function setDisplayName(name: string): void {
  localStorage.setItem(DISPLAY_NAME_KEY, name.trim().slice(0, 32));
}

export function isOnboarded(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ONBOARDED_KEY) === "1";
}

export function setOnboarded(): void {
  localStorage.setItem(ONBOARDED_KEY, "1");
}
