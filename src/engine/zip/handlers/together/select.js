// src/engine/together/select.js

import { injectTogetherBase } from "./base";
import { sanitizeLaTeX } from "../../../utils/sanitize";

function normalize(raw) {
  // zipProcessor가 extractedBuildData.lines 형태를 만든다고 가정
  return {
    header: raw?.header,
    guideText: raw?.guideText ?? raw?.guide ?? "",
    lines: raw?.lines ?? [],
  };
}

function injectTogetherSelectHtml({ doc, data }) {
  console.log("injectTogetherSelectHtml called", data); // Debug log

  const container = doc.querySelector('div[translate="no"]');
  if (!container) {
    console.warn("Container not found");
    return;
  }

  const existingLines = Array.from(container.querySelectorAll(".txt1"));
  console.log("Existing lines count:", existingLines.length);

  // 1. 템플릿 확보 (기존 요소에서 복제하거나, 없으면 생성 - Fallback Logic)
  const createBase = (hasLabel) => {
    const div = doc.createElement("div");
    div.className = hasLabel ? "txt1 mb40 ml50" : "txt1 mb40 ml100 flex-row ai-c";
    return div;
  };

  const ml50Base = existingLines.find((l) => l.classList.contains("ml50"))?.cloneNode(true) || createBase(true);
  const ml100Base = existingLines.find((l) => l.classList.contains("ml100"))?.cloneNode(true) || createBase(false);

  // 2. 초기화 (oldzip logic: Wipe & Rebuild)
  container.innerHTML = "";
  let bId = 0;

  (data.lines || []).forEach((line) => {
    // 템플릿 선택: 라벨 유무에 따라 적절한 베이스 사용
    const base = line.label ? ml50Base : ml100Base;
    const newLine = base.cloneNode(true);

    newLine.innerHTML = "";
    // 클래스 재설정 (혹시 베이스가 섞였을 경우 대비)
    newLine.className = line.label ? "txt1 mb40 ml50" : "txt1 mb40 ml100 flex-row ai-c";

    if (line.label) {
      const lSpan = doc.createElement("span");
      lSpan.textContent = line.label;
      newLine.appendChild(lSpan);
    }

    (line.parts || []).forEach((part) => {
      if (part.type === "text") {
        const tSpan = doc.createElement("span");
        if (!line.label) tSpan.className = "ml10";
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
  ${options
            .map((opt) => `<li><button type="button" class="btn-select">${sanitizeLaTeX(opt)}</button></li>`)
            .join("")}
</ul>
<span class="write-txt" style="width: ${part.width || 120}px"></span>
<span class="correct">${finalCorrect}</span>
`;
        newLine.appendChild(bSpan);
      }
    });

    container.appendChild(newLine);
  });
}

function patchTogetherSelectActJs(actJsText, data) {
  const daps = [];
  (data.lines || []).forEach((l) =>
    l.parts?.filter((p) => p.type === "blank").forEach((p) => daps.push((p.correctIndex || 1) - 1))
  );

  let out = actJsText;

  out = out.replace(/var\s+dap_array\s*=\s*\[[\s\S]*?\]\s*;/g, `var dap_array = ${JSON.stringify(daps)};`);
  out = out.replace(/var\s+q_len\s*=\s*dap_array\.length\s*;/g, `var q_len = ${daps.length};`);

  return out;
}

const selectHandler = {
  typeKey: "together.select",

  normalize,

  injectHtmlPage({ doc, manifest, data, pageIndex }) {
    // ✅ 함께 풀기 공통(헤더 이미지/guideText) 먼저
    injectTogetherBase({ doc, data, manifest });

    // ✅ 본문(라인/빈칸/보기) 채우기
    injectTogetherSelectHtml({ doc, data });
  },

  patchActJs({ actJsText, data, pageIndex }) {
    return patchTogetherSelectActJs(actJsText, data);
  },
};

export default selectHandler;
