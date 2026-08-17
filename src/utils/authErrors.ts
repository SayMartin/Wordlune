import type { TFunction } from "i18next";

// Maps Supabase auth-js error codes (see @supabase/auth-js ErrorCode) to
// translation keys, so known failures show localized text instead of
// Supabase's raw (always-English) error.message.
const ERROR_CODE_KEYS: Record<string, { key: string; defaultValue: string }> = {
  invalid_credentials: { key: "error_invalid_credentials", defaultValue: "Incorrect email or password" },
  email_not_confirmed: { key: "error_email_not_confirmed", defaultValue: "Please confirm your email before signing in" },
  email_exists: { key: "error_email_exists", defaultValue: "An account with this email already exists" },
  user_already_exists: { key: "error_email_exists", defaultValue: "An account with this email already exists" },
  weak_password: { key: "error_weak_password", defaultValue: "Password is too weak" },
  over_request_rate_limit: { key: "error_rate_limited", defaultValue: "Too many attempts. Please try again later." },
  over_email_send_rate_limit: { key: "error_rate_limited", defaultValue: "Too many attempts. Please try again later." },
};

export function translateAuthError(
  t: TFunction,
  errorCode: string | undefined,
  fallbackMessage: string | undefined,
  fallbackKey: string,
  fallbackDefault: string,
): string {
  const mapped = errorCode ? ERROR_CODE_KEYS[errorCode] : undefined;
  if (mapped) {
    return t(mapped.key, { defaultValue: mapped.defaultValue });
  }
  return fallbackMessage || t(fallbackKey, { defaultValue: fallbackDefault });
}
