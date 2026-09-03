let colors_by_dimension = {
    "Visualization Type cleanup": "#073b4c",
    "Drawing Dimensionality": "#073b4c",
    "Aesthetic Tag": "#118ab2",
    "Aesthetic Metric": "#118ab2",
    "Aesthetic Resolution": "#118ab2",
    "Graph Feature": "#06d6a0",
    "Graph Feature Clean-up": "#06d6a0",
    "Optimization Approach": "#ffd166",
    "Optimization Approach cleaned": "#ffd166",
    "Optimization Level": "#ffd166",
    "Optimization Method": "#ffd166",
    "Evaluation Methodology": "#f78c6b",
    "Evaluation Methodology cleaned": "#f78c6b",
    "Paper Type": "#f78c6b",
    "Application Domain": "#ef476f"
}

let subcategories_by_dimension = {
    "Aesthetic Tag": {
        "1": ["Edge Crossings", "Overlap", 
                "Node-Node Overlap", "Node-Edge Overlap", "Cluster-Cluster Overlap", "Label Overlap"],
        // Density
        "2": ["Density", "Node Density", "Edge Density", "Ply Number"],
        // Clutter
        "3": ["Clutter", "Number of Visual Elements", "Edge Congestion", "Sprawl"],
        // Number of visual elements, edge congestion, sprawl, sprawlter
        // Edge lengths
        // Edge Bends
        // Edge flow
        "4": ["Edge Length", "Edge Bends", "Edge Flow"],
        // Resolution
        "5": ["Angular Resolution", "Crossing Resolution", "Total Resolution", "Bend Resolution"],
        // Orthogonality
        // Node orthogonality, Edge orthogonality
        "6": ["Edge Orthogonality", "Node Orthogonality"],
        // Symmetry
        "7": ["Symmetry"],
        // Drawing area, grid size, aspect ration, height, witdt, white space, entity area, cluster area, shape
        "8": ["Total Area", "Aspect Ratio", "Whitespace", "Width", "Height", "Cluster Area", "Entity Area", "Grid Size", "Number of Layers"],
        // Fairness
        "9": ["Fairness"],
        // Faithfulness
        "10": ["Neighborhood Faithfulness", "Faithfulness", "Cluster Faithfulness", "Automorphism Faithfulness", "Change Faithfulness", "Shape-Based Faithfulness", "Automorphism Faitfulness"],
        // Neighborhood Faithfulness, shape-based faithfulness, cluster faithfullness, change faithfulness, automorphism faithfulness
        // Stability
        "11": ["Layout Stability", "Cluster Stability", "Visual Pattern Preservation"],
        // Layout stability, cluster stability, bundle stability
        // Tangles
        // Energy and stress
        "12": ["Stress", "Energy"],
        // bandwidth
        "13": ["Bandwidth"],
        // polygon properties
        "14": ["Polygon Complexity", "Face Convexity", "Shape"],
        // visual pattern preservation
    },
    "Paper Type": {
        "1": ["Algorithm", "Evaluation", "Comparison", "Method", "Proof", "Application", "Aesthetic", "Technique", "Design Space"],
    },
    "Optimization Approach cleaned": {
        "1": ["Heuristic", "Exact", "Proof", "Machine Learning", "Manual", "Simplification"],
        "Ignore": ["None"]
    },
    "Graph Feature Clean-up": {
        "1": ["Simple"],
        "2": ["Tree", "Layered", "Hierarchy"],
        "3": ["Directed", "Undirected"],
        "4": ["Dynamic"],
        "5": ["Clustered"],
        "6": ["Geometric Contraints"],
        "7": ["Acyclic", "Cyclic"],
        "8": ["Complete"],
        "9": ["Hypergraph", "Multigraph"],
        "10": ["Weighted", "Unweighted"],
        
        
        "11": ["Sparse"],
        
        
        "12": ["Multivariate"],
        
        "13": ["Egocentric"],
        "14": ["Labeled Nodes"],
        "15": ["Ordered"],
        "16": ["N-Connected", "Regular"],
        "18": ["Maximum Degree", "Maximum Tree-width"],
        "19": ["Bipartite"],
        
        "20": ["Large"],
    },
    "Evaluation Methodology cleaned": {
        "1": ["Computational (Aesthetic)", "Computational (Run Time)", "Computational (Memory Usage)"],
        "2": ["Looking at Pictures", "Case Study", "Expert Interviews"],
        "3": ["User Study (Quantitative)", "User Study (Qualitative)"],
        "4": ["Proof", "Bounds", "Complexity"],
        "5": ["Comparison"],
        "6": ["None"]
    },
    "Visualization Type cleanup": {
        "1": ["Node-Link", "Tree", "Adjacency Matrix", "Storyline", "Space-Filling",   "Hybrid", "Flow Graph","Biofabric", "Parallel Coordinates",
 
 "Contact Graph","Space-Time-Cube",
 "Visibility Drawing"]
    }
}

