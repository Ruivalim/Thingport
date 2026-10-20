import { prisma } from "../db";

// Kept in sync by hand with the frontend's ThemeSelection and AccentColor.
export const THEME_SELECTIONS = ["light", "dark", "system"] as const;
export type ThemeSelection = (typeof THEME_SELECTIONS)[number];
export const ACCENT_COLORS = ["green", "blue", "orange", "amber", "teal", "purple"] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];

function isThemeSelection(value: string): value is ThemeSelection {
  return (THEME_SELECTIONS as readonly string[]).includes(value);
}

function isAccentColor(value: string): value is AccentColor {
  return (ACCENT_COLORS as readonly string[]).includes(value);
}

export type ThemePreferences = { theme: ThemeSelection | null; accent: AccentColor | null };

export async function getUserThemePreferences(userId: string): Promise<ThemePreferences> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { themePreference: true, accentColor: true },
  });
  const theme = user?.themePreference;
  const accent = user?.accentColor;
  return {
    theme: theme && isThemeSelection(theme) ? theme : null,
    accent: accent && isAccentColor(accent) ? accent : null,
  };
}

/** Only the fields given change; null clears one back to the frontend's default. */
export async function setUserThemePreferences(
  userId: string,
  patch: { theme?: string | null; accent?: string | null },
): Promise<ThemePreferences> {
  const data: { themePreference?: ThemeSelection | null; accentColor?: AccentColor | null } = {};
  if (patch.theme !== undefined)
    data.themePreference = patch.theme && isThemeSelection(patch.theme) ? patch.theme : null;
  if (patch.accent !== undefined) data.accentColor = patch.accent && isAccentColor(patch.accent) ? patch.accent : null;
  await prisma.user.update({ where: { id: userId }, data });
  return getUserThemePreferences(userId);
}
