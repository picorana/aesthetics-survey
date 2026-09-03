const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const csvPath = path.join(repoRoot, "data", "user_study_data.csv");
const outDir = path.join(repoRoot, "exports", "paper-aesthetic-visualization-pdfs");

const dotColor = "#118ab2";
const gridColor = "#d9d9d9";
const countColor = "#777";

const paperLabels = {
    archambault_mental_2012: "[AP12]",
    archambault_mental_2013: "[AP13]",
    binucci_partial_2016: "[BLMT16]",
    burch_evaluating_2012: "[BVKW12]",
    didimo_visualization_2018: "[DKMT18]",
    dwyer_edge_2013: "[DHRMM13]",
    ehlers_improving_2023: "[EVRW23]",
    huang_effects_2008: "[HHE08]",
    huang_effects_2016: "[HEHBD16]",
    huang_establishing_2013: "[Hua13]",
    huang_evaluating_2016: "[HZHD*16]",
    huang_exploring_2010: "[HH10]",
    huang_graph_2009: "[HEH09]",
    huang_improving_2010: "[HEH10]",
    huang_larger_2014: "[HEH14]",
    huang_layout_2006: "[HHE06b]",
    huang_using_2007: "[Hua07]",
    kindermann_experimental_2018: "[KNS18]",
    kobourov_are_2014: "[KRS14]",
    kypridemou_effect_2022: "[KZB22]",
    purchase_effective_2000: "[Pur00]",
    purchase_empirical_2002: "[PCA02]",
    purchase_experimental_1997: "[PC97]",
    purchase_extremes_2008: "[PS08]",
    purchase_how_2007: "[PHG07]",
    purchase_usability_2013: "[PHNK13]",
    purchase_validating_1996: "[PC96]",
    sathiyanarayanan_social_2017: "[SP17]",
    storrle_impact_2014: "[Sto14]",
    wallner_influence_2020: "[WPG*20]",
    ware_cognitive_2002: "[WPCM02]",
    xu_user_2012: "[XRP**12]"
};

function parseCsv(text) {
    text = text.replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let value = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === "\"") {
            if (inQuotes && next === "\"") {
                value += "\"";
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            row.push(value);
            value = "";
        } else if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && next === "\n") i++;
            row.push(value);
            if (row.some(cell => cell.length > 0)) rows.push(row);
            row = [];
            value = "";
        } else {
            value += char;
        }
    }

    row.push(value);
    if (row.some(cell => cell.length > 0)) rows.push(row);

    const headers = rows.shift();
    return rows.map(values => Object.fromEntries(headers.map((header, i) => [header, values[i] || ""])));
}

function splitTags(value) {
    return (value || "")
        .split(",")
        .map(d => d.trim().replace(/^"|"$/g, ""))
        .filter(d => d.length > 0);
}

function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function normalizeBibtexKey(value) {
    const key = (value || "").trim();
    return key === "huang_using_2007 (6)" ? "huang_using_2007" : key;
}

function numericValue(value) {
    const cleanedValue = String(value || "").replace(/,/g, "").trim();
    if (!cleanedValue) return null;
    const parsed = Number(cleanedValue);
    return Number.isFinite(parsed) ? parsed : null;
}

function numericRange(value) {
    const parts = String(value || "")
        .split("-")
        .map(part => numericValue(part))
        .filter(part => part !== null);

    if (parts.length === 0) return null;
    if (parts.length === 1) return { min: parts[0], max: parts[0] };
    return { min: Math.min(...parts), max: Math.max(...parts) };
}

function hasNumber(value) {
    return value !== null && value !== undefined && Number.isFinite(value);
}

function median(values) {
    const cleanValues = values.filter(hasNumber).sort((a, b) => a - b);
    if (!cleanValues.length) return null;
    const middle = Math.floor(cleanValues.length / 2);
    return cleanValues.length % 2 ? cleanValues[middle] : (cleanValues[middle - 1] + cleanValues[middle]) / 2;
}