async function make_upset_visualization(data, dimension, minlimit = 20) {
    let contentainer = d3.select("#upset");
    let width = contentainer.node().getBoundingClientRect().width;
    let height = 600;
    let margin = {top: 150, right: 10, bottom: 0, left: 180};

    let svg = contentainer.append("svg")
        .attr("width", width)
        .attr("height", height);

    // Process data to get unique sets and their combinations
    // Count occurrences of each set
    let counts = {};
    data.forEach(d => {
        let tags = d[dimension].split(",").map(s => s.trim()).filter(s => s.length > 0);
        // Count all possible non-empty combinations
        for (let k = 1; k <= tags.length; k++) {
            let combos = k === 1 ? tags.map(tag => [tag]) : getCombinations(tags, k);
            combos.forEach(combo => {
                let key = combo.sort().join(" & ");
                counts[key] = (counts[key] || 0) + 1;
            });
        }
    });

    // Helper function to get all k-combinations of an array
    function getCombinations(arr, k) {
        let results = [];
        function helper(start, combo) {
            if (combo.length === k) {
                results.push([...combo]);
                return;
            }
            for (let i = start; i < arr.length; i++) {
                combo.push(arr[i]);
                helper(i + 1, combo);
                combo.pop();
            }
        }
        helper(0, []);
        return results;
    }

    // Sort sets by occurrences (descending)
    let sets = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([set]) => set);
    let n = sets.length;

    let individual_sets = sets.filter(s => !s.includes("&") && counts[s] >= minlimit);

    let vertical_coordinates = {};
    individual_sets.forEach((s, i) => {
        vertical_coordinates[s] = margin.top + (i + 0.5) * (height - margin.top - margin.bottom) / individual_sets.length;
    });

    for (let el of individual_sets) {
        // make a background that is gray and white alternating
        svg.append("rect")
            .attr("x", 0)
            .attr("y", vertical_coordinates[el] - (height - margin.top - margin.bottom) / individual_sets.length / 2)
            .attr("width", width)
            .attr("rx", 10)
            .attr("ry", 10)
            .attr("height", (height - margin.top - margin.bottom) / individual_sets.length)
            .attr("fill", (individual_sets.indexOf(el) % 2 === 0) ? "#fff" : "#f0f0f0");

        svg.append("text")
            .attr("x", margin.left - 10)
            .attr("y", vertical_coordinates[el])
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("font-size", "12px")
            .style("font-weight", "bold")
            .style("fill", "#333")
            .text(el);
    }

    // filter sets so that we only have counts > 10
    sets = sets.filter(set => counts[set] >= minlimit);
    n = sets.length;

    // Use a scale for bar height
    let barScale = d3.scaleLinear()
        .domain([0, d3.max(sets.map(s => counts[s]))])
        .range([0, margin.top - 100]);


    // append numbers for bar scale (no ticks, just numbers, bold font)
    let yAxisScale = d3.scaleLinear()
        .domain([0, d3.max(sets.map(s => counts[s]))])
        .range([margin.top - 100, 0]);

    let yAxis = d3.axisLeft(yAxisScale)
        .ticks(5)
        .tickFormat(d3.format("d"));

    svg.selectAll("line.bar-line")
        .data(yAxisScale.ticks(5))
        .enter()
        .append("line")
        .attr("class", "bar-line")
        .attr("x1", margin.left - 5)
        .attr("y1", d => margin.top - 50 + yAxisScale(d))
        .attr("x2", width - margin.right)
        .attr("y2", d => margin.top - 50 + yAxisScale(d))
        .attr("stroke", "#eee")
        .attr("stroke-width", 3)
        .style("stroke-linecap", "round")
        .attr("stroke-dasharray", "6,6");

    // for every set, draw a line connecting the individual sets
    for (let i = 0; i < sets.length; i++) {
        let set = sets[i];
        let tags = set.split("&").map(s => s.trim());
        let y_positions = tags.map(tag => vertical_coordinates[tag]).sort((a, b) => a - b);
        let x = margin.left + (i + 0.5) * (width - margin.left - margin.right) / n;

        // Draw line
        svg.append("line")
            .attr("x1", x)
            .attr("y1", y_positions[0])
            .attr("x2", x)
            .attr("y2", y_positions[y_positions.length - 1])
            .attr("stroke", "#333")
            .attr("stroke-width", 3);

        // Draw circles at each individual set position
        y_positions.forEach(y => {
            svg.append("circle")
                .attr("cx", x)
                .attr("cy", y)
                .attr("r", 4)
                .attr("fill", "#333");
        });

        // Draw bar for count

        // Calculate the horizontal space between elements
        let barWidth = (width - margin.left - margin.right) / n * 0.7; // 70% of the available slot
        svg.append("rect")
            .attr("x", x - barWidth / 2)
            .attr("y", margin.top - barScale(counts[set]))
            .attr("width", barWidth)
            .attr("height", barScale(counts[set]))
            .attr("fill", colors_by_dimension[dimension] || "#118ab2")
            .attr("rx", Math.min(4, barWidth*2))
            .attr("ry", Math.min(4, barWidth*2))
            .attr("stroke", "#333")
            .attr("stroke-width", 0)
            .append("title")
            .text(`${set}: ${counts[set]}`);

        // svg.append("text")
        //     .attr("x", x)
        //     .attr("y", margin.top - barScale(counts[set]) - 8)
        //     .attr("text-anchor", "middle")
        //     .attr("font-size", "11px")
        //     .style("font-weight", "bold")
        //     .style("fill", "#333")
        //     .text(counts[set]);


    }

    // // Add title
    // svg.append("text")
    //     .attr("x", width / 2)
    //     .attr("y", margin.top / 2)
    //     .attr("text-anchor", "middle")
    //     .attr("font-size", "16px")
    //     .attr("font-weight", "bold")
    //     .text("UpSet Visualization of " + dimension);

    svg.append("g")
        .attr("transform", `translate(${margin.left - 5},${margin.top - 50})`)
        .call(
            yAxis
                .ticks(2)
                .tickValues(
                    yAxisScale.ticks(2).filter(d => d !== 0)
                )
        )
        .call(g => g.select(".domain").remove()); // Remove the vertical axis line

    // Remove all ticks from the SVG
    svg.selectAll("g.tick").selectAll("line").attr("stroke-width", 3).attr("stroke", "#333")
    .style("stroke-linecap", "round");

    // all tick labels should be bold and dark gray
    svg.selectAll("g.tick").selectAll("text")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .style("font-size", "11px");
}

