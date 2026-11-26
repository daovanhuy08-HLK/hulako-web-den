// Màn 056 Nhập từ khoá CSV (dùng importKeywordsCsv qua Server Action importCsv có kiểm quyền seo.view).
import { requirePage } from "@/lib/admin-page";
import { CsvImport } from "@/components/admin/CsvImport";
import { SeoNav } from "@/components/admin/SeoNav";
import { PageTitle } from "@/components/admin/ui";
import { importCsv } from "../../../actions/seo";

export const metadata = { title: "Nhập từ khoá CSV" };

export default async function ImportCsv() {
  await requirePage("seo.view");
  return (
    <>
      <PageTitle title="Nhập từ khóa CSV" back="/admin/seo?tab=keywords" />
      <SeoNav current="/admin/seo/import" />
      <CsvImport action={importCsv} />
    </>
  );
}
