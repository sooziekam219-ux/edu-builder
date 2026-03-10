
import { injectTogetherSelfBase } from "./base";
import { TYPE_KEYS } from "../../../typeKeys";

const togetherSelfHandler = {
  typeKey: TYPE_KEYS.TOGETHER_SELF,

  // 데이터를 핸들러가 처리하기 편한 형태로 정규화
  normalize(raw) {
    return {
      title: raw?.mainQuestion || raw?.title || "함께 풀기",
      lines: raw?.subQuestions || raw?.lines || [],
      // Other properties if needed
    };
  },

  // 실제 HTML 파일에 데이터 주입
  injectHtmlPage({ doc, manifest, data, pageIndex }) {
    console.log("injectTogetherSelf HTML called", data);

    // base.js의 함수가 view01(함께)/view02(스스로)를 자동 구분하여 처리
    injectTogetherSelfBase({ doc, data });
  },

  // Act.js 수정 필요 시 (현재는 단순 반환)
  patchActJs({ actJsText, data, pageIndex }) {
    // [추가] LaTeX 기호 제거 및 다중 답안 통합 처리
    const cleanLatex = (str) => {
      if (typeof str !== 'string') return str || "";
      let cleaned = str.trim();
      // \(, \), \[, \] 제거 (이스케이프된 모든 형태 및 공백 포함 캐치)
      // 앞부분: 모든 \ 와 ( 또는 [ 삭제
      cleaned = cleaned.replace(/^[\s\\]*[\(\[]\s*/, "");
      // 뒷부분: 모든 \ 와 ) 또는 ] 삭제 (기존 [\)\]]\\* 방식은 \가 뒤에 있을 때만 작동하여 오류 발생)
      // 수정된 방식: \ 가 앞에 오는 LaTeX 특성을 고려하여 \\*[\)\]] 패턴으로 매칭 후 잔여 \ 까지 제거
      cleaned = cleaned.replace(/\s*\\*[\)\]][\s\\]*$/, "");
      // 마지막으로 혹시 남았을지 모르는 문장 끝의 백슬래시들 제거
      cleaned = cleaned.replace(/\\+$/, "");
      return cleaned.trim();
    };

    const processAnswer = (ans) => {
      if (!ans) return "";
      // | 기호가 있으면 다중 답안으로 처리하여 배열 반환
      const parts = ans.split('|').map(p => cleanLatex(p)).filter(p => p !== "");
      if (parts.length > 1) return parts;
      return parts[0] || "";
    };

    // Collect all blank answers
    const dapBlanks = [];
    const latexBlanks = [];
    (data.lines || []).forEach(line => {
      if (line.parts) {
        line.parts.filter(p => p.type === 'blank').forEach(p => {
          const options = p.options || [];
          const correctIdx = (parseInt(p.correctIndex, 10) || 1) - 1;
          const rawAns = p.answerLatex || options[correctIdx] || "";
          dapBlanks.push(processAnswer(rawAns));
          latexBlanks.push(rawAns); // 원본 유지
        });
      } else if (line.answerLatex || line.answer) {
        const rawAns = line.answerLatex || line.answer;
        dapBlanks.push(processAnswer(rawAns));
        latexBlanks.push(rawAns);
      }
    });

    let out = actJsText;

    // 1. Together Mode (card_array)
    const zeros = dapBlanks.map(() => 0);
    // [수정] 대괄호 대신 세미콜론 전까지 매칭하여 중첩 배열 구조( [[...]] )에서도 안전하게 치환
    const cardRegex = /(?:var|let|const)?\s*card_array\s*=\s*[^;]*;?/g;
    out = out.replace(cardRegex, `var card_array = ${JSON.stringify(zeros)};`);

    // 2. Self Study Mode (dap_array, latexStr_array)
    const dapRegex = /(?:var|let|const)?\s*dap_array\s*=\s*[^;]*;?/g;
    const latexRegex = /(?:var|let|const)?\s*latexStr_array\s*=\s*[^;]*;?/g;

    out = out.replace(dapRegex, `var dap_array = ${JSON.stringify(dapBlanks)};`);
    out = out.replace(latexRegex, `var latexStr_array = dap_array;`);

    // 3. Optional: Patch q_len, card_len
    out = out.replace(/(?:var|let|const)?\s*q_len\s*=\s*\d+\s*;?/g, `var q_len = ${dapBlanks.length};`);
    out = out.replace(/(?:var|let|const)?\s*card_len\s*=\s*[^;]+;?/g, `var card_len = ${dapBlanks.length};`);

    out += `\n\n/* 로컬 테스트를 위한 수식 입력 프롬프트 주입 */
(function() {
  if (window._hasCallExpressPatch) return;
  window._hasCallExpressPatch = true;
  const original_call_EXPRESS = window.call_EXPRESS;
  window.call_EXPRESS = function (idx) {
    if (typeof isMuto_fn === 'function' && isMuto_fn()) {
      const latex = prompt("LaTeX 수식을 입력하세요:");
      if (latex !== null && typeof ExpRtn_fn === 'function') {
        ExpRtn_fn({ id: "EXPRESS_0" + idx, latex: latex });
      }
      return;
    }
    if (typeof original_call_EXPRESS === 'function') {
      original_call_EXPRESS(idx);
    }
  };
})();\n`;

    return out;
  }
};

export default togetherSelfHandler;