function makeMatrix(data) {
    let papers = uniqueSorted(data.map(d => normalizeBibtexKey(d["Bibtex Key"])));
    let aesthetics = uniqueSorted(data.flatMap(d => splitTags(d["Aesthetic Tag"])));
    const paperAesthetics = new Map(papers.map(paper => [paper, new Set()]));

    data.forEach(d => {
        const paper = normalizeBibtexKey(d["Bibtex Key"]);
        if (!paper) return;
        if (!paperAesthetics.has(paper)) paperAesthetics.set(paper, new Set());
        splitTags(d["Aesthetic Tag"]).forEach(aesthetic => paperAesthetics.get(paper).add(aesthetic));
    });

    const aestheticCounts = new Map(aesthetics.map(aesthetic => [
        aesthetic,
        papers.filter(paper => paperAesthetics.get(paper).has(aesthetic)).length
    ]));
    const paperCounts = new Map(papers.map(paper => [
        paper,
        paperAesthetics.get(paper).size
    ]));

    papers = papers
        .filter(paper => paperCounts.get(paper) > 0)
        .sort((a, b) => paperCounts.get(b) - paperCounts.get(a) || a.localeCompare(b));
    aesthetics = aesthetics.sort((a, b) => aestheticCounts.get(b) - aestheticCounts.get(a) || a.localeCompare(b));

    return { papers, aesthetics, paperAesthetics, aestheticCounts, paperCounts };
}

function collectPaperScaleStats(data, papers) {
    const stats = new Map(papers.map(paper => [paper, {
        paper,
        participants: [],
        graphs: [],
        nodeMins: [],
        nodeMaxes: []
    }]));

    data.forEach(d => {
        const paper = normalizeBibtexKey(d["Bibtex Key"]);
        if (!paper || !papers.includes(paper)) return;
        const entry = stats.get(paper);
        const nodeRange = numericRange(d["|N|"]);
        entry.participants.push(numericValue(d.Participants));
        entry.graphs.push(numericValue(d["|G|"]));
        if (nodeRange) {
            entry.nodeMins.push(nodeRange.min);
            entry.nodeMaxes.push(nodeRange.max);
        }
    });

    return Array.from(stats.values()).map(entry => ({
        paper: entry.paper,
        participants: median(entry.participants),
        graphs: median(entry.graphs),
        nodeMin: entry.nodeMins.length ? Math.min(...entry.nodeMins) : null,
        nodeMax: entry.nodeMaxes.length ? Math.max(...entry.nodeMaxes) : null
    }));
}

function xml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function svgStart(width, height) {
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
        `<rect width="${width}" height="${height}" fill="white"/>`,
        `<g font-family="Arial, Helvetica, sans-serif">`
    ];
}

