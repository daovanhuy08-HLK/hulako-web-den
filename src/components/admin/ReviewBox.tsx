"use client";
// Hộp duyệt bài (màn 029): danh sách kiểm tra trước khi đăng + nhận xét + Yêu cầu sửa / Duyệt bài.
// Nút "Duyệt bài" chỉ bật khi đã tích đủ hạng mục; quyền thật vẫn kiểm ở máy chủ (transitionArticle).
import { useState } from "react";
import type { ActionResult } from "@/lib/admin";
import { ActionForm } from "./ActionForm";

const CHECKS = ["Nguồn thông tin", "Thao tác thực tế", "Ảnh và thiết bị", "Thông số sản phẩm", "Chính sách & liên kết mua", "Liên kết nội bộ"];

export function ReviewBox({ action, articleId, revisionId, canApprove }: {
  action: (fd: FormData) => Promise<ActionResult>; articleId: string; revisionId: string; canApprove: boolean;
}) {
  const [done, setDone] = useState<boolean[]>(CHECKS.map(() => false));
  const [reason, setReason] = useState("");
  const all = done.every(Boolean);
  return (
    <ActionForm action={action} buttons={null}>
      <input type="hidden" name="id" value={articleId} />
      <input type="hidden" name="revisionId" value={revisionId} />
      <h2 className="text-xl font-bold">Kiểm tra trước khi đăng</h2>
      <ul className="mt-3">
        {CHECKS.map((c, i) => (
          <li key={c} className="border-t border-[#EFECE8] first:border-0">
            <label className="flex items-center gap-3 py-3 text-[16px]">
              <input type="checkbox" checked={done[i]} onChange={(e) => setDone((d) => d.map((v, j) => (j === i ? e.target.checked : v)))} /> {c}
            </label>
          </li>
        ))}
      </ul>
      <h2 className="mt-6 text-xl font-bold">Nhận xét</h2>
      <textarea name="reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Nhập nhận xét… (mỗi ý một dòng)" className="input mt-3" aria-label="Nhận xét" />
      {canApprove ? (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="submit" name="action" value="request_changes" className="btn-outline" disabled={!reason.trim()} title={reason.trim() ? "" : "Nhập nhận xét để yêu cầu sửa"}>Yêu cầu sửa</button>
          <button type="submit" name="action" value="approve" className="btn-primary" disabled={!all} title={all ? "" : "Tích đủ các hạng mục kiểm tra"}>Duyệt bài</button>
        </div>
      ) : <p className="mt-4 rounded-xl bg-[#F4F1ED] p-3 text-sm">Duyệt bài cần vai trò Người duyệt nội dung.</p>}
      {!all && canApprove && <p className="mt-2 text-xs text-ink-muted">Tích đủ {CHECKS.length} hạng mục để bật nút Duyệt bài.</p>}
    </ActionForm>
  );
}
