function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function markdownToTelegramHtml(markdown) {
  if (!markdown) return "";

  let html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const codeBlocks = [];
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => {
    const placeholder = `CODEBLOCKPLACEHOLDER${codeBlocks.length}`;
    codeBlocks.push(code.trim());
    return placeholder;
  });

  const inlineCodes = [];
  html = html.replace(/`([^`]+)`/g, (_, code) => {
    const placeholder = `INLINECODEPLACEHOLDER${inlineCodes.length}`;
    inlineCodes.push(code.trim());
    return placeholder;
  });

  html = html.replace(/\[([^\]]+)\]\((\/dashboard\/[^\s)]+)\)/g, '<a href="https://hivex-backend.vercel.app$2">$1</a>');
  html = html.replace(/\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi, '<a href="https://hivex-backend.vercel.app/dashboard/videos?id=$1">Ver Análisis</a>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/^\s*[-*+]\s+(.*)$/gm, "• $1");
  html = html.replace(/^#+\s+(.*)$/gm, "<b>$1</b>");
  html = html.replace(/\*\*([^\*\n]+?)\*\*/g, "<b>$1</b>");
  html = html.replace(/__([^_\n]+?)__/g, "<b>$1</b>");
  html = html.replace(/\*([^\*\n]+?)\*/g, "<i>$1</i>");
  html = html.replace(/_([^_\n]+?)_/g, "<i>$1</i>");
  html = html.replace(/^\s*(?:>|&gt;)\s+(.*)$/gm, "<blockquote>$1</blockquote>");

  codeBlocks.forEach((code, index) => {
    html = html.replace(`CODEBLOCKPLACEHOLDER${index}`, `<pre>${code}</pre>`);
  });

  inlineCodes.forEach((code, index) => {
    html = html.replace(`INLINECODEPLACEHOLDER${index}`, `<code>${code}</code>`);
  });

  return html;
}

function splitMarkdown(text, maxLength = 3000) {
  if (!text) return [];
  if (text.length <= maxLength) return [text];

  const chunks = [];
  const paragraphs = text.split("\n\n");
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }

      const lines = paragraph.split("\n");
      for (const line of lines) {
        if (line.length > maxLength) {
          if (currentChunk) {
            chunks.push(currentChunk.trim());
            currentChunk = "";
          }

          let remaining = line;
          while (remaining.length > 0) {
            let sliceEnd = maxLength;
            if (remaining.length > maxLength) {
              const lastSpace = remaining.lastIndexOf(" ", maxLength);
              if (lastSpace > 0) {
                sliceEnd = lastSpace;
              }
            }
            chunks.push(remaining.slice(0, sliceEnd).trim());
            remaining = remaining.slice(sliceEnd).trim();
          }
        } else {
          const separator = currentChunk ? "\n" : "";
          if ((currentChunk + separator + line).length > maxLength) {
            chunks.push(currentChunk.trim());
            currentChunk = line;
          } else {
            currentChunk += separator + line;
          }
        }
      }
    } else {
      const separator = currentChunk ? "\n\n" : "";
      if ((currentChunk + separator + paragraph).length > maxLength) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      } else {
        currentChunk += separator + paragraph;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function sendTelegramMessage(text) {
  console.log(`[SIMULATION sendTelegramMessage]:\n${text}\n-------------------------`);
  return { success: true, simulated: true };
}

async function sendTelegramPhoto(photoUrl, caption, fallbackText) {
  console.log(`[SIMULATION sendTelegramPhoto]:\nURL: ${photoUrl}\nCAPTION: ${caption}\nFALLBACK: ${fallbackText}\n-------------------------`);
  return { success: true, simulated: true, photoSent: true };
}

async function sendTelegramMessageWithPhotos(text) {
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
    return sendTelegramMessage(markdownToTelegramHtml(text));
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
    
    // Fallback: use the last non-empty line
    if (hIdx === -1) {
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

  if (introText.trim().length > 0) {
    const introHtml = markdownToTelegramHtml(introText);
    await sendTelegramMessage(introHtml);
  }

  for (let i = 0; i < matches.length; i++) {
    const imgUrl = resolveUrl(matches[i].url);
    const heading = headings[i];
    const explanation = explanations[i];

    const captionMarkdown = explanation
      ? `${heading}\n\n${explanation}`
      : heading;

    const captionHtml = markdownToTelegramHtml(captionMarkdown);

    if (captionHtml.length <= 950) {
      const photoResult = await sendTelegramPhoto(imgUrl, captionHtml, captionHtml);
    } else {
      const headingHtml = markdownToTelegramHtml(heading);
      const photoResult = await sendTelegramPhoto(imgUrl, headingHtml, captionHtml);

      if (photoResult.photoSent && explanation) {
        const chunks = splitMarkdown(explanation, 3000);
        for (const chunk of chunks) {
          const chunkHtml = markdownToTelegramHtml(chunk);
          await sendTelegramMessage(chunkHtml);
        }
      }
    }
  }
}

const textNoHeading = `Aquí podemos ver el crecimiento constante de las ventas durante el último trimestre, impulsado por el nuevo canal de marketing.

![Gráfico de Ventas](/snapshots/15c513a0-81bf-4880-b3e9-9524c7c0624f/83.jpg)

Y aquí concluye el análisis.`;

sendTelegramMessageWithPhotos(textNoHeading);
