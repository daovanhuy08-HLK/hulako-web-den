// postgres.js trả mảng, PGlite trả {rows}. Đọc kết quả db.execute() thống nhất.
export function rowsOf<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  return ((res as { rows?: T[] }).rows ?? []) as T[];
}
