// src/engine/utils/sanitize.js

export const sanitizeLaTeX = (str) => {
  if (!str) return "";
  let sanitized = str;

  // $...$ -> \(...\)
  sanitized = sanitized.replace(/\$(.*?)\$/g, "\\($1\\)");

  // \ ^ _ 있는데 \( \) 없으면 감싸기
  if (
    (sanitized.includes("\\") || sanitized.includes("^") || sanitized.includes("_")) &&
    !sanitized.includes("\\(")
  ) {
    sanitized = `\\(${sanitized}\\)`;
  }

  // 중복된 \( \( 제거
  sanitized = sanitized.replace(/\\\((\\\(.*?\\\))\\\)/g, "$1");

  return sanitized;
};
