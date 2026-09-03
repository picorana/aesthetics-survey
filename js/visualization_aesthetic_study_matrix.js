(function () {
    "use strict";

    const DATA_PATH = "data/paper_categorization.csv";

    const visualizationMethods = [
        {
            label: "Matrix",
            tags: ["Matrix", "Adjacency Matrix"]
        },
        { label: "Arc", tags: ["Arc Diagram"] },
        { label: "Radial", tags: ["Radial"] },
        {
            label: "Space filling",
            tags: ["Space-filling/nested polygons"],
            cleanedTags: ["Space-Filling"]
        },
        {
            label: "Biofabric",
            tags: ["Biofabric"]
        },
        { label: "Bipartite", tags: ["Bipartite Straight-Line Node-Link Diagram"] },
        { label: "Layered", tags: ["Layered Graph"] },
        { label: "Hive plots", tags: ["Hive Plots"] }
    ];

    const aestheticMetrics = [
        {
            id: "edge-crossings",
            label: "Edge crossings",
            tags: ["Edge Crossings"],
            notApplicableMethods: ["Matrix", "Biofabric"]
        },
        {
            id: "edge-length",
            label: "Edge length",
            tags: ["Edge Length"]
        },
        {
            id: "angular-crossing-resolution",
            label: "Angular / crossing resolution",
            tags: ["Angular Resolution", "Crossing Resolution", "Total Resolution"],
            notApplicableMethods: ["Matrix", "Biofabric"]
        },
        {
            id: "visual-symmetry",
            label: "Visual symmetry",
            tags: ["Symmetry"],
            uncertainMethods: ["Matrix", "Arc", "Radial", "Space filling", "Biofabric", "Bipartite", "Layered", "Hive plots"]
        },
        {
            id: "drawing-area-aspect-ratio",
            label: "Drawing area / aspect ratio",
            tags: ["Total Area", "Aspect Ratio", "Grid Size", "Height", "Width"],
            notApplicableMethods: ["Bipartite"],
            caveatMethods: ["Matrix", "Radial", "Space filling", "Biofabric", "Layered", "Hive plots"]
        },
        {
            id: "pixel-ink-ratio",
            label: "Pixel / ink ratio",
            tags: ["Density", "Edge Density", "Node Density", "Whitespace", "Entity Area", "Number of Visual Elements"],
            notApplicableMethods: ["Matrix"]
        },
        {
            id: "similarity",
            label: "Similarity (isomorphic subgraphs)",
            tags: ["Visual Pattern Preservation"]
        },
        {
            id: "entropy",
            label: "Entropy (visual, Moran’s I)",
            tags: [],
            rawMetricLabels: ["Entropy", "Community Entropy", "Spatial Autocorrelation", "Moran’s I"],
            rawMetricPattern: /\b(?:community\s+)?entropy\b|spatial autocorrelation|moran(?:'|’)?s?\s+i\b/i
        },
        {
            id: "pattern-faithfulness",
            label: "Pattern faithfulness",
            tags: [
                "Automorphism Faitfulness",
                "Change Faithfulness",
                "Cluster Faithfulness",
                "Faithfulness",
                "Neighborhood Faithfulness",
                "Shape-Based Faithfulness"
            ]
        }
    ];

    function splitTags(value) {
        return String(value || "")
            .split(",")
            .map(tag => tag.trim())
            .filter(Boolean);
    }

    function firstNonEmpty(current, candidate) {
        return current || String(candidate || "").trim();
    }

    function mergePaperRows(rows) {
        const papersByKey = new Map();

        rows.forEach((row, index) => {
            const key = String(row["Bibtex Key"] || "").trim();
            if (!key) return;

            if (!papersByKey.has(key)) {
                papersByKey.set(key, {
                    key,
                    sourceIndex: index,
                    title: "",
                    authors: "",
                    year: "",
                    url: "",
                    doi: "",
                    visualizationTags: new Set(),
                    cleanedVisualizationTags: new Set(),
                    aestheticTags: new Set(),
                    rawAestheticMetrics: new Set(),
                    evaluationMethods: new Set()
                });
            }

            const paper = papersByKey.get(key);
            paper.title = firstNonEmpty(paper.title, row.Title);
            paper.authors = firstNonEmpty(paper.authors, row.Authors);
            paper.year = firstNonEmpty(paper.year, row.Year);
            paper.url = firstNonEmpty(paper.url, row.URL);
            paper.doi = firstNonEmpty(paper.doi, row.DOI);

            splitTags(row["Visualization Type"]).forEach(tag => paper.visualizationTags.add(tag));
            splitTags(row["Visualization Type cleanup"]).forEach(tag => paper.cleanedVisualizationTags.add(tag));
            splitTags(row["Aesthetic Tag"]).forEach(tag => paper.aestheticTags.add(tag));
            splitTags(row["Aesthetic Metrics"]).forEach(tag => paper.rawAestheticMetrics.add(tag));
            splitTags(row["Evaluation Methodology cleaned"]).forEach(method => paper.evaluationMethods.add(method));
        });

        return Array.from(papersByKey.values());
    }

    function hasUserStudy(paper) {
        return Array.from(paper.evaluationMethods).some(method => /^User Study \((?:Qualitative|Quantitative)\)$/.test(method));
    }

    function matchesVisualization(paper, method) {
        const detailedMatch = method.tags.some(tag => paper.visualizationTags.has(tag));
        const cleanedMatch = (method.cleanedTags || []).some(tag => paper.cleanedVisualizationTags.has(tag));
        return detailedMatch || cleanedMatch;
    }

    function matchesMetric(paper, metric) {
        if (metric.tags && metric.tags.some(tag => paper.aestheticTags.has(tag))) return true;
        if (metric.rawMetricPattern && Array.from(paper.rawAestheticMetrics).some(value => metric.rawMetricPattern.test(value))) return true;
        return false;
    }

    function metricMappingText(metric) {
        const tagText = metric.tags.length
            ? `Aesthetic Tags: ${metric.tags.join(", ")}`
            : "Aesthetic Tags: none";
        const rawText = metric.rawMetricLabels
            ? `\nRaw metric fallback: ${metric.rawMetricLabels.join(", ")}`
            : "";
        return `${tagText}${rawText}`;
    }

    function renderCategoryMapping() {
        const cards = d3.select("#category-mapping")
            .selectAll("article")
            .data(aestheticMetrics)
            .join("article")
            .attr("class", "mapping-card");

        cards.append("h3").text(metric => metric.label);

        cards.each(function (metric) {
            const card = d3.select(this);
            const tagRow = card.append("div").attr("class", "mapping-row");
            tagRow.append("span").attr("class", "mapping-label").text("Aesthetic Tags");

            const tags = tagRow.append("div").attr("class", "tag-list");
            if (metric.tags.length) {
                tags.selectAll("code")
                    .data(metric.tags)
                    .join("code")
                    .text(tag => tag);
            } else {
                tags.append("span").attr("class", "no-tag").text("None in the catalogue");
            }

            if (metric.rawMetricLabels) {
                const fallbackRow = card.append("div").attr("class", "mapping-row fallback-row");
                fallbackRow.append("span").attr("class", "mapping-label").text("Raw metric fallback");
                fallbackRow.append("div")
                    .attr("class", "tag-list")
                    .selectAll("code")
                    .data(metric.rawMetricLabels)
                    .join("code")
                    .text(value => value);
            }
        });
    }

    function cellAnnotation(method, metric) {
        if ((metric.notApplicableMethods || []).includes(method.label)) return "not-applicable";
        if ((metric.uncertainMethods || []).includes(method.label)) return "uncertain";
        if ((metric.caveatMethods || []).includes(method.label)) return "caveat";
        return "none";
    }

    function renderCellAnnotationMapping() {
        const annotationTypes = [
            { label: "N/A", property: "notApplicableMethods" },
            { label: "?", property: "uncertainMethods" },
            { label: "*", property: "caveatMethods" }
        ];
        const annotationGroups = annotationTypes.map(type => ({
            ...type,
            entries: aestheticMetrics
                .filter(metric => metric[type.property]?.length)
                .map(metric => `${metric.label} — ${metric[type.property].join(", ")}`)
        }));

        const list = d3.select("#cell-annotation-mapping")
            .selectAll("li")
            .data(annotationGroups)
            .join("li");

        list.append("strong").text(group => `${group.label}: `);
        list.append("span").text(group => group.entries.join("; "));
    }

    function normalizePaperUrl(paper) {
        let url = String(paper.url || "").trim();
        url = url.replace(/^https:\/\/doi\.org\/https:\/\/doi\.org\//i, "https://doi.org/");
        if (/^https?:\/\//i.test(url)) return url;

        const doi = String(paper.doi || "").trim();
        if (doi && doi.toUpperCase() !== "NA") {
            return `https://doi.org/${doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")}`;
        }
        return "";
    }

    function firstAuthorSurname(authors, fallbackKey) {
        const value = String(authors || "").trim();
        const fallbackSurname = fallbackKey.split("_")[0]
            .split("-")
            .map(part => part ? part[0].toUpperCase() + part.slice(1) : part)
            .join("-");
        if (!value || value.toUpperCase() === "NA") return fallbackSurname;

        const firstAuthor = value.split(/,\s+and\s+|;\s*|\s+and\s+/i)[0].trim();
        const commaParts = firstAuthor.split(",").map(part => part.trim()).filter(Boolean);
        if (commaParts.length > 1 && commaParts[0].split(/\s+/).length === 1) return commaParts[0];

        const nameParts = commaParts[0].split(/\s+/).filter(Boolean);
        return nameParts[nameParts.length - 1] || fallbackSurname;
    }

    function citationLabel(paper) {
        const surname = firstAuthorSurname(paper.authors, paper.key);
        return paper.year ? `${surname} ${paper.year}` : surname;
    }

    function paperTitle(paper, method, metric) {
        const studyTypes = Array.from(paper.evaluationMethods)
            .filter(value => value.startsWith("User Study"))
            .join("; ");
        return `${paper.title || paper.key}\n${method.label} × ${metric.label}\n${studyTypes}`;
    }

    function cellPapers(papers, method, metric) {
        return papers
            .filter(paper => hasUserStudy(paper) && matchesVisualization(paper, method) && matchesMetric(paper, metric))
            .sort((a, b) =>
                Number(a.year || Infinity) - Number(b.year || Infinity) ||
                citationLabel(a).localeCompare(citationLabel(b))
            );
    }

    function renderMatrix(rows) {
        const papers = mergePaperRows(rows);
        const matrix = visualizationMethods.map(method => ({
            method,
            cells: aestheticMetrics.map(metric => {
                const annotation = cellAnnotation(method, metric);
                const notApplicable = annotation === "not-applicable";
                return {
                    metric,
                    annotation,
                    notApplicable,
                    papers: notApplicable ? [] : cellPapers(papers, method, metric)
                };
            })
        }));

        const root = d3.select("#matrix");
        root.attr("class", null).text("");

        const table = root.append("table");
        const headerRow = table.append("thead").append("tr");
        headerRow.append("th").attr("scope", "col").text("Visualization method");
        headerRow.selectAll("th.metric")
            .data(aestheticMetrics)
            .join("th")
            .attr("class", "metric")
            .attr("scope", "col")
            .attr("title", metricMappingText)
            .text(metric => metric.label);

        const bodyRows = table.append("tbody")
            .selectAll("tr")
            .data(matrix)
            .join("tr");

        bodyRows.append("th")
            .attr("scope", "row")
            .text(row => row.method.label);

        const cells = bodyRows.selectAll("td")
            .data(row => row.cells.map(cell => ({ ...cell, method: row.method })))
            .join("td")
            .attr("class", cell => {
                if (cell.notApplicable) return "not-applicable";
                const baseClass = cell.papers.length ? "has-papers" : "is-empty";
                return cell.annotation === "none" ? baseClass : `${baseClass} is-${cell.annotation}`;
            })
            .attr("aria-label", cell => cell.notApplicable
                ? `${cell.method.label}, ${cell.metric.label}: structurally not applicable`
                : cell.papers.length
                ? `${cell.method.label}, ${cell.metric.label}: ${cell.papers.length} paper${cell.papers.length === 1 ? "" : "s"}${cell.annotation === "uncertain" ? "; applicability uncertain" : cell.annotation === "caveat" ? "; qualified with an asterisk" : ""}`
                : `${cell.method.label}, ${cell.metric.label}: no matching paper${cell.annotation === "uncertain" ? "; applicability uncertain" : cell.annotation === "caveat" ? "; qualified with an asterisk" : ""}`);

        cells.filter(cell => cell.notApplicable)
            .append("span")
            .attr("class", "na-label")
            .attr("title", "This metric is not structurally meaningful for this visualization method.")
            .text("N/A");

        cells.filter(cell => cell.annotation === "uncertain")
            .append("span")
            .attr("class", "cell-marker uncertain-marker")
            .attr("title", "Applicability is uncertain.")
            .text("?");

        cells.filter(cell => cell.annotation === "caveat")
            .append("span")
            .attr("class", "cell-marker caveat-marker")
            .attr("title", "Applicability is qualified with an asterisk.")
            .text("*");

        const lists = cells.filter(cell => cell.papers.length).append("ul").attr("class", "paper-list");
        const items = lists.selectAll("li")
            .data(cell => cell.papers.map(paper => ({ paper, method: cell.method, metric: cell.metric })))
            .join("li");

        items.append("a")
            .attr("class", "paper-link")
            .attr("href", item => normalizePaperUrl(item.paper))
            .attr("target", "_blank")
            .attr("rel", "noopener noreferrer")
            .attr("title", item => paperTitle(item.paper, item.method, item.metric))
            .text(item => citationLabel(item.paper));

        lists.filter(cell => cell.papers.length > 1)
            .append("li")
            .attr("class", "paper-count")
            .text(cell => `${cell.papers.length} papers`);

        const coveredCells = matrix.flatMap(row => row.cells).filter(cell => cell.papers.length).length;
        const applicableCells = matrix.flatMap(row => row.cells).filter(cell => !cell.notApplicable).length;
        const linkedPaperKeys = new Set(matrix.flatMap(row => row.cells).flatMap(cell => cell.papers.map(paper => paper.key)));
        d3.select("#paper-total").text(linkedPaperKeys.size);
        d3.select("#cell-total").text(`${coveredCells}/${applicableCells}`);
    }

    function renderError(error) {
        console.error(error);
        d3.select("#matrix")
            .attr("class", "error")
            .html("Could not load <code>data/paper_categorization.csv</code>. Serve this repository through a local web server and reload the page.");
    }

    renderCategoryMapping();
    renderCellAnnotationMapping();
    d3.csv(DATA_PATH).then(renderMatrix).catch(renderError);
})();
