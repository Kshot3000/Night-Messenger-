const DISPLAY_NAME_KEY = "nm_display_name";
const ONBOARDED_KEY = "nm_onboarded";
export function getDisplayName(): string | null {
  try {
    return typeof window === "undefined"
      ? null
      : localStorage.getItem(DISPLAY_NAME_KEY);
  } catch {
    return null;
  }
}
export function setDisplayName(name: string): boolean {
  try {
    localStorage.setItem(DISPLAY_NAME_KEY, name.trim().slice(0, 32));
    return true;
  } catch {
    return false;
  }
}
export function isOnboarded(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      localStorage.getItem(ONBOARDED_KEY) === "1"
    );
  } catch {
    return false;
  }
}
export function setOnboarded(): boolean {
  try {
    localStorage.setItem(ONBOARDED_KEY, "1");
    return true;
  } catch {
    return false;
  }
}
