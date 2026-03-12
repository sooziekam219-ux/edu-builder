import { injectTogetherBase } from "./base";
import { sanitizeLaTeX } from "../../../utils/sanitize";

function normalize(raw) {
  return {
    header: raw?.header,
    title: raw?.title || "",
    mainQuestion: raw?.mainQuestion || "",
    guideText: raw?.guideText ?? raw?.guide ?? "",
    lines: raw?.lines ?? [],
  };
}

function injectTogetherSelectHtml({ doc, data }) {
  const container = doc.querySelector('div[translate="no"]') || doc.querySelector('main');
  if (!container) return;

  container.removeAttribute('translate');
  container.classList.add('tex2jax_process');

  const existingLines = Array.from(container.querySelectorAll(".txt1"));

  const createBase = (hasLabel) => {
    const div = doc.createElement("div");
    div.className = hasLabel ? "txt1 mb40 ml50" : "txt1 mb40 ml100 flex-row ai-c";
    return div;
  };

  const ml50Base = existingLines.find((l) => l.classList.contains("ml50"))?.cloneNode(true) || createBase(true);
  const ml100Base = existingLines.find((l) => l.classList.contains("ml100"))?.cloneNode(true) || createBase(false);

  // 🌟 [핵심] container.innerHTML = ""; 대신 기존 텍스트 박스만 골라서 지웁니다.
  existingLines.forEach(line => line.remove());

  let qIdx = 0;
  let bId = 0;

  (data.lines || []).forEach((line) => {
    qIdx++;
    const base = line.label ? ml50Base : ml100Base;
    const newLine = base.cloneNode(true);

    newLine.innerHTML = "";
    newLine.className = line.label ? "txt1 mb40 ml50" : "txt1 mb40 ml100 flex-row ai-c";
    newLine.id = `Quiz${qIdx}`;

    if (line.label) {
      const lSpan = doc.createElement("span");
      lSpan.textContent = line.label;
      newLine.appendChild(lSpan);
    }

    (line.parts || []).forEach((part) => {
      if (part.type === "text") {
        const tSpan = doc.createElement("span");
        tSpan.className = line.label ? "math math-tex tex2jax_process" : "ml10 math math-tex tex2jax_process";
        tSpan.setAttribute("translate", "no");
        tSpan.innerHTML = sanitizeLaTeX(part.content);
        newLine.appendChild(tSpan);
      } else if (part.type === "blank") {
        bId++;
        const options = part.options || [];
        const correctIdx = (parseInt(part.correctIndex, 10) || 1) - 1;
        const correctValue = options[correctIdx] || "";
        const finalCorrect = sanitizeLaTeX(correctValue);

        const bSpan = doc.createElement("span");
        bSpan.className = "btn-blank-wrap ml10";
        bSpan.innerHTML = `
<input type="checkbox" class="check-blank" id="check-blank${bId}">
<label for="check-blank${bId}" class="btn-blank">빈칸</label>
<ul class="select-wrap bottom">
  ${options.map((opt, oIdx) => `<li><button type="button" class="btn-select math math-tex ans${oIdx + 1}" translate="no">${sanitizeLaTeX(opt)}</button></li>`).join("")}
</ul>
<span class="write-txt" style="width: ${part.width || 120}px"></span>
<span class="correct math math-tex tex2jax_process" translate="no">${finalCorrect}</span>
`;
        newLine.appendChild(bSpan);
      }
    });

    container.appendChild(newLine);
  });
}

function patchTogetherSelectActJs(actJsText, data) {
  const daps = [];
  (data.lines || []).forEach((line) => {
    (line.parts || []).forEach((part) => {
      if (part.type === "blank") {
        const idx = parseInt(part.correctIndex, 10) || 1;
        daps.push(idx);
      }
    });
  });

  let out = actJsText;
  const zeros = daps.map(() => 0);

  const dapRegex = /(?:var|let|const)\s+dap_array\s*=\s*\[[\s\S]*?\]\s*;?/g;
  if (dapRegex.test(out)) out = out.replace(dapRegex, `var dap_array = ${JSON.stringify(daps)};`);
  else out = out.replace(/dap_array\s*=\s*\[[\s\S]*?\]\s*;?/g, `dap_array = ${JSON.stringify(daps)};`);

  const ansRegex = /(?:var|let|const)\s+ans_array\s*=\s*\[[\s\S]*?\]\s*;?/g;
  const cardRegex = /(?:var|let|const)\s+card_array\s*=\s*\[[\s\S]*?\]\s*;?/g;

  if (ansRegex.test(out)) out = out.replace(ansRegex, `var ans_array = ${JSON.stringify(zeros)};`);
  if (cardRegex.test(out)) out = out.replace(cardRegex, `var card_array = ${JSON.stringify(zeros)};`);

  out = out.replace(/(?:var|let|const)\s+q_len\s*=\s*[^;]+;?/g, `var q_len = ${daps.length};`);

  return out;
}

const selectHandler = {
  typeKey: "together.select",
  normalize,
  // 🌟 [핵심] 인자에서 skeletonConfig를 받아와서 base로 넘겨줍니다.
  injectHtmlPage({ doc, manifest, data, pageIndex, skeletonConfig }) {
    injectTogetherBase({ doc, data, manifest, skeletonConfig });
    injectTogetherSelectHtml({ doc, data });
  },
  patchActJs({ actJsText, data, pageIndex }) {
    return patchTogetherSelectActJs(actJsText, data);
  },
};

export default selectHandler;