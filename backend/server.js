require("dotenv").config();

const cors = require("cors");
const express = require("express");
const PDFDocument = require("pdfkit");

const app = express();

const clientOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

app.use(
  cors({
    origin: clientOrigins && clientOrigins.length > 0 ? clientOrigins : true,
    exposedHeaders: ["Content-Disposition"],
  }),
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── Forecast endpoint — proxies to Python prediction service ─────────────────
const PREDICT_URL = process.env.PREDICT_SERVICE_URL || "http://localhost:5001";

app.post("/api/forecast", async (req, res) => {
  try {
    const {
      emissions = [],
      industry = "manufacturing",
      fuel = "coal",
      production = 500,
      steps = 12,
      cap = null,
    } = req.body || {};

    const SCALE_TARGET_MAX = Number(process.env.FORECAST_SCALE_TARGET_MAX || 500);

    const toNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const emissionNums = Array.isArray(emissions)
      ? emissions.map((v) => toNumber(v)).filter((v) => v !== null)
      : [];
    const maxEmission = emissionNums.length
      ? Math.max(...emissionNums.map((v) => Math.abs(v)))
      : 0;
    const scaleFactor = maxEmission > SCALE_TARGET_MAX
      ? Math.ceil(maxEmission / SCALE_TARGET_MAX)
      : 1;

    const scaleDown = (v) => {
      const n = toNumber(v);
      return n === null ? v : n / scaleFactor;
    };

    const scaledEmissions = Array.isArray(emissions)
      ? emissions.map((v) => scaleDown(v))
      : [];
    const scaledProduction = scaleDown(production);
    const capNum = toNumber(cap);
    const scaledCap = capNum === null ? cap : capNum / scaleFactor;

    const payload = {
      emissions: scaledEmissions,
      industry,
      fuel,
      production: scaledProduction,
      steps,
      cap: scaledCap,
    };

    // Use native fetch (Node 18+) or fallback to http
    let result;
    try {
      const resp = await fetch(`${PREDICT_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Prediction service error ${resp.status}: ${txt}`);
      }
      result = await resp.json();
    } catch (fetchErr) {
      // Service unreachable — return graceful fallback
      console.warn("Prediction service unavailable:", fetchErr.message);
      return res.status(503).json({
        error: "Prediction service unavailable",
        detail: fetchErr.message,
      });
    }

    if (scaleFactor !== 1 && result) {
      if (Array.isArray(result.forecast)) {
        result.forecast = result.forecast.map((v) => Number(v) * scaleFactor);
      }
      if (typeof result.next === "number") {
        result.next = result.next * scaleFactor;
      }
      if (typeof result.input_last === "number") {
        result.input_last = result.input_last * scaleFactor;
      }
      if (result.compliance) {
        const c = result.compliance;
        if (typeof c.cap === "number") c.cap *= scaleFactor;
        if (typeof c.cumulative_forecast === "number")
          c.cumulative_forecast *= scaleFactor;
        if (typeof c.avg_forecast === "number") c.avg_forecast *= scaleFactor;
      }
      result.scaleFactorApplied = scaleFactor;
    }

    res.json(result);
  } catch (err) {
    console.error("Forecast endpoint error:", err);
    res.status(500).json({ error: err?.message || "Forecast failed" });
  }
});

const fmtDate = (v) => {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (isNaN(d)) return "—";

    // Convert UTC hours/minutes
    // Or just use local string
    return d
      .toLocaleString("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .replace(",", "");
  } catch {
    return "—";
  }
};

const fmtNum = (v, decimals = 2) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
};

const truncHash = (h) =>
  h && h.length > 14 ? `${h.slice(0, 8)}...${h.slice(-6)}` : h || "—";

