const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const csvPath = path.join(repoRoot, "data", "user_study_data.csv");
const outDir = path.join(repoRoot, "exports", "task-correlation-row-pdfs");
const pdfScale = 0.6;

const taskGroupColor = "steelblue";
const fallbackDotColor = "#118ab2";
const evaluationCriterionColors = {
    "task accuracy": "#118ab2",
    "error rate": "#118ab2",
    "task time": "#ef476f",
    "efficiency": "#ef476f",
    "preference": "#f8961e",
    "effort": "#06d6a0",
    "cognitive load": "#06d6a0"
};
const evaluationCriterionColorOrder = ["#118ab2", "#ef476f", "#f8961e", "#06d6a0"];
const evaluationCriterionLegend = [
    { label: "Accuracy", color: "#118ab2" },
    { label: "Time", color: "#ef476f" },
    { label: "Preference", color: "#f8961e" },
    { label: "Cognitive Load", color: "#06d6a0" }
];

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

function uniqueInOrder(values) {
    return Array.from(new Set(values.filter(d => d && d.length > 0)));
}

function taskKey(d) {
    return `${d.group}::${d.taskType}`;
}

function taskLabel(taskType) {
    return ["Find Connected Components", "Connected Components"].includes(taskType) ? "Connected Comp." : taskType;
}

function aestheticLabel(aesthetic) {
    return aesthetic === "Number of Visual Elements" ? "Num. of Visual Elems." : aesthetic;
}

function xml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function fileSafe(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

function dotColor(d) {
    return evaluationCriterionColors[(d.evaluationCriterion || "").toLowerCase()] || fallbackDotColor;
}

function dotSort(a, b) {
    const colorIndexA = evaluationCriterionColorOrder.indexOf(dotColor(a));
    const colorIndexB = evaluationCriterionColorOrder.indexOf(dotColor(b));
    const orderedColorIndexA = colorIndexA === -1 ? evaluationCriterionColorOrder.length : colorIndexA;
    const orderedColorIndexB = colorIndexB === -1 ? evaluationCriterionColorOrder.length : colorIndexB;

    return orderedColorIndexA - orderedColorIndexB ||
        Number(b.significant) - Number(a.significant) ||
        a.evaluationCriterion.localeCompare(b.evaluationCriterion) ||
        a.bibtexKey.localeCompare(b.bibtexKey);
}

function cumulativeOffsets(items, categoryForItem, gap) {
    const offsets = [0];
    for (let i = 1; i < items.length; i++) {
        offsets[i] = offsets[i - 1] + (categoryForItem(items[i - 1]) !== categoryForItem(items[i]) ? gap : 0);
    }
    return offsets;
}

function collectTasks(data) {
    const taskGroups = uniqueInOrder(data.map(d => (d["Task Group"] || "").trim()).filter(group => group !== "Overview"));
    const tasksByGroup = new Map(taskGroups.map(group => [group, []]));

    data.forEach(d => {
        const group = (d["Task Group"] || "").trim();
        const taskType = (d["Task Type"] || "").trim();
        if (!group || !taskType) return;
        if (group === "Overview") return;
        if (!tasksByGroup.has(group)) tasksByGroup.set(group, []);
        if (!tasksByGroup.get(group).includes(taskType)) tasksByGroup.get(group).push(taskType);
    });

    if (!tasksByGroup.has("Attributes")) {
        tasksByGroup.set("Attributes", []);
    }
    ["On the Nodes", "On the Edges"].forEach(taskType => {
        if (!tasksByGroup.get("Attributes").includes(taskType)) {
            tasksByGroup.get("Attributes").push(taskType);
        }
    });
    if (!tasksByGroup.has("Overview")) {
        tasksByGroup.set("Overview", []);
    }
    data.forEach(d => {
        const group = (d["Task Group"] || "").trim();
        const taskType = (d["Task Type"] || "").trim();
        if (group === "Overview" && taskType && !tasksByGroup.get("Overview").includes(taskType)) {
            tasksByGroup.get("Overview").push(taskType);
        }
    });

    const taskRows = Array.from(tasksByGroup.entries())
        .flatMap(([group, taskTypes]) => taskTypes.map(taskType => ({ group, taskType })));

    return { taskRows, tasksByGroup };
}

function collectDotsByAestheticTask(data) {
    const dotsByAestheticTask = new Map();

    data.filter(d =>
        (d["Statistical Evaluation"] || "").trim().toLowerCase() === "yes" &&
        (d["Task Type"] || "").trim().length > 0
    ).forEach(d => {
        const group = (d["Task Group"] || "").trim();
        const taskType = (d["Task Type"] || "").trim();
        const significant = (d["Statistically Significant"] || "").trim().toLowerCase() === "yes";
        const evaluationCriterion = (d["Evaluation Criterion"] || "").trim();
        const bibtexKey = (d["Bibtex Key"] || "").trim();

        splitTags(d["Aesthetic Tag"]).forEach(aesthetic => {
            const key = `${aesthetic}::${group}::${taskType}`;
            if (!dotsByAestheticTask.has(key)) dotsByAestheticTask.set(key, []);
            dotsByAestheticTask.get(key).push({
                aesthetic,
                group,
                taskType,
                significant,
                evaluationCriterion,
                bibtexKey
            });
        });
    });

    dotsByAestheticTask.forEach(dots => dots.sort(dotSort));
    return dotsByAestheticTask;
}

function chartMetrics(taskRows) {
    const margin = { top: 155, right: 17, bottom: 0, left: 2 };
    const xCellSize = 23;
    const rowHeight = 25;
    const groupGap = 16;
    const xOffsets = cumulativeOffsets(taskRows, d => d.group, groupGap);
    const width = margin.left + taskRows.length * xCellSize + xOffsets[xOffsets.length - 1] + margin.right;
    const height = margin.top + rowHeight + margin.bottom;
    const xBandwidth = taskRows.length ? (taskRows.length * xCellSize) / taskRows.length : xCellSize;
    const xStart = margin.left;
    const xWithOffset = task => {
        const index = taskRows.findIndex(d => taskKey(d) === taskKey(task));
        return xStart + index * xBandwidth + xOffsets[index];
    };

    return { margin, xCellSize, rowHeight, groupGap, xOffsets, width, height, xBandwidth, xWithOffset };
}

function renderLegend(width) {
    width = Math.max(width, 680);
    const margin = { top: 8, right: 20, bottom: 8, left: 65 };
    const availableWidth = width - margin.left - margin.right;
    const itemSpacing = availableWidth / (evaluationCriterionLegend.length - 1);
    const height = 48;
    const parts = [svgOpen(width, height)];

    evaluationCriterionLegend.forEach((item, i) => {
        const textWidth = item.label.length * 6;
        const itemWidth = 4 + 10 + textWidth;
        const x = margin.left + i * itemSpacing - itemWidth / 2;
        const y = 15;
        parts.push(`<circle cx="${x}" cy="${y}" r="4" fill="${item.color}" fill-opacity="0.78" stroke="${item.color}" stroke-width="1.1"/>`);
        parts.push(`<text x="${x + 10}" y="${y}" dominant-baseline="middle" fill="#333" font-size="11">${xml(item.label)}</text>`);
    });

    [
        { label: "Statistically Significant", filled: true },
        { label: "Not Statistically Significant", filled: false }
    ].forEach((item, i) => {
        const x = width / 2 - 145 + i * 210;
        const y = 34;
        parts.push(`<circle cx="${x}" cy="${y}" r="4" fill="${item.filled ? "#777" : "none"}" fill-opacity="0.78" stroke="#777" stroke-width="1.1"/>`);
        parts.push(`<text x="${x + 10}" y="${y}" dominant-baseline="middle" fill="#333" font-size="11">${xml(item.label)}</text>`);
    });

    parts.push("</svg>");
    return parts.join("\n");
}

function svgOpen(width, height) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Arial, Helvetica, sans-serif">`;
}

