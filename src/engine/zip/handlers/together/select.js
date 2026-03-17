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

// 헬퍼: 배열 셔플 (Fisher-Yates)
function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// 헬퍼: 정답 길이에 따른 빈칸 너비 계산
function calculateBlankWidth(text) {
  if (!text) return 80;

  // LaTeX 명령어 및 특수 제어문자 제거하여 가시적인 글자수 측정
  const clean = text.replace(/\\[a-zA-Z]+/g, '').replace(/[\s\(\)\{\}\^\_\\]/g, '');
  const hasOps = /[\+\-\=\>\<]/.test(text);

  // 기본 너비: 한 글자당 20px + 여백 20px, 최소 80px
  let w = Math.max(80, clean.length * 20 + 20);

  // 연산 기호가 하나라도 있으면 최소 160px 보장
  if (hasOps) {
    w = Math.max(160, w);
  }

  return w;
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
        const isSelection = part.selectionEnabled !== false;
        const options = part.options || [];
        const correctValue = options[0] || ""; // 빌더에서 첫 번째는 항상 정답
        const autoWidth = calculateBlankWidth(correctValue);

        // part.width가 없거나, 구버전 기본값인 80/120인 경우 자동 너비 사용
        const finalWidth = (!part.width || part.width === 80 || part.width === 120) ? autoWidth : part.width;

        if (!isSelection) {
          // 선택형 기능 OFF: 그냥 텍스트로 노출
          const tSpan = doc.createElement("span");
          tSpan.className = "ml10 math math-tex tex2jax_process color-blue font-bold";
          tSpan.setAttribute("translate", "no");
          tSpan.innerHTML = sanitizeLaTeX(correctValue);
          newLine.appendChild(tSpan);
        } else {
          // 선택형 기능 ON: 랜덤화된 선택지 UI 생성
          bId++;

          // 정답 보존 및 셔플
          const shuffled = shuffleArray(options);
          const newCorrectIdx = shuffled.indexOf(correctValue);

          // part 객체에 셔플된 정보 임시 저장 (patchActJs에서 사용)
          part._shuffledCorrectIdx = newCorrectIdx + 1;

          const bSpan = doc.createElement("span");
          bSpan.className = "btn-blank-wrap ml10";
          bSpan.innerHTML = `
<input type="checkbox" class="check-blank" id="check-blank${bId}">
<label for="check-blank${bId}" class="btn-blank">빈칸</label>
<ul class="select-wrap bottom">
  ${shuffled.map((opt, oIdx) => `<li><button type="button" class="btn-select math math-tex ans${oIdx + 1}" translate="no">${sanitizeLaTeX(opt)}</button></li>`).join("")}
</ul>
<span class="write-txt" style="width: ${finalWidth}px"></span>
<span class="correct math math-tex tex2jax_process" translate="no">${sanitizeLaTeX(correctValue)}</span>
`;
          newLine.appendChild(bSpan);
        }
      }
    });

    container.appendChild(newLine);
  });
}

function patchTogetherSelectActJs(actJsText, data) {
  const daps = [];
  (data.lines || []).forEach((line) => {
    (line.parts || []).forEach((part) => {
      if (part.type === "blank" && part.selectionEnabled !== false) {
        // injectHtmlPage에서 계산된 셔플된 정답 인덱스 사용
        const idx = part._shuffledCorrectIdx || 1;
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