app.post("/api/reports/pdf", (req, res) => {
  try {
    const {
      company = {},
      range = {},
      summary = {},
      activities: rawActivities = [],
      emissionLogs: rawEmissionLogs = [],
      blockchainRecords: rawBlockchain = [],
      emissionTrend: rawTrend = [],
    } = req.body || {};

    const activities = Array.isArray(rawActivities) ? rawActivities : [];
    const emissionLogs = Array.isArray(rawEmissionLogs) ? rawEmissionLogs : [];
    const blockchainRecords = Array.isArray(rawBlockchain) ? rawBlockchain : [];
    const trend = Array.isArray(rawTrend) ? rawTrend : [];

    const companyName = company.name || "Carbon Company";
    const generatedAt = new Date();
    const from = range.from ? new Date(range.from) : null;
    const to = range.to ? new Date(range.to) : null;

    const safeName =
      companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "report";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}-compliance-report.pdf"`,
    );

    const doc = new PDFDocument({ margin: 0, size: "A4", autoFirstPage: true });
    doc.pipe(res);

    const PW = doc.page.width;
    const PH = doc.page.height;
    const ML = 50;
    const MR = 50;
    const MT = 50;
    const MB = 50;
    const CW = PW - ML - MR;

    const C = {
      navy: "#0f172a",
      navyMid: "#1e3a5f",
      green: "#10b981",
      orange: "#f97316",
      red: "#ef4444",
      lightBg: "#f8fafc",
      headerBg: "#f1f5f9",
      border: "#cbd5e1",
      textDark: "#1e293b",
      textMid: "#475569",
      textLight: "#94a3b8",
      white: "#ffffff",
    };

    let _pageNum = 0;

    const drawFooter = () => {
      _pageNum += 1;
      const fy = PH - 28;
      doc.save();
      doc
        .moveTo(ML, fy - 6)
        .lineTo(PW - MR, fy - 6)
        .strokeColor(C.border)
        .lineWidth(0.5)
        .stroke();
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(C.textLight)
        .text(
          `Generated: ${generatedAt.toISOString().slice(0, 19).replace("T", " ")} UTC  |  CarboCoin Blockchain Compliance System`,
          ML,
          fy,
          { width: CW - 60, lineBreak: false },
        )
        .text(`Page ${_pageNum}`, ML, fy, {
          width: CW,
          align: "right",
          lineBreak: false,
        });
      doc.restore();
    };

    const newPage = (skipFooter = false) => {
      if (!skipFooter) drawFooter();
      doc.addPage({ margin: 0, size: "A4" });
    };

    const ensureSpace = (needed) => {
      if (doc.y + needed > PH - MB - 20) newPage();
    };

    const sectionTitle = (title, opts = {}) => {
      if (opts.newPageBefore) {
        newPage();
        doc.y = MT;
      } else {
        ensureSpace(36);
        doc.y += 10;
      }
      const ty = doc.y;
      doc.save();
      doc.rect(ML, ty, 4, 18).fillColor(C.green).fill();
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(C.navy)
        .text(title, ML + 12, ty + 2, { lineBreak: false });
      doc.restore();
      doc.y = ty + 18;
      doc.save();
      doc
        .moveTo(ML, doc.y + 4)
        .lineTo(PW - MR, doc.y + 4)
        .strokeColor(C.border)
        .lineWidth(0.5)
        .stroke();
      doc.restore();
      doc.y += 10;
    };

    const metricGrid = (items) => {
      const cols = 3;
      const gap = 8;
      const cardW = (CW - gap * (cols - 1)) / cols;
      const cardH = 52;
      ensureSpace(cardH + 16);
      const startY = doc.y;
      items.forEach((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = ML + col * (cardW + gap);
        const cy = startY + row * (cardH + gap);
        const isGood = item.good === true;
        const isBad = item.good === false;
        const accentColor = isGood ? C.green : isBad ? C.red : C.navyMid;
        doc.save();
        doc.rect(cx, cy, cardW, cardH).fillColor(C.lightBg).fill();
        doc
          .rect(cx, cy, cardW, cardH)
          .strokeColor(C.border)
          .lineWidth(0.5)
          .stroke();
        doc.rect(cx, cy, cardW, 3).fillColor(accentColor).fill();
        doc
          .font("Helvetica")
          .fontSize(7.5)
          .fillColor(C.textMid)
          .text(item.label, cx + 8, cy + 10, {
            width: cardW - 16,
            lineBreak: false,
          });
        doc
          .font("Helvetica-Bold")
          .fontSize(13)
          .fillColor(C.textDark)
          .text(item.value, cx + 8, cy + 22, {
            width: cardW - 16,
            lineBreak: false,
          });
        if (item.sub) {
          doc
            .font("Helvetica")
            .fontSize(7.5)
            .fillColor(C.textLight)
            .text(item.sub, cx + 8, cy + 39, {
              width: cardW - 16,
              lineBreak: false,
            });
        }
        doc.restore();
      });
      const rows = Math.ceil(items.length / cols);
      doc.y = startY + rows * (cardH + gap) + 6;
    };

    const drawTable = (columns, rows) => {
      if (rows.length === 0) {
        doc.save();
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(C.textLight)
          .text("No records in this period.", ML, doc.y, { width: CW });
        doc.restore();
        doc.y += 12;
        return;
      }

      const rowH = 18;
      const hdrH = 20;
      const left = ML;
      const right = PW - MR;
      const totalW = CW;

      const drawHeader = (startY) => {
        doc.save();
        doc.rect(left, startY, totalW, hdrH).fillColor(C.headerBg).fill();
        doc
          .moveTo(left, startY)
          .lineTo(right, startY)
          .strokeColor(C.border)
          .lineWidth(0.5)
          .stroke();
        doc
          .moveTo(left, startY + hdrH)
          .lineTo(right, startY + hdrH)
          .strokeColor(C.border)
          .lineWidth(0.75)
          .stroke();
        let hx = left;
        columns.forEach((col) => {
          doc
            .font("Helvetica-Bold")
            .fontSize(8)
            .fillColor(C.textMid)
            .text(col.label, hx + 4, startY + 6, {
              width: col.width - 8,
              align: col.align || "left",
              lineBreak: false,
            });
          hx += col.width;
        });
        doc.restore();
      };

      ensureSpace(hdrH + rowH);
      let curY = doc.y;
      drawHeader(curY);
      curY += hdrH;

      rows.forEach((row, idx) => {
        if (curY + rowH > PH - MB - 10) {
          drawFooter();
          doc.addPage({ margin: 0, size: "A4" });
          _pageNum += 1;
          curY = MT;
          drawHeader(curY);
          curY += hdrH;
        }

        if (idx % 2 === 1) {
          doc.save();
          doc.rect(left, curY, totalW, rowH).fillColor("#f8fafc").fill();
          doc.restore();
        }

        doc.save();
        doc
          .moveTo(left, curY + rowH)
          .lineTo(right, curY + rowH)
          .strokeColor(C.border)
          .lineWidth(0.3)
          .stroke();
        doc.restore();

        let cx = left;
        columns.forEach((col) => {
          doc.save();
          const val = row[col.key] != null ? String(row[col.key]) : "—";
          if (col.isTxLink && val !== "—" && row.rawTxHash) {
            const url = `https://sepolia.etherscan.io/tx/${row.rawTxHash}`;
            doc
              .font("Helvetica")
              .fontSize(8)
              .fillColor(C.navy)
              .text(val, cx + 4, curY + 5, {
                width: col.width - 8,
                align: col.align || "left",
                lineBreak: false,
                underline: true,
              });
            const tw = doc.widthOfString(val, { size: 8 });
            const alignOffset = col.align === "right" ? col.width - 8 - tw : 0;
            doc.link(cx + 4 + alignOffset, curY + 5, tw, 10, url);
          } else {
            doc
              .font("Helvetica")
              .fontSize(8)
              .fillColor(C.textDark)
              .text(val, cx + 4, curY + 5, {
                width: col.width - 8,
                align: col.align || "left",
                lineBreak: false,
              });
          }
          doc.restore();
          cx += col.width;
        });

        curY += rowH;
      });

      doc.y = curY + 8;
    };

    const drawLineChart = ({ data, x, y, w, h, cap }) => {
      const values = data.map((d) => {
        const parsed = Number(d.value);
        return isFinite(parsed) ? parsed : 0;
      });
      const n = values.length;

      doc.save();
      doc.rect(x, y, w, h).strokeColor(C.border).lineWidth(0.5).stroke();

      if (n === 0) {
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(C.textLight)
          .text("No emission data in this period", x, y + h / 2 - 6, {
            width: w,
            align: "center",
          });
        doc.restore();
        return;
      }

      const maxVal = Math.max(...values, cap || 0, 1);
      const minVal = 0;
      const range2 = maxVal - minVal || 1;

      for (let i = 1; i <= 4; i++) {
        const gy = y + (i / 5) * h;
        doc
          .moveTo(x, gy)
          .lineTo(x + w, gy)
          .strokeColor("#f1f5f9")
          .lineWidth(0.5)
          .stroke();
        const gridVal = maxVal - (i / 5) * range2;
        doc
          .font("Helvetica")
          .fontSize(6.5)
          .fillColor(C.textLight)
          .text(fmtNum(gridVal, 0), x - 36, gy - 4, {
            width: 32,
            align: "right",
            lineBreak: false,
          });
      }

      if (cap && cap > 0) {
        const capY = y + h - ((cap - minVal) / range2) * h;
        doc
          .moveTo(x, capY)
          .lineTo(x + w, capY)
          .strokeColor(C.orange)
          .dash(4, { space: 3 })
          .lineWidth(1)
          .stroke()
          .undash();
        doc
          .font("Helvetica")
          .fontSize(7.5)
          .fillColor(C.orange)
          .text(`Cap: ${fmtNum(cap, 0)} kg`, x + w - 80, capY - 10, {
            width: 80,
            align: "right",
            lineBreak: false,
          });
      }

      const scaleX = n > 1 ? w / (n - 1) : 0;
      const scaleY = h / range2;

      doc.moveTo(x, y + h - (values[0] - minVal) * scaleY);
      for (let i = 1; i < n; i++) {
        doc.lineTo(x + i * scaleX, y + h - (values[i] - minVal) * scaleY);
      }
      doc.strokeColor(C.green).lineWidth(1.5).stroke();

      if (n <= 30) {
        values.forEach((v, i) => {
          const px = x + i * scaleX;
          const py = y + h - (v - minVal) * scaleY;
          doc.circle(px, py, 2.5).fillColor(C.green).fill();
        });
      }

      const step = Math.ceil(n / 8);
      for (let i = 0; i < n; i += step) {
        const px = x + i * scaleX;
        const lbl =
          data[i].label || data[i].name || fmtDate(data[i].timestamp) || "";
        doc
          .font("Helvetica")
          .fontSize(6.5)
          .fillColor(C.textLight)
          .text(lbl, px - 18, y + h + 3, {
            width: 36,
            align: "center",
            lineBreak: false,
          });
      }

      doc.restore();
    };

    const drawBarChart = ({ items, x, y, w }) => {
      const barH = 20;
      const gap = 14;
      const labelW = 110;
      const barAreaW = Math.max(w - labelW - 70, 0);

      const safeItems = items.map((it) => ({
        ...it,
        safeValue: isFinite(Number(it.value)) ? Number(it.value) : 0,
      }));

      const maxVal = Math.max(...safeItems.map((it) => it.safeValue), 1);

      doc.save();
      safeItems.forEach((item, i) => {
        const by = y + i * (barH + gap);
        const val = item.safeValue;
        const bw = Math.max((val / maxVal) * barAreaW, 0);

        doc
          .rect(x + labelW, by, barAreaW, barH)
          .fillColor("#f1f5f9")
          .fill();

        if (bw > 0) {
          doc
            .rect(x + labelW, by, bw, barH)
            .fillColor(item.color || C.green)
            .fill();
        }

        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(C.textDark)
          .text(item.label, x, by + 5, {
            width: labelW - 6,
            align: "right",
            lineBreak: false,
          });

        doc
          .font("Helvetica-Bold")
          .fontSize(8.5)
          .fillColor(C.textDark)
          .text(
            item.valueLabel || fmtNum(item.value),
            x + labelW + bw + 8,
            by + 6,
            {
              lineBreak: false,
            },
          );
      });
      doc.restore();
    };

    // =========================================================================
    // COVER PAGE
    // =========================================================================

    doc.rect(0, 0, PW, 200).fillColor(C.navy).fill();
    doc.rect(0, 200, PW, 6).fillColor(C.green).fill();

    doc
      .font("Helvetica-Bold")
      .fontSize(24)
      .fillColor(C.white)
      .text("CARBON EMISSION", ML, 48, { lineBreak: false });
    doc
      .font("Helvetica-Bold")
      .fontSize(24)
      .fillColor(C.green)
      .text("COMPLIANCE REPORT", ML, 78, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#94a3b8")
      .text("Blockchain-Verified Emission & Credit Activity", ML, 112, {
        lineBreak: false,
      });

    doc.save();
    doc.rect(ML, 140, CW, 48).fillColor("rgba(255,255,255,0.05)").fill();
    doc
      .rect(ML, 140, CW, 48)
      .strokeColor("rgba(255,255,255,0.12)")
      .lineWidth(0.5)
      .stroke();
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor(C.white)
      .text(companyName, ML + 12, 151, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#94a3b8")
      .text(
        `${company.industry || "Industry N/A"}  |  Wallet: ${company.walletAddress ? truncHash(company.walletAddress) : "—"}`,
        ML + 12,
        168,
        { lineBreak: false },
      );
    doc.restore();

    const infoY = 224;
    const infoItems = [
      {
        label: "Reporting Period",
        value: `${fmtDate(from)} to ${fmtDate(to)}`,
      },
      {
        label: "Report Generated",
        value:
          generatedAt.toISOString().slice(0, 16).replace("T", " ") + " UTC",
      },
      {
        label: "Compliance Status",
        value: summary.complianceStatus || "See Analysis",
      },
    ];
    const infoColW = CW / infoItems.length;
    infoItems.forEach((item, i) => {
      const ix = ML + i * infoColW;
      doc.save();
      doc
        .rect(ix + 2, infoY, infoColW - 4, 54)
        .fillColor(C.lightBg)
        .fill();
      doc
        .rect(ix + 2, infoY, infoColW - 4, 54)
        .strokeColor(C.border)
        .lineWidth(0.5)
        .stroke();
      doc
        .rect(ix + 2, infoY, infoColW - 4, 3)
        .fillColor(C.green)
        .fill();
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(C.textMid)
        .text(item.label, ix + 10, infoY + 10, {
          width: infoColW - 20,
          lineBreak: false,
        });
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(C.textDark)
        .text(item.value, ix + 10, infoY + 24, {
          width: infoColW - 20,
          lineBreak: false,
        });
      doc.restore();
    });

    doc
      .moveTo(ML, infoY + 66)
      .lineTo(PW - MR, infoY + 66)
      .strokeColor(C.border)
      .lineWidth(0.5)
      .stroke();

    const tocY = infoY + 80;
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(C.navy)
      .text("Contents", ML, tocY);
    const toc = [
      "1.  Executive Summary",
      "2.  Emission Analysis",
      "3.  Carbon Credit Summary",
      "4.  Credit Activity Log",
      "5.  Emission Sensor Logs",
      "6.  Blockchain Verification Records",
      "7.  Compliance Declaration",
    ];
    toc.forEach((item, i) => {
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(C.textMid)
        .text(item, ML + 12, tocY + 20 + i * 18, { lineBreak: false });
    });

    doc.save();
    doc
      .rect(0, PH - 40, PW, 40)
      .fillColor(C.navy)
      .fill();
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#64748b")
      .text(
        `Generated ${generatedAt.toISOString().slice(0, 19).replace("T", " ")} UTC  ·  CarboCoin Blockchain Compliance Platform`,
        ML,
        PH - 24,
        { width: CW, align: "center", lineBreak: false },
      );
    doc.restore();

    // =========================================================================
    // PAGE 2 — Executive Summary
    // =========================================================================
    newPage(true);
    doc.y = MT;

    sectionTitle("1. Executive Summary");

    const totalEmissions = Number(summary.totalEmissions || 0);
    const emissionCap = Number(summary.emissionCap || 0);
    const remaining = Number(
      summary.remainingAllowance != null
        ? summary.remainingAllowance
        : emissionCap > 0
          ? emissionCap - totalEmissions
          : 0,
    );
    const isCompliant = emissionCap > 0 ? totalEmissions <= emissionCap : null;
    const creditsIssued = Number(
      summary.creditsIssued != null
        ? summary.creditsIssued
        : summary.totalMinted != null
          ? summary.totalMinted
          : 0,
    );
    const creditsUsed = Number(
      summary.creditsUsed != null
        ? summary.creditsUsed
        : summary.totalBurned != null
          ? summary.totalBurned
          : 0,
    );
    const creditBalance = Number(summary.creditBalance || 0);
    const outstandingDebt = Number(
      summary.outstandingDebt != null ? summary.outstandingDebt : 0,
    );

    metricGrid([
      {
        label: "Total Emissions (Period)",
        value: `${fmtNum(totalEmissions)} kg`,
        sub: `${fmtDate(from)} — ${fmtDate(to)}`,
        good:
          isCompliant === true
            ? true
            : isCompliant === false
              ? false
              : undefined,
      },
      {
        label: "Emission Cap",
        value: emissionCap > 0 ? `${fmtNum(emissionCap)} kg` : "Not Set",
        sub: emissionCap > 0 ? "Authorised allowance" : "Contact administrator",
      },
      {
        label: "Remaining Allowance",
        value: emissionCap > 0 ? `${fmtNum(Math.max(0, remaining))} kg` : "—",
        sub:
          emissionCap > 0
            ? remaining >= 0
              ? "Within cap"
              : "Cap exceeded"
            : "—",
        good: emissionCap > 0 ? remaining >= 0 : undefined,
      },
      {
        label: "Credits Issued (CCT)",
        value: `${fmtNum(creditsIssued)}`,
        sub: "Carbon Credit Tokens minted",
      },
      {
        label: "Credits Used / Burned",
        value: `${fmtNum(creditsUsed)}`,
        sub: "Offset against emissions",
      },
      {
        label: "Wallet Credit Balance",
        value: `${fmtNum(creditBalance)} CCT`,
        sub:
          outstandingDebt > 0
            ? `Debt: ${fmtNum(outstandingDebt)} CCT`
            : "No outstanding debt",
        good: outstandingDebt === 0,
      },
    ]);

    doc.y += 6;
    ensureSpace(80);
    const narBoxY = doc.y;
    doc.save();
    doc.rect(ML, narBoxY, CW, 72).fillColor(C.lightBg).fill();
    doc.rect(ML, narBoxY, CW, 72).strokeColor(C.border).lineWidth(0.5).stroke();
    doc
      .rect(ML, narBoxY, 4, 72)
      .fillColor(isCompliant === false ? C.red : C.green)
      .fill();
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(C.textDark)
      .text("Summary", ML + 14, narBoxY + 10, { lineBreak: false });
    const statusText =
      isCompliant === true
        ? "COMPLIANT — emissions are within the authorised cap."
        : isCompliant === false
          ? "NON-COMPLIANT — emissions exceed the authorised cap."
          : "Compliance status indeterminate (cap not configured).";
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(C.textMid)
      .text(
        `${statusText} ${creditsIssued > 0 ? fmtNum(creditsIssued) + " CCT were issued" : "No credits were issued"} ` +
          `during this period. ${creditsUsed > 0 ? fmtNum(creditsUsed) + " CCT were retired (burned) to offset emissions." : ""} ` +
          `Total blockchain activity: ${summary.activityCount != null ? summary.activityCount : activities.length} record(s).`,
        ML + 14,
        narBoxY + 24,
        { width: CW - 24 },
      );
    doc.restore();
    doc.y = narBoxY + 80;

    // =========================================================================
    // Emission Analysis
    // =========================================================================
    sectionTitle("2. Emission Analysis", { newPageBefore: true });

    const chartH = 150;
    ensureSpace(chartH + 70);
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(C.textMid)
      .text("Emission Trend (kg CO2e)", ML, doc.y, { lineBreak: false });
    doc.y += 16;

    drawLineChart({
      data: trend.map((d) => ({
        value: Number(d.value || 0),
        label: d.label || d.name || fmtDate(d.timestamp),
        timestamp: d.timestamp,
      })),
      x: ML + 42,
      y: doc.y,
      w: CW - 42,
      h: chartH,
      cap: emissionCap > 0 ? emissionCap : undefined,
    });

    doc.y += chartH + 32;

    ensureSpace(100);
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(C.textMid)
      .text("Cap vs Actual Emissions", ML, doc.y, { lineBreak: false });
    doc.y += 14;

    drawBarChart({
      items: [
        {
          label: "Emission Cap",
          value: emissionCap,
          valueLabel: emissionCap > 0 ? `${fmtNum(emissionCap)} kg` : "Not Set",
          color: "#cbd5e1",
        },
        {
          label: "Actual Emissions",
          value: totalEmissions,
          valueLabel: `${fmtNum(totalEmissions)} kg`,
          color: isCompliant === false ? C.red : C.green,
        },
      ],
      x: ML,
      y: doc.y,
      w: CW,
    });
    doc.y += 88;

    // =========================================================================
    // Carbon Credit Summary
    // =========================================================================
    sectionTitle("3. Carbon Credit Summary", { newPageBefore: true });

    drawTable(
      [
        { key: "metric", label: "Metric", width: CW * 0.5 },
        { key: "value", label: "Value", width: CW * 0.28, align: "right" },
        { key: "note", label: "Notes", width: CW * 0.22 },
      ],
      [
        {
          metric: "Credits Issued (Minted)",
          value: `${fmtNum(creditsIssued)} CCT`,
          note: "On-chain minted",
        },
        {
          metric: "Credits Used (Burned)",
          value: `${fmtNum(creditsUsed)} CCT`,
          note: "Retired / offset",
        },
        {
          metric: "Net Credits",
          value: `${fmtNum(creditsIssued - creditsUsed)} CCT`,
          note: "Issued minus used",
        },
        {
          metric: "Outstanding Debt",
          value: `${fmtNum(outstandingDebt)} CCT`,
          note: outstandingDebt > 0 ? "Owed — action req." : "Clear",
        },
        {
          metric: "Current Wallet Balance",
          value: `${fmtNum(creditBalance)} CCT`,
          note: "Live on-chain",
        },
        {
          metric: "IoT Sensor Readings",
          value: fmtNum(
            summary.measurementsCount != null
              ? summary.measurementsCount
              : emissionLogs.length,
            0,
          ),
          note: "Sensor data points",
        },
        {
          metric: "Blockchain Transactions",
          value: fmtNum(blockchainRecords.length, 0),
          note: "Verified records",
        },
        {
          metric: "Credit Activity Events",
          value: fmtNum(activities.length, 0),
          note: "Mint/burn events",
        },
      ],
    );

    // =========================================================================
    // Credit Activity Log
    // =========================================================================
    sectionTitle("4. Credit Activity Log", { newPageBefore: true });

    drawTable(
      [
        { key: "date", label: "Date", width: CW * 0.15 },
        { key: "type", label: "Type", width: CW * 0.09 },
        { key: "minted", label: "Minted", width: CW * 0.12, align: "right" },
        { key: "burned", label: "Burned", width: CW * 0.12, align: "right" },
        { key: "debt", label: "Debt", width: CW * 0.12, align: "right" },
        {
          key: "emission",
          label: "Emission",
          width: CW * 0.14,
          align: "right",
        },
        { key: "ref", label: "Tx / Batch", width: CW * 0.26 },
      ],
      activities.map((a) => ({
        date: fmtDate(a.createdAt),
        type: (a.type || "").toUpperCase(),
        minted: Number(a.minted) > 0 ? fmtNum(a.minted) : "—",
        burned: Number(a.burned) > 0 ? fmtNum(a.burned) : "—",
        debt: Number(a.owedBalance) > 0 ? fmtNum(a.owedBalance) : "—",
        emission: a.emissionKg != null ? `${fmtNum(a.emissionKg)} kg` : "—",
        ref: a.txHash
          ? truncHash(a.txHash)
          : a.batchId
            ? truncHash(a.batchId)
            : "—",
      })),
    );

    // =========================================================================
    // Emission Sensor Logs
    // =========================================================================
    sectionTitle("5. Emission Sensor Logs", { newPageBefore: true });

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(C.navy)
      .text("5.1 Aggregated Submissions (10-Minute Batches)", ML, doc.y + 10);
    doc.y += 10;

    drawTable(
      [
        { key: "date", label: "Timestamp", width: CW * 0.26 },
        { key: "sensor", label: "Source", width: CW * 0.22 },
        {
          key: "emission",
          label: "Emission (kg)",
          width: CW * 0.18,
          align: "right",
        },
        {
          key: "txHash",
          label: "Transaction Hash",
          width: CW * 0.34,
          isTxLink: true,
        },
      ],
      (req.body.batchEmissionLogs || []).map((log) => ({
        date: log.timestamp ? fmtDate(log.timestamp) : "—",
        sensor: log.sensorId || "IoT Aggregation",
        emission: fmtNum(log.emission || 0),
        txHash: log.txHash && log.txHash !== "—" ? truncHash(log.txHash) : "—",
        rawTxHash: log.txHash !== "—" ? log.txHash : null,
      })),
    );

    ensureSpace(60);
    doc.y += 15;
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(C.navy)
      .text("5.2 Raw Sensor Readings (1-Minute Intervals)", ML, doc.y);
    doc.y += 10;

    drawTable(
      [
        { key: "date", label: "Timestamp", width: CW * 0.26 },
        { key: "sensor", label: "Sensor ID", width: CW * 0.22 },
        {
          key: "emission",
          label: "Emission (kg)",
          width: CW * 0.18,
          align: "right",
        },
        { key: "batchId", label: "Local Batch ID", width: CW * 0.34 },
      ],
      (req.body.rawEmissionLogs || rawEmissionLogs || []).map((log) => ({
        date: log.timestamp ? fmtDate(log.timestamp) : "—",
        sensor: log.sensorId || "IoT Sensor",
        emission: fmtNum(log.emission || 0),
        batchId:
          log.batchId && log.batchId !== "—"
            ? truncHash(log.batchId)
            : log.dataHash
              ? truncHash(log.dataHash)
              : "—",
      })),
    );

    // =========================================================================
    // Blockchain Verification Records
    // =========================================================================
    sectionTitle("6. Blockchain Verification Records", {
      newPageBefore: true,
    });

    drawTable(
      [
        { key: "date", label: "Timestamp", width: CW * 0.18 },
        { key: "dataHash", label: "Data Hash", width: CW * 0.22 },
        {
          key: "txHash",
          label: "Transaction Hash",
          width: CW * 0.3,
          isTxLink: true,
        },
        {
          key: "block",
          label: "Block #",
          width: CW * 0.14,
          align: "right",
        },
        { key: "status", label: "Status", width: CW * 0.16 },
      ],
      blockchainRecords.map((r) => ({
        date: fmtDate(r.timestamp),
        dataHash: truncHash(r.dataHash),
        txHash: truncHash(r.txHash),
        rawTxHash: r.txHash,
        block: r.blockNumber != null ? String(r.blockNumber) : "—",
        status: r.status || "Verified",
      })),
    );

    // =========================================================================
    // Compliance Declaration
    // =========================================================================
    sectionTitle("7. Compliance Declaration", { newPageBefore: true });

    ensureSpace(130);
    const declY = doc.y;
    doc.save();
    doc.rect(ML, declY, CW, 116).fillColor(C.lightBg).fill();
    doc.rect(ML, declY, CW, 116).strokeColor(C.border).lineWidth(0.5).stroke();
    doc
      .rect(ML, declY, 4, 116)
      .fillColor(isCompliant === false ? C.red : C.green)
      .fill();
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(C.textDark)
      .text("Declaration of Compliance", ML + 14, declY + 12, {
        lineBreak: false,
      });
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(C.textMid)
      .text(
        `This report documents the carbon emissions and credit activity for ${companyName} ` +
          `for the period ${fmtDate(from)} to ${fmtDate(to)}. All emission data has been ` +
          `recorded via IoT sensors and verified on the blockchain. Carbon credit transactions ` +
          `have been executed on-chain and are immutably recorded.\n\n` +
          `Compliance Status: ${summary.complianceStatus || "See emission analysis above."}\n` +
          `Total Emissions: ${fmtNum(totalEmissions)} kg  |  ` +
          `Emission Cap: ${emissionCap > 0 ? fmtNum(emissionCap) + " kg" : "Not configured"}  |  ` +
          `Credits Issued: ${fmtNum(creditsIssued)} CCT  |  Credits Used: ${fmtNum(creditsUsed)} CCT`,
        ML + 14,
        declY + 28,
        { width: CW - 28 },
      );
    doc.restore();
    doc.y = declY + 124;

    ensureSpace(30);
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(C.textLight)
      .text(
        "This report was automatically generated by the CarboCoin Blockchain Carbon Credit Monitoring system. " +
          "All blockchain transactions are independently verifiable on the respective public network.",
        ML,
        doc.y,
        { width: CW },
      );

    drawFooter();
    doc.end();
  } catch (err) {
    console.error("Failed to generate PDF:", err);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: "Unable to generate PDF", detail: err?.message });
    }
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
