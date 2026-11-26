// Khối nào thiếu dữ liệu/lỗi thì ẩn khối đó thay vì làm hỏng cả trang (P01).
export async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (e) {
    console.error("[safe]", (e as Error).message);
    return fallback;
  }
}
