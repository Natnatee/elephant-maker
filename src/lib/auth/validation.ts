
export function passwordError(value: string): string | null {
  return value.length < 8 || value.length > 128 ? "รหัสผ่านต้องยาว 8–128 ตัวอักษร" : null;
}

export function displayNameError(value: string): string | null {
  const name = value.trim();
  return !name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name) ? "ชื่อที่แสดงต้องยาว 1–100 ตัวอักษร และไม่มีอักขระควบคุม" : null;
}
