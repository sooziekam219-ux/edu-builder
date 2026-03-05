// src/engine/utils/sanitize.js

export const sanitizeLaTeX = (str) => {
  if (typeof str !== 'string' || !str) return "";
  let sanitized = str.trim();

  // 1. $...$ 또는 $$...$$ -> \(...\) (줄바꿈 포함 및 중복 처리 방지)
  sanitized = sanitized.replace(/\${1,2}([\s\S]*?)\${1,2}/g, "\\($1\\)");

  // [MODIFIED] 2. 수식 구분자 파편 보정 (불완전한 구분자 수정)
  // 단순히 \이나 \ 로만 끝나는 파편은 무의미하므로 제거하거나 완성
  if (sanitized === "\\(" || sanitized === "\\)") return "";

  if (sanitized.includes("\\(") && !sanitized.includes("\\)")) {
    sanitized += "\\)";
  } else if (!sanitized.includes("\\(") && sanitized.includes("\\)")) {
    sanitized = "\\(" + sanitized;
  }

  // 3. 수식 기호가 있으나 구분자가 없는 경우 감싸기
  if (
    (sanitized.includes("\\") || sanitized.includes("^") || sanitized.includes("_")) &&
    !sanitized.includes("\\(") &&
    !sanitized.includes("\\[")
  ) {
    const hasHangul = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(sanitized);
    if (!hasHangul) {
      sanitized = `\\(${sanitized}\\)`;
    }
  }

  // 4. 중복 및 빈 블록 제거 (예: \( \( ... \) \) -> \( ... \))
  let prev;
  do {
    prev = sanitized;
    // 중복 감싸기 제거
    sanitized = sanitized.replace(/\\\((\s*\\\([\s\S]*?\\\)\s*)\\\)/g, "$1");
    sanitized = sanitized.replace(/\\\((\s*\\\[[\s\S]*?\\\]\s*)\\\)/g, "$1");
    sanitized = sanitized.replace(/\\\[(\s*\\\[[\s\S]*?\\\]\s*)\\\]/g, "$1");
    // [NEW] 빈 블록 제거 (Codecogs invalid equation 방지)
    sanitized = sanitized.replace(/\\\((\s*)\\\)/g, "");
    sanitized = sanitized.replace(/\\\[(\s*)\\\]/g, "");
  } while (sanitized !== prev);

  // [NEW] 5. 중괄호 균형 보정 (unbalanced eqn 방지)
  // 열린 { 개수와 닫힌 } 개수를 맞춰줌
  const openBraces = (sanitized.match(/\{/g) || []).length;
  const closeBraces = (sanitized.match(/\}/g) || []).length;
  if (openBraces > closeBraces) {
    sanitized += "}".repeat(openBraces - closeBraces);
  } else if (closeBraces > openBraces) {
    sanitized = "{".repeat(closeBraces - openBraces) + sanitized;
  }

  // [NEW] 6. 수식 내부의 끝 백슬래시 제거 (Codecogs 에러 방지)
  // \( x = 3 \ \) -> \( x = 3 \)
  sanitized = sanitized.replace(/\\\s*\\\)/g, "\\)");
  sanitized = sanitized.replace(/\\\s*\\\]/g, "\\\]");

  return sanitized.trim();
};
