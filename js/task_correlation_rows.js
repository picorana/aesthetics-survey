(function () {
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

    function dotColor(d) {
        return evaluationCriterionColors[(d.evaluationCriterion || "").toLowerCase()] || fallbackDotColor;
    }

    function dotSort(a, b) {
        const colorIndexA = evaluationCriterionColorOrder.indexOf(dotColor(a));
        const colorIndexB = evaluationCriterionColorOrder.indexOf(dotColor(b));
        const orderedColorIndexA = colorIndexA === -1 ? evaluationCriterionColorOrder.length : colorIndexA;
        const orderedColorIndexB = colorIndexB === -1 ? evaluationCriterionColorOrder.length : colorIndexB;

        return d3.ascending(orderedColorIndexA, orderedColorIndexB) ||
            d3.descending(a.significant, b.significant) ||
            d3.ascending(a.evaluationCriterion, b.evaluationCriterion) ||
            d3.ascending(a.bibtexKey, b.bibtexKey);
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
        const evaluatedRows = data.filter(d =>
            (d["Statistical Evaluation"] || "").trim().toLowerCase() === "yes" &&
            (d["Task Type"] || "").trim().length > 0
        );
        const dotsByAestheticTask = new Map();

        evaluatedRows.forEach(d => {
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

    function drawAestheticTaskRow(container, aesthetic, taskRows, tasksByGroup, dotsByAestheticTask) {
        const margin = { top: 155, right: 17, bottom: 0, left: 2 };
        const xCellSize = 23;
        const rowHeight = 25;
        const groupGap = 16;
        const xOffsets = cumulativeOffsets(taskRows, d => d.group, groupGap);
        const width = margin.left + taskRows.length * xCellSize + xOffsets[xOffsets.length - 1] + margin.right;
        const height = margin.top + rowHeight + margin.bottom;

        const svg = container.append("svg")
            .attr("width", width)
            .attr("height", height);

        const x = d3.scaleBand()
            .domain(taskRows.map(taskKey))
            .range([margin.left, margin.left + taskRows.length * xCellSize])
            .padding(0);

        const xWithOffset = task => x(taskKey(task)) + xOffsets[taskRows.findIndex(d => taskKey(d) === taskKey(task))];
        const rowY = margin.top - 15;
        const plotRight = xWithOffset(taskRows[taskRows.length - 1]) + x.bandwidth();
        const plotLeft = xWithOffset(taskRows[0]);

        tasksByGroup.forEach((taskTypes, group) => {
            const groupTasks = taskRows.filter(d => d.group === group);
            if (groupTasks.length === 0) return;
            const xStart = xWithOffset(groupTasks[0]);
            const xEnd = xWithOffset(groupTasks[groupTasks.length - 1]) + x.bandwidth();

            svg.append("line")
                .attr("class", "task-group-overlay")
                .attr("x1", xStart)
                .attr("x2", xEnd)
                .attr("y1", margin.top - 37)
                .attr("y2", margin.top - 37)
                .attr("stroke", taskGroupColor)
                .attr("stroke-width", 6)
                .attr("stroke-linecap", "round")
                .attr("opacity", 0.8);

            if (group !== "Overview") {
                svg.append("text")
                    .attr("class", "task-group-overlay")
                    .attr("x", xStart + (xEnd - xStart) / 2)
                    .attr("y", margin.top - 32)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "hanging")
                    .attr("fill", taskGroupColor)
                    .attr("font-size", 10)
                    .attr("font-weight", 700)
                    .text(group);
            }
        });

        svg.append("g")
            .selectAll("line")
            .data(taskRows)
            .enter()
            .append("line")
            .attr("x1", d => xWithOffset(d) + x.bandwidth() / 2)
            .attr("x2", d => xWithOffset(d) + x.bandwidth() / 2)
            .attr("y1", margin.top - 35)
            .attr("y2", margin.top + rowHeight - 20)
            .attr("stroke", "#eee")
            .attr("stroke-width", 1);

        svg.append("line")
            .attr("x1", margin.left - 8)
            .attr("x2", plotRight)
            .attr("y1", rowY + rowHeight / 2)
            .attr("y2", rowY + rowHeight / 2)
            .attr("stroke", "#f2f2f2")
            .attr("stroke-width", 1);

        svg.append("g")
            .selectAll("text")
            .data(taskRows)
            .enter()
            .append("text")
            .attr("x", d => xWithOffset(d) + x.bandwidth() / 2)
            .attr("y", margin.top - 42)
            .attr("text-anchor", "start")
            .attr("transform", d => `rotate(-55, ${xWithOffset(d) + x.bandwidth() / 2}, ${margin.top - 42})`)
            .attr("fill", d => d.group === "Overview" ? taskGroupColor : "#333")
            .attr("font-size", 10)
            .attr("font-weight", d => d.group === "Overview" ? 700 : 400)
            .text(d => taskLabel(d.taskType));

        svg.append("text")
            .attr("x", plotLeft + (plotRight - plotLeft) / 2)
            .attr("y", 16)
            .attr("text-anchor", "middle")
            .attr("fill", "#333")
            .attr("font-size", 12)
            .attr("font-weight", 700)
            .text(`Evaluations on ${aestheticLabel(aesthetic)}`);

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

        function dotLayout(d) {
            const task = { group: d.group, taskType: d.taskType };
            const rows = Math.ceil(d.count / 5);
            const baseColumns = Math.floor(d.count / rows);
            const extraColumns = d.count % rows;
            const rowCounts = d3.range(rows).map(row => baseColumns + (row < extraColumns ? 1 : 0));
            let row = 0;
            let indexInRow = d.index;
            while (indexInRow >= rowCounts[row]) {
                indexInRow -= rowCounts[row];
                row += 1;
            }
            const columnsInRow = rowCounts[row];
            const maxColumns = d3.max(rowCounts);
            const stepX = x.bandwidth() / (columnsInRow + 1);
            const dotGapY = 7;
            const dotBlockHeight = (rows - 1) * dotGapY;

            return {
                cx: xWithOffset(task) + stepX * (indexInRow + 1),
                cy: rowY + rowHeight / 2 - dotBlockHeight / 2 + row * dotGapY,
                r: Math.min(3.4, x.bandwidth() / (maxColumns + 1) * 0.38, dotGapY * 0.38)
            };
        }

        const crossSize = 4;
        const emptyCells = svg.append("g")
            .selectAll("g")
            .data(emptyTasks)
            .enter()
            .append("g")
            .attr("transform", d => `translate(${xWithOffset(d) + x.bandwidth() / 2}, ${rowY + rowHeight / 2})`)
            .attr("opacity", 0.45);

        emptyCells.append("line")
            .attr("x1", -crossSize)
            .attr("x2", crossSize)
            .attr("y1", -crossSize)
            .attr("y2", crossSize)
            .attr("stroke", "#999")
            .attr("stroke-width", 1);

        emptyCells.append("line")
            .attr("x1", -crossSize)
            .attr("x2", crossSize)
            .attr("y1", crossSize)
            .attr("y2", -crossSize)
            .attr("stroke", "#999")
            .attr("stroke-width", 1);

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
            .text(d => `${d.aesthetic} / ${d.taskType}\nCriterion: ${d.evaluationCriterion || "Unknown"}\nStatistically significant: ${d.significant ? "Yes" : "No"}\nPaper: ${d.bibtexKey || "Unknown"}`);

        svg.selectAll(".task-group-overlay").raise();
    }

    function drawColorLegend(container, width) {
        width = Math.max(width, 680);
        const margin = { top: 8, right: 20, bottom: 8, left: 65 };
        const availableWidth = width - margin.left - margin.right;
        const itemSpacing = availableWidth / (evaluationCriterionLegend.length - 1);
        const height = 48;

        const svg = container.append("svg")
            .attr("width", width)
            .attr("height", height);

        const legendItems = svg.append("g")
            .selectAll("g")
            .data(evaluationCriterionLegend)
            .enter()
            .append("g")
            .attr("transform", (d, i) => `translate(${margin.left + i * itemSpacing}, 15)`);

        legendItems.append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", 4)
            .attr("fill", d => d.color)
            .attr("fill-opacity", 0.78)
            .attr("stroke", d => d.color)
            .attr("stroke-width", 1.1);

        legendItems.append("text")
            .attr("x", 10)
            .attr("y", 0)
            .attr("dominant-baseline", "middle")
            .attr("fill", "#333")
            .attr("font-size", 11)
            .text(d => d.label);

        legendItems.each(function () {
            const group = d3.select(this);
            const textWidth = group.select("text").node().getBBox().width;
            const itemWidth = 4 + 10 + textWidth;
            group.attr("transform", function () {
                const current = d3.select(this).attr("transform");
                const match = current.match(/translate\(([^,]+),\s*([^)]+)\)/);
                const x = Number(match[1]) - itemWidth / 2;
                const y = Number(match[2]);
                return `translate(${x}, ${y})`;
            });
        });

        const significanceItems = svg.append("g")
            .selectAll("g")
            .data([
                { label: "Statistically Significant", filled: true },
                { label: "Not Statistically Significant", filled: false }
            ])
            .enter()
            .append("g")
            .attr("transform", (d, i) => `translate(${width / 2 - 145 + i * 210}, 34)`);

        significanceItems.append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", 4)
            .attr("fill", d => d.filled ? "#777" : "none")
            .attr("fill-opacity", 0.78)
            .attr("stroke", "#777")
            .attr("stroke-width", 1.1);

        significanceItems.append("text")
            .attr("x", 10)
            .attr("y", 0)
            .attr("dominant-baseline", "middle")
            .attr("fill", "#333")
            .attr("font-size", 11)
            .text(d => d.label);
    }

    function drawExampleVisualization(container) {
        const tasks = [
            { group: "...", taskType: "..." },
            { group: "...", taskType: "..." },
            { group: "...", taskType: "..." },
            { group: "...", taskType: "..." },
            { group: "...", taskType: "..." },
            { group: "...", taskType: "..." }
        ];
        const groups = [
            { label: "...", start: 0, end: 2 },
            { label: "...", start: 3, end: 4 },
            { label: "...", start: 5, end: 5 }
        ];
        const dots = [
            { task: 0, count: 3, filled: [true, false, true] },
            { task: 1, count: 1, filled: [false] },
            { task: 2, count: 6, filled: [true, true, false, false, true, false] },
            { task: 4, count: 2, filled: [true, false] }
        ];

        const margin = { top: 126, right: 18, bottom: 0, left: 20 };
        const xCellSize = 46;
        const rowHeight = 25;
        const groupGap = 18;
        const xOffsets = cumulativeOffsets(tasks, d => d.group, groupGap);
        const width = margin.left + tasks.length * xCellSize + xOffsets[xOffsets.length - 1] + margin.right;
        const height = margin.top + rowHeight;
        const rowY = margin.top - 15;
        const gray = "#777";

        const svg = container.append("svg")
            .attr("width", width)
            .attr("height", height);

        const x = d3.scaleBand()
            .domain(tasks.map((d, i) => i))
            .range([margin.left, margin.left + tasks.length * xCellSize])
            .padding(0);

        const xWithOffset = index => x(index) + xOffsets[index];
        const plotLeft = xWithOffset(0);
        const plotRight = xWithOffset(tasks.length - 1) + x.bandwidth();

        groups.forEach(group => {
            const xStart = xWithOffset(group.start);
            const xEnd = xWithOffset(group.end) + x.bandwidth();

            svg.append("line")
                .attr("class", "example-overlay")
                .attr("x1", xStart)
                .attr("x2", xEnd)
                .attr("y1", margin.top - 37)
                .attr("y2", margin.top - 37)
                .attr("stroke", gray)
                .attr("stroke-width", 6)
                .attr("stroke-linecap", "round")
                .attr("opacity", 0.8);

            svg.append("text")
                .attr("class", "example-overlay")
                .attr("x", xStart + (xEnd - xStart) / 2)
                .attr("y", margin.top - 32)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("fill", gray)
                .attr("font-size", 10)
                .attr("font-weight", 700)
                .text(group.label);
        });

        svg.append("g")
            .selectAll("line")
            .data(tasks)
            .enter()
            .append("line")
            .attr("x1", (d, i) => xWithOffset(i) + x.bandwidth() / 2)
            .attr("x2", (d, i) => xWithOffset(i) + x.bandwidth() / 2)
            .attr("y1", margin.top - 35)
            .attr("y2", margin.top + rowHeight - 20)
            .attr("stroke", "#eee")
            .attr("stroke-width", 1);

        svg.append("line")
            .attr("x1", margin.left - 8)
            .attr("x2", plotRight)
            .attr("y1", rowY + rowHeight / 2)
            .attr("y2", rowY + rowHeight / 2)
            .attr("stroke", "#f2f2f2")
            .attr("stroke-width", 1);

        svg.append("g")
            .selectAll("text")
            .data(tasks)
            .enter()
            .append("text")
            .attr("x", (d, i) => xWithOffset(i) + x.bandwidth() / 2)
            .attr("y", margin.top - 42)
            .attr("text-anchor", "start")
            .attr("transform", (d, i) => `rotate(-55, ${xWithOffset(i) + x.bandwidth() / 2}, ${margin.top - 42})`)
            .attr("fill", "#333")
            .attr("font-size", 10)
            .text(d => d.taskType);

        svg.append("text")
            .attr("x", plotLeft + (plotRight - plotLeft) / 2)
            .attr("y", 16)
            .attr("text-anchor", "middle")
            .attr("fill", "#333")
            .attr("font-size", 12)
            .attr("font-weight", 700)
            .text("Evaluations on ...");

        const occupied = new Set(dots.map(d => d.task));
        const crossSize = 4;
        tasks.forEach((task, index) => {
            if (occupied.has(index)) return;
            const cx = xWithOffset(index) + x.bandwidth() / 2;
            const cy = rowY + rowHeight / 2;
            svg.append("line")
                .attr("x1", cx - crossSize)
                .attr("x2", cx + crossSize)
                .attr("y1", cy - crossSize)
                .attr("y2", cy + crossSize)
                .attr("stroke", "#999")
                .attr("stroke-width", 1)
                .attr("opacity", 0.45);
            svg.append("line")
                .attr("x1", cx - crossSize)
                .attr("x2", cx + crossSize)
                .attr("y1", cy + crossSize)
                .attr("y2", cy - crossSize)
                .attr("stroke", "#999")
                .attr("stroke-width", 1)
                .attr("opacity", 0.45);
        });

        dots.flatMap(d => d.filled.map((filled, index) => ({ ...d, filled, index }))).forEach(dot => {
            const rows = Math.ceil(dot.count / 5);
            const baseColumns = Math.floor(dot.count / rows);
            const extraColumns = dot.count % rows;
            const rowCounts = d3.range(rows).map(row => baseColumns + (row < extraColumns ? 1 : 0));
            let row = 0;
            let indexInRow = dot.index;
            while (indexInRow >= rowCounts[row]) {
                indexInRow -= rowCounts[row];
                row += 1;
            }
            const columnsInRow = rowCounts[row];
            const maxColumns = d3.max(rowCounts);
            const stepX = x.bandwidth() / (columnsInRow + 1);
            const dotGapY = 7;
            const dotBlockHeight = (rows - 1) * dotGapY;
            const cx = xWithOffset(dot.task) + stepX * (indexInRow + 1);
            const cy = rowY + rowHeight / 2 - dotBlockHeight / 2 + row * dotGapY;
            const r = Math.min(3.4, x.bandwidth() / (maxColumns + 1) * 0.38, dotGapY * 0.38);

            svg.append("circle")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", r)
                .attr("fill", dot.filled ? gray : "none")
                .attr("fill-opacity", dot.filled ? 0.78 : 1)
                .attr("stroke", gray)
                .attr("stroke-width", 1.1);
        });

        svg.selectAll(".example-overlay").raise();
    }

    function makeAestheticTaskRows(data) {
        const container = d3.select("#task-correlation-rows");
        if (container.empty()) return;
        container.selectAll("*").remove();

        const aesthetics = uniqueInOrder(data.flatMap(d => splitTags(d["Aesthetic Tag"]))).sort(d3.ascending);
        const { taskRows, tasksByGroup } = collectTasks(data);
        const dotsByAestheticTask = collectDotsByAestheticTask(data);
        const xCellSize = 30;
        const groupGap = 16;
        const margin = { right: 40, left: 20 };
        const xOffsets = cumulativeOffsets(taskRows, d => d.group, groupGap);
        const rowWidth = margin.left + taskRows.length * xCellSize + xOffsets[xOffsets.length - 1] + margin.right;

        drawExampleVisualization(container);
        drawColorLegend(container, rowWidth);

        aesthetics.forEach(aesthetic => {
            drawAestheticTaskRow(container, aesthetic, taskRows, tasksByGroup, dotsByAestheticTask);
        });
    }

    async function initAestheticTaskRows() {
        const data = await d3.csv("data/user_study_data.csv");
        makeAestheticTaskRows(data);
    }

    initAestheticTaskRows();
})();
