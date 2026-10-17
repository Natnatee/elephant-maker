const RESERVED_USERNAMES = new Set(["admin", "administrator", "root", "support", "system", "elephantmaker"]);

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function usernameError(value: string): string | null {
  const username = normalizeUsername(value);
  if (!/^[a-z0-9_]{3,24}$/.test(username)) return "Username ต้องยาว 3–24 ตัว ใช้ a–z, 0–9 และ _ เท่านั้น";
  if (RESERVED_USERNAMES.has(username)) return "Username นี้สงวนไว้ กรุณาเลือกชื่ออื่น";
  return null;
}

export function passwordError(value: string): string | null {
  return value.length < 8 || value.length > 128 ? "รหัสผ่านต้องยาว 8–128 ตัวอักษร" : null;
}

export function displayNameError(value: string): string | null {
  const name = value.trim();
  return !name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name) ? "ชื่อที่แสดงต้องยาว 1–100 ตัวอักษร และไม่มีอักขระควบคุม" : null;
}