async function make_correlation_matrix (data, dimension1, dimension2, dim1limit=10, dim2limit=10, margin = {top: 80, right: 20, bottom: 60, left: 190}) {
    let contentainer = d3.select("#correlation-matrix");
    let width = 500;
    let height = 400;

    let svg = contentainer.append("svg")
        .attr("width", width)
        .attr("height", height);

    // Calculate number of unique aesthetics and paper types
    let aesthetics = Array.from(new Set(data.map(d => d[dimension1]).flatMap(d => d.split(",").map(s => s.trim())))).filter(d => d.length > 0);
    let n = aesthetics.length;
    let paperTypes = Array.from(new Set(data.map(d => d[dimension2]).flatMap(d => d.split(",").map(s => s.trim())))).filter(d => d.length > 0);
    let m = paperTypes.length;

    // Calculate the maximum possible square size based on width and margins
    let availableWidth = width - margin.left - margin.right;
    let availableHeight = height - margin.top - margin.bottom;
    let squareSize = 22;
    let xsquareSize = 26;
        
    // if anything in dimension1 or dimension2 has a count of 0, remove it
    let aestheticCounts = {};
    let paperTypeCounts = {};
    
    data.forEach(d => {
        d[dimension1].split(",").map(s => s.trim()).forEach(tag => {
            if (tag.length > 0) {
                aestheticCounts[tag] = (aestheticCounts[tag] || 0) + 1;
            }
        });
        
        d[dimension2].split(",").map(s => s.trim()).forEach(tag => {
            if (tag.length > 0) {
                paperTypeCounts[tag] = (paperTypeCounts[tag] || 0) + 1;
            }
        });
    });

    aesthetics = aesthetics.filter(aesthetic => aestheticCounts[aesthetic] > dim1limit);
    paperTypes = paperTypes.filter(paperType => paperTypeCounts[paperType] > dim2limit);
    n = aesthetics.length;
    m = paperTypes.length;

    // sort the aesthetics based on subcategories if they exist
    if (subcategories_by_dimension[dimension1]) {
        // Flatten subcategories into a single ordered array
        let ordered = [];
        Object.values(subcategories_by_dimension[dimension1]).forEach(arr => {
            ordered = ordered.concat(arr);
        });
        // Only keep aesthetics that are present in the ordered list, in that order
        let orderedAesthetics = ordered.filter(a => aesthetics.includes(a));
        // Collect the rest (not in ordered) and sort alphabetically
        let rest = aesthetics.filter(a => !ordered.includes(a)).sort();
        aesthetics = orderedAesthetics.concat(rest);
    }

    // do the same for paper type
    if (subcategories_by_dimension[dimension2]) {
        // Flatten subcategories into a single ordered array
        let ordered = [];
        Object.values(subcategories_by_dimension[dimension2]).forEach(arr => {
            ordered = ordered.concat(arr);
        });
        // Only keep paper types that are present in the ordered list, in that order
        let orderedPaperTypes = ordered.filter(a => paperTypes.includes(a));
        // Collect the rest (not in ordered) and sort alphabetically
        let rest = paperTypes.filter(a => !ordered.includes(a)).sort();
        paperTypes = orderedPaperTypes.concat(rest);
    }
    

    // Create a matrix to hold counts
    let matrix = Array.from({ length: n }, () => Array(m).fill(0));
    
    // Fill the matrix with counts  
    data.forEach(d => {
        let aestheticTags = d[dimension1].split(",").map(s => s.trim());
        let paperTypeTags = d[dimension2].split(",").map(s => s.trim());
        aestheticTags.forEach(aesthetic => {
            paperTypeTags.forEach(paperType => {
                let i = aesthetics.indexOf(aesthetic);
                let j = paperTypes.indexOf(paperType);
                if (i >= 0 && j >= 0) {
                    matrix[i][j] += 1;
                }
            });
        });
    }
    );

    // // Define scales
    // let x = d3.scaleBand()
    //     .domain(paperTypes)
    //     .range([margin.left, width - margin.right])
    //     .padding(0.1);
        
    // Compute extra padding between rows if aesthetics belong to different categories
    // First, build a mapping from aesthetic to its category (if available)
    let aestheticCategory = {};
    if (subcategories_by_dimension[dimension1]) {
        Object.entries(subcategories_by_dimension[dimension1]).forEach(([cat, arr]) => {
            arr.forEach(aesthetic => {
                aestheticCategory[aesthetic] = cat;
            });
        });
    }

    // Compute an array of extra offsets for each row
    // Compute extra padding between columns if paperTypes belong to different categories
    let paperTypeCategory = {};
    if (subcategories_by_dimension[dimension2]) {
        Object.entries(subcategories_by_dimension[dimension2]).forEach(([cat, arr]) => {
            arr.forEach(paperType => {
                paperTypeCategory[paperType] = cat;
            });
        });
    }

    let extraPadding = 12; // px of extra space between categories
    let yOffsets = [0];
    for (let i = 1; i < aesthetics.length; i++) {
        let prevCat = aestheticCategory[aesthetics[i - 1]] || null;
        let currCat = aestheticCategory[aesthetics[i]] || null;
        if (prevCat !== currCat) {
            yOffsets[i] = yOffsets[i - 1] + extraPadding;
        } else {
            yOffsets[i] = yOffsets[i - 1];
        }
    }

    // Compute xOffsets for columns (paperTypes)
    let xOffsets = [0];
    for (let i = 1; i < paperTypes.length; i++) {
        let prevCat = paperTypeCategory[paperTypes[i - 1]] || null;
        let currCat = paperTypeCategory[paperTypes[i]] || null;
        if (prevCat !== currCat) {
            xOffsets[i] = xOffsets[i - 1] + 0.5*extraPadding;
        } else {
            xOffsets[i] = xOffsets[i - 1];
        }
    }

    // Adjust height so that rects are square and fit all elements
    height = margin.top + n * squareSize + margin.bottom;
    svg.attr("height", height);

    // also adjust width if needed, accounting for xOffsets
    let requiredWidth = margin.left + m * xsquareSize + (xOffsets.length > 0 ? xOffsets[xOffsets.length - 1] : 0) + margin.right + 100; // extra space for totals
    svg.attr("width", Math.max(width, requiredWidth));

    // Custom y scale with extra space between categories
    let y = d3.scaleBand()
        .domain(aesthetics)
        .range([margin.top, height - margin.bottom - yOffsets[yOffsets.length - 1]])
        .padding(0.1);

    // Make x scale spacing match y scale spacing
    // Custom x scale with extra space between categories (using xOffsets)
    let x = d3.scaleBand()
        .domain(paperTypes)
        .range([margin.left, margin.left + m * xsquareSize + xOffsets[xOffsets.length - 1]])
        .padding(0.2);

    // Helper to get x position with offset
    function xWithOffset(paperType) {
        let idx = paperTypes.indexOf(paperType);
        return x(paperType) + xOffsets[idx];
    }

    // Helper to get y position with offset
    function yWithOffset(aesthetic) {
        let idx = aesthetics.indexOf(aesthetic);
        return y(aesthetic) + yOffsets[idx];
    }


    // Draw cells
    // Create color interpolator between the two dimension colors
    const color2 = d3.color(colors_by_dimension[dimension1]) || d3.color("#118ab2");
    const color1 = d3.color(colors_by_dimension[dimension2]) || d3.color("#f78c6b");
    const colorInterp = d3.interpolateRgb(color1, color2);

    // Define a drop shadow filter
    svg.append("defs").append("filter")
        .attr("id", "drop-shadow")
        .attr("height", "130%")
        .html(`
            <feDropShadow dx="1" dy="1" stdDeviation="2" flood-color="#888" flood-opacity="0.5"/>
        `);

    svg.selectAll("rect")
        .data(matrix.flatMap((row, i) => row.map((value, j) => ({ aesthetic: aesthetics[i], paperType: paperTypes[j], value, i, j }))))
        .enter()
        .append("rect")
        .attr("x", d => xWithOffset(d.paperType))
        .attr("y", d => yWithOffset(d.aesthetic))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        // .attr("fill", d => colorInterp((d.i + (paperTypes.length - 1 - d.j)) / (aesthetics.length + paperTypes.length - 2)))
        .attr("fill", d => colors_by_dimension[dimension1])
        .attr("fill-opacity", d => d.value > 0 ? Math.min(0.1 + d.value / d3.max(matrix.flat()), 1) : 0)
        .attr("rx", Math.min(x.bandwidth(), y.bandwidth()) / 4)
        .attr("ry", Math.min(x.bandwidth(), y.bandwidth()) / 4)
        .attr("filter", "url(#drop-shadow)")
        .style("stroke", d => d.value > 0 ? "#333" : "none")
        .style("stroke-width", 0)
        .append("title")
        .text(d => `${d.aesthetic} & ${d.paperType}: ${d.value}`);

    // Use a logarithmic scale for square size (avoid log(0) by using 1 + value)
    const maxValue = d3.max(matrix.flat());
    const minValue = d3.min(matrix.flat().filter(v => v > 0)) || 1;
    const logScale = d3.scaleLog()
        .domain([minValue, maxValue])
        .range([0.6, 1]); // min 50% size, max 100% size

    let rectsize = Math.min(x.bandwidth(), y.bandwidth());

    // svg.selectAll("rect")
    //     .data(matrix.flatMap((row, i) => row.map((value, j) => ({ aesthetic: aesthetics[i], paperType: paperTypes[j], value, i, j }))))
    //     .enter()
    //     .append("rect")
    //     .attr("x", d => {
    //         let scale = d.value > 0 ? logScale(d.value) : 0;
    //         return x(d.paperType) + (x.bandwidth() - rectsize * scale) / 2;
    //     })
    //     .attr("y", d => {
    //         let scale = d.value > 0 ? logScale(d.value) : 0;
    //         return yWithOffset(d.aesthetic) + (y.bandwidth() - rectsize * scale) / 2;
    //     })
    //     .attr("width", d => {
    //         let scale = d.value > 0 ? logScale(d.value) : 0;
    //         return rectsize * scale;
    //     })
    //     .attr("height", d => {
    //         let scale = d.value > 0 ? logScale(d.value) : 0;
    //         return rectsize * scale;
    //     })
    //     .attr("fill", d => colors_by_dimension[dimension1])
    //     .attr("rx", Math.min(x.bandwidth(), y.bandwidth()) / 4)
    //     .attr("ry", Math.min(x.bandwidth(), y.bandwidth()) / 4)
    //     .attr("filter", "url(#drop-shadow)")
    //     .style("stroke", d => d.value > 0 ? "#333" : "none")
    //     .style("stroke-width", d => d.value > 0 ? 2.5 : 0)
    //     .append("title")
    //     .text(d => `${d.aesthetic} & ${d.paperType}: ${d.value}`);

    // add total count at the end of a row of rects
    // Compute total count for each aesthetic (row)
    let rowTotals = aesthetics.map((aesthetic, i) => {
        // Count unique entries (papers) for this aesthetic
        let uniqueEntries = new Set();
        data.forEach(d => {
            let tags = d[dimension1].split(",").map(s => s.trim());
            if (tags.includes(aesthetic)) {
                uniqueEntries.add(d["Title"] || d["ID"] || JSON.stringify(d));
            }
        });
        return {
            aesthetic,
            total: uniqueEntries.size
        };
    });

    if (subcategories_by_dimension[dimension1]) {
        Object.entries(subcategories_by_dimension[dimension1]).forEach(([cat, group]) => {
            // Find the indices of aesthetics in this group
            let indices = group
                .map(aesthetic => aesthetics.indexOf(aesthetic))
                .filter(idx => idx !== -1);
            if (indices.length === 0) return;

            // Get the vertical positions for the first and last aesthetic in the group
            let firstIdx = Math.min(...indices);
            let lastIdx = Math.max(...indices);

            let yStart = yWithOffset(aesthetics[firstIdx]);
            let yEnd = yWithOffset(aesthetics[lastIdx]) + y.bandwidth();

            // Draw a colored line spanning all elements in the group
            svg.append("line")
                .attr("x1", margin.left - 6)
                .attr("x2", margin.left - 6)
                .attr("y1", yStart)
                .attr("y2", yEnd)
                .attr("stroke", colors_by_dimension[dimension1] || "#118ab2")
                .attr("stroke-width", 6)
                .attr("stroke-linecap", "round")
                .attr("opacity", 0.7);

            // Draw a horizontal gray separator below the last element in the group, except for the last group
            if (lastIdx < aesthetics.length - 1) {
                svg.append("line")
                    .attr("x1", margin.left + 10)
                    .attr("x2", xWithOffset(paperTypes[paperTypes.length - 1]) + x.bandwidth() - 5)
                    .attr("y1", yEnd + 6)
                    .attr("y2", yEnd + 6)
                    .attr("stroke", "#eee")
                    .attr("stroke-width", 2);
            }
        });
    }

    if (subcategories_by_dimension[dimension2]) {
        Object.entries(subcategories_by_dimension[dimension2]).forEach(([cat, group]) => {
            // Find the indices of paperTypes in this group
            let indices = group
                .map(paperType => paperTypes.indexOf(paperType))
                .filter(idx => idx !== -1);
            if (indices.length === 0) return;

            // Get the horizontal positions for the first and last paperType in the group
            let firstIdx = Math.min(...indices);
            let lastIdx = Math.max(...indices);

            let xStart = xWithOffset(paperTypes[firstIdx]);
            let xEnd = xWithOffset(paperTypes[lastIdx]) + x.bandwidth();

            // Draw a colored line spanning all elements in the group
            svg.append("line")
                .attr("y1", margin.top - 7)
                .attr("y2", margin.top - 7)
                .attr("x1", xStart)
                .attr("x2", xEnd)
                .attr("stroke", colors_by_dimension[dimension2] || "#f78c6b")
                .attr("stroke-width", 6)
                .attr("stroke-linecap", "round")
                .attr("opacity", 0.7);

            // make a vertical gray separator spanning the whole height below the paper type labels for each category
            // Only draw the separator if this is not the last category
            if (lastIdx < paperTypes.length - 1) {
                svg.append("line")
                    .attr("y1", margin.top + 5)
                    .attr("y2", height - margin.bottom - 5)
                    .attr("x1", xEnd + 6)
                    .attr("x2", xEnd + 6)
                    .attr("stroke", "#eee")
                    .attr("stroke-width", 2);
            }
        });

        
    }

    // Compute the x position at the end of the rects (after all columns)
    // Compute the x position at the end of the rects (after all columns), accounting for xOffsets
    let lastColIdx = paperTypes.length - 1;
    let rowTotalX = xWithOffset(paperTypes[lastColIdx]) + x.bandwidth() + 10;
    let rowBarX = xWithOffset(paperTypes[lastColIdx]) + x.bandwidth() + 40;

    let maxRowTotal = d3.max(rowTotals.map(d => d.total));
    let rowBarScale = d3.scaleLinear()
        .domain([0, maxRowTotal])
        .range([2, 80]);

    svg.selectAll("text.row-total")
        .data(rowTotals)
        .enter()
        .append("text")
        .attr("class", "row-total")
        .attr("x", rowTotalX)
        .attr("y", d => yWithOffset(d.aesthetic) + y.bandwidth() / 2 + 3)
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .attr("fill", "#999")
        .text(d => d.total);

    let barTicks = rowBarScale.ticks(3).filter(tick => tick > 0 && tick < maxRowTotal);
    barTicks.forEach(tick => {
        svg.append("line")
            .attr("x1", rowBarX + rowBarScale(tick))
            .attr("x2", rowBarX + rowBarScale(tick))
            .attr("y1", margin.top )
            .attr("y2", height - margin.bottom)
            .attr("stroke", "#eee")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4,4");

        svg.append("text")
            .attr("x", rowBarX + rowBarScale(tick))
            .attr("y", margin.top - 5)
            .attr("text-anchor", "start")
            .attr("font-size", "11px")
            .attr("font-weight", "bold")
            .attr("fill", "#888")
            .attr("transform", `rotate(-45,${rowBarX + rowBarScale(tick)},${margin.top - 5})`)
            .text(tick);
    });

    svg.selectAll("rect.row-bar")
        .data(rowTotals)
        .enter()
        .append("rect")
        .attr("class", "row-bar")
        .attr("x", rowBarX)
        .attr("y", d => {
            let idx = aesthetics.indexOf(d.aesthetic);
            return y(d.aesthetic) + yOffsets[idx] + y.bandwidth() / 4;
        })
        .attr("width", d => rowBarScale(d.total))
        .attr("height", 0.7 * y.bandwidth())
        .attr("fill", colors_by_dimension[dimension1] || "#118ab2")
        .attr("rx", 2)
        .attr("ry", 2)
        .attr("opacity", 0.7)
        .append("title")
        .text(d => `${d.aesthetic}: ${d.total}`);

    // do the same for the other dimension
    let colTotals = paperTypes.map((paperType, j) => {
        // Count unique entries (papers) for this paper type
        let uniqueEntries = new Set();
        data.forEach(d => {
            let tags = d[dimension2].split(",").map(s => s.trim());
            if (tags.includes(paperType)) {
                uniqueEntries.add(d["Title"] || d["ID"] || JSON.stringify(d));
            }
        });
        return {
            paperType,
            total: uniqueEntries.size
        };
    });

    svg.selectAll("text.col-total")
        .data(colTotals)
        .enter()
        .append("text")
        .attr("class", "col-total")
        .attr("x", d => xWithOffset(d.paperType) + x.bandwidth() / 2)
        .attr("y", height - margin.bottom + 20)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .attr("fill", "#999")
        .text(d => d.total);

    let colBarY = height - margin.bottom + 30;
    let colBarHeight = 80;
    let maxColTotal = d3.max(colTotals.map(d => d.total));
    let colBarScale = d3.scaleLinear()
        .domain([0, maxColTotal])
        .range([2, colBarHeight]);

    let colBarTicks = colBarScale.ticks(3).filter(tick => tick > 0 && tick < maxColTotal);

    colBarTicks.forEach(tick => {
        svg.append("line")
            .attr("x1", xWithOffset(paperTypes[0]))
            .attr("x2", xWithOffset(paperTypes[paperTypes.length - 1]) + x.bandwidth())
            .attr("y1", colBarY + colBarScale(tick))
            .attr("y2", colBarY + colBarScale(tick))
            .attr("stroke", "#eee")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4,4");

        svg.append("text")
            .attr("x", margin.left - 5)
            .attr("y", colBarY + colBarScale(tick))
            .attr("text-anchor", "end")
            .attr("font-size", "11px")
            .attr("font-weight", "bold")
            .attr("fill", "#888")
            .text(tick);
    });

    svg.selectAll("rect.col-bar")
        .data(colTotals)
        .enter()
        .append("rect")
        .attr("class", "col-bar")
        .attr("x", d => xWithOffset(d.paperType) + (y.bandwidth()) / 2)
        .attr("y", colBarY)
        .attr("width", .8 * y.bandwidth())
        .attr("height", d => colBarScale(d.total))
        .attr("fill", colors_by_dimension[dimension2] || "#f78c6b")
        .attr("rx", 2)
        .attr("ry", 2)
        .attr("opacity", 0.7)
        .append("title")
        .text(d => `${d.paperType}: ${d.total}`);

    // Add only the names (labels), not the axes
    // Paper type labels (top)
    svg.selectAll("text.paper-type-label")
        .data(paperTypes)
        .enter()
        .append("text")
        .attr("class", "paper-type-label")
        .attr("x", d => xWithOffset(d) + x.bandwidth() / 2)
        .attr("y", margin.top - 15)
        .attr("text-anchor", "start")
        .attr("transform", d => `rotate(-45,${xWithOffset(d) + x.bandwidth() / 2},${margin.top - 10})`)
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", "#333")
        .text(d => d);

    // Aesthetic labels (left)
    svg.selectAll("text.aesthetic-label")
        .data(aesthetics)
        .enter()
        .append("text")
        .attr("class", "aesthetic-label")
        .attr("x", margin.left - 15)
        .attr("y", d => yWithOffset(d) + y.bandwidth() / 2)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", "#333")
        .text(d => d);

    // // Add labels
    // svg.append("text")
    //     .attr("x", width / 2)
    //     .attr("y", margin.top / 2)
    //     .attr("text-anchor", "middle")
    //     .attr("font-size", "16px")
    //     .attr("font-weight", "bold")
    //     .text("Correlation Matrix of " + dimension1 + " and " + dimension2);

    // Add numbers in the cells
    svg.selectAll("text.cell-text")
        .data(matrix.flatMap((row, i) => row.map((value, j) => ({ aesthetic: aesthetics[i], paperType: paperTypes[j], value }))))
        .enter()
        .append("text")
        .attr("class", "cell-text")
        .attr("x", d => xWithOffset(d.paperType) + x.bandwidth() / 2)
        .attr("y", d => yWithOffset(d.aesthetic) + y.bandwidth() / 2)
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        // .attr("fill", "white")
        .attr("fill", d => d.value > d3.max(matrix.flat())*.8 / 2 ? "white" : "black")
        .text(d => d.value > 0 ? d.value : "");
}

