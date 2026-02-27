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

  const container = doc.querySelector('div[translate="no"]') || doc.querySelector('main');
  if (!container) {
    console.warn("Container not found");
    return;
  }
  // MathJax 스캔을 방해하는 translate="no" 속성 제거
  container.removeAttribute('translate');
  // MathJax 강제 스캔을 위한 클래스 추가
  container.classList.add('tex2jax_process');

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
  let qIdx = 0;
  let bId = 0;

  (data.lines || []).forEach((line) => {
    qIdx++;
    // 템플릿 선택: 라벨 유무에 따라 적절한 베이스 사용
    const base = line.label ? ml50Base : ml100Base;
    const newLine = base.cloneNode(true);

    newLine.innerHTML = "";
    // 클래스 재설정 (혹시 베이스가 섞였을 경우 대비)
    newLine.className = line.label ? "txt1 mb40 ml50" : "txt1 mb40 ml100 flex-row ai-c";
    // [중요] 각 문항에 고유 ID 부여 (정오 판별용 클래스/스크립트 대응)
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
  ${options
            .map((opt, oIdx) => `<li><button type="button" class="btn-select math math-tex ans${oIdx + 1}" translate="no">${sanitizeLaTeX(opt)}</button></li>`)
            .join("")}
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

  // 모든 라인을 순회하며 그 안의 모든 빈칸(blank)의 정답을 순서대로 수집
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

  // 1. dap_array 치환 (var/let/const 및 유연한 공백 대응)
  const dapRegex = /(?:var|let|const)\s+dap_array\s*=\s*\[[\s\S]*?\]\s*;/g;
  if (dapRegex.test(out)) {
    out = out.replace(dapRegex, `var dap_array = ${JSON.stringify(daps)};`);
  } else {
    out = out.replace(/dap_array\s*=\s*\[[\s\S]*?\]\s*;/g, `dap_array = ${JSON.stringify(daps)};`);
  }

  // 2. 관련 보조 배열 동기화 (ans_array, card_array)
  const ansRegex = /(?:var|let|const)\s+ans_array\s*=\s*\[[\s\S]*?\]\s*;/g;
  const cardRegex = /(?:var|let|const)\s+card_array\s*=\s*\[[\s\S]*?\]\s*;/g;

  if (ansRegex.test(out)) {
    out = out.replace(ansRegex, `var ans_array = ${JSON.stringify(zeros)};`);
  }
  if (cardRegex.test(out)) {
    out = out.replace(cardRegex, `var card_array = ${JSON.stringify(zeros)};`);
  }

  // 3. 문항 개수(q_len) 업데이트
  out = out.replace(/(?:var|let|const)\s+q_len\s*=\s*[^;]+;/g, `var q_len = ${daps.length};`);

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
