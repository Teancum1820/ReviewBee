import type { User } from "@supabase/supabase-js";

const USERNAME_AUTH_DOMAIN = "users.reviewbee.invalid";
const USERNAME_PATTERN = /^[a-z0-9_-]{3,32}$/;

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function validateUsername(username: string) {
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername) {
    return "Enter a username.";
  }

  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    return "Use 3-32 letters, numbers, underscores, or hyphens.";
  }

  return "";
}

export function usernameToAuthEmail(username: string) {
  return `${normalizeUsername(username)}@${USERNAME_AUTH_DOMAIN}`;
}

export function usernameFromUser(user: User | null) {
  const metadataUsername = user?.user_metadata?.username;

  if (typeof metadataUsername === "string" && metadataUsername.trim()) {
    return metadataUsername;
  }

  if (user?.email?.endsWith(`@${USERNAME_AUTH_DOMAIN}`)) {
    return user.email.replace(`@${USERNAME_AUTH_DOMAIN}`, "");
  }

  return user?.email ?? "";
}
