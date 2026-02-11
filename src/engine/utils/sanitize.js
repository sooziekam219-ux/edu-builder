// src/engine/utils/sanitize.js

export const sanitizeLaTeX = (str) => {
  if (!str) return "";
  let sanitized = str;

  // $...$ -> \(...\)
  sanitized = sanitized.replace(/\$(.*?)\$/g, "\\($1\\)");

  // \ ^ _ 있는데 \( \) 없으면 감싸기
  // 단, 이미 \( \) 가 포함되어 있거나, $ $ 변환 후라면 감싸지 않음 (혼합 텍스트 보호)
  if (
    (sanitized.includes("\\") || sanitized.includes("^") || sanitized.includes("_")) &&
    !sanitized.includes("\\(") &&
    !str.includes("$") // 원본에 $가 있었다면 이미 위에서 처리됨
  ) {
    // 한글이 섞여 있는지 간단히 체크 (한글이 있으면 수식 부분만 감싸는게 맞지만, 
    // 일단은 전체 감싸기에 의한 깨짐을 방지하기 위해 한글이 있으면 감싸지 않음)
    const hasHangul = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(sanitized);
    if (!hasHangul) {
      sanitized = `\\(${sanitized}\\)`;
    }
  }

  // 중복된 \( \( 제거
  sanitized = sanitized.replace(/\\\((\\\(.*?\\\))\\\)/g, "$1");

  return sanitized;
};
