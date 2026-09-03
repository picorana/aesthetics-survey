const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const csvPath = path.join(repoRoot, "data", "user_study_data.csv");
const outPath = path.join(repoRoot, "exports", "paper_aesthetic_matrix.tex");

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

function latexEscape(value) {
    return String(value)
        .replace(/\\/g, "\\textbackslash{}")
        .replace(/&/g, "\\&")
        .replace(/%/g, "\\%")
        .replace(/\$/g, "\\$")
        .replace(/#/g, "\\#")
        .replace(/_/g, "\\_")
        .replace(/{/g, "\\{")
        .replace(/}/g, "\\}")
        .replace(/~/g, "\\textasciitilde{}")
        .replace(/\^/g, "\\textasciicircum{}");
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

    papers = papers.sort((a, b) =>
        paperCounts.get(b) - paperCounts.get(a) ||
        a.localeCompare(b)
    );
    aesthetics = aesthetics.sort((a, b) =>
        aestheticCounts.get(b) - aestheticCounts.get(a) ||
        a.localeCompare(b)
    );

    return { papers, aesthetics, paperAesthetics };
}

function renderLatex({ papers, aesthetics, paperAesthetics }) {
    const header = [
        "% Auto-generated from data/user_study_data.csv.",
        "% Required packages:",
        "% \\usepackage{booktabs}",
        "% \\usepackage{graphicx}",
        "% \\usepackage{tikz}",
        "% \\usepackage{xcolor}",
        "% \\usepackage{colortbl}",
        "\\definecolor{paperAestheticDot}{HTML}{118AB2}",
        "\\definecolor{paperAestheticGrid}{HTML}{D9D9D9}",
        "\\definecolor{paperAestheticCount}{HTML}{777777}",
        "\\newcommand{\\paperaestheticdot}{\\tikz[baseline=-0.55ex]{\\fill[paperAestheticDot] (0,0) circle (1.7pt);}}",
        "",
        "\\begin{table*}[t]",
        "\\centering",
        "\\sffamily",
        "\\scriptsize",
        "\\setlength{\\tabcolsep}{2.2pt}",
        "\\renewcommand{\\arraystretch}{1.15}",
        "\\resizebox{\\textwidth}{!}{%"
    ];

    const thinSeparator = "!{\\color{paperAestheticGrid}\\vrule width 0.35pt}";
    const paperColumns = papers
        .map((_, index) => index === 0 ? "c" : `${thinSeparator}c`)
        .join("");
    const columnSpec = `r${paperColumns}${thinSeparator}c`;
    const dataColumnCount = papers.length + 2;
    const bodyRule = `\\cline{2-${dataColumnCount}}`;
    const paperHeader = [
        "\\arrayrulecolor{paperAestheticGrid}",
        "\\setlength{\\arrayrulewidth}{0.35pt}",
        "\\begin{tabular}{" + columnSpec + "}",
        " " + papers
            .map(paper => `& \\multicolumn{1}{c}{\\rotatebox{90}{\\cite{${paper}}}}`)
            .join(" ") + " & \\multicolumn{1}{c}{} \\\\",
        "% \\noalign{\\global\\arrayrulewidth=0.9pt}\\hline\\noalign{\\global\\arrayrulewidth=0.35pt}"
    ];

    const rows = aesthetics.map(aesthetic => {
        const count = papers.filter(paper => paperAesthetics.get(paper).has(aesthetic)).length;
        const cells = papers.map(paper => paperAesthetics.get(paper).has(aesthetic) ? "\\paperaestheticdot" : "");
        return `\\textbf{${latexEscape(aesthetic)}} ${cells.map(cell => `& ${cell}`).join(" ")} & \\textbf{\\textcolor{paperAestheticCount}{${count}}} \\\\ ${bodyRule}`;
    });

    const footer = [
        "\\arrayrulecolor{black}",
        "\\end{tabular}%",
        "}",
        "\\caption{}",
        "\\label{tab:paper-aesthetic-matrix}",
        "\\end{table*}",
        ""
    ];

    return header.concat(paperHeader, rows, footer).join("\n");
}

function main() {
    const data = parseCsv(fs.readFileSync(csvPath, "utf8"));
    const matrix = makeMatrix(data);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, renderLatex(matrix));
    console.log(`Wrote ${matrix.aesthetics.length} x ${matrix.papers.length} matrix to ${outPath}`);
}

main();
