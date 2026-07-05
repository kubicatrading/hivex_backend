const fs = require('fs');

// Simple mockup of the splitTranscription function
function splitTranscription(text) {
  if (!text) return { transcription: "", summary: "", charts: "", report: "" };
  
  const regexSplit = /\n\s*(?:---|===|\*\*\*|___|- - -)[^\n]*\n/;
  const parts = text.split(regexSplit);
  
  let transcription = "";
  let summary = "";
  let charts = "";
  let report = "";
  
  if (parts.length >= 4) {
    transcription = parts[0] || "";
    summary = parts[1] || "";
    charts = parts[2] || "";
    report = parts.slice(3).join("\n---\n") || "";
  } else if (parts.length === 3) {
    transcription = parts[0] || "";
    summary = parts[1] || "";
    charts = "";
    report = parts[2] || "";
  } else {
    // Basic fallback
    transcription = text;
  }
  
  return { transcription, summary, charts, report };
}

// Simple mockup of parseChartsMarkdown
function parseChartsMarkdown(content) {
  if (!content || content.includes("No se detectaron gráficos") || content.includes("No charts detected")) {
    return [];
  }

  const sections = content.split(/####\s+/);
  const parsed = [];

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;

    const lines = section.split("\n");
    const headerLine = lines[0].trim();

    const timestampRegex = /\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?/;
    const match = headerLine.match(timestampRegex);
    if (!match) continue;

    const timestamp = match[1];
    const parts = timestamp.split(":").map(Number);
    let seconds = 0;
    if (parts.length === 3) {
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      seconds = parts[0] * 60 + parts[1];
    }

    const title = headerLine
      .replace(timestampRegex, "")
      .replace(/[\[\]\*#\-\:]/g, "")
      .trim();

    const bullets = [];
    let legend = "";

    for (let j = 1; j < lines.length; j++) {
      const line = lines[j].trim();
      if (!line) continue;

      if (line.startsWith("-") || line.startsWith("*")) {
        if (line.toLowerCase().includes("leyenda:") || line.toLowerCase().includes("legend:") || (line.startsWith("*") && line.endsWith("*") && !line.startsWith("-"))) {
          legend = line.replace(/^\*+/, "").replace(/\*+$/, "").trim();
        } else {
          bullets.push(line.replace(/^[\-\*\s]+/, "").trim());
        }
      } else if (line.toLowerCase().includes("leyenda:") || line.toLowerCase().includes("legend:")) {
        legend = line.replace(/[_\*]/g, "").trim();
      } else if (line.startsWith("_") && line.endsWith("_")) {
        legend = line.replace(/^_+/, "").replace(/_+$/, "").trim();
      } else {
        if (!legend && bullets.length > 0) {
          bullets[bullets.length - 1] += " " + line;
        }
      }
    }

    parsed.push({
      timestamp,
      seconds,
      title: title || `Visualización @ ${timestamp}`,
      bullets,
      legend
    });
  }

  return parsed;
}

// Read app/api/videos/sync/route.ts to grab realisticMockTranscription
const routeFileContent = fs.readFileSync('app/api/videos/sync/route.ts', 'utf8');

// Use simple regex to extract realisticMockTranscription value
const mockTextRegex = /const realisticMockTranscription = `([\s\S]*?)`;/;
const match = routeFileContent.match(mockTextRegex);

if (!match) {
  console.error("Could not extract realisticMockTranscription from route file!");
  process.exit(1);
}

const mockText = match[1];
console.log("Successfully extracted realisticMockTranscription from sync/route.ts!");
console.log(`Total Length: ${mockText.length} characters.`);

// 1. Run splitTranscription
console.log("\n========================================");
console.log("1. SPLIT TRANSCRIPTION TEST");
console.log("========================================");
const splitted = splitTranscription(mockText);
console.log(`Verbatim length: ${splitted.transcription.length}`);
console.log(`Summary length: ${splitted.summary.length}`);
console.log(`Charts length: ${splitted.charts.length}`);
console.log(`Report length: ${splitted.report.length}`);

// Verify all segments are non-empty
if (splitted.transcription && splitted.summary && splitted.charts && splitted.report) {
  console.log("SUCCESS: All four sections split cleanly and are non-empty!");
} else {
  console.error("FAILURE: Some sections are empty!");
}

// 2. Analyze detailed summary timestamps
console.log("\n========================================");
console.log("2. DETAILED SUMMARY TIMESTAMPS TEST");
console.log("========================================");
const summaryHeaders = splitted.summary.match(/####\s+\[\d{2}:\d{2}\][^\n]*/g) || [];
console.log("Found headings in summary:");
summaryHeaders.forEach(h => console.log(`  - ${h}`));

const lastHeader = summaryHeaders[summaryHeaders.length - 1];
if (lastHeader && lastHeader.includes("25:30")) {
  console.log("\nSUCCESS: Detailed summary has headings all the way up to [25:30], confirming full coverage up to the end of the 26-minute video!");
} else {
  console.error("\nFAILURE: Detailed summary is missing the final [25:30] section!");
}

// 3. Analyze Charts
console.log("\n========================================");
console.log("3. PARSED CHARTS TEST");
console.log("========================================");
const parsedCharts = parseChartsMarkdown(splitted.charts);
console.log(`Found ${parsedCharts.length} parsed charts.`);
parsedCharts.forEach((chart, idx) => {
  console.log(`\nChart #${idx + 1}:`);
  console.log(`  Timestamp: ${chart.timestamp} (${chart.seconds} seconds)`);
  console.log(`  Title: ${chart.title}`);
  console.log(`  Bullets count: ${chart.bullets.length}`);
  console.log(`  Legend: ${chart.legend}`);
});

if (parsedCharts.length > 0) {
  console.log("\nSUCCESS: Charts parsed correctly into objects suitable for chronological rows!");
} else {
  console.error("\nFAILURE: No charts could be parsed!");
}
