let dimensions = [
    "Aesthetic Tag"
]

async function generate_table(data, dimension) {
    // for every different tag that appears in the specified dimension 
    // Flatten and split entries that are comma-separated within quotes
    // Count occurrences of each tag
    let tagCounts = {};
    data.forEach(d => {
        if (d[dimension]) {
            d[dimension]
                .split(',')
                .map(tag => tag.trim().replace(/^"|"$/g, ''))
                .filter(tag => tag.length > 0)
                .forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
        }
    });

    // Sort tags by count (descending)
    let tags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([tag, _]) => tag);

    // For each tag, collect all bibtex keys of papers containing this tag
    let tagBibtexKeys = {};
    data.forEach(d => {
        if (d[dimension]) {
            d[dimension]
                .split(',')
                .map(tag => tag.trim().replace(/^"|"$/g, ''))
                .filter(tag => tag.length > 0)
                .forEach(tag => {
                    if (!tagBibtexKeys[tag]) tagBibtexKeys[tag] = new Set();
                    if (d['Bibtex Key']) tagBibtexKeys[tag].add(d['Bibtex Key']);
                });
        }
    });

    // Group bibtex keys by paper type for each tag
    // Assume 'Paper Type' is a column in your data
    let tagPaperTypeKeys = {};
    data.forEach(d => {
        if (d[dimension]) {
            d[dimension]
                .split(',')
                .map(tag => tag.trim().replace(/^"|"$/g, ''))
                .filter(tag => tag.length > 0)
                .forEach(tag => {
                    if (!tagPaperTypeKeys[tag]) tagPaperTypeKeys[tag] = {};
                    let type = d['Paper Type'] || 'Unknown';
                    if (!tagPaperTypeKeys[tag][type]) tagPaperTypeKeys[tag][type] = new Set();
                    if (d['Bibtex Key']) tagPaperTypeKeys[tag][type].add(d['Bibtex Key']);
                });
        }
    });

    // Generate text chunks for each tag
    let chunks = [];
    tags.forEach(tag => {
        let chunk = `\\textbf{${tag}} (${tagCounts[tag]} papers):\n\n`;
        let typeKeys = tagPaperTypeKeys[tag] || {};
        Object.entries(typeKeys).forEach(([type, keysSet]) => {
            let keysArr = Array.from(keysSet);
            if (keysArr.length > 0) {
                chunk += `\\textit{${type}}: {\\color{gray}\\cite{${keysArr.join(', ')}}}\n\n`;
            }
        });
        chunks.push(chunk);
    });

    let output = chunks.join('\n');

    console.log(output)
}

async function init(dimension){
    let data = await d3.csv("data/paper_categorization.csv");
    generate_table(data, dimensions[0]);
}

// init()