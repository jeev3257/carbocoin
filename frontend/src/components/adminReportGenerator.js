import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const primaryText = [22, 27, 34];
const secondaryText = [90, 102, 120];
const accent = [16, 185, 129];
const danger = [239, 68, 68];
const tableHead = [243, 244, 246];
const tableBorder = [209, 213, 219];

const formatNumber = (value, maximumFractionDigits = 2) => {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return "--";
    return numeric.toLocaleString(undefined, { maximumFractionDigits });
};

const formatDateTime = (ms) => {
    if (!ms) return "—";
    return new Date(ms).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
    });
};

const drawSparkline = (doc, series, { x, y, width, height, color = accent }) => {
    const sorted = (series || [])
        .filter((entry) => Number.isFinite(entry?.value) && Number.isFinite(entry?.tsMs))
        .sort((a, b) => a.tsMs - b.tsMs);

    if (sorted.length < 2) {
        doc.setTextColor(...secondaryText);
        doc.setFontSize(10);
        doc.text("No emission readings available", x, y + height / 2);
        return;
    }

    const values = sorted.map((entry) => entry.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);

    const points = values.map((value, idx) => {
        const px = x + (idx / (values.length - 1)) * width;
        const py = y + height - ((value - min) / range) * height;
        return [px, py];
    });

    doc.setDrawColor(...color);
    doc.setLineWidth(1);
    for (let i = 0; i < points.length - 1; i += 1) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[i + 1];
        doc.line(x1, y1, x2, y2);
    }

    doc.setFillColor(...color);
    doc.circle(points[points.length - 1][0], points[points.length - 1][1], 2, "F");
};

const drawBarComparison = (doc, { x, y, width, height, minted, burned }) => {
    const maxValue = Math.max(minted, burned, 1);
    const barWidth = width / 3;

    const mintedHeight = (minted / maxValue) * height;
    const burnedHeight = (burned / maxValue) * height;

    doc.setFillColor(...accent);
    doc.rect(x, y + (height - mintedHeight), barWidth, mintedHeight, "F");
    doc.setTextColor(...secondaryText);
    doc.setFontSize(9);
    doc.text(`${formatNumber(minted, 0)} minted`, x, y + height + 14);

    doc.setFillColor(...danger);
    doc.rect(x + barWidth + 18, y + (height - burnedHeight), barWidth, burnedHeight, "F");
    doc.text(`${formatNumber(burned, 0)} burned`, x + barWidth + 18, y + height + 14);
};

const coverPage = (doc, { filters, companyCount }) => {
    doc.setLineHeightFactor(1.35);
    doc.setTextColor(...primaryText);
    doc.setFontSize(24);
    doc.text("CarboCoin Compliance Report", 48, 80);

    doc.setFontSize(12);
    doc.setTextColor(...secondaryText);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 48, 110);
    doc.text(`Company selection: ${companyCount} company record(s)`, 48, 126);
    doc.text(`Date range: ${filters.start || "Any"} → ${filters.end || "Any"}`, 48, 142);
    doc.text(`Status filter: ${filters.status || "All"}`, 48, 158);
    doc.text(`Search filter: ${filters.search || "None"}`, 48, 174);

    doc.setDrawColor(...accent);
    doc.setLineWidth(0.6);
    doc.line(48, 190, 360, 190);

    doc.setFontSize(14);
    doc.setTextColor(...primaryText);
    doc.text("What this report includes", 48, 214);
    doc.setFontSize(11);
    doc.setTextColor(...secondaryText);
    const bullets = [
        "Per-company emissions with timestamps and units",
        "All carbon credit mints/burns with hashes",
        "Net balances and last on-chain activity",
        "Mini charts for emissions trend and credit flow",
        "Filters applied to this export for audit traceability",
    ];
    doc.setFillColor(...accent);
    bullets.forEach((text, idx) => {
        doc.circle(50, 230 + idx * 18 - 3, 2, "F");
        doc.text(text, 60, 230 + idx * 18, { maxWidth: 420 });
    });
};