function renderRowSvg(aesthetic, taskRows, tasksByGroup, dotsByAestheticTask) {
    const { margin, rowHeight, width, height, xBandwidth, xWithOffset } = chartMetrics(taskRows);
    const rowY = margin.top - 15;
    const plotRight = xWithOffset(taskRows[taskRows.length - 1]) + xBandwidth;
    const plotLeft = xWithOffset(taskRows[0]);
    const parts = [svgOpen(width, height)];

    taskRows.forEach(task => {
        const x = xWithOffset(task) + xBandwidth / 2;
        parts.push(`<line x1="${x}" x2="${x}" y1="${margin.top - 35}" y2="${margin.top + rowHeight - 20}" stroke="#eee" stroke-width="1"/>`);
    });

    parts.push(`<line x1="${margin.left - 8}" x2="${plotRight}" y1="${rowY + rowHeight / 2}" y2="${rowY + rowHeight / 2}" stroke="#f2f2f2" stroke-width="1"/>`);

    taskRows.forEach(task => {
        const x = xWithOffset(task) + xBandwidth / 2;
        const y = margin.top - 42;
        parts.push(`<text x="${x}" y="${y}" text-anchor="start" transform="rotate(-55 ${x} ${y})" fill="${task.group === "Overview" ? taskGroupColor : "#333"}" font-size="10" font-weight="${task.group === "Overview" ? 700 : 400}">${xml(taskLabel(task.taskType))}</text>`);
    });

    parts.push(`<text x="${plotLeft + (plotRight - plotLeft) / 2}" y="16" text-anchor="middle" fill="#333" font-size="12" font-weight="700">${xml(`Evaluations on ${aestheticLabel(aesthetic)}`)}</text>`);

    const dotData = taskRows.flatMap(task => {
        const dots = dotsByAestheticTask.get(`${aesthetic}::${task.group}::${task.taskType}`) || [];
        return dots.map((dot, index) => ({
            ...dot,
            count: dots.length,
            index
        }));
    });
    const emptyTasks = taskRows.filter(task => {
        const dots = dotsByAestheticTask.get(`${aesthetic}::${task.group}::${task.taskType}`) || [];
        return dots.length === 0;
    });

    emptyTasks.forEach(task => {
        const cx = xWithOffset(task) + xBandwidth / 2;
        const cy = rowY + rowHeight / 2;
        const crossSize = 4;
        parts.push(`<g opacity="0.45"><line x1="${cx - crossSize}" x2="${cx + crossSize}" y1="${cy - crossSize}" y2="${cy + crossSize}" stroke="#999" stroke-width="1"/><line x1="${cx - crossSize}" x2="${cx + crossSize}" y1="${cy + crossSize}" y2="${cy - crossSize}" stroke="#999" stroke-width="1"/></g>`);
    });

    dotData.forEach(dot => {
        const task = { group: dot.group, taskType: dot.taskType };
        const rows = Math.ceil(dot.count / 5);
        const baseColumns = Math.floor(dot.count / rows);
        const extraColumns = dot.count % rows;
        const rowCounts = Array.from({ length: rows }, (_, row) => baseColumns + (row < extraColumns ? 1 : 0));
        let row = 0;
        let indexInRow = dot.index;
        while (indexInRow >= rowCounts[row]) {
            indexInRow -= rowCounts[row];
            row += 1;
        }
        const columnsInRow = rowCounts[row];
        const maxColumns = Math.max(...rowCounts);
        const stepX = xBandwidth / (columnsInRow + 1);
        const dotGapY = 7;
        const dotBlockHeight = (rows - 1) * dotGapY;
        const cx = xWithOffset(task) + stepX * (indexInRow + 1);
        const cy = rowY + rowHeight / 2 - dotBlockHeight / 2 + row * dotGapY;
        const r = Math.min(3.4, xBandwidth / (maxColumns + 1) * 0.38, dotGapY * 0.38);
        const color = dotColor(dot);
        const fill = dot.significant ? color : "none";
        const fillOpacity = dot.significant ? 0.78 : 1;
        parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${color}" stroke-width="1.1"><title>${xml(`${dot.aesthetic} / ${dot.taskType}\nCriterion: ${dot.evaluationCriterion || "Unknown"}\nStatistically significant: ${dot.significant ? "Yes" : "No"}\nPaper: ${dot.bibtexKey || "Unknown"}`)}</title></circle>`);
    });

    tasksByGroup.forEach((taskTypes, group) => {
        const groupTasks = taskRows.filter(d => d.group === group);
        if (groupTasks.length === 0) return;
        const xStart = xWithOffset(groupTasks[0]);
        const xEnd = xWithOffset(groupTasks[groupTasks.length - 1]) + xBandwidth;
        const y = margin.top - 37;
        parts.push(`<line x1="${xStart}" x2="${xEnd}" y1="${y}" y2="${y}" stroke="${taskGroupColor}" stroke-width="6" stroke-linecap="round" opacity="0.8"/>`);
        if (group !== "Overview") {
            parts.push(`<text x="${xStart + (xEnd - xStart) / 2}" y="${margin.top - 32}" text-anchor="middle" dominant-baseline="hanging" fill="${taskGroupColor}" font-size="10" font-weight="700">${xml(group)}</text>`);
        }
    });

    parts.push("</svg>");
    return parts.join("\n");
}