function line(x1, y1, x2, y2, attrs = "") {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attrs}/>`;
}

function textNode(text, x, y, attrs = "") {
    return `<text x="${x}" y="${y}" ${attrs}>${xml(text)}</text>`;
}

function bandScale(domain, start, end, padding = 0) {
    const n = domain.length;
    const width = end - start;
    const step = n ? width / Math.max(1, n + padding) : 0;
    const bandwidth = step * (1 - padding);
    const offset = step * padding;
    const positions = new Map(domain.map((d, i) => [d, start + offset + i * step]));
    return { x: d => positions.get(d), bandwidth };
}

function linearScale(domainMax, rangeStart, rangeEnd) {
    const max = domainMax || 1;
    return value => rangeStart + (Number(value) / max) * (rangeEnd - rangeStart);
}

function ticks(max) {
    if (!max || max <= 1) return [];
    const step = Math.ceil(max / 3);
    return [step, step * 2].filter(tick => tick > 0 && tick < max);
}

function renderMatrixSvg(matrix) {
    const { papers, aesthetics, paperAesthetics, aestheticCounts, paperCounts } = matrix;
    const margin = { top: 165, right: 165, bottom: 120, left: 110 };
    const cellWidth = 42;
    const cellHeight = 25;
    const dotRadius = 6.8;
    const barWidth = 92;
    const bottomBarHeight = 82;
    const countGap = 10;
    const barGap = 34;
    const bottomBarGap = 24;
    const plotWidth = aesthetics.length * cellWidth;
    const plotHeight = papers.length * cellHeight;
    const width = margin.left + plotWidth + margin.right;
    const height = margin.top + plotHeight + margin.bottom;
    const x = bandScale(aesthetics, margin.left, margin.left + plotWidth, 0);
    const y = bandScale(papers, margin.top, margin.top + plotHeight, 0);
    const rowTotals = papers.map(paper => ({ paper, total: paperCounts.get(paper) }));
    const columnTotals = aesthetics.map(aesthetic => ({ aesthetic, total: aestheticCounts.get(aesthetic) }));
    const maxRowTotal = Math.max(...rowTotals.map(d => d.total));
    const maxColumnTotal = Math.max(...columnTotals.map(d => d.total));
    const rowBarScale = linearScale(maxRowTotal, 0, barWidth);
    const columnBarScale = linearScale(maxColumnTotal, 0, bottomBarHeight);
    const countX = margin.left + plotWidth + countGap;
    const barX = margin.left + plotWidth + barGap;
    const bottomBarY = margin.top + plotHeight + bottomBarGap;
    const out = svgStart(width, height);

    for (let i = 1; i < aesthetics.length; i++) {
        out.push(line(margin.left + i * cellWidth, margin.top, margin.left + i * cellWidth, margin.top + plotHeight, `stroke="${gridColor}" stroke-width="1"`));
    }
    for (let i = 1; i < papers.length; i++) {
        out.push(line(margin.left, margin.top + i * cellHeight, margin.left + plotWidth, margin.top + i * cellHeight, `stroke="${gridColor}" stroke-width="1"`));
    }

    aesthetics.forEach(aesthetic => {
        const tx = x.x(aesthetic) + x.bandwidth / 2;
        const ty = margin.top - 18;
        out.push(textNode(aesthetic, tx, ty, `text-anchor="start" fill="#000" font-size="16" font-weight="700" transform="rotate(-45 ${tx} ${ty})"`));
    });

    papers.forEach(paper => {
        out.push(textNode(paperLabels[paper] || `[${paper}]`, margin.left - 10, y.x(paper) + y.bandwidth / 2, `text-anchor="end" dominant-baseline="middle" fill="#000" font-size="18" font-weight="400"`));
    });

    papers.forEach(paper => {
        aesthetics.forEach(aesthetic => {
            if (!paperAesthetics.get(paper).has(aesthetic)) return;
            out.push(`<circle cx="${x.x(aesthetic) + x.bandwidth / 2}" cy="${y.x(paper) + y.bandwidth / 2}" r="${dotRadius}" fill="${dotColor}"/>`);
        });
    });

    ticks(maxRowTotal).forEach(tick => {
        const tx = barX + rowBarScale(tick);
        out.push(line(tx, margin.top, tx, margin.top + plotHeight, `stroke="#eee" stroke-width="2" stroke-dasharray="4,4"`));
        out.push(textNode(tick, tx, margin.top - 7, `text-anchor="start" fill="#888" font-size="15" font-weight="700" transform="rotate(-45 ${tx} ${margin.top - 7})"`));
    });

    rowTotals.forEach(d => {
        const yy = y.x(d.paper);
        out.push(`<rect x="${barX}" y="${yy + y.bandwidth * 0.25}" width="${rowBarScale(d.total)}" height="${y.bandwidth * 0.5}" fill="${dotColor}" fill-opacity="0.7" rx="2" ry="2"/>`);
        out.push(textNode(d.total, countX + 7, yy + y.bandwidth / 2, `text-anchor="middle" dominant-baseline="middle" fill="${countColor}" font-size="18" font-weight="700"`));
    });

    ticks(maxColumnTotal).forEach(tick => {
        const ty = bottomBarY + columnBarScale(tick);
        out.push(line(margin.left, ty, margin.left + plotWidth, ty, `stroke="#eee" stroke-width="2" stroke-dasharray="4,4"`));
        out.push(textNode(tick, margin.left - 8, ty, `text-anchor="end" dominant-baseline="middle" fill="#888" font-size="15" font-weight="700"`));
    });

    columnTotals.forEach(d => {
        const xx = x.x(d.aesthetic);
        out.push(`<rect x="${xx + x.bandwidth * 0.25}" y="${bottomBarY}" width="${x.bandwidth * 0.5}" height="${columnBarScale(d.total)}" fill="${dotColor}" fill-opacity="0.7" rx="2" ry="2"/>`);
        out.push(textNode(d.total, xx + x.bandwidth / 2, bottomBarY - 9, `text-anchor="middle" dominant-baseline="middle" fill="${countColor}" font-size="18" font-weight="700"`));
    });

    out.push("</g></svg>");
    return out.join("\n");
}

function renderScaleChartsSvg({ papers, matrixPlotWidth, matrixHeight, matrixAxisY, matrixGridBottom, paperStats }) {
    const chartGap = 0;
    const margin = { top: 30, right: 10, bottom: 20, left: 54 };
    const plotWidth = matrixPlotWidth / 1.5;
    const width = margin.left + plotWidth + margin.right;
    const height = matrixHeight + 20;
    const chartAreaTop = matrixAxisY;
    const chartAreaBottom = matrixGridBottom;
    const chartHeight = (chartAreaBottom - chartAreaTop - chartGap) / 3;
    const x = bandScale(papers, margin.left, margin.left + plotWidth, 0.2);
    const guideTop = chartAreaTop + margin.top;
    const guideBottom = chartAreaBottom - margin.bottom;
    const charts = [
        { label: "Num. Participants", value: d => d.participants, max: Math.max(...paperStats.map(d => d.participants).filter(hasNumber)), color: "#118ab2", valueLabel: d => d.participants ?? "" },
        { label: "Num. of Graphs", value: d => d.graphs, max: Math.max(...paperStats.map(d => d.graphs).filter(hasNumber)), color: "#ef476f", valueLabel: d => d.graphs ?? "" },
        { label: "|N| range", value: d => d.nodeMax, minValue: d => d.nodeMin, max: Math.max(...paperStats.map(d => d.nodeMax).filter(hasNumber)), color: "#06d6a0", valueLabel: d => d.nodeMax ?? "" }
    ];
    const out = svgStart(width, height);

    papers.forEach(paper => {
        const xx = x.x(paper) + x.bandwidth / 2;
        out.push(line(xx, guideTop, xx, guideBottom, `stroke="#e6e6e6" stroke-width="1" stroke-dasharray="3,4"`));
    });

    charts.forEach((chart, index) => {
        const chartY = chartAreaTop + index * (chartHeight + chartGap);
        const innerTop = chartY + margin.top;
        const innerBottom = chartY + chartHeight - margin.bottom;
        const y = linearScale(chart.max || 1, innerBottom, innerTop);

        ticks(chart.max || 1).forEach(tick => {
            out.push(line(margin.left, y(tick), margin.left + plotWidth, y(tick), `stroke="#eee" stroke-width="1.5" stroke-dasharray="4,4"`));
            out.push(textNode(tick, margin.left - 8, y(tick), `text-anchor="end" dominant-baseline="middle" fill="#888" font-size="15" font-weight="700"`));
        });

        out.push(textNode(chart.label, margin.left + plotWidth / 2, chartY + 13, `text-anchor="middle" dominant-baseline="middle" fill="#333" font-size="18" font-weight="700"`));
        papers.forEach(paper => {
            const xx = x.x(paper) + x.bandwidth / 2;
            out.push(line(xx, innerBottom, xx, innerBottom + 5, `stroke="#888" stroke-width="1"`));
        });

        if (chart.minValue) {
            const nodeStats = paperStats.filter(d => hasNumber(chart.value(d)) && hasNumber(chart.minValue(d)));
            nodeStats.forEach(d => {
                const xx = x.x(d.paper) + x.bandwidth / 2;
                if (chart.value(d) === chart.minValue(d)) {
                    out.push(`<circle cx="${xx}" cy="${y(chart.value(d))}" r="${Math.max(3, x.bandwidth * 0.28)}" fill="${chart.color}" fill-opacity="0.8"/>`);
                    out.push(textNode(chart.valueLabel(d), xx, y(chart.value(d)) - 8, `text-anchor="middle" fill="${countColor}" font-size="12" font-weight="700"`));
                } else {
                    out.push(line(xx, y(chart.minValue(d)), xx, y(chart.value(d)), `stroke="${chart.color}" stroke-width="${Math.max(3, x.bandwidth * 0.45)}" stroke-linecap="round" opacity="0.7"`));
                    out.push(textNode(chart.value(d), xx, y(chart.value(d)) - 8, `text-anchor="middle" fill="${countColor}" font-size="12" font-weight="700"`));
                    out.push(textNode(chart.minValue(d), xx, y(chart.minValue(d)) + 14, `text-anchor="middle" fill="${countColor}" font-size="12" font-weight="700"`));
                }
            });
        } else {
            paperStats.filter(d => hasNumber(chart.value(d))).forEach(d => {
                const xx = x.x(d.paper);
                out.push(`<rect x="${xx}" y="${y(chart.value(d))}" width="${x.bandwidth}" height="${innerBottom - y(chart.value(d))}" fill="${chart.color}" fill-opacity="0.7" rx="2" ry="2"/>`);
                out.push(textNode(chart.valueLabel(d), xx + x.bandwidth / 2, y(chart.value(d)) - 4, `text-anchor="middle" fill="${countColor}" font-size="12" font-weight="700"`));
            });
        }

        if (index === charts.length - 1) {
            papers.forEach(paper => {
                const tx = x.x(paper) + x.bandwidth / 2;
                out.push(textNode(paperLabels[paper] || `[${paper}]`, tx, chartAreaBottom, `text-anchor="end" fill="#000" font-size="14" font-weight="400" transform="rotate(-45 ${tx} ${chartAreaBottom})"`));
            });
        }
    });

    out.push("</g></svg>");
    return out.join("\n");
}

function convertSvgToPdf(svg, basename) {
    const svgPath = path.join(outDir, `${basename}.svg`);
    const pdfPath = path.join(outDir, `${basename}.pdf`);
    fs.writeFileSync(svgPath, svg);
    const result = spawnSync("rsvg-convert", ["-f", "pdf", "-o", pdfPath, svgPath], { encoding: "utf8" });
    if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || `rsvg-convert failed for ${pdfPath}`);
    }
    return pdfPath;
}

function main() {
    fs.mkdirSync(outDir, { recursive: true });
    const data = parseCsv(fs.readFileSync(csvPath, "utf8"));
    const matrix = makeMatrix(data);
    const matrixSvg = renderMatrixSvg(matrix);
    const matrixMargin = { top: 165, bottom: 120 };
    const plotHeight = matrix.papers.length * 25;
    const matrixHeight = matrixMargin.top + plotHeight + matrixMargin.bottom;
    const barchartsSvg = renderScaleChartsSvg({
        papers: matrix.papers,
        matrixPlotWidth: matrix.aesthetics.length * 42,
        matrixHeight,
        matrixAxisY: matrixMargin.top - 18,
        matrixGridBottom: matrixMargin.top + plotHeight,
        paperStats: collectPaperScaleStats(data, matrix.papers)
    });

    const matrixPdf = convertSvgToPdf(matrixSvg, "paper-aesthetic-matrix");
    const barchartsPdf = convertSvgToPdf(barchartsSvg, "paper-scale-barcharts");
    console.log(`Wrote ${matrixPdf}`);
    console.log(`Wrote ${barchartsPdf}`);
}

main();
