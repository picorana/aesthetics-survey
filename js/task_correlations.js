(function () {
    const taskHierarchyColors = {
        "Topology": "steelblue",
        "Browsing": "steelblue",
        "Overview": "steelblue",
        "Attributes": "steelblue"
    };

    const fallbackAestheticColor = "#118ab2";
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

    function splitTags(value) {
        return (value || "")
            .split(",")
            .map(d => d.trim().replace(/^"|"$/g, ""))
            .filter(d => d.length > 0);
    }

    function uniqueInOrder(values) {
        return Array.from(new Set(values.filter(d => d && d.length > 0)));
    }

    function orderAesthetics(aesthetics) {
        if (typeof subcategories_by_dimension === "undefined" || !subcategories_by_dimension["Aesthetic Tag"]) {
            return aesthetics.sort(d3.ascending);
        }

        let groupedOrder = [];
        Object.values(subcategories_by_dimension["Aesthetic Tag"]).forEach(group => {
            groupedOrder = groupedOrder.concat(group);
        });

        return groupedOrder
            .filter(d => aesthetics.includes(d))
            .concat(aesthetics.filter(d => !groupedOrder.includes(d)).sort(d3.ascending));
    }

    function aestheticCategoryLookup() {
        const categories = {};
        if (typeof subcategories_by_dimension === "undefined" || !subcategories_by_dimension["Aesthetic Tag"]) {
            return categories;
        }

        Object.entries(subcategories_by_dimension["Aesthetic Tag"]).forEach(([category, aesthetics]) => {
            aesthetics.forEach(aesthetic => {
                categories[aesthetic] = category;
            });
        });

        return categories;
    }

    function cumulativeOffsets(items, categoryForItem, gap) {
        const offsets = [0];
        for (let i = 1; i < items.length; i++) {
            offsets[i] = offsets[i - 1] + (categoryForItem(items[i - 1]) !== categoryForItem(items[i]) ? gap : 0);
        }
        return offsets;
    }

    function makeTaskAestheticCorrelationChart(data) {
        const container = d3.select("#task-correlations");
        if (container.empty()) return;

        container.selectAll("*").remove();

        const evaluatedRows = data.filter(d =>
            (d["Statistical Evaluation"] || "").trim().toLowerCase() === "yes" &&
            (d["Task Type"] || "").trim().length > 0
        );

        const aesthetics = orderAesthetics(uniqueInOrder(data.flatMap(d => splitTags(d["Aesthetic Tag"]))));
        const taskGroups = uniqueInOrder(data.map(d => (d["Task Group"] || "").trim()));
        const tasksByGroup = new Map(taskGroups.map(group => [group, []]));

        data.forEach(d => {
            const group = (d["Task Group"] || "").trim();
            const taskType = (d["Task Type"] || "").trim();
            if (!group || !taskType) return;
            if (!tasksByGroup.has(group)) tasksByGroup.set(group, []);
            if (!tasksByGroup.get(group).includes(taskType)) tasksByGroup.get(group).push(taskType);
        });

        const taskRows = Array.from(tasksByGroup.entries())
            .flatMap(([group, taskTypes]) => taskTypes.map(taskType => ({ group, taskType })));

        const taskKey = d => `${d.group}::${d.taskType}`;
        const aestheticCategories = aestheticCategoryLookup();
        const xGap = 10;
        const yGap = 16;
        const xOffsets = cumulativeOffsets(aesthetics, d => aestheticCategories[d] || d, xGap);
        const yOffsets = cumulativeOffsets(taskRows, d => d.group, yGap);

        const xCellSize = 44;
        const yCellSize = 25;
        const margin = { top: 180, right: 80, bottom: 40, left: 230 };
        const width = margin.left + aesthetics.length * xCellSize + xOffsets[xOffsets.length - 1] + margin.right;
        const height = margin.top + taskRows.length * yCellSize + yOffsets[yOffsets.length - 1] + margin.bottom;

        const svg = container.append("svg")
            .attr("width", width)
            .attr("height", height);

        const x = d3.scaleBand()
            .domain(aesthetics)
            .range([margin.left, margin.left + aesthetics.length * xCellSize])
            .padding(0);

        const y = d3.scaleBand()
            .domain(taskRows.map(taskKey))
            .range([margin.top, margin.top + taskRows.length * yCellSize])
            .padding(0);

        const xWithOffset = aesthetic => x(aesthetic) + xOffsets[aesthetics.indexOf(aesthetic)];
        const yWithOffset = row => y(taskKey(row)) + yOffsets[taskRows.findIndex(d => taskKey(d) === taskKey(row))];
        const plotRight = xWithOffset(aesthetics[aesthetics.length - 1]) + x.bandwidth();
        const plotBottom = yWithOffset(taskRows[taskRows.length - 1]) + y.bandwidth();

        const counts = new Map();
        evaluatedRows.forEach(d => {
            const group = (d["Task Group"] || "").trim();
            const taskType = (d["Task Type"] || "").trim();
            const significant = (d["Statistically Significant"] || "").trim().toLowerCase() === "yes";
            const evaluationCriterion = (d["Evaluation Criterion"] || "").trim();
            splitTags(d["Aesthetic Tag"]).forEach(aesthetic => {
                const key = `${aesthetic}::${group}::${taskType}`;
                if (!counts.has(key)) {
                    counts.set(key, {
                        aesthetic,
                        group,
                        taskType,
                        count: 0,
                        dots: [],
                        papers: new Set()
                    });
                }
                counts.get(key).count += 1;
                counts.get(key).dots.push({
                    significant,
                    evaluationCriterion,
                    bibtexKey: (d["Bibtex Key"] || "").trim()
                });
                counts.get(key).papers.add((d["Bibtex Key"] || "").trim());
            });
        });

        svg.append("g")
            .selectAll("line")
            .data(aesthetics)
            .enter()
            .append("line")
            .attr("x1", d => xWithOffset(d) + x.bandwidth() / 2)
            .attr("x2", d => xWithOffset(d) + x.bandwidth() / 2)
            .attr("y1", margin.top - 6)
            .attr("y2", plotBottom)
            .attr("stroke", "#eee")
            .attr("stroke-width", 1);

        svg.append("g")
            .selectAll("line")
            .data(taskRows)
            .enter()
            .append("line")
            .attr("x1", margin.left - 8)
            .attr("x2", plotRight)
            .attr("y1", d => yWithOffset(d) + y.bandwidth() / 2)
            .attr("y2", d => yWithOffset(d) + y.bandwidth() / 2)
            .attr("stroke", "#f2f2f2")
            .attr("stroke-width", 1);

        tasksByGroup.forEach((taskTypes, group) => {
            const rows = taskRows.filter(d => d.group === group);
            if (rows.length === 0) return;

            const yStart = yWithOffset(rows[0]);
            const yEnd = yWithOffset(rows[rows.length - 1]) + y.bandwidth();
            const color = taskHierarchyColors[group] || "#999";

            svg.append("line")
                .attr("x1", margin.left - 18)
                .attr("x2", margin.left - 18)
                .attr("y1", yStart)
                .attr("y2", yEnd)
                .attr("stroke", color)
                .attr("stroke-width", 6)
                .attr("stroke-linecap", "round")
                .attr("opacity", 0.8);

            if (group !== "Overview") {
                const labelX = margin.left - 6;
                const labelY = yStart + (yEnd - yStart) / 2;
                svg.append("text")
                    .attr("x", labelX)
                    .attr("y", labelY)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("transform", `rotate(-90, ${labelX}, ${labelY})`)
                    .attr("fill", color)
                    .attr("font-size", 10)
                    .attr("font-weight", 700)
                    .text(group);
            }
        });

        svg.append("g")
            .selectAll("text")
            .data(aesthetics)
            .enter()
            .append("text")
            .attr("x", d => xWithOffset(d) + x.bandwidth() / 2)
            .attr("y", margin.top - 14)
            .attr("text-anchor", "start")
            .attr("transform", d => `rotate(-55, ${xWithOffset(d) + x.bandwidth() / 2}, ${margin.top - 14})`)
            .attr("fill", "#333")
            .attr("font-size", 11)
            .text(d => d);

        svg.append("g")
            .selectAll("text")
            .data(taskRows)
            .enter()
            .append("text")
            .attr("x", margin.left - 30)
            .attr("y", d => yWithOffset(d) + y.bandwidth() / 2)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", d => d.group === "Overview" ? taskHierarchyColors["Overview"] : "#333")
            .attr("font-size", 11)
            .attr("font-weight", d => d.group === "Overview" ? 700 : 400)
            .text(d => d.taskType);

        function dotColor(d) {
            return evaluationCriterionColors[(d.evaluationCriterion || "").toLowerCase()] || fallbackAestheticColor;
        }

        function dotSort(a, b) {
            const colorA = dotColor(a);
            const colorB = dotColor(b);
            const colorIndexA = evaluationCriterionColorOrder.indexOf(colorA);
            const colorIndexB = evaluationCriterionColorOrder.indexOf(colorB);
            const orderedColorIndexA = colorIndexA === -1 ? evaluationCriterionColorOrder.length : colorIndexA;
            const orderedColorIndexB = colorIndexB === -1 ? evaluationCriterionColorOrder.length : colorIndexB;

            return d3.ascending(orderedColorIndexA, orderedColorIndexB) ||
                d3.descending(a.significant, b.significant) ||
                d3.ascending(a.evaluationCriterion, b.evaluationCriterion) ||
                d3.ascending(a.bibtexKey, b.bibtexKey);
        }

        const dotData = Array.from(counts.values())
            .filter(d => aesthetics.includes(d.aesthetic))
            .flatMap(d => d.dots
                .map(dot => ({ ...d, ...dot }))
                .sort(dotSort)
                .map((dot, index) => ({ ...dot, index })));

        function dotLayout(d) {
            const columns = Math.min(d.count, Math.ceil(Math.sqrt(d.count) * 1.8));
            const rows = Math.ceil(d.count / columns);
            const column = d.index % columns;
            const row = Math.floor(d.index / columns);
            const stepX = x.bandwidth() / (columns + 1);
            const stepY = y.bandwidth() / (rows + 1);

            return {
                cx: xWithOffset(d.aesthetic) + stepX * (column + 1),
                cy: yWithOffset({ group: d.group, taskType: d.taskType }) + stepY * (row + 1),
                r: Math.min(3.4, stepX * 0.38, stepY * 0.38)
            };
        }

        svg.append("g")
            .selectAll("circle")
            .data(dotData)
            .enter()
            .append("circle")
            .attr("cx", d => dotLayout(d).cx)
            .attr("cy", d => dotLayout(d).cy)
            .attr("r", d => dotLayout(d).r)
            .attr("fill", d => d.significant ? dotColor(d) : "none")
            .attr("fill-opacity", d => d.significant ? 0.78 : 1)
            .attr("stroke", d => dotColor(d))
            .attr("stroke-width", 1.1)
            .append("title")
            .text(d => `${d.aesthetic} / ${d.taskType}\nCriterion: ${d.evaluationCriterion || "Unknown"}\nStatistically significant: ${d.significant ? "Yes" : "No"}\nEvaluated rows: ${d.count}\nPaper: ${d.bibtexKey || "Unknown"}`);
    }

    async function initTaskCorrelations() {
        const data = await d3.csv("data/user_study_data.csv");
        makeTaskAestheticCorrelationChart(data);
    }

    initTaskCorrelations();
})();