function convertSvgToPdf(svg, pdfPath) {
    const tmpSvgPath = path.join(outDir, `${path.basename(pdfPath, ".pdf")}.svg`);
    fs.writeFileSync(tmpSvgPath, svg);
    const result = spawnSync("rsvg-convert", ["-f", "pdf", "--zoom", String(pdfScale), "-o", pdfPath, tmpSvgPath], { encoding: "utf8" });
    if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || `rsvg-convert failed for ${pdfPath}`);
    }
}

function main() {
    fs.mkdirSync(outDir, { recursive: true });
    const data = parseCsv(fs.readFileSync(csvPath, "utf8"));
    const aesthetics = uniqueInOrder(data.flatMap(d => splitTags(d["Aesthetic Tag"]))).sort((a, b) => a.localeCompare(b));
    const { taskRows, tasksByGroup } = collectTasks(data);
    const dotsByAestheticTask = collectDotsByAestheticTask(data);
    const legendXCellSize = 30;
    const legendGroupGap = 16;
    const legendMargin = { right: 40, left: 20 };
    const legendXOffsets = cumulativeOffsets(taskRows, d => d.group, legendGroupGap);
    const legendWidth = legendMargin.left + taskRows.length * legendXCellSize + legendXOffsets[legendXOffsets.length - 1] + legendMargin.right;

    convertSvgToPdf(renderLegend(legendWidth), path.join(outDir, "00-legend.pdf"));

    aesthetics.forEach((aesthetic, index) => {
        const svg = renderRowSvg(aesthetic, taskRows, tasksByGroup, dotsByAestheticTask);
        const pdfName = `${String(index + 1).padStart(2, "0")}-${fileSafe(aesthetic)}.pdf`;
        convertSvgToPdf(svg, path.join(outDir, pdfName));
    });

    console.log(`Wrote ${aesthetics.length + 1} PDFs to ${outDir}`);
}

main();
