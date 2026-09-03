(function () {
    const dotColor = "#118ab2";
    const gridColor = "#d9d9d9";
    const countColor = "#777";
    const citationColor = "#0033cc";

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
        return { min: d3.min(parts), max: d3.max(parts) };
    }

    function hasNumber(value) {
        return value !== null && value !== undefined && Number.isFinite(value);
    }

    function median(values) {
        const cleanValues = values.filter(hasNumber);
        return cleanValues.length ? d3.median(cleanValues) : null;
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
            .sort((a, b) =>
                paperCounts.get(b) - paperCounts.get(a) ||
                a.localeCompare(b)
            );
        aesthetics = aesthetics.sort((a, b) =>
            aestheticCounts.get(b) - aestheticCounts.get(a) ||
            a.localeCompare(b)
        );

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
            nodeMin: entry.nodeMins.length ? d3.min(entry.nodeMins) : null,
            nodeMax: entry.nodeMaxes.length ? d3.max(entry.nodeMaxes) : null
        }));
    }

    function drawPaperAestheticMatrix(data) {
        const container = d3.select("#paper-aesthetic-matrix");
        if (container.empty()) return;
        container.selectAll("*").remove();

        const { papers, aesthetics, paperAesthetics, aestheticCounts, paperCounts } = makeMatrix(data);
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
        const rowTotals = papers.map(paper => ({
            paper,
            total: paperCounts.get(paper)
        }));
        const columnTotals = aesthetics.map(aesthetic => ({
            aesthetic,
            total: aestheticCounts.get(aesthetic)
        }));
        const maxRowTotal = d3.max(rowTotals, d => d.total);
        const maxColumnTotal = d3.max(columnTotals, d => d.total);
        const countX = margin.left + plotWidth + countGap;
        const barX = margin.left + plotWidth + barGap;
        const bottomBarY = margin.top + plotHeight + bottomBarGap;
        const rowBarScale = d3.scaleLinear()
            .domain([0, maxRowTotal])
            .range([0, barWidth]);
        const columnBarScale = d3.scaleLinear()
            .domain([0, maxColumnTotal])
            .range([0, bottomBarHeight]);

        const layout = container.append("div")
            .style("display", "flex")
            .style("align-items", "flex-start")
            .style("gap", "18px");
        const matrixContainer = layout.append("div");
        const scaleContainer = layout.append("div");

        const svg = matrixContainer.append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .style("display", "block")
            .style("font-family", "Arial, Helvetica, sans-serif");

        const x = d3.scaleBand()
            .domain(aesthetics)
            .range([margin.left, margin.left + plotWidth])
            .padding(0);

        const y = d3.scaleBand()
            .domain(papers)
            .range([margin.top, margin.top + plotHeight])
            .padding(0);

        svg.append("g")
            .selectAll("line")
            .data(d3.range(1, aesthetics.length))
            .enter()
            .append("line")
            .attr("x1", i => margin.left + i * cellWidth)
            .attr("x2", i => margin.left + i * cellWidth)
            .attr("y1", margin.top)
            .attr("y2", margin.top + plotHeight)
            .attr("stroke", gridColor)
            .attr("stroke-width", 1);

        svg.append("g")
            .selectAll("line")
            .data(d3.range(1, papers.length))
            .enter()
            .append("line")
            .attr("x1", margin.left)
            .attr("x2", margin.left + plotWidth)
            .attr("y1", i => margin.top + i * cellHeight)
            .attr("y2", i => margin.top + i * cellHeight)
            .attr("stroke", gridColor)
            .attr("stroke-width", 1);

        svg.append("g")
            .selectAll("text")
            .data(aesthetics)
            .enter()
            .append("text")
            .attr("x", d => x(d) + x.bandwidth() / 2)
            .attr("y", margin.top - 18)
            .attr("text-anchor", "start")
            .attr("transform", d => `rotate(-45, ${x(d) + x.bandwidth() / 2}, ${margin.top - 18})`)
            .attr("fill", "#000")
            .attr("font-size", 16)
            .attr("font-weight", 700)
            .text(d => d);

        svg.append("g")
            .selectAll("text")
            .data(papers)
            .enter()
            .append("text")
            .attr("x", margin.left - 10)
            .attr("y", d => y(d) + y.bandwidth() / 2)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#000")
            .attr("font-size", 18)
            .attr("font-weight", 400)
            .text(d => paperLabels[d] || `[${d}]`);

        const dots = papers.flatMap(paper =>
            aesthetics
                .filter(aesthetic => paperAesthetics.get(paper).has(aesthetic))
                .map(aesthetic => ({ aesthetic, paper }))
        );

        svg.append("g")
            .selectAll("circle")
            .data(dots)
            .enter()
            .append("circle")
            .attr("cx", d => x(d.aesthetic) + x.bandwidth() / 2)
            .attr("cy", d => y(d.paper) + y.bandwidth() / 2)
            .attr("r", dotRadius)
            .attr("fill", dotColor)
            .append("title")
            .text(d => `${d.aesthetic}\n${paperLabels[d.paper] || d.paper}\n${d.paper}`);

        const barTicks = rowBarScale.ticks(3).filter(tick => tick > 0 && tick < maxRowTotal);

        svg.append("g")
            .selectAll("line")
            .data(barTicks)
            .enter()
            .append("line")
            .attr("x1", d => barX + rowBarScale(d))
            .attr("x2", d => barX + rowBarScale(d))
            .attr("y1", margin.top)
            .attr("y2", margin.top + plotHeight)
            .attr("stroke", "#eee")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4,4");

        svg.append("g")
            .selectAll("text")
            .data(barTicks)
            .enter()
            .append("text")
            .attr("x", d => barX + rowBarScale(d))
            .attr("y", margin.top - 7)
            .attr("text-anchor", "start")
            .attr("fill", "#888")
            .attr("font-size", 15)
            .attr("font-weight", 700)
            .attr("transform", d => `rotate(-45, ${barX + rowBarScale(d)}, ${margin.top - 7})`)
            .text(d => d);

        svg.append("g")
            .selectAll("rect")
            .data(rowTotals)
            .enter()
            .append("rect")
            .attr("x", barX)
            .attr("y", d => y(d.paper) + y.bandwidth() * 0.25)
            .attr("width", d => rowBarScale(d.total))
            .attr("height", y.bandwidth() * 0.5)
            .attr("fill", dotColor)
            .attr("fill-opacity", 0.7)
            .attr("rx", 2)
            .attr("ry", 2)
            .append("title")
            .text(d => `${paperLabels[d.paper] || d.paper}: ${d.total}`);

        svg.append("g")
            .selectAll("text")
            .data(rowTotals)
            .enter()
            .append("text")
            .attr("x", countX + 7)
            .attr("y", d => y(d.paper) + y.bandwidth() / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", countColor)
            .attr("font-size", 18)
            .attr("font-weight", 700)
            .text(d => d.total);

        const columnBarTicks = columnBarScale.ticks(3).filter(tick => tick > 0 && tick < maxColumnTotal);

        svg.append("g")
            .selectAll("line")
            .data(columnBarTicks)
            .enter()
            .append("line")
            .attr("x1", margin.left)
            .attr("x2", margin.left + plotWidth)
            .attr("y1", d => bottomBarY + columnBarScale(d))
            .attr("y2", d => bottomBarY + columnBarScale(d))
            .attr("stroke", "#eee")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4,4");

        svg.append("g")
            .selectAll("text")
            .data(columnBarTicks)
            .enter()
            .append("text")
            .attr("x", margin.left - 8)
            .attr("y", d => bottomBarY + columnBarScale(d))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#888")
            .attr("font-size", 15)
            .attr("font-weight", 700)
            .text(d => d);

        svg.append("g")
            .selectAll("rect")
            .data(columnTotals)
            .enter()
            .append("rect")
            .attr("x", d => x(d.aesthetic) + x.bandwidth() * 0.25)
            .attr("y", bottomBarY)
            .attr("width", x.bandwidth() * 0.5)
            .attr("height", d => columnBarScale(d.total))
            .attr("fill", dotColor)
            .attr("fill-opacity", 0.7)
            .attr("rx", 2)
            .attr("ry", 2)
            .append("title")
            .text(d => `${d.aesthetic}: ${d.total}`);

        svg.append("g")
            .selectAll("text")
            .data(columnTotals)
            .enter()
            .append("text")
            .attr("x", d => x(d.aesthetic) + x.bandwidth() / 2)
            .attr("y", bottomBarY - 9)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", countColor)
            .attr("font-size", 18)
            .attr("font-weight", 700)
            .text(d => d.total);

        drawPaperScaleCharts(scaleContainer, {
            papers,
            matrixPlotWidth: plotWidth,
            matrixHeight: height,
            matrixAxisY: margin.top - 18,
            matrixGridBottom: margin.top + plotHeight,
            paperStats: collectPaperScaleStats(data, papers)
        });
    }

    function drawPaperScaleCharts(container, { papers, matrixPlotWidth, matrixHeight, matrixAxisY, matrixGridBottom, paperStats }) {
        const chartGap = 0;
        const margin = { top: 30, right: 10, bottom: 20, left: 54 };
        const plotWidth = matrixPlotWidth / 1.5;
        const width = margin.left + plotWidth + margin.right;
        const height = matrixHeight + 20;
        const chartAreaTop = matrixAxisY;
        const chartAreaBottom = matrixGridBottom;
        const chartHeight = (chartAreaBottom - chartAreaTop - chartGap) / 3;

        const svg = container.append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .style("display", "block")
            .style("font-family", "Arial, Helvetica, sans-serif")
            .style("margin-top", "0");

        const x = d3.scaleBand()
            .domain(papers)
            .range([margin.left, margin.left + plotWidth])
            .padding(0.2);
        const guideTop = chartAreaTop + margin.top;
        const guideBottom = chartAreaBottom - margin.bottom;

        const charts = [
            {
                label: "Num. Participants",
                value: d => d.participants,
                max: d3.max(paperStats, d => d.participants) || 1,
                color: "#118ab2",
                valueLabel: d => d.participants ?? "",
                title: d => `${paperLabels[d.paper] || d.paper}: ${d.participants ?? "Unknown"} participants`
            },
            {
                label: "Num. of Graphs",
                value: d => d.graphs,
                max: d3.max(paperStats, d => d.graphs) || 1,
                color: "#ef476f",
                valueLabel: d => d.graphs ?? "",
                title: d => `${paperLabels[d.paper] || d.paper}: ${d.graphs ?? "Unknown"} graphs`
            },
            {
                label: "|N| range",
                value: d => d.nodeMax,
                minValue: d => d.nodeMin,
                max: d3.max(paperStats, d => d.nodeMax) || 1,
                color: "#06d6a0",
                valueLabel: d => d.nodeMax ?? "",
                title: d => `${paperLabels[d.paper] || d.paper}: ${d.nodeMin ?? "Unknown"}-${d.nodeMax ?? "Unknown"} nodes`
            }
        ];

        svg.append("g")
            .selectAll("line")
            .data(papers)
            .enter()
            .append("line")
            .attr("x1", d => x(d) + x.bandwidth() / 2)
            .attr("x2", d => x(d) + x.bandwidth() / 2)
            .attr("y1", guideTop)
            .attr("y2", guideBottom)
            .attr("stroke", "#e6e6e6")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,4");

        charts.forEach((chart, index) => {
            const chartY = chartAreaTop + index * (chartHeight + chartGap);
            const innerTop = chartY + margin.top;
            const innerBottom = chartY + chartHeight - margin.bottom;
            const y = d3.scaleLinear()
                .domain([0, chart.max])
                .nice()
                .range([innerBottom, innerTop]);
            const ticks = y.ticks(3).filter(tick => tick > 0 && tick < chart.max);

            svg.append("g")
                .selectAll("line")
                .data(ticks)
                .enter()
                .append("line")
                .attr("x1", margin.left)
                .attr("x2", margin.left + plotWidth)
                .attr("y1", d => y(d))
                .attr("y2", d => y(d))
                .attr("stroke", "#eee")
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", "4,4");

            svg.append("text")
                .attr("x", margin.left + plotWidth / 2)
                .attr("y", chartY + 13)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("fill", "#333")
                .attr("font-size", 18)
                .attr("font-weight", 700)
                .text(chart.label);

            svg.append("g")
                .selectAll("line")
                .data(papers)
                .enter()
                .append("line")
                .attr("x1", d => x(d) + x.bandwidth() / 2)
                .attr("x2", d => x(d) + x.bandwidth() / 2)
                .attr("y1", innerBottom)
                .attr("y2", innerBottom + 5)
                .attr("stroke", "#888")
                .attr("stroke-width", 1);

            svg.append("g")
                .selectAll("text")
                .data(ticks)
                .enter()
                .append("text")
                .attr("x", margin.left - 8)
                .attr("y", d => y(d))
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .attr("fill", "#888")
                .attr("font-size", 15)
                .attr("font-weight", 700)
                .text(d => d);

            if (chart.minValue) {
                const nodeStats = paperStats.filter(d => hasNumber(chart.value(d)) && hasNumber(chart.minValue(d)));
                const rangeStats = nodeStats.filter(d => chart.value(d) !== chart.minValue(d));
                const pointStats = nodeStats.filter(d => chart.value(d) === chart.minValue(d));

                svg.append("g")
                    .selectAll("line")
                    .data(rangeStats)
                    .enter()
                    .append("line")
                    .attr("x1", d => x(d.paper) + x.bandwidth() / 2)
                    .attr("x2", d => x(d.paper) + x.bandwidth() / 2)
                    .attr("y1", d => y(chart.minValue(d)))
                    .attr("y2", d => y(chart.value(d)))
                    .attr("stroke", chart.color)
                    .attr("stroke-width", Math.max(3, x.bandwidth() * 0.45))
                    .attr("stroke-linecap", "round")
                    .attr("opacity", 0.7)
                    .append("title")
                    .text(chart.title);

                svg.append("g")
                    .selectAll("circle")
                    .data(pointStats)
                    .enter()
                    .append("circle")
                    .attr("cx", d => x(d.paper) + x.bandwidth() / 2)
                    .attr("cy", d => y(chart.value(d)))
                    .attr("r", Math.max(3, x.bandwidth() * 0.28))
                    .attr("fill", chart.color)
                    .attr("fill-opacity", 0.8)
                    .append("title")
                    .text(chart.title);

                svg.append("g")
                    .selectAll("text")
                    .data(rangeStats)
                    .enter()
                    .append("text")
                    .attr("x", d => x(d.paper) + x.bandwidth() / 2)
                    .attr("y", d => y(chart.value(d)) - 8)
                    .attr("text-anchor", "middle")
                    .attr("fill", countColor)
                    .attr("font-size", 12)
                    .attr("font-weight", 700)
                    .text(d => chart.value(d));

                svg.append("g")
                    .selectAll("text")
                    .data(rangeStats)
                    .enter()
                    .append("text")
                    .attr("x", d => x(d.paper) + x.bandwidth() / 2)
                    .attr("y", d => y(chart.minValue(d)) + 14)
                    .attr("text-anchor", "middle")
                    .attr("fill", countColor)
                    .attr("font-size", 12)
                    .attr("font-weight", 700)
                    .text(d => chart.minValue(d));

                svg.append("g")
                    .selectAll("text")
                    .data(pointStats)
                    .enter()
                    .append("text")
                    .attr("x", d => x(d.paper) + x.bandwidth() / 2)
                    .attr("y", d => y(chart.value(d)) - 8)
                    .attr("text-anchor", "middle")
                    .attr("fill", countColor)
                    .attr("font-size", 12)
                    .attr("font-weight", 700)
                    .text(chart.valueLabel);
            } else {
                svg.append("g")
                    .selectAll("rect")
                    .data(paperStats.filter(d => hasNumber(chart.value(d))))
                    .enter()
                    .append("rect")
                    .attr("x", d => x(d.paper))
                    .attr("y", d => y(chart.value(d)))
                    .attr("width", x.bandwidth())
                    .attr("height", d => innerBottom - y(chart.value(d)))
                    .attr("fill", chart.color)
                    .attr("fill-opacity", 0.7)
                    .attr("rx", 2)
                    .attr("ry", 2)
                    .append("title")
                    .text(chart.title);

                svg.append("g")
                    .selectAll("text")
                    .data(paperStats.filter(d => hasNumber(chart.value(d))))
                    .enter()
                    .append("text")
                    .attr("x", d => x(d.paper) + x.bandwidth() / 2)
                    .attr("y", d => y(chart.value(d)) - 4)
                    .attr("text-anchor", "middle")
                    .attr("fill", countColor)
                    .attr("font-size", 12)
                    .attr("font-weight", 700)
                    .text(chart.valueLabel);
            }

            if (index === charts.length - 1) {
                svg.append("g")
                    .selectAll("text")
                    .data(papers)
                    .enter()
                    .append("text")
                    .attr("x", d => x(d) + x.bandwidth() / 2)
                    .attr("y", chartAreaBottom)
                    .attr("text-anchor", "end")
                    .attr("transform", d => `rotate(-45, ${x(d) + x.bandwidth() / 2}, ${chartAreaBottom})`)
                    .attr("fill", "#000")
                    .attr("font-size", 14)
                    .attr("font-weight", 400)
                    .text(d => paperLabels[d] || `[${d}]`);
            }
        });
    }

    async function initPaperAestheticMatrix() {
        const data = await d3.csv("data/user_study_data.csv");
        drawPaperAestheticMatrix(data);
    }

    initPaperAestheticMatrix();
})();