const summaryPage = (doc, summaryRows) => {
    const totalEmissions = summaryRows.reduce((sum, row) => sum + (Number(row.emissionTotal) || 0), 0);
    const totalMinted = summaryRows.reduce((sum, row) => sum + (Number(row.totalMinted) || 0), 0);
    const totalBurned = summaryRows.reduce((sum, row) => sum + (Number(row.totalBurned) || 0), 0);
    const net = totalMinted - totalBurned;
    const marginX = 48;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - marginX * 2;

    doc.addPage();
    doc.setTextColor(...primaryText);
    doc.setFontSize(18);
    doc.text("Portfolio Summary", 48, 64);

    doc.setFontSize(11);
    doc.setTextColor(...secondaryText);
    doc.text(`Companies included: ${summaryRows.length}`, 48, 84);

    const kpiY = 110;
    const cards = [
        { label: "Total emissions", value: `${formatNumber(totalEmissions)} (mixed units)` },
        { label: "Carbon credits minted", value: formatNumber(totalMinted, 0) },
        { label: "Carbon credits burned", value: formatNumber(totalBurned, 0) },
        { label: "Net credits", value: formatNumber(net, 0) },
    ];

    const cardWidth = (contentWidth - 24) / 2;
    const cardHeight = 72;
    cards.forEach((card, idx) => {
        const row = Math.floor(idx / 2);
        const col = idx % 2;
        const x = marginX + col * (cardWidth + 12);
        const y = kpiY + row * (cardHeight + 12);
        doc.setDrawColor(...tableBorder);
        doc.rect(x, y, cardWidth, cardHeight);
        doc.setTextColor(...secondaryText);
        doc.setFontSize(10);
        doc.text(card.label, x + 10, y + 18, { maxWidth: cardWidth - 20 });
        doc.setTextColor(...primaryText);
        doc.setFontSize(12);
        doc.text(card.value, x + 10, y + 40, { maxWidth: cardWidth - 20 });
    });

    autoTable(doc, {
        startY: kpiY + cardHeight * 2 + 24,
        head: [["Company", "Status", "Emissions", "Minted", "Burned", "Net", "Last Activity"]],
        body: summaryRows.map((row) => [
            row.companyName,
            (row.status || "").toUpperCase(),
            row.emissionCount ? `${formatNumber(row.emissionTotal)} ${row.emissionUnit}` : "—",
            formatNumber(row.totalMinted, 0),
            formatNumber(row.totalBurned, 0),
            formatNumber(row.netTokens, 0),
            row.lastActivity ? formatDateTime(row.lastActivity) : "—",
        ]),
        theme: "grid",
        styles: { fontSize: 9, textColor: primaryText, overflow: "linebreak", cellPadding: 6, minCellHeight: 14 },
        headStyles: { fillColor: tableHead, textColor: primaryText, halign: "left" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        tableLineColor: tableBorder,
        tableLineWidth: 0.3,
        columnStyles: {
            0: { cellWidth: 110 },
            1: { cellWidth: 60 },
            2: { cellWidth: 80 },
            3: { cellWidth: 60 },
            4: { cellWidth: 60 },
            5: { cellWidth: 60 },
            6: { cellWidth: 86 },
        },
    });
};

const companyPage = (doc, company, explorerBase) => {
    doc.addPage();
    doc.setTextColor(...primaryText);
    doc.setFontSize(16);
    doc.text(company.companyName || "Company", 48, 60, { maxWidth: 500 });

    doc.setFontSize(10);
    doc.setTextColor(...secondaryText);
    doc.text(`CIN: ${company.cin || "N/A"}`, 48, 78);
    doc.text(`Sector: ${company.sector || "—"}`, 48, 92);
    doc.text(`Status: ${(company.status || "").toUpperCase()}`, 48, 106);
    if (company.wallet) {
        doc.text(`Wallet: ${company.wallet}`, 48, 120, { maxWidth: 500 });
    }

    const totalsY = 150;
    const totals = [
        { label: "Emission readings", value: company.emissionCount, color: secondaryText },
        { label: "Total emissions", value: `${formatNumber(company.emissionTotal)} ${company.emissionUnit}` },
        { label: "Minted", value: formatNumber(company.totalMinted, 0), color: accent },
        { label: "Burned", value: formatNumber(company.totalBurned, 0), color: danger },
        { label: "Net credits", value: formatNumber(company.netTokens, 0) },
    ];

    totals.forEach((item, idx) => {
        const x = 48 + (idx % 3) * 180;
        const y = totalsY + Math.floor(idx / 3) * 60;
        doc.setDrawColor(...tableBorder);
        doc.rect(x, y, 160, 48);
        doc.setFontSize(9);
        doc.setTextColor(...secondaryText);
        doc.text(item.label, x + 10, y + 16);
        doc.setFontSize(12);
        doc.setTextColor(...(item.color || primaryText));
        doc.text(String(item.value), x + 10, y + 34);
    });

    const chartTop = totalsY + 120;
    doc.setTextColor(...primaryText);
    doc.setFontSize(11);
    doc.text("Emissions trend", 48, chartTop - 10);
    drawSparkline(doc, company.emissionReadings, { x: 48, y: chartTop, width: 320, height: 80 });

    doc.text("Carbon credit activity", 400, chartTop - 10);
    drawBarComparison(doc, {
        x: 400,
        y: chartTop,
        width: 180,
        height: 80,
        minted: company.totalMinted,
        burned: company.totalBurned,
    });

    const emissionTableStart = chartTop + 120;
    autoTable(doc, {
        startY: emissionTableStart,
        head: [["Emission timestamp", "Value", "Unit"]],
        body: (company.emissionReadings || [])
            .sort((a, b) => (a.tsMs || 0) - (b.tsMs || 0))
            .map((entry) => [
                formatDateTime(entry.tsMs),
                formatNumber(entry.value),
                entry.unit || "ppm",
            ]),
        theme: "grid",
        styles: { fontSize: 9, textColor: primaryText, overflow: "linebreak", cellPadding: 6, minCellHeight: 14 },
        headStyles: { fillColor: tableHead, textColor: primaryText, halign: "left" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        tableLineColor: tableBorder,
        tableLineWidth: 0.3,
        margin: { left: 48, right: 48 },
    });

    const emissionTableEnd = doc.lastAutoTable?.finalY || emissionTableStart;
    const tokenStart = emissionTableEnd + 20;

    autoTable(doc, {
        startY: tokenStart,
        head: [["Timestamp", "Minted", "Burned", "Net", "Tx hash"]],
        body: (company.tokenActivities || [])
            .sort((a, b) => (a.tsMs || 0) - (b.tsMs || 0))
            .map((activity) => {
                const hash = activity.txHash || activity.hash || "—";
                const shortened = hash && hash !== "—" ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : "—";
                return [
                    formatDateTime(activity.tsMs),
                    formatNumber(activity.minted, 0),
                    formatNumber(activity.burned, 0),
                    formatNumber((activity.minted || 0) - (activity.burned || 0), 0),
                    shortened,
                ];
            }),
        didDrawCell: (data) => {
            if (data.column.index === 4 && data.cell.text?.[0] && data.cell.text[0] !== "—") {
                const hash = company.tokenActivities?.[data.row.index]?.txHash || company.tokenActivities?.[data.row.index]?.hash;
                if (hash) {
                    const url = `${explorerBase || "https://sepolia.etherscan.io"}/tx/${hash}`;
                    doc.setTextColor(39, 110, 241);
                    doc.textWithLink(data.cell.text[0], data.cell.x + 2, data.cell.y + data.cell.height - 4, { url });
                    doc.setTextColor(...primaryText);
                }
            }
        },
        theme: "grid",
        styles: { fontSize: 9, textColor: primaryText, overflow: "linebreak", cellPadding: 6, minCellHeight: 14 },
        headStyles: { fillColor: tableHead, textColor: primaryText, halign: "left" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        tableLineColor: tableBorder,
        tableLineWidth: 0.3,
        margin: { left: 48, right: 48 },
        columnStyles: {
            0: { cellWidth: 120 },
            1: { cellWidth: 60 },
            2: { cellWidth: 60 },
            3: { cellWidth: 60 },
            4: { cellWidth: 170, overflow: "ellipsize" },
        },
    });
};

export async function generateDetailedReport({ companies = [], summaryRows = [], filters = {}, explorerBase = "" }) {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
    doc.setLineHeightFactor(1.35);
    const summary = summaryRows.length ? summaryRows : companies;

    coverPage(doc, { filters, companyCount: companies.length });
    summaryPage(doc, summary);
    companies.forEach((company) => companyPage(doc, company, explorerBase));

    doc.save(`carbocoin-report-${Date.now()}.pdf`);
}