async function make_timeline_by_aesthetic (data, dimension) {
    let contentainer = d3.select("#timeline-by-aesthetic");
    let width = 800;
    let height = 1400;
    let margin = {top: 50, right: 20, bottom: 30, left: 190};
    let distance_between_aesthetics = 40;

    let svg = contentainer.append("svg")
        .attr("width", width)
        .attr("height", height);

    // list all aesthetics in the data
    let aesthetics = data.map(d => d[dimension].split(","))
        .flat()
        .map(d => d.trim())
        .filter(d => d.length > 0);

    // Count occurrences
    let counts = {};
    aesthetics.forEach(aesthetic => {
        counts[aesthetic] = (counts[aesthetic] || 0) + 1;
    });

    // filter all elements before 1985
    data = data.filter(d => +d["Year"] >= 1985);

    // filter to only those with more than 20 occurrences
    counts = Object.fromEntries(
        Object.entries(counts).filter(([aesthetic, count]) => count >= 10)
    );

    // Make a violin plot where the x axis is year and the y axis is count
    let years = data.map(d => +d["Year"]).filter(d => !isNaN(d));
    
    let x = d3.scaleLinear()
        .domain([1985, d3.max(years) + 1])
        .range([margin.left, width - margin.right]);

    let y = d3.scaleLinear()
        .domain([0, d3.max(Object.values(counts))])
        .range([0, 600]);

    // every 5 years
    for (let year = 1990; year <= d3.max(years) - 5; year += 5) {
        svg.append("line")
            .attr("x1", x(year))
            .attr("y1", margin.top - 20)
            .attr("x2", x(year))
            .attr("y2", height - margin.bottom)
            .attr("stroke", "#ccc")
            .attr("stroke-width", 3)
            .style("stroke-linecap", "round")
            .attr("stroke-dasharray", "2,8");

        svg.append("text")
            .attr("x", x(year))
            .attr("y", height - margin.bottom + 15)
            .attr("text-anchor", "middle")
            .style("fill", "#666")
            .style("font-weight", "bold")
            .attr("font-size", "12px")
            .text(year);
    }

    // For each aesthetic, plot points over time
    let color = d3.scaleOrdinal(d3.schemeCategory10)
        .domain(Object.keys(counts));

    // for each aesthetic
    Object.keys(counts).forEach(aesthetic => {

        let path = [];

        // // draw a horizontal lines where 20 papers per year would be
        // svg.append("line")
        //     .attr("x1", margin.left + width*.1)
        //     .attr("y1", margin.top + distance_between_aesthetics * Object.keys(counts).indexOf(aesthetic) - y(50))
        //     .attr("x2", width - margin.right)
        //     .attr("y2", margin.top + distance_between_aesthetics * Object.keys(counts).indexOf(aesthetic) - y(50))
        //     .attr("stroke", "#666")
        //     .attr("stroke-width", 3)
        //     .style("stroke-linecap", "round")
        //     .style("stroke-dasharray", "6,8");

        // add name of the aesthetic on the left
        svg.append("text")
            .attr("x", margin.left - 10)
            .attr("y", margin.top + distance_between_aesthetics * Object.keys(counts).indexOf(aesthetic))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("font-size", "13px")
            .style("font-weight", "bold")
            .style("fill", "#333")
            .text(aesthetic);

        // for each year from min to max
        for (let year = 1980; year <= d3.max(years); year++) {
            // count how many papers in that year have that aesthetic
            let count = data.filter(d => {
                let tags = d[dimension].split(",").map(s => s.trim());
                return tags.includes(aesthetic) && +d["Year"] === year;
            }).length;

            // if (count === 0) continue;

            // build path for violin plot
            path.push([year, count]);
        }

        // split the path into sections before and after counts get to 0
        let first_nonzero_index = path.findIndex(d => d[1] > 0);
        let last_nonzero_index = path.length - 1 - [...path].reverse().findIndex(d => d[1] > 0);
        path = path.slice(first_nonzero_index, last_nonzero_index + 1);

        // it needs to be split in multiple parts if there are zeros in between
        let split_paths = [];
        let current_path = [];
        path.forEach(d => {
            if (d[1] === 0) {
                if (current_path.length > 0) {
                    split_paths.push(current_path);
                    current_path = [];
                }
            } else {
                current_path.push(d);
            }
        });

        if (current_path.length > 0) {
            split_paths.push(current_path);
        }

        for (let path of split_paths) {
            // mirror the path for the bottom half of the violin plot
            let backpath = path.slice().reverse().map(d => [d[0], d[1]* -1]);
            path = path.concat(backpath);

            // draw a closed path (area) connecting the points
            if (path.length > 3) {

            // Build area path by connecting the points (not closing to baseline)
            let minThickness = 8; // minimum thickness in pixels
            let area = d3.line()
                .x(d => x(d[0]))
                .y(d => {
                    // Center line for this aesthetic
                    let centerY = margin.top + distance_between_aesthetics * Object.keys(counts).indexOf(aesthetic);
                    // Calculate offset from center, ensure minimum thickness
                    let offset = y(d[1]);
                    if (Math.abs(offset) < minThickness / 2 && d[1] !== 0) {
                        offset = (offset >= 0 ? 1 : -1) * (minThickness / 2);
                    }
                    return centerY + offset;
                })
                .curve(d3.curveBasisClosed);

            // Add drop shadow filter definition if not already present
            if (svg.select("defs").empty()) {
                svg.append("defs")
                .append("filter")
                .attr("id", "violin-drop-shadow")
                .attr("height", "130%")
                .html(`
                    <feDropShadow dx="1" dy="2" stdDeviation="2" flood-color="#888" flood-opacity="0.25"/>
                `);
            }

            svg.append("path")
                .datum(path)
                .attr("fill", colors_by_dimension[dimension] || "#118ab2")
                .attr("fill-opacity", 1)
                // .attr("stroke", "#333")
                .attr("stroke", d3.color(colors_by_dimension[dimension] || "#118ab2"))
                .attr("stroke-width", path.length > 8 ? 5 : 5)
                .attr("d", area)
                .style("stroke-linecap", "round")
                .attr("filter", path.length > 8 ? "url(#violin-drop-shadow)" : null);
            }

            // add just a circle if there are only 2 points
            if (path.length === 2) {
                svg.append("circle")
                    .attr("cx", x(path[0][0]))
                    .attr("cy", margin.top + distance_between_aesthetics * Object.keys(counts).indexOf(aesthetic))
                    .attr("r", 2)
                    .attr("stroke", d3.color(colors_by_dimension[dimension] || "#118ab2"))
                    .attr("stroke-width", 5)
                    .attr("fill", d3.color(colors_by_dimension[dimension] || "#118ab2"))
                    .attr("opacity", 1);
            }
        }


        // let backpath = path.slice().reverse().map(d => [d[0], d[1]* -1]);
        // path = path.concat(backpath);

        // draw a closed path (area) connecting the points
        // if (path.length > 1) {
        //     // Build area path by closing the shape to the baseline
        //     let area = d3.area()
        //     .x(d => x(d[0]))
        //     .y0(margin.top + 50 * Object.keys(counts).indexOf(aesthetic))
        //     .y1(d => margin.top + 50 * Object.keys(counts).indexOf(aesthetic) + y(d[1]))
        //     .curve(d3.curveBasisClosed);

        //     svg.append("path")
        //     .datum(path)
        //     .attr("fill", "steelblue")
        //     .attr("fill-opacity", 1)
        //     .attr("stroke", "#333")
        //     .attr("stroke-width", 3)
        //     .attr("d", area)
        //     .style("stroke-linecap", "round")
        // }

        // for every year, find papers that have this aesthetic and have type "Evaluation"
        for (let year = 1980; year <= d3.max(years); year++) {
            let count = data.filter(d => {
                let tags = d[dimension].split(",").map(s => s.trim());
                return tags.includes(aesthetic) && +d["Year"] === year && d["Paper Type"] === "Evaluation";
            }).length;

            if (count == 0) continue;

            // Build a path for the "Evaluation" counts over time (like the main violin path)
            let evalPath = [];
            for (let evalYear = 1980; evalYear <= d3.max(years); evalYear++) {
                let evalCount = data.filter(d => {
                    let tags = d[dimension].split(",").map(s => s.trim());
                    return tags.includes(aesthetic) && +d["Year"] === evalYear && d["Paper Type"] === "Evaluation";
                }).length;
                evalPath.push([evalYear, evalCount]);
            }

            // Trim leading/trailing zeros
            let firstEvalIdx = evalPath.findIndex(d => d[1] > 0);
            let lastEvalIdx = evalPath.length - 1 - [...evalPath].reverse().findIndex(d => d[1] > 0);
            evalPath = evalPath.slice(firstEvalIdx, lastEvalIdx + 1);

            // Split into segments if there are zeros in between
            let evalSplitPaths = [];
            let evalCurrent = [];
            evalPath.forEach(d => {
                if (d[1] === 0) {
                    if (evalCurrent.length > 0) {
                        evalSplitPaths.push(evalCurrent);
                        evalCurrent = [];
                    }
                } else {
                    evalCurrent.push(d);
                }
            });
            if (evalCurrent.length > 0) {
                evalSplitPaths.push(evalCurrent);
            }

            for (let path of evalSplitPaths) {
                // Mirror for violin shape
                let backpath = path.slice().reverse().map(d => [d[0], d[1] * -1]);
                let fullPath = path.concat(backpath);

                if (fullPath.length > 3) {
                    let minThickness = 6; // minimum thickness in pixels
                    let area = d3.line()
                        .x(d => x(d[0]))
                        .y(d => {
                            // Center line for this aesthetic
                            let centerY = margin.top + distance_between_aesthetics * Object.keys(counts).indexOf(aesthetic);
                            // Calculate offset from center, ensure minimum thickness
                            let offset = y(d[1]);
                            if (Math.abs(offset) < minThickness / 2 && d[1] !== 0) {
                                offset = (offset >= 0 ? 1 : -1) * (minThickness / 2);
                            }
                            return centerY + offset;
                        })
                        .curve(d3.curveBasisClosed);

                    svg.append("path")
                        .datum(fullPath)
                        .attr("fill", "#eee")
                        .attr("fill-opacity", 0.7)
                        .attr("stroke", d3.color(colors_by_dimension[dimension] || "#118ab2"))
                        .attr("stroke-width", 1)
                        .attr("d", area)
                        .style("stroke-linecap", "round");
                }

                // If only two points, draw a circle
                if (fullPath.length === 2) {
                    svg.append("circle")
                        .attr("cx", x(fullPath[0][0]))
                        .attr("cy", margin.top + distance_between_aesthetics * Object.keys(counts).indexOf(aesthetic))
                        .attr("r", 4)
                        .attr("stroke", d3.color(colors_by_dimension[dimension] || "#118ab2"))
                        .attr("stroke-width", 3)
                        .attr("fill", "#eee")
                        .attr("opacity", 1);
                }
            }
        }

    });

}

