// [NEW] Safe Math Splitter (Handles brace depth to avoid unbalanced eqn)
export const splitMathSafely = (text) => {
    // 1. 수식 블록 \(( ... \) 또는 \[ ... \] 을 찾음
    return text.replace(/(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g, (match) => {
        const startDelim = match.startsWith('\\(') ? '\\(' : '\\[';
        const endDelim = match.startsWith('\\(') ? '\\)' : '\\]';
        const content = match.substring(2, match.length - 2);

        if (!content.includes('□') && !content.includes('_')) return match;

        // 중괄호 균형을 맞추며 분할
        const parts = [];
        let currentPart = "";
        let braceDepth = 0;

        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            if (char === '{') braceDepth++;
            else if (char === '}') braceDepth--;

            if (char === '□' || char === '_') {
                // 현재까지의 파트를 밸런스 맞춰서 추가
                if (currentPart.trim()) {
                    let partToPush = currentPart;
                    if (braceDepth > 0) partToPush += "}".repeat(braceDepth);
                    parts.push(`${startDelim}${partToPush}${endDelim}`);
                }

                parts.push(char); // 빈칸 추가

                // 다음 파트 시작 시 열려있던 중괄호를 다시 열어줌
                currentPart = braceDepth > 0 ? "{".repeat(braceDepth) : "";
            } else {
                currentPart += char;
            }
        }

        if (currentPart.trim() && currentPart !== "{".repeat(braceDepth)) {
            let partToPush = currentPart;
            if (braceDepth > 0) partToPush += "}".repeat(braceDepth);
            parts.push(`${startDelim}${partToPush}${endDelim}`);
        }

        return parts.join('');
    });
};


// [NEW] Text to Lines/Parts Parser
export const parseTextToLines = (text, answers = []) => {
    if (!text) return [];

    // [MODIFIED] 수식 블록 내부에 □ 또는 _ 가 있는 경우 안전하게 분리
    let processedText = splitMathSafely(text);

    const lines = processedText.split('\n');
    let globalBlankIdx = 0;

    return lines.map(lineText => {
        // Find □ or _ as blank markers
        const rawParts = lineText.split(/(□|_)/g);
        const parts = rawParts.map(p => {
            if (!p) return null;
            if (p === '□' || p === '_') {
                const ans = answers[globalBlankIdx] || "";
                globalBlankIdx++;
                return {
                    type: 'blank',
                    options: [ans],
                    correctIndex: 1,
                    labelEnabled: false,
                    labelText: ""
                };
            }
            return { type: 'text', content: p };
        }).filter(Boolean);

        return { label: "", parts };
    });
};


