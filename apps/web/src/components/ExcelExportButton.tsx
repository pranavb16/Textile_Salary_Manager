import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { exportReport, type ExcelReport } from "../lib/export-report.js";

// Helps to download the excel sheet on clicking the 'Export Excel' button
export function ExcelExportButton({ report, disabled = false }: { report: ExcelReport; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setBusy(true);
    setError("");
    try { await exportReport(report); }
    catch { setError("Could not export the report. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="excel-export"><button type="button" className="button button-outline" aria-label={busy ? "Exporting Excel" : "Export Excel"} title="Export Excel" disabled={disabled || busy} onClick={() => void download()}><FileSpreadsheet size={17} />{busy ? "Exporting…" : "Export Excel"}</button>{error && <span role="alert">{error}</span>}</div>;
}
