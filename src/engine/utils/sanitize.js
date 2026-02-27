// src/engine/utils/sanitize.js

export const sanitizeLaTeX = (str) => {
  if (typeof str !== 'string' || !str) return "";
  let sanitized = str.trim();

  // 1. $...$ 또는 $$...$$ -> \(...\) (줄바꿈 포함 및 중복 처리 방지)
  sanitized = sanitized.replace(/\${1,2}([\s\S]*?)\${1,2}/g, "\\($1\\)");

  // 2. 수식 구분자 균형 보정 (불완전한 구분자 수정)
  if (sanitized.includes("\\(") && !sanitized.includes("\\)")) {
    sanitized += "\\)";
  } else if (!sanitized.includes("\\(") && sanitized.includes("\\)")) {
    sanitized = "\\(" + sanitized;
  }

  // 3. 수식 기호가 있으나 구분자가 없는 경우 감싸기
  // 단, 이미 \( 또는 \[ 가 포함되어 있거나 한글이 섞여 있으면 보수적으로 처리
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

  // 4. 중복 감싸기 제거 (예: \( \( ... \) \) -> \( ... \))
  let prev;
  do {
    prev = sanitized;
    sanitized = sanitized.replace(/\\\((\s*\\\( [\s\S]*? \\\)\s*)\\\)/g, "$1");
    sanitized = sanitized.replace(/\\\((\s*\\\[ [\s\S]*? \\\]\s*)\\\)/g, "$1");
  } while (sanitized !== prev);

  return sanitized;
};
