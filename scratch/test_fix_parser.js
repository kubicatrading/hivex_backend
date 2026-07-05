const testMarkdown1 = `### 📊 Detected Charts & Visualizations

#### [01:23] **Gold Price Volatility and Peak-to-Trough Drop**
![Gold Price Volatility and Peak-to-Trough Drop](/snapshots/15c513a0-81bf-4880-b3e9-9524c7c0624f/83.jpg)
- **Peak Price**: Stated at over $55,000 per ounce on January 29th.
- **Current Price**: Stated at approximately $4,000 per ounce.
- **Percentage Decline**: Represented as a 28% drop from the peak.
- **Margin Requirement**: Highlighted at a record high of 140%.
*Legend: Visual representation of the extreme price volatility in spot gold that prompted Chinese regulators to raise margin requirements to 140% and shut down retail paper trading.*

#### [03:31] **China's Monthly Gold Purchases (May)**
![China's Monthly Gold Purchases (May)](/snapshots/15c513a0-81bf-4880-b3e9-9524c7c0624f/211.jpg)
- **May Purchase Volume**: 163 tons of physical gold.
- **Historical Comparison**: Marked as the highest monthly purchase volume since March 2024.
*Legend: Bar chart illustrating China's accelerating physical gold accumulation, peaking in May at 163 tons.*`;

const testMarkdown2 = `### Gráfico de Ventas
Aquí podemos ver el crecimiento constante de las ventas durante el último trimestre, impulsado por el nuevo canal de marketing.
![Gráfico de Ventas](/snapshots/15c513a0-81bf-4880-b3e9-9524c7c0624f/83.jpg)

### Gráfico de Gastos
Aquí vemos cómo se reducen los costes fijos de la empresa gracias a la reestructuración logística.
![Gráfico de Gastos](/snapshots/15c513a0-81bf-4880-b3e9-9524c7c0624f/120.jpg)`;

const testMarkdown3 = `Aquí podemos ver el crecimiento constante de las ventas durante el último trimestre, impulsado por el nuevo canal de marketing.

![Gráfico de Ventas](/snapshots/15c513a0-81bf-4880-b3e9-9524c7c0624f/83.jpg)

Y aquí concluye el análisis.`;

function testParse(text, label) {
  console.log(`\n=================== TESTING PARSER: ${label} ===================`);
  const imageRegex = /!\[([^\]]*)\]\(((?:https?:\/\/[^\s)]+|\/[^\s)]+))\)/g;
  const matches = [];
  let match;

  while ((match = imageRegex.exec(text)) !== null) {
    matches.push({
      alt: match[1],
      url: match[2],
      start: match.index,
      end: imageRegex.lastIndex
    });
  }

  if (matches.length === 0) {
    console.log("No images found!");
    return;
  }

  const resolveUrl = (url) => {
    if (url.startsWith("/")) {
      return `https://hivex-backend.vercel.app${url}`;
    }
    return url;
  };

  const nonImageBlocks = [];
  let lastIndex = 0;
  for (let i = 0; i < matches.length; i++) {
    nonImageBlocks.push(text.substring(lastIndex, matches[i].start));
    lastIndex = matches[i].end;
  }
  nonImageBlocks.push(text.substring(lastIndex));

  let introText = "";
  const headings = [];
  const preExplanations = [];
  const postExplanations = [];

  for (let i = 0; i < matches.length; i++) {
    const block = nonImageBlocks[i];
    const lines = block.split("\n");
    
    // Find heading index bottom-to-top
    let hIdx = -1;
    for (let j = lines.length - 1; j >= 0; j--) {
      const trimmedLine = lines[j].trim();
      if (trimmedLine === "") continue;
      
      const isHeading = 
        trimmedLine.startsWith("#") || 
        /^\[\d{1,2}:\d{2}(?::\d{2})?\]/i.test(trimmedLine) ||
        (/^####\s+\[?\d{1,2}:\d{2}/i.test(trimmedLine)) ||
        (trimmedLine.startsWith("**") && trimmedLine.endsWith("**") && trimmedLine.length < 120);
        
      if (isHeading) {
        hIdx = j;
        break;
      }
    }

    let heading = "";
    let leftoverBefore = "";
    let rightoverAfter = "";

    if (hIdx !== -1) {
      heading = lines[hIdx].trim();
      leftoverBefore = lines.slice(0, hIdx).join("\n").trim();
      rightoverAfter = lines.slice(hIdx + 1).join("\n").trim();
    } else {
      // Fix logic: If no formal heading, treat the entire block as pre-explanation
      // and use alt text as heading.
      heading = matches[i].alt || "Gráfico de Análisis";
      leftoverBefore = "";
      rightoverAfter = block.trim();
    }

    headings.push(heading);
    preExplanations.push(rightoverAfter);

    if (i === 0) {
      introText = leftoverBefore;
    } else {
      postExplanations.push(leftoverBefore);
    }
  }

  postExplanations.push(nonImageBlocks[matches.length].trim());

  const explanations = [];
  for (let i = 0; i < matches.length; i++) {
    const preExp = preExplanations[i] || "";
    const postExp = postExplanations[i] || "";
    
    let combined = "";
    if (preExp && postExp) {
      combined = `${preExp}\n\n${postExp}`;
    } else {
      combined = preExp || postExp;
    }
    explanations.push(combined.trim());
  }

  console.log("--- INTRO TEXT ---");
  console.log(introText);
  console.log("------------------\n");

  for (let i = 0; i < matches.length; i++) {
    console.log(`=== ITEM ${i} ===`);
    console.log(`URL: ${resolveUrl(matches[i].url)}`);
    console.log(`HEADING: ${headings[i]}`);
    console.log(`EXPLANATION:\n${explanations[i]}`);
    console.log(`==================\n`);
  }
}

testParse(testMarkdown1, "Standard format (Explanation AFTER Image)");
testParse(testMarkdown2, "Alternative format (Explanation BEFORE Image)");
testParse(testMarkdown3, "No-heading format (Single Paragraph before/after Image)");