async function init () {
    let data = await d3.csv("data/paper_categorization.csv");
    data = data.filter(d => d["Keep"] == "Yes" && !d["Paper Type"].includes("Survey"));  

    // make_upset_visualization(data, "Visualization Type cleanup");
    // make_upset_visualization(data, "Drawing Dimensionality");
    // make_upset_visualization(data, "Optimization Level");
    // make_upset_visualization(data, "Optimization Approach");
    make_upset_visualization(data, "Aesthetic Tag");
    // make_upset_visualization(data, "Paper Type");
    // make_upset_visualization(data, "Graph Feature Clean-up");
    // make_upset_visualization(data, "Optimization Approach cleaned");
    // make_upset_visualization(data, "Visualization Type cleanup");

    make_correlation_matrix(data, "Aesthetic Tag", "Graph Feature Clean-up", 10, 10, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Aesthetic Tag", "Paper Type", 10, 10, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Aesthetic Tag", "Optimization Approach cleaned", 10, 1, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Aesthetic Tag", "Visualization Type cleanup", 10, 1, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Aesthetic Tag", "Evaluation Methodology cleaned", 10, 1, {top: 150, bottom: 100, left: 200, right: 200});

    make_correlation_matrix(data, "Graph Feature Clean-up", "Aesthetic Tag", 7, 10, {top: 150, bottom: 150, left: 200, right: 200});
    make_correlation_matrix(data, "Graph Feature Clean-up", "Paper Type", 1, 1, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Graph Feature Clean-up", "Optimization Approach cleaned", 7, 10, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Graph Feature Clean-up", "Visualization Type cleanup", 7, 1, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Graph Feature Clean-up", "Evaluation Methodology cleaned", 7, 1, {top: 150, bottom: 100, left: 200, right: 200});

    make_correlation_matrix(data, "Paper Type", "Aesthetic Tag", 7, 10, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Paper Type", "Graph Feature Clean-up", 1, 1, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Paper Type", "Optimization Approach cleaned", 7, 10, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Paper Type", "Visualization Type cleanup", 7, 1, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Paper Type", "Evaluation Methodology cleaned", 7, 1, {top: 150, bottom: 100, left: 200, right: 200});

    make_correlation_matrix(data, "Optimization Approach cleaned", "Aesthetic Tag", 7, 10, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Optimization Approach cleaned", "Graph Feature Clean-up", 1, 1, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Optimization Approach cleaned", "Paper Type", 7, 10, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Optimization Approach cleaned", "Visualization Type cleanup", 7, 1, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Optimization Approach cleaned", "Evaluation Methodology cleaned", 7, 1, {top: 150, bottom: 100, left: 200, right: 200});
    
    make_correlation_matrix(data, "Visualization Type cleanup", "Aesthetic Tag", 7, 10, {top: 150, bottom: 150, left: 200, right: 200});
    make_correlation_matrix(data, "Visualization Type cleanup", "Graph Feature Clean-up", 1, 1, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Visualization Type cleanup", "Paper Type", 7, 10, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Visualization Type cleanup", "Optimization Approach cleaned", 7, 1, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Visualization Type cleanup", "Evaluation Methodology cleaned", 7, 1, {top: 150, bottom: 100, left: 200, right: 200});

    make_correlation_matrix(data, "Evaluation Methodology cleaned", "Aesthetic Tag", 7, 10, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Evaluation Methodology cleaned", "Graph Feature Clean-up", 1, 1, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Evaluation Methodology cleaned", "Paper Type", 7, 10, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Evaluation Methodology cleaned", "Optimization Approach cleaned", 7, 1, {top: 150, bottom: 100, left: 200, right: 200});
    make_correlation_matrix(data, "Evaluation Methodology cleaned", "Visualization Type cleanup", 7, 1, {top: 150, bottom: 100, left: 200, right: 200});

    make_timeline_by_aesthetic(data, "Aesthetic Tag");
    make_timeline_by_aesthetic(data, "Paper Type");
    make_timeline_by_aesthetic(data, "Optimization Approach cleaned");
    make_timeline_by_aesthetic(data, "Visualization Type cleanup");
    make_timeline_by_aesthetic(data, "Graph Feature Clean-up");    
}

init();