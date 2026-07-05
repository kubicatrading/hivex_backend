const testMarkdown = `Aquí tienes el análisis del gráfico de Andrei Jikh de las tasas de interés de las letras del Tesoro. El gráfico ilustra que las letras de ahorro de alto rendimiento (HYSA) están rindiendo más del 5%.

- **Rendimiento superior al 5%**: El gráfico de barras muestra la rentabilidad anualizada.
- **Diferencial positivo**: Se observa un claro spread de rendimiento real.
*Leyenda: Las Letras del Tesoro a corto plazo.*

![Rendimiento](https://hivex-backend.vercel.app/snapshots/Z_xvkbGWauU/129.jpg)`;

function testParse(text, removeFallback) {
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
    
    // Fallback: use the last non-empty line
    if (!removeFallback && hIdx === -1) {
      for (let j = lines.length - 1; j >= 0; j--) {
        if (lines[j].trim() !== "") {
          hIdx = j;
          break;
        }
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
      heading = matches[i].alt || "Gráfico de Análisis";
      leftoverBefore = block.trim();
      rightoverAfter = "";
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

  console.log(`\n=================== REMOVE FALLBACK: ${removeFallback} ===================`);
  console.log("--- INTRO TEXT ---");
  console.log(introText);
  console.log("------------------\n");

  for (let i = 0; i < matches.length; i++) {
    console.log(`=== ITEM ${i} ===`);
    console.log(`HEADING: ${headings[i]}`);
    console.log(`EXPLANATION:\n${explanations[i]}`);
    console.log(`==================\n`);
  }
}

testParse(testMarkdown, false);
testParse(testMarkdown, true);
