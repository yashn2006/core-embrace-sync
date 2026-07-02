import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

type Lead = { id: string; name: string; stage: string; deal_value: number | null; created_at: string; won_at: string | null; lost_at: string | null; assigned_to: string | null; custom_status: string | null; progress: number | null };
type Commission = { deal_value: number; commission_amount: number; status: string; created_at: string };

export async function generateRepReport(repId: string, repName: string) {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: leads }, { data: comms }, { data: acts }] = await Promise.all([
    supabase.from("leads").select("*").eq("assigned_to", repId),
    supabase.from("commissions").select("deal_value,commission_amount,status,created_at").eq("rep_id", repId),
    supabase.from("activities").select("id,type,created_at").eq("created_by", repId).gte("created_at", since),
  ]);
  const L = (leads ?? []) as Lead[];
  const C = (comms ?? []) as Commission[];
  const A = (acts ?? []) as { id: string; type: string; created_at: string }[];

  const total = L.length;
  const won = L.filter((l) => l.stage === "won");
  const lost = L.filter((l) => l.stage === "lost").length;
  const openPipeline = L.filter((l) => !["won", "lost"].includes(l.stage)).reduce((s, l) => s + (l.deal_value ?? 0), 0);
  const wonValue = won.reduce((s, l) => s + (l.deal_value ?? 0), 0);
  const winRate = total > 0 ? Math.round((won.length / total) * 100) : 0;
  const pendingCommission = C.filter((c) => c.status === "pending").reduce((s, c) => s + Number(c.commission_amount ?? 0), 0);
  const paidCommission = C.filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.commission_amount ?? 0), 0);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = 56;

  doc.setFillColor(236, 72, 153);
  doc.rect(0, 0, w, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20);
  doc.text("Rep Performance Report", M, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text(`${repName} · Generated ${new Date().toLocaleDateString()} · Last 30 days activity`, M, y);
  y += 28;

  const kpis: Array<[string, string]> = [
    ["Total leads", String(total)],
    ["Won", `${won.length} (${winRate}%)`],
    ["Lost", String(lost)],
    ["Open pipeline", `₹${openPipeline.toLocaleString("en-IN")}`],
    ["Won value", `₹${wonValue.toLocaleString("en-IN")}`],
    ["Activities (30d)", String(A.length)],
    ["Pending commission", `₹${pendingCommission.toLocaleString("en-IN")}`],
    ["Paid commission", `₹${paidCommission.toLocaleString("en-IN")}`],
  ];
  const colW = (w - M * 2) / 4;
  kpis.forEach((k, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = M + col * colW;
    const yy = y + row * 62;
    doc.setDrawColor(230);
    doc.roundedRect(x + 4, yy, colW - 8, 54, 8, 8);
    doc.setFontSize(9);
    doc.setTextColor(140);
    doc.text(k[0], x + 14, yy + 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20);
    doc.text(k[1], x + 14, yy + 40);
    doc.setFont("helvetica", "normal");
  });
  y += 62 * Math.ceil(kpis.length / 4) + 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text("Recent wins", M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  const wins = [...won].sort((a, b) => (b.won_at ?? "").localeCompare(a.won_at ?? "")).slice(0, 8);
  if (wins.length === 0) {
    doc.setTextColor(140);
    doc.text("No wins recorded.", M, y + 14);
    y += 24;
  } else {
    wins.forEach((l) => {
      y += 16;
      if (y > 780) { doc.addPage(); y = 60; }
      doc.text(`• ${l.name} — ₹${(l.deal_value ?? 0).toLocaleString("en-IN")}`, M, y);
      doc.setTextColor(150);
      doc.text(l.won_at ? new Date(l.won_at).toLocaleDateString() : "", w - M, y, { align: "right" });
      doc.setTextColor(60);
    });
    y += 10;
  }

  y += 18;
  if (y > 720) { doc.addPage(); y = 60; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text("Coaching notes", M, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(70);
  const notes: string[] = [];
  if (winRate < 20 && total >= 5) notes.push("Win rate under 20% — review qualification & discovery calls.");
  if (A.length < 20) notes.push("Low activity volume this month — target 1+ touch per lead per week.");
  if (openPipeline < wonValue) notes.push("Pipeline < won value — refill top of funnel with new prospecting.");
  if (notes.length === 0) notes.push("Solid month. Keep momentum: focus on top 3 highest-value open leads.");
  notes.forEach((n) => { y += 14; doc.text("• " + n, M, y, { maxWidth: w - M * 2 }); });

  doc.save(`${repName.replace(/\s+/g, "_")}_report_${new Date().toISOString().slice(0, 10)}.pdf`);
}