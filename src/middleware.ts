// Chặn /admin khi chưa đăng nhập (kiểm chữ ký JWT ở edge). Quyền chi tiết vẫn kiểm lại ở máy chủ cho từng hành động.
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "hlk_admin";

// Dấu câu hay dính vào cuối link khi khách copy từ tin nhắn (vd "…/phong-nho." hoặc "…/phong-nho),")
const TRAILING_PUNCT = /[.,;:!?)\]"'”’»…]+$/;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) {
    // Trang nội dung: bỏ dấu câu thừa ở cuối rồi chuyển hướng 301 về link đúng (thay vì báo 404)
    let decoded = pathname;
    try { decoded = decodeURIComponent(pathname); } catch { /* giữ nguyên */ }
    const clean = decoded.replace(TRAILING_PUNCT, "");
    if (clean !== decoded && clean.length > 1) {
      const url = req.nextUrl.clone();
      url.pathname = clean;
      return NextResponse.redirect(url, 301);
    }
    return NextResponse.next();
  }
  if (pathname === "/admin/login" || pathname === "/admin/setup") return NextResponse.next();
  const token = req.cookies.get(COOKIE)?.value;
  const secret = process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32
    ? process.env.SESSION_SECRET : "dev-only-secret-change-me-0123456789abcdef";
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret));
      const res = NextResponse.next();
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    } catch { /* hết hạn hoặc sai chữ ký */ }
  }
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/kien-thuc/:path*", "/tin-tuc/:path*", "/thiet-bi/:path*", "/goc-livestream/:path*", "/tuyen-dung/:path*", "/ho-tro/:path*"],
};
