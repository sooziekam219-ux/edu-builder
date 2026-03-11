/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, query, deleteDoc, addDoc, getDocs } from 'firebase/firestore';
import {
    Upload, FileArchive, ImageIcon, Settings, Download, CheckCircle2,
    AlertCircle, Loader2, User, FileCode, ShieldCheck, Layers,
    Trash2, Maximize2, Plus, Server, Check, HardDrive, Layout, RefreshCw,
    Type, Info, ListPlus, X, AlertTriangle, Calculator, FileText,
    BookOpen, GripVertical, ChevronRight, MonitorPlay, MessageSquare,
    Film, Eye, Code, Square, PenTool
} from 'lucide-react';
import { processAndDownloadZip } from "./engine/zip/zipProcessor";
import { TYPE_KEYS } from "./engine/typeKeys";
import { sanitizeLaTeX } from "./engine/utils/sanitize"; // [NEW] Math Sanitizer
console.log("App.js loaded");


// --- Constants & Assets ---
const JSZIP_CDN = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
const PPTX_CDN = "https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";
const link = document.createElement('link');
link.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css';
link.rel = 'stylesheet';
document.head.appendChild(link);

// Modern Global Styles
const style = document.createElement('style');
style.innerHTML = `
    * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif !important; }
    body { background-color: #F8FAFC; color: #334155; }
    
    /* Modern Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

    /* Selection Color */
    ::selection { background: #6366f1; color: white; }

    /* Inputs Focus Ring */
    input:focus, textarea:focus, select:focus {
        outline: none;
        box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        border-color: #6366f1;
    }
`;
document.head.appendChild(style);

document.body.style.fontFamily = "Pretendard, sans-serif";
const ASSETS = {
    TITLES: {
        '발견하기': 'https://i.imgur.com/t5oUrkW.png',
        '문제': 'https://i.imgur.com/gH2J7p7.png',
        '함께 풀기': 'https://i.imgur.com/qnlGWhM.png',
        '스스로 풀기': 'https://i.imgur.com/LVk2NIU.png',
        '생각 KEY우기': 'https://i.imgur.com/99AXcjD.png',
        '핵심 쏙': 'https://placehold.co/300x80/f59e0b/ffffff?text=%ED%95%B5%EC%8B%AC+%EC%8F%99',
    },
    BUTTONS: {
        'CHECK': 'https://i.imgur.com/B8Wofel.png',
        'SAVE': 'https://i.imgur.com/3xzxskE.png',
        'RETRY': 'https://i.imgur.com/Cg89H9w.png',
        'SOLVE': 'https://placehold.co/200x60/0ea5e9/ffffff?text=풀이'
    }
};

// --- Firebase Config ---
const raw = process.env.REACT_APP_FIREBASE_CONFIG;

if (!raw) throw new Error("REACT_APP_FIREBASE_CONFIG가 비어있음(.env 설정 확인)");

// --- Firebase Config & Init ---
let firebaseConfig;
try {
    const raw = process.env.REACT_APP_FIREBASE_CONFIG;
    if (!raw) {
        throw new Error("환경 변수 REACT_APP_FIREBASE_CONFIG가 설정되지 않았습니다.");
    }
    firebaseConfig = JSON.parse(raw.trim());
} catch (e) {
    console.error("Firebase 초기화 에러:", e.message);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'edu-builder-integrated-v5';
const CHUNK_SIZE = 500 * 1024;



// --- Prompts ---
//얘는 안 쓰는 프롬프트(구버전)
const KIM_HWA_KYUNG_PROMPT = `
  **Role:** Expert digital textbook converter for 'Kim Hwa-kyung'.
  Analyze input textbook image(s) and split content into logical sections for a Storyboard.
  
  **Splitting Rules:**
  - Detect visual separators like "문제 1", "함께 풀기", "스스로 풀기".
  - **Type:** '문제', '함께 풀기', '함께 풀기 + 스스로 풀기'
  - **Body Text:** Use LaTeX \\( ... \\). Use \\n to separate distinct questions or sentences.
  - **답이 스토리보드에 포함되지 않도록 주의** 

  **Specific Rules for '함께 풀기 + 스스로 풀기':**
    "중요: '함께 풀기'와 '스스로 풀기'는 반드시 서로 다른 별개의 'section' 객체로 나누어서 응답할 것."
  1. **Preserve Full Text:** Do NOT omit any sentences. Extract the entire explanation process.
  2. **Together Part (함께 풀기):** Keep the text as is. Ensure LaTeX is correctly formatted.
  3. **Self Part (스스로 풀기):** Identify areas that are underlined in the image and represent them as '_'. one explanation has to be included.
  - **Answers:** Extract or solve for correct answers.
  - **[빈칸 동기화 규칙 (매우 중요!!)]**: '함께 풀기' 섹션도 '스스로 풀기'의 밑줄 위치와 **논리적으로 동일한 지점**에 반드시 '□' 기호를 사용하여 빈칸을 생성해야 함. 이미지 원본에 빈칸이 없더라도 반드시 스스로 풀기와 대칭되도록 빈칸을 만들어낼 것.
 ### STEP 0: 텍스트 정제 규칙 (Text Cleaning)
- 이미지에 포함된 "답:", "정답:", "풀이:", "해설:"로 시작하는 텍스트는 교사용 정보이므로 **절대 'body'나 'content'에 포함하지 마라.**
- 만약 문제 바로 아래에 정답이 적혀 있다면, 해당 정답은 'answers' 배열에만 넣고 'body'에서는 삭제하라.
- 반드시 "숫자 = □" 와 같이 등호를 빈칸 밖의 *텍스트**로 분리하여 추출하십시오.

  **Study Section (스스로 풀기) Rules:**
  1. **Underline Detection:** Look for text with underlines (____) in the image. 
  2. **Symbol Conversion:** Replace the underlined text part with the symbol '□'.
  3. **Full Context:** Extract the complete sentence including the '□'.
  4. **Answer Extraction:** Place the actual text that was on the underline into the "answers" array in the correct sequence.
  5. **LaTeX:** Ensure all mathematical expressions within or around the underline are wrapped in \( ... \).


  Output JSON format:
  {
    "sections": [
      {
        "type": "함께 풀기 + 스스로 풀기",
        "typeKey": "together.self",
        "subtype": "복합형",
        "content": { "title": "함께 풀기", "instruction": "...", "body": "전체 텍스트..." },
        "answers": ["정답"],
        "explanation": ["해설"],
        "figure_bounds": [0,0,0,0],
        "figure_alt": "이미지 설명"
      }
    ]
  }
  
  
  
`;

//현 버전 프롬프트
const UNIVERSAL_BUILDER_PROMPT = `당신은 수학 교육 콘텐츠 전문 개발자입니다. 
이미지를 분석하여 시각적 증거(로고, 아이콘)를 기반으로 유형을 분류하고, 정해진 규격의 JSON을 생성하라.

### STEP 1: 시각적 구조 및 아이콘 정밀 분석 (Visual & Layout First)
JSON을 생성하기 전, 텍스트를 읽지 말고 이미지의 전체적인 '틀(Layout)'을 먼저 스캔하여 다음 3가지를 확정하라:
1. **[함풀 아이콘]**: 좌측 상단에 '함께 풀기' 타이틀 아이콘이 존재하는가?
2. **[스풀 아이콘]**: 우측 상단에 '스스로 풀기' 타이틀 아이콘이 존재하는가?
3. **[레이아웃]**: 박스가 좌우 2단(2-Column)으로 나뉘어 있는가, 아니면 화면 전체를 쓰는 1단(Single-Column) 박스인가?
4. **[삽화 및 구조]**: '함께 풀기' 템플릿 외부의 일반 '문제' 영역에 (1), (2) 같은 **소문항이 없으면서**, 우측이나 하단에 문제 풀이에 필수적인 **시각 자료(도형, 그래프, 실생활 사진 등)**가 포함되어 있는가? (단, 단순 장식용 캐릭터 일러스트는 시각 자료로 치지 않는다.)

### STEP 2: 절대 유형 결정 규칙 (Strict Decision Table)
STEP 1의 결과에 따라 한 치의 예외도 없이 아래 규칙에 따라 'typeKey'를 결정하라. 텍스트가 아무리 길어도 이 규칙이 우선한다.

- **[Case A] 좌우 2단 구조 + '함께 풀기' & '스스로 풀기' 아이콘 모두 존재**
  -> **분류:** \`together.self\` (복합형)
  -> **특징:** 왼쪽에는 완성된 풀이가 있고, 오른쪽에는 빈칸(밑줄)이 뚫려 있는 대칭 구조.

- **[Case B] 1단 넓은 구조 + '함께 풀기' 아이콘만 단독 존재 ('스스로 풀기' 없음)**
  -> **분류:** \`together.select\` (선택형/단독형)
  -> **특징:** 가로로 긴 하나의 박스 안에 빈칸(□)들이 포함된 풀이 과정이 나열됨.

- **[Case C] 위 두 아이콘이 없고, "문제 1", "문제 2" 등으로 시작함**
  -> **분류:** \`question.mathinput\` (일반 문제)
  -> **특징:** 특정 박스 템플릿 없이 일반적인 발문과 수식이 나열됨.

- **[Case D] '함께 풀기' 템플릿 외부의 일반 '문제' 영역에 문제 풀이에 필수적인 '삽화(도형, 그래프, 표, 실생활 사진 등)'가 포함되어 있고 소문항이 없는 경우**
  -> **분류:** \`question.image\` (이미지형 문제)
  -> **특징:** 문제 텍스트보다 삽화 영역이 핵심이며, 반드시 \`figure_bounds\`를 추출해야 함.

### STEP 3: 삽화(Figure) 영역 정밀 탐지 규칙 (Crucial for question.image)
AI는 다음 지침에 따라 \`figure_bounds\`를 [ymin, xmin, ymax, xmax] (0~1000) 좌표로 추출하라:
1. **필수 삽화 매핑**: 문제 텍스트에 "그림과 같이", "그래프에서", "정육각형" 등의 표현이 있다면 반드시 해당 영역을 포착하라.
2. **최소 영역 원칙**: 텍스트를 제외하고 순수하게 삽화(도형, 기호 포함)만 포함하는 가장 타이트한 사각형 영역을 잡아야 함.
3. **탐지 실패 방지**: 삽화가 흐릿하거나 작아도 실루엣을 따라 영역을 확정하라. 삽화가 없으면 [0, 0, 0, 0].

### STEP 4: 스스로 풀기 정답 추론 특수 규칙 (Crucial for together.self)
'스스로 풀기'의 빈칸(밑줄) 정답을 추출할 때는 절대 임의로 계산 방식을 생략하거나 건너뛰지 마라. 반드시 짝꿍인 '함께 풀기'의 풀이 과정을 1:1 템플릿으로 사용하여 아래의 논리적 흐름(Chain of Thought)을 따라라:
1. **패턴 매핑 (Pattern Mapping):** '함께 풀기'의 풀이 과정 각 줄에서 어떤 공식, 식의 변형, 연산 논리가 쓰였는지 파악하라.
2. **숫자 치환 (Substitution):** '스스로 풀기'에 주어진 문제의 숫자와 조건을 '함께 풀기'와 완전히 동일한 위치에 대입하라. 
3. **중간 과정 도출 (Step-by-Step):** 최종 정답만 구하지 말고, '함께 풀기'의 구조상 중간에 위치한 빈칸(밑줄 등)에 들어가야 할 정확한 식이나 계산값(예: 약분 전의 분수형태, 근호 안의 식 등)을 도출하여 정답으로 설정하라.

**공통 규칙 (매우 중요):**
- **정답 및 해설 직접 계산:** 예시 텍스트를 그대로 복사하지 마십시오. 당신은 수학 교사입니다. 이미지의 문제를 **직접 풀이하여 정확한 수학적 정답**을 구하고, 그에 맞는 **구체적인 해설**을 작성하여 JSON 필드에 채워 넣어야 합니다.
- 모든 수식은 반드시 '\\\\( ... \\\\)' 형태로 감싸세요. (백슬래시 2개)
- 유형 안에 삽화나 도형이 있다면 'figure_bounds'([ymin, xmin, ymax, xmax])를 0~1000 좌표계로 추출하세요. 없으면 [0,0,0,0].
- 이미지에 포함된 "답:", "정답:", "풀이:", "해설:"로 시작하는 텍스트는 교사용 정보이므로 **절대 'body'나 'content'에 포함하지 마라.**
- 만약 문제 바로 아래에 정답이 적혀 있다면, 해당 정답은 'answers' 배열에만 넣고 'body'에서는 삭제하라.

### STEP 5: 데이터 구조 및 분할 규칙:

1. **[단독형 (together.select)]**: 
   - 1개의 객체 안에서 모두 처리하라.
   - **중요:** 'blank' 파트의 'options' 배열에는 반드시 **[ "실제 계산된 정답", "오답1", "오답2" ]** 처럼 3개의 요소가 있어야 한다. (객관식 선택형이므로)
- **[본문 빈칸 유지 - 매우 중요!]** 이미지 원본에서 네모 박스, 빈칸, 밑줄 등으로 비워져 있는 부분은 \`content.body\` 텍스트 작성 시 절대 정답으로 계산해서 채워 넣지 마라! 반드시 원본 위치 그대로 **'□'** 기호를 사용하여 빈칸으로 남겨두어라.
2. **[복합형 (together.self) - 절대 분할 규칙]**: 
   - '함께 풀기'와 '스스로 풀기'는 **반드시 서로 다른 2개의 독립적인 객체(section)**로 분할하여 배열에 담아라. 절대 1개의 객체로 합치지 마라!
    - **중요:** 'blank' 파트의 'options' 배열에는 오답이 필요 없다! 반드시 **[ "실제 계산된 정답" ]** 1개의 요소만 배열에 담아라. (단순 확인 및 주관식 입력이므로)
    - **[빈칸 동기화 규칙 (매우 중요!!)]**: 
      1. '함께 풀기' 섹션도 '스스로 풀기'의 밑줄 위치와 **논리적으로 동일한 지점**에 반드시 '□' 기호를 사용하여 빈칸을 생성하라.
      2. 이미지 상의 '함께 풀기'가 완성된 풀이 형태더라도, '스스로 풀기'와 대조하여 동일한 계층/위치에 '□' 빈칸을 강제로 만들어야 함. (예상 정답은 answers 배열에 넣을 것)

3. **question.mathinput**:
   - 'subQuestions' 배열을 사용하세요.
   - 각 항목은 { 'label': '...', 'passage': '...', 'answer': '<실제 계산된 정답>', 'explanation': '<구체적인 풀이 과정>' } 형태입니다.

**최종 JSON 응답은 마크다운 코드 블록 없이 순수 JSON만 반환하세요.**

### [매우 중요: 다중 영역 분할 및 JSON 구조 예시]
한 이미지 안에 '함께 풀기(복합)', '스스로 풀기(복합)', '문제'가 같이 있다면 반드시 아래처럼 **3개의 독립된 객체**로 나누어 응답해야 합니다. (options 배열의 차이에 주목하라)

### [매우 중요: 섹션 분할 및 기존 JSON 출력 포맷]
'함께 풀기'와 '스스로 풀기', 그리고 하단의 '문제'는 **반드시 서로 다른 독립된 객체**로 분할하여 \`sections\` 배열에 담아라.
출력 포맷은 반드시 아래의 기존 \`content: { title, instruction, body }\` 구조를 엄격하게 지켜야 한다.

**JSON 구조 예시:**
{
  "sections": [
    {
      "type": "함께 풀기 + 스스로 풀기",
      "typeKey": "together.self",
      "subtype": "복합형",
      "content": {
        "title": "함께 풀기 1",
        "instruction": "이차방정식을 푸시오.",
        "body": "좌변을 인수분해 하면 \\\\( (x-3)(2x-1)=0 \\\\)\\n\\\\( x-3=0 \\\\) 또는 \\\\( 2x-1=0 \\\\)\\n따라서 \\\\( x=3 \\\\) 또는 \\\\( x= \\\\) □"
      },
      "answers": ["\\\\frac{1}{2}"],
      "explanation": [""],
      "figure_bounds": [0,0,0,0],
      "figure_alt": ""
    },
    {
      "type": "스스로 풀기",
      "typeKey": "together.self",
      "subtype": "복합형",
      "content": {
        "title": "스스로 풀기",
        "instruction": "이차방정식을 푸시오.",
        "body": "좌변을 인수분해 하면 □\\n□ 또는 □\\n따라서 □ 또는 □"
      },
      "answers": ["\\\\( (x-2)(3x+2)=0 \\\\)", "\\\\( x-2=0 \\\\)", "\\\\( 3x+2=0 \\\\)", "2", "-\\\\frac{2}{3}"],
      "explanation": [""],
      "figure_bounds": [0,0,0,0],
      "figure_alt": ""
    },
    {
      "type": "함께 풀기",
      "typeKey": "together.select",
      "subtype": "선택형",
      "content": {
        "title": "함께 풀기 2",
        "instruction": "다음 식을 인수분해 하시오.",
        "body": "\\\\( 2x^2+5x-3=( \\\\) □ \\\\( )(2x-1) \\\\)"
      },
      "answers": ["x+3"],
      "options": [
        ["x+3", "x-3", "2x+3"]
      ],
      "explanation": [""],
      "figure_bounds": [0,0,0,0],
      "figure_alt": ""
    },
    {
      "type": "문제",
      "typeKey": "question.mathinput",
      "subtype": "일반형",
      "content": {
        "title": "문제 5",
        "instruction": "다음 이차방정식을 푸시오.",
        "body": "(1) \\\\( x^2+4x-12=0 \\\\) □\\n(2) \\\\( 6x^2-13x-5=0 \\\\) □"
      },
      "answers": ["-6, 2", "-\\\\frac{1}{3}, \\\\frac{5}{2}"],
      "explanation": ["(1) 인수분해하여 풉니다.", "(2) 인수분해하여 풉니다."],
      "figure_bounds": [0,0,0,0],
      "figure_alt": ""
    },
    {
      "type": "이미지형",
      "typeKey": "question.image",
      "subtype": "이미지형",
      "strategy": {
        "name": "images_v1",
        "options": { "inputKind": "math" }
      },
      "content": {
        "title": "문제 2",
        "instruction": "오른쪽 그림과 같은 삼각형의 넓이를 구하시오.",
        "body": ""
      },
      "answers": ["24"],
      "explanation": ["삼각형의 넓이는 (밑변 x 높이) / 2 이므로 (8 x 6) / 2 = 24 입니다."],
      "figure_bounds": [150, 400, 450, 800],
      "figure_alt": "밑변이 8, 높이가 6인 삼각형 그림"
    }
  ]
}
`;


// --- Helpers ---

// [NEW] Safe Math Splitter (Handles brace depth to avoid unbalanced eqn)
const splitMathSafely = (text) => {
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
const parseTextToLines = (text, answers = []) => {
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

const generateLogicText = (type, subtype, answers) => {
    const hasAnswer = answers && answers.length > 0;
    const answerSection = hasAnswer ? `[정답 설정]\n- 정답: ${answers.join(', ')}\n\n` : '';


    // 2. 함께 풀기 + 스스로 풀기 (복합 유형)
    if (type === '함께 풀기 + 스스로 풀기') {
        const isTogether = subtype === 'together_part' || subtype === '복합형' || subtype === '함께풀기';

        const baseText = isTogether
            ? `[복합형: 함께 풀기]\n1. 하늘색 네모(□) 클릭 시 라벨이 사라지며 정답 텍스트 노출.\n2. [확인] 버튼 없음. [저장] 버튼 클릭 시 학습 완료 처리.\n3. 정오 판별 로직 제외.`
            : `[복합형: 함께 풀기]\n1. 하늘색 네모(□) 클릭 시 라벨이 사라지며 정답 텍스트 노출.\n2. [확인] 버튼 없음. [저장] 버튼 클릭 시 학습 완료 처리.\n3. 정오 판별 로직 제외.`;
        return answerSection + baseText;
    }

    // 3. 함께 풀기 (선택형)
    if (type === '함께 풀기') {
        return answerSection + `[함께 풀기: 선택형]\n1. 빈칸(□) 클릭 시 선택 요소(Pop-up/Picker) 노출.\n2. [확인] 클릭 시 선택값 기반 정오 판별.`;
    }

    // 4. 활동형 (발견/생각)
    if (type.includes('발견') || type.includes('생각')) {
        return answerSection + `[활동형]\n1. [저장] 버튼 클릭 시 입력값 저장.\n2. 정오 판별 없음.\n3. 빈칸 시 "내용을 입력하세요" 알럿.`;
    }

    // 5. 일반 문제 (수식 입력형)
    return answerSection + `[기능 로직]\n1. 빈칸 클릭 시 수식 입력기 호출.\n2. [확인] 클릭 시 정오답 판별.\n3. 정답 시: 파란색(#0000FF) 변경 + 정답 알럿.\n4. 오답 시: 재도전 알럿 + 오답 붉은색 노출.\n5. 버튼 토글: 확인 -> 풀이/다시하기.`;
};


// [NEW] Draft Config Generator
const buildDraftInputConfig = ({
    typeKey, // "concept", "together.select", "question.mathinput" etc.
    baseTemplateTypeKey, // zip 베이스. 예: "question.mathinput"
    inputKind = "math", hasImage = false, headerUrl = "", contentImageUrl = "",
    figure_bounds = null, figure_alt = "",
    isTogether = false, // [NEW] Together Mode Flag
    isSelfStudy = false // [NEW] Self Study Flag
}) => {
    // [NEW] JSON 확인용 로그
    console.log("[buildDraftInputConfig] Input:", { typeKey, isTogether, isSelfStudy });


    // 2. Together + Self Type [FIX]
    if (typeKey === TYPE_KEYS.TOGETHER_SELF) {
        return {
            typeKey: TYPE_KEYS.TOGETHER_SELF,
            baseTemplateTypeKey: TYPE_KEYS.TOGETHER_SELF, // [FIX] Use correct key
            manifest: {
                rowTemplate: ".txt1",
            },
            strategy: {
                name: "together_self_v1",
                options: {
                    hasImage,
                    headerUrl,
                    contentImageUrl,
                    figure_bounds,
                    figure_alt,
                    isSelfStudy // [NEW] Pass flag
                }
            }
        };
    }

    // [NEW] 2.5 Image-based Type
    if (typeKey === TYPE_KEYS.QUESTION_IMAGE) {
        return {
            typeKey: TYPE_KEYS.QUESTION_IMAGE,
            baseTemplateTypeKey: TYPE_KEYS.QUESTION_IMAGE,
            manifest: {
                rowTemplate: ".flex-row.ai-s.jc-sb",
            },
            strategy: {
                name: "images_v1",
                options: {
                    inputKind: "math",
                    hasImage: true,
                    headerUrl,
                    contentImageUrl,
                    figure_bounds,
                    figure_alt
                }
            }
        };
    }

    // 3. Together Type or Standard Input
    const finalTypeKey = typeKey || (isTogether ? "together.custom" : "input.custom");

    return {
        typeKey: finalTypeKey,
        baseTemplateTypeKey: isTogether ? TYPE_KEYS.TOGETHER_SELECT : TYPE_KEYS.QUESTION_MATHINPUT,
        manifest: {
            rowTemplate: isTogether ? ".txt1" : ".flex-row.ai-s.jc-sb",
        },
        strategy: {
            name: isTogether ? "together_v1" : "input_v1", // Strategy Name Switch
            options: {
                inputKind,
                hasImage,
                headerUrl,
                contentImageUrl,
                figure_bounds,
                figure_alt
            }
        }
    };
};

const App = () => {
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('analysis');
    const [isProcessing, setIsProcessing] = useState(false);
    const TYPE_DEFS = [
        {
            typeKey: TYPE_KEYS.QUESTION_MATHINPUT,
            label: "문제 > 수식입력형",
        },
        {
            typeKey: TYPE_KEYS.TOGETHER_SELECT,
            label: "함께 풀기 > 선택형",
        },
        {
            typeKey: TYPE_KEYS.TOGETHER_SELF,
            label: "함께 풀기 + 스스로 풀기",
        }
    ];

    // 이후 계속 추가

    const [analysisImages, setAnalysisImages] = useState([]);
    const [pages, setPages] = useState([]);
    const [metadata, setMetadata] = useState({
        schoolLevel: '중학교', grade: '3학년', subject: '수학', author: '김화경', unit: '1. 제곱근과 실수', session: '1차시', activityName: ''
    });

    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [selectedTypeKey, setSelectedTypeKey] = useState(""); // Default to empty (Auto Detect)

    // [New] Multi-Page Builder State
    const [buildPages, setBuildPages] = useState([{ id: 1, image: null, data: null }]);
    const [activePageIndex, setActivePageIndex] = useState(0);

    // [New] Input Strategy Test State
    const [inputKind, setInputKind] = useState("math"); // math | text | ocr
    const [hasImage, setHasImage] = useState(false);

    const [removePagination, setRemovePagination] = useState(true);
    const [zoomedImage, setZoomedImage] = useState(null);
    const [showDetectionOverlay, setShowDetectionOverlay] = useState(false); // [NEW] AI 탐지 영역 표시 여부

    // Derived Logic
    const activeData = buildPages[activePageIndex]?.data;

    // // 1. Detect Type from Data
    // let detectedTypeKey = "";
    // if (activeData) {
    //     if (activeData.subQuestions || activeData.questions) 
    //         detectedTypeKey = "question.mathinput"; // Or generalized to question.input later
    //     else if (activeData.lines) 
    //         detectedTypeKey = "together.select";
    // }


    // 기존의 useEffect 두 개를 지우고 아래 하나로 합치세요
    useEffect(() => {
        // 1. 인증 상태 감시 (익명 로그인 처리)
        const unsubAuth = onAuthStateChanged(auth, async (u) => {
            if (u) {
                setUser(u); // 유저 정보가 등록되어야 다음 useEffect가 작동함
            } else {
                try {
                    await signInAnonymously(auth);
                } catch (err) {
                    console.error("익명 로그인 실패:", err);
                }
            }
        });

        return () => unsubAuth();
    }, [auth]);

    useEffect(() => {
        // 2. 중요: 유저가 없을 때는 아예 Firestore에 접근하지 않음 (권한 에러 방지)
        if (!user) return;

        const q = collection(db, 'artifacts', appId, 'public', 'data', 'templates');
        const unsubSnapshot = onSnapshot(q,
            (snapshot) => {
                const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setTemplates(list);
            },
            (error) => {
                // 배포 후 에러 발생 시 여기서 원인 확인 가능
                console.error("Firestore Snapshot 에러:", error.code, error.message);
            }
        );

        return () => unsubSnapshot();
    }, [user, db, appId]); // user가 변경될 때마다(로그인 성공 시) 실행

    console.table(
        templates.map(t => ({
            id: t.id,
            name: t.name,
            typeKey: t.typeKey,
            baseTemplateTypeKey: t.baseTemplateTypeKey
        }))
    );


    // ================================
    // [NEW] Detection Logic (Family vs Type)
    // ================================

    // 1️⃣ 패턴(Strategy Family) 판별
    let detectedFamily = "";
    if (activeData) {
        // [Universal Logic] Trust typeKey first
        const tKey = activeData.typeKey || "";
        if (tKey.startsWith("together")) {
            detectedFamily = "together";
        } else if (tKey.startsWith("question")) {
            detectedFamily = "input";
        } else if (activeData.lines) {
            detectedFamily = "together";
        } else if (activeData.subQuestions) {
            detectedFamily = "input";
        }
    }

    // 2️⃣ 의미 typeKey (AI 우선, 없으면 normalization)
    let detectedTypeKey = activeData?.typeKey || "";

    // Normalize if missing but type string exists
    if (!detectedTypeKey && activeData?.type) {
        const typeStr = activeData.type;
        if (typeStr.includes("함께 풀기 + 스스로 풀기")) detectedTypeKey = TYPE_KEYS.TOGETHER_SELF;
        else if (typeStr.includes("함께 풀기")) detectedTypeKey = TYPE_KEYS.TOGETHER_SELECT;
        else if (typeStr.includes("이미지형")) detectedTypeKey = TYPE_KEYS.QUESTION_IMAGE;
        else if (typeStr.includes("문제") || typeStr.includes("예제")) detectedTypeKey = TYPE_KEYS.QUESTION_MATHINPUT;
    }

    // 3️⃣ [NEW] Header Mapping for Exact Match
    const TYPE_MAPPING = {
        [TYPE_KEYS.QUESTION_MATHINPUT]: ["문제", "예제", "따라 하기", "수식 입력형"],
        [TYPE_KEYS.QUESTION_IMAGE]: ["이미지형"],
        [TYPE_KEYS.TOGETHER_SELECT]: ["함께 풀기"],
        [TYPE_KEYS.TOGETHER_SELF]: ["함께 풀기 + 스스로 풀기"]
    };

    // 4️⃣ 기존 템플릿 존재 여부 및 상세 판별
    const matchingDetectedTemplates = templates.filter(t => t.typeKey === detectedTypeKey);
    const hasExistingTemplate = matchingDetectedTemplates.length > 0;

    let detectionStatus = "UNKNOWN"; // EXACT | SIMILAR | NEW
    if (!detectedFamily) {
        detectionStatus = "UNKNOWN";
    } else if (hasExistingTemplate) {
        // [MODIFIED] Check if header also matches for "EXACT" status
        const headerType = activeData?.type || "";
        const allowedHeaders = TYPE_MAPPING[detectedTypeKey] || [];
        const isHeaderMatch = allowedHeaders.some(h => headerType.includes(h));

        if (isHeaderMatch) {
            detectionStatus = "EXACT";
        } else {
            detectionStatus = "SIMILAR";
        }
    } else if (detectedTypeKey === TYPE_KEYS.TOGETHER_SELF || detectedFamily === "input") {
        detectionStatus = "SIMILAR";
    } else {
        detectionStatus = "NEW";
    }


    // 2. Filter Templates: If manual type selected, use it. Else if detected, use matching. Else show all?
    const filteredTemplates = templates.filter(t => !selectedTypeKey || t.typeKey === selectedTypeKey);
    const isInputType = detectedFamily === "input" || detectedFamily === "together";

    function renderTypeEditor(currentData) {
        const typeKey = currentData?.typeKey;

        if (!typeKey) {
            return (
                <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-200 text-slate-400 font-bold">
                    타입이 감지되지 않았어요.
                </div>
            );
        }

        if (typeKey === TYPE_KEYS.QUESTION_MATHINPUT) {
            return <MathInputEditor currentData={currentData} onChange={updateCurrentPageData} />;
        }

        if (typeKey === TYPE_KEYS.TOGETHER_SELECT) {
            return <TogetherSelectEditor currentData={currentData} onChange={updateCurrentPageData} />;
        }

        if (typeKey === TYPE_KEYS.TOGETHER_SELF) {
            return (
                <TogetherSelfEditor
                    currentData={currentData}
                    onChange={updateCurrentPageData}
                    onClickLabelZip={onClickLabelZip}
                />
            );
        }

        if (typeKey === TYPE_KEYS.QUESTION_IMAGE) {
            return <QuestionImageEditor currentData={currentData} onChange={updateCurrentPageData} />;
        }

        return <GenericFallbackEditor currentData={currentData} onChange={updateCurrentPageData} />;
    }




    // together.self 전용

    const onClickLabelZip = async (pageData) => {
        // TODO: pageData.together.numbers 중 labelEnabled === true 인 것들로
        // 라벨 올린 이미지 생성 → zip으로 묶어서 다운로드
        console.log("LABEL ZIP:", pageData);
    };


    const onClickZip = () => {
        let customConfig = null;
        let finalTemplateId = null;

        const currentData = buildPages[activePageIndex]?.data;

        // 1. 현재 유형 결정 (Manual Override > AI Detected > Legacy string mapping)
        let currentType = selectedTypeKey;
        if (!currentType) {
            currentType = currentData?.typeKey;
        }
        if (!currentType && currentData?.type) {
            const typeStr = currentData.type;
            if (typeStr.includes("함께 풀기 + 스스로 풀기")) currentType = TYPE_KEYS.TOGETHER_SELF;
            else if (typeStr.includes("함께 풀기")) currentType = TYPE_KEYS.TOGETHER_SELECT;
            else currentType = TYPE_KEYS.QUESTION_MATHINPUT;
        }

        // 2. 기본 플래그 설정
        const isTogetherSelf = currentType === TYPE_KEYS.TOGETHER_SELF;
        const isTogether = isTogetherSelf || (currentType?.startsWith("together") || false);

        /**
         * A. 템플릿 ID 결정 로직
         */
        if (selectedTemplateId) {
            finalTemplateId = selectedTemplateId;
        } else if (detectionStatus === "EXACT" && matchingDetectedTemplates.length > 0) {
            finalTemplateId = matchingDetectedTemplates[0].id;
        } else {
            let baseTypeKey = TYPE_KEYS.QUESTION_MATHINPUT;
            if (isTogetherSelf) baseTypeKey = TYPE_KEYS.TOGETHER_SELF;
            else if (isTogether) baseTypeKey = TYPE_KEYS.TOGETHER_SELECT;
            else if (currentType === TYPE_KEYS.QUESTION_IMAGE) baseTypeKey = TYPE_KEYS.QUESTION_IMAGE;

            const fallback = templates.find(t => t.typeKey === baseTypeKey);
            finalTemplateId = fallback?.id;
            console.log("[ZIP] Fallback applied:", baseTypeKey, finalTemplateId);
        }

        // B. 커스텀 설정(Draft Config) 생성 로직
        // EXACT 모드가 아닐 때는 사용자가 편집한 내용을 덮어씌워야 하므로 Config를 생성함
        if (detectionStatus !== "EXACT" || selectedTypeKey) {
            let headerType = "문제";
            if (isTogetherSelf) {
                // [FIX] Determine header type based on title (함께/스스로)
                const title = currentData?.title || "";
                if (title.includes("스스로")) headerType = "스스로 풀기";
                else headerType = "함께 풀기";
            }
            else if (isTogether) headerType = "함께 풀기";
            else if (currentData?.type) headerType = currentData.type;

            // [수정] 타이틀 정보를 확인하여 적절한 이미지(번호 포함)를 우선 선택
            const titleContent = (currentData?.title || "") + (currentData?.mainQuestion || "");
            const qMatch = titleContent.match(/문제\s*(\d+)/);
            const tMatch = titleContent.match(/함께\s*풀기\s*(\d+)/);

            let hUrl = "";
            if (qMatch) hUrl = `images/tit-question${qMatch[1]}.png`;
            else if (tMatch) hUrl = `images/tit-together${tMatch[1]}.png`;
            else hUrl = ASSETS.TITLES[headerType] || ASSETS.TITLES['문제'];
            const cImg = buildPages[activePageIndex]?.image || "";
            const isSelfStudy = headerType === "스스로 풀기";

            // [FIX] If figure_bounds are present and not empty, set hasImage to true automatically
            const aiHasImage = currentData?.figure_bounds &&
                Array.isArray(currentData.figure_bounds) &&
                currentData.figure_bounds.some(v => v !== 0);

            customConfig = buildDraftInputConfig({
                typeKey: currentType,
                inputKind,
                hasImage: hasImage || aiHasImage, // Use either UI toggle or AI detection
                headerUrl: hUrl,
                contentImageUrl: cImg, // Page original image
                figure_bounds: currentData?.figure_bounds,
                figure_alt: currentData?.figure_alt,
                isTogether,
                isSelfStudy // [NEW]
            });
            console.log("[onClickZip] Custom Config generated:", customConfig);
        }

        if (!finalTemplateId) {
            setStatusMessage({ title: "알림", message: "사용할 템플릿을 찾을 수 없습니다.", type: "error" });
            return;
        }

        // [NEW] 라벨 노출(labelEnabled) 설정 반영 (TogetherSelf용)
        const processedBuildPages = buildPages.map(page => {
            if (page.data && page.data.typeKey === TYPE_KEYS.TOGETHER_SELF) {

                // [FIX] '함께 풀기 + 스스로 풀기' 텍스트 간섭 버그 수정 (!includes("함께") 추가)
                const pType = page.type || "";
                const pTitle = page.title || "";
                const dTitle = page.data.title || "";
                const dType = page.data.type || "";

                const isSelfPage =
                    pType === "스스로 풀기" || dType === "스스로 풀기" ||
                    (pTitle.includes("스스로") && !pTitle.includes("함께")) ||
                    (dTitle.includes("스스로") && !dTitle.includes("함께"));

                const newLines = (page.data.lines || []).map(line => ({
                    ...line,
                    parts: (line.parts || []).map(part => {
                        const isSelfLine = line.isSelfLine || isSelfPage;

                        // [Together] labelEnabled === false 이면 텍스트로 변환
                        if (part.type === 'blank' && part.labelEnabled === false && !isSelfLine) {
                            const options = Array.isArray(part.options) ? part.options : [];
                            const idx = (parseInt(part.correctIndex, 10) || 1) - 1;
                            const answer = options[idx] ?? "";
                            return { ...part, type: 'text', content: answer };
                        }

                        // [Self] inputEnabled === false 이면 텍스트로 변환
                        if (part.type === 'blank' && part.inputEnabled === false && isSelfLine) {
                            const options = Array.isArray(part.options) ? part.options : [];
                            const idx = (parseInt(part.correctIndex, 10) || 1) - 1;
                            const answer = options[idx] ?? "";
                            return { ...part, type: 'text', content: answer };
                        }
                        return part;
                    })
                }));
                return { ...page, data: { ...page.data, lines: newLines } };
            }
            return page;
        });

        // 최종 실행
        processAndDownloadZip({
            templates,
            selectedTemplateId: finalTemplateId,
            buildPages: processedBuildPages, // 가공된 데이터 전달
            setStatusMessage,
            setIsProcessing,
            removePagination,
            db,
            appId,
            customConfig
        });
    };

    const builderImageInputRef = useRef(null);
    const templateZipInputRef = useRef(null);
    const analysisScrollRef = useRef(null); // [NEW] Ref for analysis image grid

    const dragItem = useRef(null);

    const [statusMessage, setStatusMessage] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    // [New] Auto-scroll when analysis images are added
    useEffect(() => {
        if (activeTab === 'analysis' && analysisImages.length > 0 && analysisScrollRef.current) {
            analysisScrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [analysisImages, activeTab]);

    const ZoomModal = ({ imageUrl, onClose }) => {
        if (!imageUrl) return null;
        return (
            <div
                className="fixed inset-0 bg-black/90 z-[300] flex items-center justify-center p-4 animate-in fade-in cursor-zoom-out"
                onClick={onClose}
            >
                <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
                    <img
                        src={imageUrl}
                        className="max-w-full max-h-full object-contain shadow-2xl rounded-lg animate-in zoom-in-95 duration-300"
                        alt="Zoomed Source"
                    />
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-all"
                    >
                        <X size={24} />
                    </button>
                </div>
            </div>
        );
    };

    const StatusModal = ({ status, onClose }) => {
        if (!status) return null;
        const isLoading = status.type === 'loading' || status.type === 'info';
        return (
            <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center gap-6">
                    <div className={`p-4 rounded-full ${status.type === 'error' ? 'bg-red-100 text-red-600' : isLoading ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {status.type === 'error' ? <AlertTriangle size={32} /> : isLoading ? <Loader2 className="animate-spin" size={32} /> : <CheckCircle2 size={32} />}
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-black text-slate-900 mb-2">{status.title}</h3>
                        <p className="text-slate-500 font-medium whitespace-pre-wrap">{status.message}</p>
                    </div>
                    {!isLoading && (
                        <button onClick={onClose} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all">확인</button>
                    )}
                </div>
            </div>
        );
    };

    // 익명 로그인(firebase 보안)
    useEffect(() => {
        [JSZIP_CDN, PPTX_CDN].forEach(src => {
            if (!document.querySelector(`script[src="${src}"]`)) {
                const script = document.createElement('script'); script.src = src; script.async = true; document.head.appendChild(script);
            }
        });

        const initAuth = async () => {
            // 복잡한 조건문 대신, 단순히 익명 로그인을 시도하도록 수정합니다.
            try {
                await signInAnonymously(auth);
            } catch (error) {
                console.error("인증 에러:", error);
            }
        };
        initAuth();

        const unsubscribe = onAuthStateChanged(auth, setUser);
        return () => unsubscribe();
    }, []);


    useEffect(() => {
        // 필터링된 결과가 없으면 비움
        if (filteredTemplates.length === 0) {
            setSelectedTemplateId("");
            return;
        }

        // 사용자가 현재 타입을 변경했거나, 기존에 선택된게 필터링 리스트에 없는 경우에만 업데이트
        const exists = filteredTemplates.some(t => t.id === selectedTemplateId);
        if (!selectedTemplateId || !exists) {
            setSelectedTemplateId(filteredTemplates[0].id);
        }
    }, [selectedTypeKey, filteredTemplates]); // selectedTemplateId를 의존성에서 제거 (무한루프 방지)

    const renderMathToHTML = (text, typeKey, pageTitle, answers = []) => {
        if (!text) return null;

        const sanitizedText = sanitizeLaTeX(text);

        // 스스로 풀기 여부 확인 (함께 풀기가 포함되어 있으면 함께 풀기 섹션으로 간주)
        const isSelfStudy = typeKey === TYPE_KEYS.TOGETHER_SELF && (pageTitle?.includes('스스로') && !pageTitle?.includes('함께'));
        const isTogether = typeKey === TYPE_KEYS.TOGETHER_SELECT || (typeKey === TYPE_KEYS.TOGETHER_SELF && !isSelfStudy);

        // [MODIFIED] 수식 블록 내부에 □ 또는 _ 가 있는 경우 안전하게 분리
        let processedText = splitMathSafely(sanitizedText);

        const parts = processedText.split(/(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|□|_)/g);
        let blankIdx = 0;

        return parts.map((part, i) => {
            if (!part) return null;

            if (part.startsWith('\\(') || part.startsWith('\\[')) {
                const latex = part.replace(/^\\\(|^\\\[|\\\)$|\\\]$/g, '').trim();
                if (!latex) return null; // 빈 수식은 렌더링 안 함

                const url = `https://latex.codecogs.com/png.latex?\\dpi{150}\\bg_white ${encodeURIComponent(latex)}`;
                return <img key={i} src={url} alt="math" className="inline-block align-middle mx-1 h-5" />;
            } else if (part === '□' || part === '_') {
                blankIdx++;
                const currentBlankIdx = blankIdx;
                const answer = answers[currentBlankIdx - 1] || "";

                return (
                    <span key={i} className="inline-flex items-center align-middle mx-1 relative">
                        <span
                            className={`inline-flex items-center justify-center rounded-md border-2 transition-all relative ${isSelfStudy
                                ? 'w-16 h-10 bg-white border-slate-300 shadow-sm'
                                : isTogether
                                    ? 'w-10 h-10 bg-[#00bcf1] border-[#00bcf1] shadow-[0_4px_0_0_#0097c3]'
                                    : 'w-10 h-10 bg-[#00bcf1] border-[#00bcf1]'
                                }`}
                        >

                            {isSelfStudy && <img src="https://i.imgur.com/5LhWfL3.png" className="w-5 h-5 object-contain opacity-50" />}

                            {answer && (
                                <span className={`absolute inset-0 flex items-center justify-center font-bold text-[11px] pointer-events-none ${isSelfStudy ? 'text-blue-600' : 'text-white'}`}>
                                    {answer.length > 5 ? answer.substring(0, 4) + '..' : answer}
                                </span>
                            )}
                        </span>
                    </span>
                );
            }
            return <span key={i} className="whitespace-pre-wrap">{part}</span>;
        });
    };
    // 교과서 -> SB 변환
    const runAnalysis = async () => {
        if (analysisImages.length === 0) return;
        setIsProcessing(true);

        const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
        if (!apiKey) {
            alert("API 키를 찾을 수 없습니다. Vercel 환경 변수 설정을 확인해주세요.");
            setIsProcessing(false);
            return;
        }

        try {
            const newPages = [];

            for (let imgIdx = 0; imgIdx < analysisImages.length; imgIdx++) {
                const imageFile = analysisImages[imgIdx].file;
                const contentImageUrl = URL.createObjectURL(imageFile); // Create URL for cropping/display
                console.log(`[runAnalysis] Page ${imgIdx + 1} Image URL:`, contentImageUrl);
                const base64 = await new Promise(r => {
                    const reader = new FileReader();
                    reader.onload = () => r(reader.result.split(',')[1]);
                    reader.readAsDataURL(imageFile);
                });

                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: "이미지를 분석하여 JSON 구조로 추출해줘." }, { inlineData: { mimeType: "image/png", data: base64 } }] }],
                        systemInstruction: { parts: [{ text: UNIVERSAL_BUILDER_PROMPT }] }, // 우리가 열심히 깎은 프롬프트를 드디어 적용!
                        generationConfig: { responseMimeType: "application/json" }
                    })
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(`[Page ${imgIdx + 1}] API 요청 실패: ${errorData.error?.message || "알 수 없는 오류"}`);
                }

                const data = await res.json();
                if (!data.candidates || !data.candidates[0]) continue;

                let rawJsonText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();

                // 1. JSON 파싱 (에러 방지 및 유연한 구조 대응)
                let parsed;
                try {
                    // 1차 시도: 원본 그대로 파싱 (AI가 이미 완벽한 JSON을 준 경우)
                    parsed = JSON.parse(rawJsonText);
                } catch (e1) {
                    try {
                        // 2차 시도: 특수기호 보정 후 파싱 (수식 등에서 백슬래시 에러가 난 경우)
                        const sanitizedJson = rawJsonText
                            .replace(/\\/g, "\\\\")
                            .replace(/\\\\"/g, '\\"')
                            .replace(/\\\\n/g, '\\n')
                            .replace(/\n/g, " ");
                        parsed = JSON.parse(sanitizedJson);
                    } catch (e2) {
                        console.error("JSON 파싱 완전 실패:", rawJsonText);
                        throw new Error("AI가 올바른 JSON 데이터를 반환하지 않았습니다. 다시 시도해 주세요.");
                    }
                }

                // 2. 수식 백슬래시 복구 함수
                const deepRestore = (obj) => {
                    if (typeof obj === 'string') return obj.replace(/\\\\/g, "\\");
                    if (Array.isArray(obj)) return obj.map(deepRestore);
                    if (obj !== null && typeof obj === 'object') {
                        const newObj = {};
                        for (let key in obj) { newObj[key] = deepRestore(obj[key]); }
                        return newObj;
                    }
                    return obj;
                };

                // [중요] AI가 sections 껍데기를 빼먹고 배열만 뱉거나 구조를 바꿨을 때를 대비한 3중 방어
                let extractedSections = [];
                if (Array.isArray(parsed)) {
                    extractedSections = parsed;
                } else if (parsed.sections && Array.isArray(parsed.sections)) {
                    extractedSections = parsed.sections;
                } else {
                    // 객체 안에 배열이 하나라도 숨어있다면 그걸 끄집어내서 사용
                    const fallbackArray = Object.values(parsed).find(v => Array.isArray(v));
                    if (fallbackArray) extractedSections = fallbackArray;
                    else extractedSections = [parsed]; // 최후의 수단: 단일 객체를 강제로 배열에 넣음
                }

                const pageSections = deepRestore(extractedSections);
                // [FIX] content 객체가 없는 새로운 JSON 구조에도 에러가 나지 않도록 옵셔널 체이닝(?.) 및 다중 조건 적용
                const hasTogether = pageSections.some(s => {
                    const t = s.content?.title || s.mainQuestion || s.title || "";
                    return t.includes("함께");
                });
                const hasSelf = pageSections.some(s => {
                    const t = s.content?.title || s.mainQuestion || s.title || "";
                    return t.includes("스스로");
                });
                const isTogetherSelfSet = hasTogether && hasSelf;

                let lastTogetherType = ""; // [추가] 이전 섹션의 together 유형 추적

                pageSections.forEach((sec, sIdx) => {
                    const contentObj = sec.content || {};
                    const title = contentObj.title || sec.mainQuestion || sec.title || "";
                    const secTitle = title.toLowerCase();
                    const isThisSecSelf = secTitle.includes('스스로') && !secTitle.includes('함께'); // [FIX] "함께 + 스스로" 간섭 방지
                    const isThisSecTogether = secTitle.includes('함께');

                    const isContinuation = !title || /^\d/.test(title) || title.includes("계속");

                    let detectedTypeKey = sec.typeKey || "";
                    let type = sec.type || "";

                    if (!detectedTypeKey) {
                        if (isTogetherSelfSet && (isThisSecTogether || isThisSecSelf)) {
                            detectedTypeKey = TYPE_KEYS.TOGETHER_SELF;
                            type = isThisSecSelf ? '스스로 풀기' : '함께 풀기 + 스스로 풀기';
                        } else if (isThisSecTogether) {
                            detectedTypeKey = TYPE_KEYS.TOGETHER_SELECT;
                            type = '함께 풀기';
                        } else if (isThisSecSelf) {
                            detectedTypeKey = TYPE_KEYS.TOGETHER_SELF;
                            type = '스스로 풀기';
                        } else if (isContinuation && lastTogetherType) {
                            detectedTypeKey = lastTogetherType;
                            type = lastTogetherType === TYPE_KEYS.TOGETHER_SELECT ? '함께 풀기' : '함께 풀기 + 스스로 풀기';
                        } else {
                            detectedTypeKey = TYPE_KEYS.QUESTION_MATHINPUT;
                            type = '문제';
                        }
                    }

                    if (detectedTypeKey.startsWith("together")) {
                        lastTogetherType = detectedTypeKey;
                    } else {
                        lastTogetherType = "";
                    }

                    let body = (contentObj.body || "").replace(/(답|정답|풀이|해설)\s*[:\.]\s*.*(\n|$)/g, "").trim();
                    let finalAnswers = [...(sec.answers || [])];

                    // [복구] AI가 빈칸 생성에 실패한 경우를 대비한 최소한의 안전 장치
                    if (detectedTypeKey === TYPE_KEYS.TOGETHER_SELF && !body.includes('□') && !body.includes('_') && body.length > 0) {
                        const extracted = [];
                        body = body.replace(/=\s*([^=\n]+?)(?=\s*\\\)|\s*\n|\s*=|$)/g, (match, p1) => {
                            extracted.push(p1.trim());
                            return '=\\) □ \\(';
                        });
                        body = body.replace(/\\\( *\\\)/g, '');
                        if (extracted.length > 0) finalAnswers = extracted;
                    }
                    body = body.trim() || "";

                    const bodyLines = body.split('\n').filter(l => l.trim());
                    const updatedSubQs = [];
                    let currentSq = null;
                    let answerPointer = 0;
                    let pendingPassage = "";

                    const isTogetherType = detectedTypeKey.includes('SELF') || detectedTypeKey === TYPE_KEYS.TOGETHER_SELECT;

                    bodyLines.forEach((line, i) => {
                        const trimmedLine = line.trim();
                        if (!trimmedLine) return;

                        const labelMatch = trimmedLine.match(/^[\(\[①-⑨]?(\d+)[\)\]\.]?\s*/);
                        const isTitleLine = trimmedLine.includes("함께 풀기") || trimmedLine.includes("스스로 풀기");

                        if (isTitleLine) return;

                        if (labelMatch) {
                            const rawText = trimmedLine.replace(labelMatch[0], "").trim();
                            const blankCount = (rawText.match(/□|_/g) || []).length;
                            const chunk = blankCount > 0 ? finalAnswers.slice(answerPointer, answerPointer + blankCount) : [];
                            if (blankCount > 0) answerPointer += blankCount;

                            const finalPassage = pendingPassage ? `${pendingPassage}\n${rawText}` : rawText;
                            pendingPassage = "";

                            currentSq = {
                                id: Date.now() + i + Math.random(),
                                label: labelMatch[0].trim(),
                                passage: finalPassage,
                                answer: chunk.length > 1 ? chunk : (chunk[0] || ""),
                                labelEnabled: isTogetherType,
                                explanation: ""
                            };
                            updatedSubQs.push(currentSq);
                        } else if (currentSq) {
                            currentSq.passage += "\n" + trimmedLine;
                            const extraBlank = (trimmedLine.match(/□|_/g) || []).length;
                            if (extraBlank > 0) {
                                const extraChunk = finalAnswers.slice(answerPointer, answerPointer + extraBlank);
                                const prev = Array.isArray(currentSq.answer) ? currentSq.answer : (currentSq.answer ? [currentSq.answer] : []);
                                currentSq.answer = [...prev, ...extraChunk].length > 1 ? [...prev, ...extraChunk] : (prev[0] || extraChunk[0] || "");
                                answerPointer += extraBlank;
                            }
                        } else {
                            pendingPassage = pendingPassage ? `${pendingPassage}\n${trimmedLine}` : trimmedLine;
                        }
                    });

                    if (updatedSubQs.length === 0 && pendingPassage) {
                        updatedSubQs.push({
                            id: Date.now(),
                            label: "",
                            passage: pendingPassage,
                            answer: finalAnswers.length > 1 ? finalAnswers : (finalAnswers[0] || ""),
                            explanation: ""
                        });
                    }

                    // --- [4] Builder 라벨 인식을 위한 lines 생성 로직 ---
                    const sourceSubQs = updatedSubQs.length > 0 ? updatedSubQs : (sec.subQuestions || []);
                    let finalLines = (sec.lines && sec.lines.length > 0) ? sec.lines : null;

                    if (!finalLines && isTogetherType && sourceSubQs.length > 0) {
                        finalLines = sourceSubQs.map((sq, sqIdx) => {
                            const parts = [];
                            let balancedPassage = splitMathSafely(sq.passage || sq.text || "").replace(/\\\( *\\\)/g, "");
                            const textParts = balancedPassage.split(/□|_/);
                            const sqAnswers = Array.isArray(sq.answer) ? sq.answer : (sq.answer ? [sq.answer] : []);

                            textParts.forEach((tp, i) => {
                                if (tp) parts.push({ type: 'text', content: tp.trim() });
                                if (i < textParts.length - 1) {
                                    const ans = String(sqAnswers[i] || "정답");
                                    const numMatch = ans.match(/^-?\d*\.?\d+$/);
                                    let finalOptions = ["", "", ""];
                                    if (numMatch) {
                                        const n = parseFloat(ans);
                                        finalOptions = [ans, String(n - 1), String(n + 1)];
                                    } else {
                                        finalOptions = [ans, "오답1", "오답2"];
                                    }

                                    parts.push({
                                        type: 'blank',
                                        options: finalOptions,
                                        correctIndex: 1,
                                        labelEnabled: true,
                                        isLabelTarget: true,
                                        label: "",
                                        explanation: sq.explanation || ""
                                    });
                                }
                            });
                            return { label: sq.label || `(${sqIdx + 1})`, parts: parts, labelEnabled: true, isSelfLine: isThisSecSelf };
                        });
                    }

                    // 🚨 여기가 이전 턴에서 날아갔던 변수들입니다! 🚨
                    let instructionRaw = contentObj.instruction || sec.mainQuestion || "";
                    let finalInstruction = instructionRaw.replace(/\\\\/g, "\\");
                    if (!finalInstruction) {
                        finalInstruction = (detectedTypeKey === TYPE_KEYS.QUESTION_MATHINPUT) ? "다음을 계산하세요." : "문제를 해결해 보세요.";
                    }

                    let guideRaw = sec.guideText || "";
                    let guide = (guideRaw.replace(/\\\\/g, "\\")) || "";
                    if (!guide) {
                        guide = (detectedTypeKey === TYPE_KEYS.QUESTION_MATHINPUT) ? "▷ 빈칸에 들어갈 값을 입력해 보세요." : "▷ 빈칸을 클릭하여 문제를 해결해 보세요.";
                    }

                    const finalSubQs = sourceSubQs;

                    if ((type === '문제' || detectedTypeKey === TYPE_KEYS.TOGETHER_SELECT) && finalSubQs.length >= 3) {
                        for (let i = 0; i < finalSubQs.length; i += 2) {
                            const chunk = finalSubQs.slice(i, i + 2);
                            const chunkLines = finalLines ? finalLines.slice(i, i + 2) : null;
                            const isFirst = i === 0;

                            newPages.push({
                                id: Date.now() + sIdx + i + imgIdx * 1000,
                                type, typeKey: detectedTypeKey,
                                title: isFirst ? title : `${title} (계속)`,
                                mainQuestion: isFirst ? title : `${title} (계속)`,
                                content: finalInstruction, guide: guide,
                                body: chunk.map(q => q.passage).join('\n'),
                                answers: chunk.flatMap(q => Array.isArray(q.answer) ? q.answer : [q.answer]),
                                description: [{ text: generateLogicText(type, sec.subtype, chunk.flatMap(q => Array.isArray(q.answer) ? q.answer : [q.answer])) }],
                                subQuestions: chunk, lines: chunkLines,
                                isSelfStudy: isThisSecSelf, // [NEW]
                                figure_bounds: sec.figure_bounds || [0, 0, 0, 0],
                                figure_alt: sec.figure_alt || "",
                                contentImageUrl: contentImageUrl
                            });
                        }
                    } else {
                        newPages.push({
                            id: Date.now() + sIdx + imgIdx * 1000,
                            type, typeKey: detectedTypeKey,
                            title, mainQuestion: title,
                            content: finalInstruction, guide: guide,
                            body: body, answers: finalAnswers,
                            description: [{ text: generateLogicText(type, sec.subtype, finalAnswers) }],
                            subQuestions: finalSubQs, lines: finalLines,
                            isSelfStudy: isThisSecSelf, // [NEW]
                            figure_bounds: sec.figure_bounds || [0, 0, 0, 0],
                            figure_alt: sec.figure_alt || "",
                            contentImageUrl: contentImageUrl
                        });
                    }
                });
            }

            setPages(newPages);
            setActiveTab('storyboard');
            if (newPages[0]) setMetadata(prev => ({ ...prev, activityName: newPages[0].title }));

        } catch (err) {
            console.error("분석 상세 에러:", err);
            alert("분석 실패: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // const handleTypeChange = (pageId, newTypeKey) => {
    //     setPages(prevPages => prevPages.map(page => {
    //         if (page.id !== pageId) return page;

    //         // 1. 기본 타입 정보 업데이트
    //         let updatedPage = {
    //             ...page,
    //             typeKey: newTypeKey,
    //             type: newTypeKey === TYPE_KEYS.QUESTION_MATHINPUT ? '문제' : '함께/스스로 풀기'
    //         };

    //         // 2. Together 계열로 변경 시 lines 구조 생성
    //         if (newTypeKey.includes('TOGETHER')) {
    //             updatedPage.lines = generateLinesFromSubQs(page.subQuestions);
    //             // 기존 subQuestions에도 라벨 활성화 플래그 주입
    //             updatedPage.subQuestions = page.subQuestions.map(sq => ({ ...sq, labelEnabled: true }));
    //         } else {
    //             // 일반 문제로 변경 시 lines 제거
    //             updatedPage.lines = null;
    //             updatedPage.subQuestions = page.subQuestions.map(sq => ({ ...sq, labelEnabled: false }));
    //         }

    //         return updatedPage;
    //     }));
    // };
    // const generateLinesFromSubQs = (subQs) => {
    //     return subQs.map((sq, qIdx) => {
    //         const parts = [];
    //         const textParts = sq.passage.split(/□|_/);
    //         const sqAnswers = Array.isArray(sq.answer) ? sq.answer : [sq.answer];

    //         textParts.forEach((tp, i) => {
    //             if (tp) parts.push({ type: 'text', content: tp.trim() });
    //             if (i < textParts.length - 1) {
    //                 parts.push({
    //                     type: 'blank',
    //                     options: [sqAnswers[i] || "정답", "오답1", "오답2"],
    //                     correctIndex: 1,
    //                     labelEnabled: true,
    //                     isLabelTarget: true,
    //                     label: sq.label || `(${qIdx + 1})`
    //                 });
    //             }
    //         });
    //         return { label: sq.label || `(${qIdx + 1})`, parts, labelEnabled: true };
    //     });
    // };



    const addPage = () => {
        if (buildPages.length >= 4) return;
        const newPages = [...buildPages, { id: buildPages.length + 1, image: null, data: null }];
        setBuildPages(newPages);
        setActivePageIndex(newPages.length - 1);
    };

    const removePage = (index) => {
        if (buildPages.length <= 1) return;
        if (!window.confirm("뷰를 삭제할까요?")) return;
        const newPages = buildPages.filter((_, i) => i !== index).map((p, i) => ({ ...p, id: i + 1 }));
        setBuildPages(newPages);
        setActivePageIndex(Math.max(0, index - 1));
    };

    const updateCurrentPageData = (newData) => {
        const newPages = [...buildPages];
        newPages[activePageIndex].data = newData;
        setBuildPages(newPages);
    };

    const analyzeImage = async (file) => {
        const base64 = await new Promise(r => {
            const reader = new FileReader();
            reader.onload = () => r(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
        });

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Extract JSON for build." }, { inlineData: { mimeType: "image/png", data: base64 } }] }],
                systemInstruction: { parts: [{ text: UNIVERSAL_BUILDER_PROMPT }] },
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error?.message || `API Error ${res.status}`);
        }

        const data = await res.json();
        if (!data.candidates || data.candidates.length === 0) {
            console.error("Gemini No Candidates:", data);
            if (data.promptFeedback?.blockReason) {
                throw new Error(`AI Safety Block: ${data.promptFeedback.blockReason}`);
            }
            throw new Error("AI 분석 결과가 없습니다. 다시 시도해주세요.");
        }

        const text = data.candidates[0].content.parts[0].text;
        // Strip markdown code blocks if present
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    };

    // 콘텐츠 생성 tab에서 사용자가 업로드한 sb 이미지를 받아서 미리보기를 생성하고, AI를 통해 **내용을 분석**한 뒤, 그 결과를 페이지별로 저장
    const handleBuilderImage = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setIsProcessing(true);
        try {
            let currentPages = [...buildPages];
            let targetIndex = activePageIndex;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                // Add page if needed
                if (targetIndex >= currentPages.length) {
                    if (currentPages.length >= 5) break;
                    currentPages.push({ id: currentPages.length + 1, image: null, data: null });
                }

                // Preview
                currentPages[targetIndex] = {
                    ...currentPages[targetIndex],
                    image: URL.createObjectURL(file),
                };
                setBuildPages([...currentPages]);

                // Analyze
                let extracted = await analyzeImage(file);

                // [NEW] Normalize extracted data (Ensure labels are ON by default and tag Self lines)
                if (extracted) {
                    const isSelfStudyPage = (extracted.typeKey === TYPE_KEYS.TOGETHER_SELF && (extracted.subtype === "스스로 풀기" || (extracted.mainQuestion || "").includes("스스로")));

                    if (extracted.lines) {
                        extracted.lines = extracted.lines.map(line => ({
                            ...line,
                            isSelfLine: line.isSelfLine !== undefined ? line.isSelfLine : isSelfStudyPage,
                            parts: (line.parts || []).map(part => {
                                if (part.type === 'blank' && part.labelEnabled === undefined) {
                                    return { ...part, labelEnabled: true };
                                }
                                return part;
                            })
                        }));
                    }

                    currentPages[targetIndex].type = isSelfStudyPage ? "스스로 풀기" : (extracted.typeKey === TYPE_KEYS.TOGETHER_SELF ? "함께 풀기 + 스스로 풀기" : "문제");
                    currentPages[targetIndex].title = extracted.mainQuestion || (isSelfStudyPage ? "스스로 풀기" : "함께 풀기");
                }

                currentPages[targetIndex].data = extracted;
                setBuildPages([...currentPages]);

                targetIndex++;
            }
            // Move active index to the last processed page
            setActivePageIndex(targetIndex - 1);

        } catch (e) {
            alert("분석 에러: " + e.message);
        } finally {
            setIsProcessing(false);
            e.target.value = '';
        }
    };


    // 템플릿 zip파일 생성
    const uploadTemplate = async (e) => {
        const file = e.target.files[0];
        if (!file || !file.name.endsWith('.zip')) {
            setStatusMessage({ title: "오류", message: "유효한 ZIP 파일을 선택해주세요.", type: 'error' });
            return;
        }
        if (file.size === 0) {
            setStatusMessage({ title: "오류", message: "파일 크기가 0바이트입니다. 올바른 파일을 선택해주세요.", type: 'error' });
            return;
        }

        setIsProcessing(true);
        setUploadProgress(0);
        try {
            const templateId = `temp_${Date.now()}`;
            const chunkCount = Math.ceil(file.size / CHUNK_SIZE);

            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'templates', templateId), {
                name: file.name.replace('.zip', ''),
                createdAt: Date.now(),
                typeKey: selectedTypeKey,
            });

            for (let i = 0; i < chunkCount; i++) {
                const chunkBlob = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const result = reader.result;
                        const base64Str = result.includes(',') ? result.split(',')[1] : result;
                        resolve(base64Str);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(chunkBlob);
                });

                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'templates', templateId, 'chunks', `chunk_${i}`), { data: base64, index: i });
                setUploadProgress(Math.round(((i + 1) / chunkCount) * 100));
            }
            setStatusMessage({ title: "성공", message: "템플릿 업로드가 완료되었습니다.", type: 'success' });
        } catch (e) {
            console.error(e);
            setStatusMessage({ title: "오류", message: "업로드 실패: " + e.message, type: 'error' });
        } finally {
            setIsProcessing(false);
            setUploadProgress(0);
            if (templateZipInputRef.current) templateZipInputRef.current.value = '';
        }
    };

    return (
        <div className="flex h-screen bg-[#F8FAFC] text-slate-800 overflow-hidden selection:bg-indigo-500 selection:text-white">
            <StatusModal status={statusMessage} onClose={() => setStatusMessage(null)} />
            <ZoomModal imageUrl={zoomedImage} onClose={() => setZoomedImage(null)} />

            {/* [Modern Sidebar] Glassmorphism & Clean Typography */}
            <aside className="w-72 bg-white/80 backdrop-blur-2xl border-r border-slate-100/50 p-8 flex flex-col gap-10 z-20 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-4 px-2">
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-200 ring-4 ring-indigo-50">
                        <Layout size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none mb-1">Edu Builder</h1>
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-full inline-block">AI Powered</span>
                    </div>
                </div>

                <nav className="flex flex-col gap-3 flex-1">
                    {[
                        { id: 'analysis', icon: BookOpen, label: '교과서 분석' },
                        { id: 'storyboard', icon: Layers, label: '스토리보드' },
                        { id: 'builder', icon: Calculator, label: '콘텐츠 생성' },
                        { id: 'library', icon: HardDrive, label: '라이브러리' }
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`group flex items-center gap-4 px-5 py-4 rounded-[1.2rem] transition-all duration-300 ease-out border ${activeTab === item.id
                                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 border-indigo-500 translate-x-2'
                                : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-50 hover:text-slate-900 hover:border-slate-100'
                                }`}
                        >
                            <item.icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2} className={`transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'}`} />
                            <span className="font-bold text-[15px] tracking-tight">{item.label}</span>
                            {activeTab === item.id && <ChevronRight size={16} className="ml-auto opacity-50" />}
                        </button>
                    ))}
                </nav>

                <div className="px-4 py-6 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">System Status</p>
                    <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-bold text-slate-600">Online & Ready</span>
                    </div>
                </div>
            </aside>

            <main className="flex-1 overflow-y-auto relative custom-scrollbar p-10">
                {isProcessing && (
                    <div className="fixed inset-0 bg-white/70 backdrop-blur-md z-[100] flex flex-col items-center justify-center">
                        <div className="p-10 bg-white rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 border border-slate-100 animate-in zoom-in duration-300">
                            <Loader2 className="animate-spin text-indigo-600" size={64} />
                            <p className="font-black text-slate-700 text-lg">
                                {uploadProgress > 0 ? `업로드 중... ${uploadProgress}%` : (activeTab === 'analysis' ? "AI 엔진 가동 중..." : "콘텐츠 패키징 중...")}
                            </p>
                            {uploadProgress > 0 && (
                                <div className="w-64 h-4 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-600 transition-all duration-300 ease-out"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="max-w-7xl mx-auto">
                    <header className="flex justify-between items-end mb-8 px-4 sticky top-0 z-20 bg-[#fcfcfc]">
                        <div>
                            <h2 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tighter leading-tight drop-shadow-sm">
                                {activeTab === 'analysis' && "교과서 분석"}
                                {activeTab === 'storyboard' && "스토리보드 리뷰"}
                                {activeTab === 'builder' && "콘텐츠 자동 생성"}
                                {activeTab === 'library' && "템플릿 라이브러리"}
                            </h2>
                            <p className="text-slate-500 font-small mt-3 text-lg">
                                {activeTab === 'analysis' && "교과서 이미지를 업로드하면 AI가 스토리보드 초안을 생성합니다."}
                                {activeTab === 'storyboard' && "생성된 스토리보드 화면을 확인하고 콘텐츠 생성을 진행하세요."}
                                {activeTab === 'builder' && "화면을 보며 직접 내용을 수정해 보세요. 내용 작성이 완료된 후 [콘텐츠 다운로드] 버튼을 눌러 act 파일을 다운받을 수 있습니다."}
                                {activeTab === 'library' && "템플릿 업로드 페이지입니다."}
                            </p>
                        </div>
                        <div className="flex gap-4">
                            {activeTab === 'analysis' && (
                                <button onClick={runAnalysis} className="px-10 py-4 bg-gray-900 text-white rounded-full font-bold text-lg shadow-xl shadow-gray-200 hover:scale-[1.02] hover:shadow-2xl active:scale-95 transition-all flex items-center gap-3">
                                    <MonitorPlay size={20} /> 스토리보드 생성
                                </button>
                            )}
                            {/* {activeTab === 'storyboard' && (
                                <button onClick={generatePPTX} className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-full font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:scale-105 transition-all">
                                    <Download size={20} /> PPTX 다운로드
                                </button>
                            )} */}
                        </div>
                    </header>

                    {activeTab === 'analysis' && (
                        <div className="space-y-12 animate-in slide-in-from-bottom-8 duration-700 fade-in">
                            <div className="flex justify-center mb-6">
                                <button
                                    onClick={async () => {
                                        setIsProcessing(true);
                                        try {
                                            // [FIX] Use 'templates' collection to ensure public read access if 'examples' is blocked
                                            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'templates', 'example_demo_image');
                                            const snap = await getDoc(docRef);
                                            if (snap.exists()) {
                                                const data = snap.data();
                                                if (data.base64) {
                                                    // Base64 to Blob/File
                                                    const byteString = atob(data.base64);
                                                    const ab = new ArrayBuffer(byteString.length);
                                                    const ia = new Uint8Array(ab);
                                                    for (let i = 0; i < byteString.length; i++) {
                                                        ia[i] = byteString.charCodeAt(i);
                                                    }
                                                    const blob = new Blob([ab], { type: 'image/png' });
                                                    const file = new File([blob], "example_textbook.png", { type: 'image/png' });

                                                    setAnalysisImages([{ id: Date.now(), file, preview: URL.createObjectURL(file) }]);
                                                    setStatusMessage({ title: "성공", message: "예시 이미지를 불러왔습니다.", type: "success" });
                                                }
                                            } else {
                                                alert("저장된 예시 이미지가 없습니다.");
                                            }
                                        } catch (e) {
                                            console.error(e);
                                            alert("예시 불러오기 실패: " + e.message);
                                        } finally {
                                            setIsProcessing(false);
                                        }
                                    }}
                                    className="px-6 py-2 bg-indigo-50 text-indigo-600 rounded-full font-bold text-sm hover:bg-indigo-100 transition-colors flex items-center gap-2"
                                >
                                    <BookOpen size={16} /> 예시 이미지로 테스트
                                </button>
                            </div>

                            <div
                                onClick={() => builderImageInputRef.current.click()}
                                className="group relative border-4 border-dashed border-slate-200/80 rounded-[3rem] p-24 flex flex-col items-center justify-center bg-white hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer shadow-sm hover:shadow-2xl hover:shadow-indigo-100/50 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10 group-hover:opacity-100 transition-opacity" />
                                <input ref={builderImageInputRef} type="file" multiple accept="image/*" onChange={(e) => setAnalysisImages(Array.from(e.target.files).map(f => ({ id: Math.random(), file: f, preview: URL.createObjectURL(f) })))} className="hidden" />

                                <div className="p-3 bg-white rounded-[2rem] text-indigo-600 mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-100">
                                    <Upload size={64} strokeWidth={1.5} />
                                </div>
                                <h3 className="text-3xl font-bold text-slate-800 tracking-tight text-center">교과서 원고 업로드</h3>
                                <p className="text-slate-500 font-medium mt-4 text-center max-w-lg leading-relaxed">
                                    수학 김화경 교과서 png를 업로드하면 분석하여 스토리보드를 생성합니다.<br />
                                    (문제, 함께 풀기, 함께 풀기 + 스스로 풀기) 유형만 가능합니다.<br />
                                    <span className="text-indigo-500 font-bold">AI가 자동으로 콘텐츠 유형 판별 및 텍스트 추출, 정답 및 해설 내용을 작성합니다. <br /> AI는 실수를 할 수 있습니다.</span>
                                </p>
                            </div>
                            <div ref={analysisScrollRef} className="grid grid-cols-3 gap-8">
                                {analysisImages.map(img => (
                                    <div key={img.id} className="relative rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-md group hover:scale-[1.02] hover:shadow-xl transition-all duration-500 bg-white">
                                        <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                            <button
                                                title="기본 예시로 설정"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!window.confirm("이 이미지를 '예시 이미지'로 설정하시겠습니까? 기존 예시는 덮어씌워집니다.")) return;

                                                    setIsProcessing(true);
                                                    try {
                                                        const base64 = await new Promise(r => {
                                                            const reader = new FileReader();
                                                            reader.onload = () => r(reader.result.split(',')[1]);
                                                            reader.readAsDataURL(img.file);
                                                        });

                                                        // [FIX] Use 'templates' collection for write access if 'examples' is blocked
                                                        // Assuming write access to templates is allowed for authenticated users (even anonymous)
                                                        // If not, we might need a specific 'user_data' area, but templates are where we write other things.
                                                        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'templates', 'example_demo_image'), {
                                                            base64,
                                                            name: "Example Demo Image", // Add dummy fields to look like a template
                                                            typeKey: "demo",
                                                            updatedAt: Date.now()
                                                        });

                                                        setStatusMessage({ title: "설정 완료", message: "기본 예시 이미지가 업데이트되었습니다.", type: "success" });
                                                    } catch (err) {
                                                        console.error(err);
                                                        alert("설정 실패: " + err.message);
                                                    } finally {
                                                        setIsProcessing(false);
                                                    }
                                                }}
                                                className="p-3 bg-white/90 backdrop-blur-md text-amber-500 rounded-full hover:bg-amber-50 transition-colors shadow-sm"
                                            >
                                                <checkCircle2 size={20} /> ★
                                            </button>
                                            <button onClick={() => setAnalysisImages(prev => prev.filter(i => i.id !== img.id))} className="p-3 bg-white/90 backdrop-blur-md text-rose-500 rounded-full hover:bg-rose-50 transition-colors shadow-sm"><Trash2 size={20} /></button>
                                        </div>
                                        <img src={img.preview} className="w-full h-72 object-cover" />
                                        <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
                                            <p className="text-white font-bold text-sm">교과서 이미지</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'storyboard' && (
                        <div className="space-y-16 animate-in fade-in duration-500 pb-32">
                            {pages.length > 0 ? pages.map((page, pIdx) => (
                                <div key={page.id} className="bg-white rounded-[3rem] p-2 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-slate-100 group">
                                    <div className="flex flex-col lg:flex-row h-full">

                                        {/* Metadata Sider */}
                                        <div className="lg:w-60 p-8 flex flex-col gap-6 border-b lg:border-b-0 lg:border-r border-slate-100">


                                            <div className="flex items-center gap-4 mb-4">
                                                <span className="w-14 h-14 bg-indigo-600 text-white rounded-[1.5rem] flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-200">
                                                    {pIdx + 1}
                                                </span>
                                                <div>
                                                    <span className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Page Sequence</span>
                                                    <span className="font-black text-slate-800 text-lg tracking-tight">Main Flow</span>
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</span>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-700">
                                                    {page.type}
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Title</span>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-700 leading-snug">
                                                    {page.title}
                                                </div>
                                            </div>

                                            <div className="mt-auto pt-4 flex gap-2 opacity-50 hover:opacity-100 transition-opacity">
                                                <GripVertical className="text-slate-300 cursor-move" />
                                                <span className="text-xs font-bold text-slate-400">Drag to Reorder</span>
                                            </div>
                                        </div>

                                        {/* Content Preview */}
                                        <div className="flex-1 p-10 bg-slate-50/50">
                                            <label className="text-[10px] font-black uppercase text-indigo-300 tracking-widest block mb-6">Visual Preview</label>
                                            <div className="bg-white p-12 rounded-[2.5rem] border border-slate-200 shadow-sm relative min-h-[500px]">
                                                {(() => {
                                                    let titleImg = ASSETS.TITLES['문제'];
                                                    // 타이틀 텍스트가 제멋대로여도 typeKey(유형)를 최우선으로 아이콘 매핑
                                                    if (page.typeKey === 'together.self' || page.type === '함께 풀기 + 스스로 풀기') {
                                                        if ((page.title || "").includes('스스로')) titleImg = ASSETS.TITLES['스스로 풀기'];
                                                        else titleImg = ASSETS.TITLES['함께 풀기']; // 기본값은 함께 풀기
                                                    } else if (page.typeKey === 'together.select' || page.type === '함께 풀기') {
                                                        titleImg = ASSETS.TITLES['함께 풀기'];
                                                    } else if (page.typeKey === 'question.image' || page.type === '이미지형') {
                                                        titleImg = ASSETS.TITLES['문제'];
                                                    } else if (page.typeKey === 'question.mathinput' || page.type === '문제') {
                                                        titleImg = ASSETS.TITLES['문제'];
                                                    }
                                                    return <img src={titleImg} className="h-10 mb-4 object-contain brightness-95" alt="title" />;
                                                })()}

                                                <div className="space-y-2">
                                                    <h4 className="text-2xl font-bold text-slate-800 leading-snug tracking-tight">
                                                        {renderMathToHTML(page.content, page.typeKey || page.type, page.title)}
                                                    </h4>
                                                    <h5 className="text-lg text-slate-400 leading-snug tracking-tight mb-6">
                                                        {renderMathToHTML(page.guide, page.typeKey || page.type, page.title)}
                                                    </h5>

                                                    <div className="space-y-6 mt-8 pl-2 border-l-2 border-slate-100">
                                                        {/* [NEW] 통합 삽화 및 크롭 에디터 영역 (페이지 레벨로 이동) */}
                                                        {page.contentImageUrl && (page.typeKey === 'question.image' || page.type === '이미지형' || (page.figure_bounds && page.figure_bounds.some(v => v !== 0))) && (
                                                            <div className="mb-10 space-y-4 pr-6">
                                                                <div
                                                                    className="relative rounded-[2.5rem] overflow-hidden border-4 border-rose-100 shadow-2xl bg-slate-50 aspect-video lg:aspect-[16/7] group/fig cursor-crosshair"
                                                                    onMouseDown={(e) => {
                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                        const x = ((e.clientX - rect.left) / rect.width) * 1000;
                                                                        const y = ((e.clientY - rect.top) / rect.height) * 1000;

                                                                        const updateBounds = (moveEvent) => {
                                                                            const moveRect = e.currentTarget.getBoundingClientRect();
                                                                            const moveX = ((moveEvent.clientX - moveRect.left) / moveRect.width) * 1000;
                                                                            const moveY = ((moveEvent.clientY - moveRect.top) / moveRect.height) * 1000;

                                                                            const newBounds = [
                                                                                Math.max(0, Math.min(y, moveY)),
                                                                                Math.max(0, Math.min(x, moveX)),
                                                                                Math.min(1000, Math.max(y, moveY)),
                                                                                Math.min(1000, Math.max(x, moveX))
                                                                            ];

                                                                            const newPages = [...pages];
                                                                            newPages[pIdx] = { ...newPages[pIdx], figure_bounds: newBounds };
                                                                            setPages(newPages);
                                                                        };

                                                                        const stopUpdate = () => {
                                                                            window.removeEventListener('mousemove', updateBounds);
                                                                            window.removeEventListener('mouseup', stopUpdate);
                                                                        };

                                                                        window.addEventListener('mousemove', updateBounds);
                                                                        window.addEventListener('mouseup', stopUpdate);
                                                                    }}
                                                                >
                                                                    <img src={page.contentImageUrl} className="w-full h-full object-contain pointer-events-none select-none" alt="Original" />
                                                                    {page.figure_bounds && page.figure_bounds.some(v => v !== 0) && (
                                                                        <div
                                                                            className="absolute border-4 border-rose-500 bg-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-all duration-75"
                                                                            style={{
                                                                                top: `${page.figure_bounds[0] / 10}%`,
                                                                                left: `${page.figure_bounds[1] / 10}%`,
                                                                                width: `${(page.figure_bounds[3] - page.figure_bounds[1]) / 10}%`,
                                                                                height: `${(page.figure_bounds[2] - page.figure_bounds[0]) / 10}%`,
                                                                            }}
                                                                        >
                                                                            <div className="absolute -top-7 left-0 bg-rose-500 text-white text-[10px] font-black px-2 py-1 rounded flex items-center gap-1 shadow-lg">
                                                                                <Crop size={10} /> CROP AREA
                                                                            </div>
                                                                            <button
                                                                                className="absolute -top-3 -right-3 w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const newPages = [...pages];
                                                                                    newPages[pIdx] = { ...newPages[pIdx], figure_bounds: [0, 0, 0, 0] };
                                                                                    setPages(newPages);
                                                                                }}
                                                                            >
                                                                                ×
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/fig:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                                                        <span className="text-white font-bold text-sm bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm shadow-xl flex items-center gap-2">
                                                                            <MousePointer2 size={16} /> 드래그하여 삽화 영역 지정
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                {(page.typeKey === 'question.image' || page.type === '이미지형') && (
                                                                    <div className="p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100 flex items-center justify-between">
                                                                        <div>
                                                                            <div className="text-[10px] font-black text-emerald-500 mb-1 uppercase tracking-widest">Expected Answer</div>
                                                                            <div className="text-xl font-black text-emerald-700">
                                                                                {renderMathToHTML(Array.isArray(page.answers) ? page.answers[0] : page.answers, page.typeKey, page.title)}
                                                                            </div>
                                                                        </div>
                                                                        <div className="w-16 h-10 border border-slate-300 rounded-lg flex items-center justify-center bg-white shrink-0">
                                                                            <img src="https://i.imgur.com/5LhWfL3.png" className="w-5 h-5 object-contain opacity-50" />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* 1. 질문 리스트 및 Lines 렌더링 */}
                                                        {(page.typeKey?.startsWith('together') || page.type?.includes('함께')) && page.lines && page.lines.length > 0 ? (
                                                            <div className="space-y-4 pt-4">
                                                                {(() => {
                                                                    let globalBlankIdx = 0;
                                                                    return page.lines.map((line, li) => (
                                                                        <div key={li} className="flex gap-4 items-start p-6 bg-slate-50 rounded-[2rem] hover:bg-indigo-50/30 transition-colors">
                                                                            {line.label && <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0">{line.label}</div>}
                                                                            <div className="flex-1 text-lg font-medium leading-relaxed text-slate-700">
                                                                                {(line.parts || []).map((part, pi) => {
                                                                                    if (part.type === 'text') return renderMathToHTML(part.content, page.typeKey || page.type, page.title);
                                                                                    if (part.type === 'blank') {
                                                                                        globalBlankIdx++;
                                                                                        const currentIdx = globalBlankIdx;
                                                                                        // [FIX] Strict Self-study detection
                                                                                        const isSelf = page.isSelfStudy || ((page.title || "").includes("스스로") && !(page.title || "").includes("함께"));
                                                                                        const ans = (part.options && part.options[0]) || "";
                                                                                        return (
                                                                                            <span key={pi} className="inline-flex items-center align-middle mx-1 relative">
                                                                                                <span className={`inline-flex items-center justify-center rounded-md border-2 transition-all relative ${isSelf
                                                                                                    ? 'w-16 h-10 bg-white border-slate-300 shadow-sm'
                                                                                                    : 'w-10 h-10 bg-[#00bcf1] border-[#00bcf1] shadow-[0_4px_0_0_#0097c3]'}`}>


                                                                                                    {isSelf && <img src="https://i.imgur.com/5LhWfL3.png" className="w-5 h-5 object-contain opacity-50" />}

                                                                                                    {ans && (
                                                                                                        <span className={`absolute inset-0 flex items-center justify-center font-bold text-[11px] pointer-events-none ${isSelf ? 'text-blue-600' : 'text-white'}`}>
                                                                                                            {ans.length > 5 ? ans.substring(0, 4) + '..' : ans}
                                                                                                        </span>
                                                                                                    )}
                                                                                                </span>
                                                                                            </span>
                                                                                        );
                                                                                    }
                                                                                    return null;
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    ));
                                                                })()}
                                                            </div>
                                                        ) : page.subQuestions.length > 0 ? page.subQuestions.map((sq, i) => (
                                                            <div key={i} className="flex items-start gap-6 p-6 bg-slate-50 rounded-[2rem] hover:bg-indigo-50/30 transition-colors">
                                                                {sq.label && (
                                                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500 mt-1">
                                                                        {sq.label}
                                                                    </div>
                                                                )}
                                                                <div className="flex-1 space-y-2">
                                                                    <div className="flex items-center justify-between gap-4">
                                                                        <div className="text-lg font-medium text-slate-700 leading-relaxed flex-1">
                                                                            {renderMathToHTML(sq.passage || sq.text, page.typeKey || page.type, page.title)}
                                                                        </div>
                                                                        {(page.typeKey === 'question.mathinput' || page.type === '문제') && (
                                                                            <div className="w-16 h-10 border border-slate-300 rounded-lg flex items-center justify-center bg-white shrink-0">
                                                                                <img src="https://i.imgur.com/5LhWfL3.png" className="w-5 h-5 object-contain opacity-50" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {/* (그 외 일반 렌더링은 위에서 처리한 이미지 영역을 공유함) */}


                                                                    {(page.typeKey === 'question.mathinput' || page.type === '문제') && (
                                                                        <div className="mt-4 flex justify-end">
                                                                            <button className="bg-red-500 text-white px-6 py-2 rounded-3xl font-bold shadow-md">확인</button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )) : (
                                                            <div className="text-xl leading-relaxed text-slate-600 font-medium whitespace-pre-wrap">
                                                                {renderMathToHTML(page.body, page.typeKey || page.type, page.title)}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* [추가] 하단 공통 버튼 영역: 유형에 따라 버튼 모양과 텍스트가 달라짐 */}
                                                    <div className="mt-10 flex justify-end">
                                                        {(() => {
                                                            const isTogetherSelf = page.typeKey === 'together.self' || page.type === '함께 풀기 + 스스로 풀기';
                                                            const isTogetherPart = isTogetherSelf && page.title.includes('함께');
                                                            const isSelfPart = isTogetherSelf && page.title.includes('스스로');
                                                            const isTogetherSelect = page.typeKey === 'together.select' || page.type === '함께 풀기';

                                                            // 1. Together Section (함께 풀기 파트) -> 저장 버튼
                                                            if (isTogetherPart) {
                                                                return <button className="bg-red-500 text-white px-6 py-3 rounded-3xl font-extrabold shadow-lg">저장</button>;
                                                            }
                                                            // 2. Self Section (스스로 풀기 파트) 또는 함께 풀기 전용 -> 확인 버튼 하나
                                                            if (isSelfPart || isTogetherSelect) {
                                                                return <button className="bg-red-500 text-white px-6 py-3 rounded-3xl font-extrabold shadow-lg">확인</button>;
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Logic Description */}
                                        <div className="lg:w-76 bg-slate-900 p-8 text-slate-300 flex flex-col">
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-6">Interaction Logic</label>
                                            <textarea

                                                className="w-full flex-1 bg-transparent text-emerald-400 font-mono text-xs leading-relaxed border-none focus:ring-0 p-0 resize-none selection:bg-emerald-900"
                                                value={page.description[0].text}
                                                onChange={(e) => {
                                                    const newPages = [...pages];
                                                    newPages[pIdx].description[0].text = e.target.value;
                                                    setPages(newPages);
                                                }}
                                            />
                                            <button
                                                disabled={statusMessage?.type === 'loading'}
                                                onClick={async () => {
                                                    if (statusMessage?.type === 'loading') return;
                                                    // Remove setIsProcessing(true) to avoid double popup. Rely on StatusModal overlay.
                                                    setStatusMessage({ title: "생성 중", message: "콘텐츠 빌더로 복사 및 데이터 추출 중...", type: 'loading' });

                                                    try {
                                                        // [MODIFIED] Robust mapping using buildDraftInputConfig helper
                                                        const detectedTypeKey = page.typeKey || (
                                                            page.type.includes("함께 풀기 + 스스로 풀기") ? TYPE_KEYS.TOGETHER_SELF :
                                                                page.type.includes("함께 풀기") ? TYPE_KEYS.TOGETHER_SELECT :
                                                                    page.type.includes("이미지형") ? TYPE_KEYS.QUESTION_IMAGE :
                                                                        TYPE_KEYS.QUESTION_MATHINPUT
                                                        );

                                                        const isSelfStudy = (page.type || "").includes("스스로") || (page.title || "").includes("스스로");

                                                        // Start with a clean draft config template
                                                        const draftConfig = buildDraftInputConfig({
                                                            typeKey: detectedTypeKey,
                                                            baseTemplateTypeKey: detectedTypeKey,
                                                            hasImage: !!(page.figure_bounds && page.figure_bounds.some(v => v !== 0)),
                                                            contentImageUrl: page.contentImageUrl,
                                                            figure_bounds: page.figure_bounds,
                                                            figure_alt: page.figure_alt,
                                                            isTogether: detectedTypeKey.startsWith("together"),
                                                            isSelfStudy: isSelfStudy
                                                        });

                                                        const finalExtracted = {
                                                            ...draftConfig,
                                                            type: page.type,
                                                            title: page.title || page.mainQuestion,
                                                            mainQuestion: page.content || page.mainQuestion,
                                                            guideText: page.guide,
                                                            subQuestions: page.subQuestions || [],
                                                            lines: page.lines || [],
                                                            answers: page.answers || [] // [FIX] Ensure answers are mapped for preview
                                                        };

                                                        // For together types, parse body into lines/parts automatically
                                                        if (detectedTypeKey.startsWith("together")) {
                                                            if (finalExtracted.lines.length === 0) {
                                                                // [FIX] Try primary source (body/content)
                                                                let sourceText = page.body || page.content || "";

                                                                // [NEW] Fallback: If body is empty, harvest from subQuestions (sometimes AI puts it there)
                                                                if (!sourceText && page.subQuestions && page.subQuestions.length > 0) {
                                                                    console.log("[Build] Harvesting source text from subQuestions...");
                                                                    sourceText = page.subQuestions
                                                                        .map(sq => String(sq.passage || sq.text || "").trim())
                                                                        .filter(Boolean)
                                                                        .join("\n");
                                                                }

                                                                finalExtracted.lines = parseTextToLines(sourceText, page.answers || []);
                                                            } else {
                                                                // If lines exist, ensure they have parts (fix for manual inputs)
                                                                finalExtracted.lines = finalExtracted.lines.map(line => {
                                                                    if (line.parts && line.parts.length > 0) return line;
                                                                    return parseTextToLines(line.text || "", page.answers || [])[0] || line;
                                                                });
                                                            }
                                                        }
                                                        // 3. Add to Build Pages
                                                        const newBuildPages = [...buildPages];
                                                        if (!newBuildPages[activePageIndex].data && !newBuildPages[activePageIndex].image) {
                                                            newBuildPages[activePageIndex] = { ...newBuildPages[activePageIndex], data: finalExtracted, image: page.contentImageUrl };
                                                        } else {
                                                            if (newBuildPages.length < 4) {
                                                                newBuildPages.push({ id: newBuildPages.length + 1, image: page.contentImageUrl, data: finalExtracted });
                                                                setActivePageIndex(newBuildPages.length - 1);
                                                            } else {
                                                                alert("최대 4페이지까지만 생성 가능합니다.");
                                                                setStatusMessage(null);
                                                                return;
                                                            }
                                                        }

                                                        setBuildPages(newBuildPages);
                                                        setActiveTab('builder');
                                                        setStatusMessage(null); // Close loading modal

                                                        // [LOG] 최종 생성된 JSON 데이터 확인용
                                                        console.log("[Build] Final Extracted JSON:", JSON.stringify(finalExtracted, null, 2));

                                                        setSelectedTypeKey(detectedTypeKey);
                                                        // Set Type Key
                                                        // Set Type Key
                                                        // [Updated] Use Pre-detected typeKey if available (Context Aware)
                                                        if (page.typeKey) {
                                                            setSelectedTypeKey(page.typeKey);
                                                        } else {
                                                            const typeMap = {
                                                                '함께 풀기': TYPE_KEYS.TOGETHER_SELECT,
                                                                '함께 풀기 + 스스로 풀기': TYPE_KEYS.TOGETHER_SELF,
                                                                '이미지형': TYPE_KEYS.QUESTION_IMAGE,
                                                                '문제': TYPE_KEYS.QUESTION_MATHINPUT,
                                                                '수식 입력형': TYPE_KEYS.QUESTION_MATHINPUT,
                                                                '스스로 풀기': TYPE_KEYS.QUESTION_MATHINPUT,
                                                                '연습 하기': TYPE_KEYS.QUESTION_MATHINPUT
                                                            };
                                                            setSelectedTypeKey(typeMap[page.type] || TYPE_KEYS.QUESTION_IMAGE || TYPE_KEYS.QUESTION_MATHINPUT);
                                                        }

                                                    } catch (e) {
                                                        console.error(e);
                                                        setStatusMessage({ title: "오류", message: "데이터 추출 실패: " + e.message, type: 'error' });
                                                    }
                                                    // No finally block needed as success clears modal, error shows error modal.
                                                }}
                                                className={`w-full mt-4 py-3 rounded-xl font-bold text-s transition-all border flex items-center justify-center gap-2 ${statusMessage?.type === 'loading' ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-wait' : 'bg-white/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border-white/10 hover:border-emerald-400'}`}
                                            >
                                                {statusMessage?.type === 'loading' ? <div className="w-3 h-3 rounded-full border-2 border-slate-500 border-t-white animate-spin" /> : <Calculator size={14} />}
                                                {statusMessage?.type === 'loading' ? "분석 중..." : "콘텐츠 생성"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-40 text-center flex flex-col items-center gap-6">
                                    <div className="bg-white p-8 rounded-[2.5rem] text-indigo-200 shadow-xl shadow-indigo-50 border border-indigo-50"><Layers size={64} /></div>
                                    <p className="font-bold text-slate-400 text-xl max-w-md mx-auto leading-relaxed">AI 교과서 분석에 오류가 있습니다. <br /><span className="text-indigo-500">교과서 분석</span> 탭으로 가세요.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'builder' && (
                        <div className="flex gap-6 h-[90vh] overflow-hidden animate-in fade-in duration-500 pb-20">

                            {/* 좌측 col-span-2 영역 */}
                            <div className="w-2/5 flex flex-col h-full overflow-hidden space-y-4">
                                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                    <div className="bg-white p-8 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col gap-6 overflow-hidden">
                                        <div className="flex items-center justify-between px-2">
                                            <label className="text-[15px] font-black text-slate-400 uppercase tracking-widest">미리보기</label>
                                            <div className="flex gap-1">
                                                {buildPages.map((p, idx) => (
                                                    <div key={p.id} className="relative group/btn">
                                                        <button
                                                            onClick={() => setActivePageIndex(idx)}
                                                            className={`w-8 h-8 rounded-full font-bold text-[10px] transition-all flex items-center justify-center ${activePageIndex === idx ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                                        >
                                                            {p.id}
                                                        </button>
                                                        {buildPages.length > 1 && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    removePage(idx);
                                                                }}
                                                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/btn:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                                                            >
                                                                <X size={8} strokeWidth={3} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {buildPages.length < 4 && (
                                                    <button onClick={addPage} className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all flex items-center justify-center">
                                                        <Plus size={12} />
                                                    </button>
                                                )}
                                            </div>

                                        </div>
                                        {/* Combined Preview Area */}
                                        <div className="bg-slate-50/50 rounded-[2.5rem] border border-slate-100 my-1">
                                            {activeData ? (
                                                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200/50">
                                                    {(() => {
                                                        const p = activeData;
                                                        const pageTitle = p.title || "";
                                                        const typeKey = p.typeKey || "";
                                                        let titleImg = ASSETS.TITLES[p.type] || ASSETS.TITLES['문제'];

                                                        if (typeKey === TYPE_KEYS.TOGETHER_SELF || typeKey === TYPE_KEYS.TOGETHER_SELECT) {
                                                            if (pageTitle.includes('함께')) titleImg = ASSETS.TITLES['함께 풀기'];
                                                            else if (pageTitle.includes('스스로')) titleImg = ASSETS.TITLES['스스로 풀기'];
                                                            else if (p.type === '함께 풀기 + 스스로 풀기') {
                                                                if (p.mainQuestion?.includes('함께')) titleImg = ASSETS.TITLES['함께 풀기'];
                                                                else if (p.mainQuestion?.includes('스스로')) titleImg = ASSETS.TITLES['스스로 풀기'];
                                                            }
                                                        } else if (typeKey === TYPE_KEYS.QUESTION_MATHINPUT) {
                                                            titleImg = ASSETS.TITLES['문제'];
                                                        }

                                                        return <img src={titleImg} className="h-6 mb-3 object-contain brightness-95" alt="Title" />;
                                                    })()}
                                                    <div className="space-y-2 mt-4">
                                                        {(() => {
                                                            const isTogetherType = activeData.typeKey?.startsWith("together") || activeData.type?.includes("함께");
                                                            const title = activeData.title || "";
                                                            const typeKey = activeData.typeKey;

                                                            if (isTogetherType && activeData.lines && activeData.lines.length > 0) {
                                                                let globalBlankCounter = 0;
                                                                return (
                                                                    <div className="space-y-5">
                                                                        <h4 className="text-base font-bold text-slate-800 leading-tight">
                                                                            {renderMathToHTML(activeData.mainQuestion, typeKey, title, activeData.answers)}
                                                                        </h4>
                                                                        <p className="text-xs text-slate-400 font-medium leading-relaxed mb-4">
                                                                            {renderMathToHTML(activeData.guideText, typeKey, title)}
                                                                        </p>
                                                                        <div className="space-y-4 pt-4 border-t border-slate-100">
                                                                            {activeData.lines.map((line, li) => (
                                                                                <div key={li} className="flex gap-3 items-start">
                                                                                    {line.label && <div className="text-[10px] font-black text-slate-400 mt-1 shrink-0">{line.label}</div>}
                                                                                    <div className="flex-1 text-sm leading-relaxed text-slate-700">
                                                                                        {(line.parts || []).map((part, pi) => {
                                                                                            if (part.type === 'text') return renderMathToHTML(part.content, typeKey, title);
                                                                                            if (part.type === 'blank') {
                                                                                                globalBlankCounter++;
                                                                                                const isSelf = title.includes("스스로");
                                                                                                const ans = (part.options && part.options[0]) || "";

                                                                                                // [Logic] 스스로 풀기는 inputEnabled, 함께 풀기는 labelEnabled 확인
                                                                                                const isHidden = isSelf
                                                                                                    ? (part.inputEnabled === false)
                                                                                                    : (part.labelEnabled === false);

                                                                                                if (isHidden) {
                                                                                                    return <span key={pi} className="mx-1 font-bold text-blue-600">{renderMathToHTML(ans, typeKey, title)}</span>;
                                                                                                }

                                                                                                return (
                                                                                                    <span key={pi} className="inline-flex items-center align-middle mx-1 relative">
                                                                                                        <span className={`inline-flex items-center justify-center rounded-md border-2 transition-all relative ${isSelf
                                                                                                            ? 'w-16 h-10 bg-white border-slate-300 shadow-sm'
                                                                                                            : 'w-10 h-10 bg-[#00bcf1] border-[#00bcf1] shadow-[0_4px_0_0_#0097c3]'}`}>
                                                                                                            {!isSelf && (
                                                                                                                <span className="absolute -top-2.5 -left-2.5 w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm z-10">
                                                                                                                    {globalBlankCounter}
                                                                                                                </span>
                                                                                                            )}
                                                                                                            {ans && (
                                                                                                                <span className={`absolute inset-0 flex items-center justify-center font-bold text-[11px] pointer-events-none ${isSelf ? 'text-blue-600' : 'text-white'}`}>
                                                                                                                    {ans.length > 5 ? ans.substring(0, 4) + '..' : ans}
                                                                                                                </span>
                                                                                                            )}
                                                                                                        </span>
                                                                                                    </span>
                                                                                                );
                                                                                            }
                                                                                            return null;
                                                                                        })}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                            return (
                                                                <>
                                                                    <h4 className="text-base font-bold text-slate-800 leading-tight">
                                                                        {renderMathToHTML(activeData.mainQuestion, activeData.typeKey, activeData.title, activeData.answers)}
                                                                    </h4>
                                                                    <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                                                        {renderMathToHTML(activeData.guideText, activeData.typeKey, activeData.title)}
                                                                    </p>
                                                                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                                                                        {(activeData.subQuestions || []).slice(0, 4).map((sq, i) => (
                                                                            <div key={i} className="flex gap-2 items-start opacity-60">
                                                                                <div className="w-4 h-4 bg-slate-100 rounded text-[8px] flex items-center justify-center font-bold shrink-0">{sq.label || i + 1}</div>
                                                                                <div className="text-[10px] text-slate-500 whitespace-pre-wrap leading-relaxed">
                                                                                    {renderMathToHTML(sq.passage || sq.text, activeData.typeKey, activeData.title, Array.isArray(sq.options) ? sq.options : [sq.answer || ""])}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                        {(activeData.subQuestions || []).length > 4 && (
                                                                            <div className="text-[9px] text-slate-400 font-bold ml-6">+ {(activeData.subQuestions.length - 4)} more items...</div>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-[200px] flex flex-col items-center justify-center text-slate-300 gap-2">
                                                    <Calculator size={32} className="opacity-20" />
                                                    <span className="text-[10px] font-bold">Syncing Data...</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>


                                    {/* 유형 및 템플릿 직접 설정 */}
                                    {/* <details className="mb-5 text-slate-400">
                                        <summary className="cursor-pointer text-xs font-black uppercase tracking-widest hover:text-indigo-500 transition-colors">[선택] 유형 및 템플릿 직접 설정</summary>
                                        <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                                            <div>
                                                <label className="text-xs font-black text-slate-400 uppercase mb-2 block tracking-widest">Manual Type Filtering</label>
                                                <select
                                                    value={selectedTypeKey}
                                                    onChange={(e) => {
                                                        setSelectedTypeKey(e.target.value);
                                                        setSelectedTemplateId("");
                                                    }}
                                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-300"
                                                >
                                                    <option value="">Auto Detect (Default)</option>
                                                    {TYPE_DEFS.map((t) => (
                                                        <option key={t.typeKey} value={t.typeKey}>{t.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-black text-slate-400 uppercase mb-2 block tracking-widest">Select Template</label>
                                                <select
                                                    value={selectedTemplateId || ""}
                                                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-300"
                                                >
                                                    <option value="">{selectedTypeKey ? "Select a template..." : "Auto Select based on detection"}</option>
                                                    {filteredTemplates.map((t) => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                    {filteredTemplates.length === 0 && <option disabled>No templates available</option>}
                                                </select>
                                            </div>
                                        </div>
                                    </details> */}

                                    {buildPages[activePageIndex]?.image && (
                                        <div
                                            className="bg-white mt-2 p-4 rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col gap-3 cursor-zoom-in hover:border-indigo-200 transition-all group scale-100 hover:scale-[1.02] active:scale-95"
                                            onClick={() => setZoomedImage(buildPages[activePageIndex].image)}
                                        >
                                            <div className="flex items-center justify-between px-2">
                                                <div className="flex items-center gap-2 text-slate-400">
                                                    <ImageIcon size={14} />
                                                    <span className="text-[10px] font-black uppercase tracking-wider">교과서 이미지</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {activeData?.figure_bounds && activeData?.figure_bounds.some(v => v !== 0) && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setShowDetectionOverlay(!showDetectionOverlay); }}
                                                            className={`px-3 py-1 rounded-full text-[9px] font-black transition-all border ${showDetectionOverlay ? 'bg-rose-500 text-white border-rose-400 shadow-md' : 'bg-slate-100 text-slate-400 border-slate-200'}`}
                                                        >
                                                            {showDetectionOverlay ? '영역 숨기기' : 'AI 탐지 영역 확인'}
                                                        </button>
                                                    )}
                                                    <div className="text-[10px] font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">Click to zoom</div>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 rounded-[1.5rem] overflow-hidden aspect-video border border-slate-100/50 relative">
                                                <img
                                                    src={buildPages[activePageIndex].image}
                                                    className="w-full h-full object-contain"
                                                    alt="Source"
                                                />
                                                {/* AI Detection Overlay */}
                                                {showDetectionOverlay && activeData?.figure_bounds && (
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            top: `${activeData.figure_bounds[0] / 10}%`,
                                                            left: `${activeData.figure_bounds[1] / 10}%`,
                                                            width: `${(activeData.figure_bounds[3] - activeData.figure_bounds[1]) / 10}%`,
                                                            height: `${(activeData.figure_bounds[2] - activeData.figure_bounds[0]) / 10}%`,
                                                            border: '3px solid #f43f5e',
                                                            backgroundColor: 'rgba(244, 63, 94, 0.2)',
                                                            pointerEvents: 'none',
                                                            boxShadow: '0 0 20px rgba(244, 63, 94, 0.4)',
                                                            zIndex: 20
                                                        }}
                                                    >
                                                        <span className="absolute -top-7 left-0 bg-rose-500 text-white text-[9px] font-black px-2 py-1 rounded shadow-md whitespace-nowrap">
                                                            AI DETECTED FIGURE
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 우측 col-span-3 영역 */}
                            <div className="w-3/5 flex flex-col h-full overflow-hidden">
                                <div className="bg-white p-10 rounded-[4.5rem] border border-slate-200 shadow-sm h-full flex-1 overflow-y-auto custom-scrollbar">
                                    {buildPages[activePageIndex]?.data ? (
                                        <div className="w-full space-y-10 animate-in slide-in-from-right-10 duration-500">
                                            <div className="flex flex-col gap-3 mt-8 mb-2">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">
                                                        View {buildPages[activePageIndex].id} 내용 수정
                                                    </h3>
                                                </div>
                                                <div className="flex justify-end">
                                                    <a
                                                        href="https://www.processon.io/ko/latex"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-xl transition-all flex items-center gap-1 shadow-sm"
                                                    >
                                                        LaTeX 수식 참고 사이트 ↗
                                                    </a>
                                                </div>
                                            </div>
                                            <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                                                <div>
                                                    <label className="text-[15px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-2">발문</label>
                                                    <input className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 font-bold text-lg text-slate-800 focus:bg-white transition-all" value={buildPages[activePageIndex].data.mainQuestion} onChange={e => updateCurrentPageData({ ...buildPages[activePageIndex].data, mainQuestion: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="text-[15px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-2">지문</label>
                                                    <input className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium text-sm text-slate-600 focus:bg-white transition-all" value={buildPages[activePageIndex].data.guideText || ""} onChange={e => updateCurrentPageData({ ...buildPages[activePageIndex].data, guideText: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="space-y-6">
                                                {renderTypeEditor(buildPages[activePageIndex].data)}
                                            </div>
                                            <button onClick={onClickZip} className="w-full py-7 bg-slate-900 text-white rounded-[3rem] font-black text-xl shadow-2xl hover:bg-black hover:scale-[1.01] active:scale-95 transition-all flex items-end justify-center gap-6">
                                                <Download size={32} /> 콘텐츠 다운로드
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center opacity-20 space-y-6">
                                            <Calculator size={100} />
                                            <p className="font-black text-2xl tracking-tight">이미지를 업로드하여 빌드 데이터를 추출하세요.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'library' && (
                        <div className="grid grid-cols-2 gap-12 animate-in fade-in duration-500 pb-20">
                            <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-sm relative overflow-hidden group flex flex-col">
                                <h3 className="text-3xl font-black mb-8 text-slate-800 tracking-tight">Add New Template</h3>
                                <div onClick={() => templateZipInputRef.current.click()} className="flex-1 min-h-[400px] bg-slate-50 border-4 border-dashed border-indigo-100 rounded-[2.5rem] flex flex-col items-center justify-center text-indigo-400 cursor-pointer hover:bg-indigo-50/50 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-inner group-hover:scale-[1.02] duration-500">
                                    <input ref={templateZipInputRef} type="file" accept=".zip" onChange={uploadTemplate} className="hidden" />
                                    <div className="bg-white p-6 rounded-full shadow-lg mb-6 group-hover:rotate-90 transition-transform duration-500 border border-indigo-50">
                                        <Plus className="text-indigo-500" size={48} />
                                    </div>
                                    <p className="font-black uppercase tracking-widest text-xs mb-2">Drop ZIP Template Here</p>
                                    <span className="text-[10px] font-bold text-slate-400">Supported formats: .zip containing templates</span>
                                </div>
                            </div>
                            <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col">
                                <div className="flex justify-between items-center mb-10">
                                    <h3 className="text-3xl font-black text-slate-800 tracking-tight">Library Index</h3>
                                    <span className="bg-slate-100 text-slate-600 px-4 py-2 rounded-2xl text-xs font-black shadow-sm border border-slate-200">{templates.length} Items</span>
                                </div>
                                <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                                    {templates.sort((a, b) => b.createdAt - a.createdAt).map(t => (
                                        <div key={t.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:border-indigo-200 hover:bg-white hover:shadow-xl transition-all group">
                                            <div className="flex items-center gap-5">
                                                <div className={`p-4 rounded-2xl ${t.type === 'together' ? 'bg-amber-100 text-amber-600 shadow-amber-100' : 'bg-indigo-100 text-indigo-600 shadow-indigo-100'} shadow-md`}>
                                                    <FileCode size={24} strokeWidth={2.5} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 text-lg leading-tight mb-1">{t.name}</p>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-100">{t.type || 'Standard'}</span>
                                                </div>
                                            </div>
                                            <button onClick={async (e) => { e.stopPropagation(); if (window.confirm('Delete template?')) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'templates', t.id)) }} className="p-3 bg-white text-slate-300 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-colors shadow-sm"><Trash2 size={20} /></button>
                                        </div>
                                    ))}
                                    {templates.length === 0 && (
                                        <div className="text-center py-20 text-slate-400 font-medium">No templates found.<br />Upload one to get started.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; border: 2px solid transparent; background-clip: content-box; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
        </div>
    );
};

export default App;

// --- Sub Components (Moved outside for Stability/Performance) ---

function ensureSubQuestions(data) {
    const sub = Array.isArray(data.subQuestions) ? data.subQuestions : [];
    return sub.length ? sub : [{ label: "1", passage: "", answer: "", explanation: "" }];
}

function SubQuestionsEditor({ currentData, onChange }) {
    const subQuestions = ensureSubQuestions(currentData);

    return (
        <div className="space-y-6">
            {subQuestions.map((item, i) => (
                <div key={i} className="p-8 bg-white border border-slate-100 rounded-[2.5rem] space-y-6 shadow-sm">
                    <div className="flex items-start gap-5">
                        <span className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-sm">
                            {item.label || i + 1}
                        </span>
                        <div className="flex-1 space-y-2">
                            <textarea
                                rows={1}
                                className="w-full p-3 bg-slate-50 rounded-xl text-sm font-medium outline-none resize-none"
                                value={item.passage || ""}
                                onChange={(e) => {
                                    const next = [...subQuestions];
                                    next[i] = { ...next[i], passage: e.target.value };
                                    onChange({ ...currentData, subQuestions: next });
                                }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-[15px] font-bold text-emerald-500 uppercase mb-2 block">정답</label>
                            <input
                                className="w-full p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-sm font-bold text-emerald-700 outline-none"
                                value={item.answer || ""}
                                onChange={(e) => {
                                    const next = [...subQuestions];
                                    next[i] = { ...next[i], answer: e.target.value };
                                    onChange({ ...currentData, subQuestions: next });
                                }}
                            />
                        </div>

                        <div>
                            <label className="text-[15px] font-bold text-indigo-400 uppercase mb-2 block">해설</label>
                            <input
                                className="w-full p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-sm font-bold text-indigo-700 outline-none"
                                value={item.explanation || ""}
                                onChange={(e) => {
                                    const next = [...subQuestions];
                                    next[i] = { ...next[i], explanation: e.target.value };
                                    onChange({ ...currentData, subQuestions: next });
                                }}
                            />
                        </div>
                    </div>
                </div>
            ))}

            {/* <button
                onClick={() =>
                    onChange({
                        ...currentData,
                        subQuestions: [
                            ...subQuestions,
                            { label: String(subQuestions.length + 1), passage: "", answer: "", explanation: "" }
                        ]
                    })
                }
                className="w-full py-4 rounded-[2rem] bg-slate-100 hover:bg-slate-200 font-black text-sm text-slate-600"
            >
                + 소문항 추가
            </button> */}
        </div>
    );
}

function MathInputEditor({ currentData, onChange }) {
    return <SubQuestionsEditor currentData={currentData} onChange={onChange} />;
}

function TogetherSelectEditor({ currentData, onChange }) {
    const lines = Array.isArray(currentData?.lines) ? currentData.lines : [];

    // blank 파트만 한 번에 모으기(순서 유지)
    const blanks = [];
    lines.forEach((line, li) => {
        (line.parts || []).forEach((part, pi) => {
            if (part?.type === "blank") blanks.push({ li, pi, part });
        });
    });

    const patchPart = (li, pi, nextPart) => {
        const nextLines = lines.map((l, idx) =>
            idx !== li ? l : { ...l, parts: (l.parts || []).map((p, j) => (j !== pi ? p : nextPart)) }
        );
        onChange({ ...currentData, lines: nextLines });
    };

    const updateOption = (li, pi, part, optIdx, value) => {
        const nextOptions = [...(part.options || ["", "", ""])];
        nextOptions[optIdx] = value;
        patchPart(li, pi, { ...part, options: nextOptions });
    };

    return (
        <div className="space-y-8">
            <div className="p-8 bg-blue-50/60 border border-blue-200 rounded-[2.5rem] space-y-5">
                <div>
                    <div className="text-xs font-black uppercase tracking-widest text-blue-600">함께 풀기(선택형)</div>
                    <div className="text-sm font-bold text-slate-600 mt-1">각 빈칸의 정답과 오답 선택지를 설정하세요.</div>
                </div>

                <div className="space-y-4">
                    {blanks.map(({ li, pi, part }, idx) => (
                        <div key={`${li}-${pi}`} className="bg-white rounded-2xl border border-blue-100 p-6 space-y-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-500 text-white font-black flex items-center justify-center text-xs">
                                    {idx + 1}
                                </div>
                                <span className="font-bold text-slate-700">빈칸 {idx + 1}번 선택지 설정</span>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block">정답</label>
                                    <input
                                        className="w-full p-3 rounded-xl border border-emerald-100 bg-emerald-50/30 font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                                        value={part.options?.[0] || ""}
                                        onChange={(e) => updateOption(li, pi, part, 0, e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest block">오답 1</label>
                                    <input
                                        className="w-full p-3 rounded-xl border border-rose-100 bg-rose-50/30 font-bold text-sm outline-none focus:ring-2 focus:ring-rose-200"
                                        value={part.options?.[1] || ""}
                                        onChange={(e) => updateOption(li, pi, part, 1, e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest block">오답 2</label>
                                    <input
                                        className="w-full p-3 rounded-xl border border-rose-100 bg-rose-50/30 font-bold text-sm outline-none focus:ring-2 focus:ring-rose-200"
                                        value={part.options?.[2] || ""}
                                        onChange={(e) => updateOption(li, pi, part, 2, e.target.value)}
                                    />
                                </div>
                            </div>


                        </div>
                    ))}

                    {blanks.length === 0 && (
                        <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                            <div className="text-slate-400 font-bold italic truncate">분석된 빈칸(blank) 데이터가 없습니다. 본문 텍스트에 □ 또는 _ 기호가 포함되어 있는지 확인하세요.</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ensureTogetherSelf(data) {
    const together = data.together || {};
    const self = data.self || {};

    return {
        ...data,
        together: {
            numbers: Array.isArray(together.numbers) && together.numbers.length
                ? together.numbers
                : [{ value: 1, labelEnabled: false }, { value: 2, labelEnabled: false }, { value: 3, labelEnabled: false }]
        },
        self: {
            answers: Array.isArray(self.answers) && self.answers.length ? self.answers : ["", "", ""],
            explanation: self.explanation || ""
        }
    };
}

function TogetherSelfEditor({ currentData, onChange, onClickLabelZip }) {
    const lines = Array.isArray(currentData?.lines) ? currentData.lines : [];
    const rawType = (currentData?.type || "").trim();

    const showTogetherTab =
        rawType === "together" ||
        rawType === "함께 풀기" ||
        rawType === "together.self";

    const showSelfTab =
        rawType === "self" ||
        rawType === "스스로 풀기" ||
        rawType === "together.self";

    const isThisPageSelf = showSelfTab && !showTogetherTab;

    const [activeTab, setActiveTab] = React.useState(
        showTogetherTab ? "together" : "self"
    );

    React.useEffect(() => {
        setActiveTab(showTogetherTab ? "together" : "self");
    }, [showTogetherTab, showSelfTab]);

    // blank 파트만 한 번에 모으기(순서 유지)
    const getBlanks = (targetLines) => {
        const blks = [];
        targetLines.forEach((line, li) => {
            (line.parts || []).forEach((part, pi) => {
                if (part?.type === "blank") blks.push({ li, pi, part });
            });
        });
        return blks;
    };

    const blanks = getBlanks(lines);

    // 편집 유틸
    const patchPart = (li, pi, nextPart) => {
        const nextLines = lines.map((l, idx) =>
            idx !== li ? l : { ...l, parts: (l.parts || []).map((p, j) => (j !== pi ? p : nextPart)) }
        );
        onChange({ ...currentData, lines: nextLines });
    };

    const getBlankAnswer = (part) => {
        const options = Array.isArray(part.options) ? part.options : [];
        const idx = (parseInt(part.correctIndex, 10) || 1) - 1;
        return options[idx] ?? "";
    };

    const setBlankAnswer = (li, pi, part, value) => {
        patchPart(li, pi, { ...part, options: [value], correctIndex: 1 });
    };

    const toggleLabel = (li, pi, part) => {
        patchPart(li, pi, { ...part, labelEnabled: !part.labelEnabled });
    };

    const toggleInput = (li, pi, part) => {
        patchPart(li, pi, { ...part, inputEnabled: part.inputEnabled === false ? true : false });
    };

    // 텍스트 소스 편집 (함께 풀기 전용)
    const fullText = lines.map(l => {
        return (l.parts || []).map(p => p.type === 'blank' ? '□' : p.content).join('');
    }).join('\n');

    const handleTextChange = (newText) => {
        // 기존 blanks 데이터 백업 (순서대로)
        const oldBlanks = blanks.map(b => ({ ...b.part }));

        let blankIdx = 0;
        const newLines = newText.split('\n').map((txt, idx) => {
            const parts = [];
            const segments = txt.split(/(□|_)/g);
            segments.forEach(seg => {
                if (seg === '□' || seg === '_') {
                    // 기존 데이터가 있으면 재사용, 없으면 초기값
                    const oldPart = oldBlanks[blankIdx];
                    parts.push({
                        type: 'blank',
                        options: oldPart ? [...oldPart.options] : [""],
                        correctIndex: oldPart ? oldPart.correctIndex : 1,
                        labelEnabled: oldPart ? oldPart.labelEnabled : (activeTab === 'together'),
                        isLabelTarget: true,
                        explanation: oldPart ? oldPart.explanation : ""
                    });
                    blankIdx++;
                } else if (seg) {
                    parts.push({ type: 'text', content: seg });
                }
            });
            return { label: `(${idx + 1})`, parts, labelEnabled: activeTab === 'together', isSelfLine: lines[idx]?.isSelfLine || isThisPageSelf };
        });
        onChange({ ...currentData, lines: newLines });
    };

    const insertLabel = () => {
        const textarea = document.getElementById('together-text-source');
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const before = text.substring(0, start);
        const after = text.substring(end);
        handleTextChange(before + "□" + after);
    };

    return (
        <div className="animate-in fade-in duration-500 space-y-6">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit">
                {showTogetherTab && (
                    <button
                        onClick={() => setActiveTab("together")}
                        className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === "together" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        함께 풀기(라벨형)
                    </button>
                )}

                {showSelfTab && (
                    <button
                        onClick={() => setActiveTab("self")}
                        className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === "self" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        스스로 풀기(입력형)
                    </button>
                )}
            </div>

            {/* Together Section */}
            {showTogetherTab && activeTab === "together" && (
                <div className="p-8 bg-amber-50/60 border border-amber-200 rounded-[2.5rem] space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs font-black uppercase tracking-widest text-amber-600">함께 풀기 설정</div>
                            <div className="text-sm font-bold text-slate-600 mt-1">제안된 라벨을 검토 후 onoff 여부를 설정해 주세요.</div>
                        </div>

                    </div>


                    <div className="space-y-3">
                        {blanks.map(({ li, pi, part }, idx) => (
                            <div key={`${li}-${pi}`} className="flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-2xl border border-amber-100 p-4 shadow-sm">
                                <div className="w-15 h-10 rounded-md bg-amber-500 text-white text-xs font-black flex items-center justify-center shadow-lg shadow-amber-100">
                                    라벨 {idx + 1}
                                </div>
                                <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                                    <div className="col-span-3">
                                        <input
                                            type="text"
                                            className="w-full p-3 rounded-xl border border-slate-200 font-bold focus:border-amber-400 outline-none transition-all"
                                            value={getBlankAnswer(part)}
                                            onChange={(e) => setBlankAnswer(li, pi, part, e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">라벨 노출</label>
                                        <button
                                            onClick={() => toggleLabel(li, pi, part)}
                                            className={`w-full py-3 rounded-xl font-black text-xs transition-all ${part.labelEnabled ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                                        >
                                            {part.labelEnabled ? "ON" : "OFF"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Self Section */}
            {showSelfTab && activeTab === "self" && (
                <div className="p-8 bg-indigo-50/60 border border-indigo-200 rounded-[2.5rem] space-y-6">
                    <div>
                        <div className="text-xs font-black uppercase tracking-widest text-indigo-600">스스로 풀기 설정</div>
                        <div className="text-sm font-bold text-slate-600 mt-1">빈칸별 정답을 수정할 수 있습니다. 입력칸 OFF를 누르면 입력칸을 삭제할 수 있습니다.</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {blanks.map(({ li, pi, part }, idx) => (
                            <div key={`self-${li}-${pi}`} className="bg-white rounded-2xl border border-indigo-100 p-5 shadow-sm space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">빈칸 {idx + 1}</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">입력칸</span>
                                        <button
                                            onClick={() => toggleInput(li, pi, part)}
                                            className={`px-3 py-1 rounded-lg font-black text-[10px] transition-all ${part.inputEnabled !== false ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                                        >
                                            {part.inputEnabled !== false ? "ON" : "OFF"}
                                        </button>
                                    </div>
                                </div>
                                <input
                                    className="w-full p-3 rounded-xl border border-slate-200 font-bold focus:border-indigo-400 outline-none transition-all"
                                    value={getBlankAnswer(part)}
                                    onChange={(e) => setBlankAnswer(li, pi, part, e.target.value)}
                                />
                            </div>
                        ))}
                    </div>
                    {blanks.length === 0 && (
                        <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 font-bold">
                            함께 풀기 섹션에서 □ 기호를 추가하면 여기에 입력창이 나타납니다.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function GenericFallbackEditor({ currentData }) {
    return (
        <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-200 text-slate-500">
            <div className="font-black mb-2">이 타입은 전용 에디터가 없어요.</div>
            <pre className="text-xs overflow-auto">{JSON.stringify(currentData, null, 2)}</pre>
        </div>
    );
}

function QuestionImageEditor({ currentData, onChange }) {
    const handleUpdate = (field, value) => {
        onChange({ ...currentData, [field]: value });
    };

    return (
        <div className="space-y-8">
            <div className="p-8 bg-emerald-50/60 border border-emerald-200 rounded-[2.5rem] space-y-6">
                <div>
                    <div className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-4">이미지형 문제 설정</div>
                    <div className="space-y-6">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest ml-1">정답 (Answer)</label>
                            <input
                                className="w-full p-4 bg-white border border-emerald-100 rounded-2xl text-lg font-bold text-emerald-700 outline-none focus:ring-4 ring-emerald-500/10 transition-all"
                                value={currentData.answer || ""}
                                onChange={(e) => handleUpdate("answer", e.target.value)}
                                placeholder="정답을 입력하세요 (예: 25\pi)"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest ml-1">해설 (Explanation)</label>
                            <textarea
                                className="w-full p-4 bg-white border border-emerald-100 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:ring-4 ring-emerald-500/10 transition-all min-h-[120px]"
                                value={currentData.explanation || ""}
                                onChange={(e) => handleUpdate("explanation", e.target.value)}
                                placeholder="상세한 풀이 과정을 입력하세요."
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-8 bg-rose-50/40 border border-rose-100 rounded-[2.5rem] space-y-6">
                <div className="flex items-center justify-between">
                    <div className="text-xs font-black uppercase tracking-widest text-rose-500">AI 삽화 탐지 정보 (Advanced)</div>
                    <span className="text-[10px] font-bold text-rose-300">이 영역이 실제 문제 삽화를 포함해야 합니다.</span>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="text-xs font-bold text-slate-400 mb-2 block ml-1">Figure Bounds (ymin, xmin, ymax, xmax)</label>
                        <div className="flex gap-2">
                            {(currentData.figure_bounds || [0, 0, 0, 0]).map((val, idx) => (
                                <input
                                    key={idx}
                                    type="number"
                                    className="w-full p-2 bg-white border border-rose-100 rounded-xl text-center font-bold text-xs text-rose-600"
                                    value={val}
                                    onChange={(e) => {
                                        const next = [...(currentData.figure_bounds || [0, 0, 0, 0])];
                                        next[idx] = parseInt(e.target.value) || 0;
                                        handleUpdate("figure_bounds", next);
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 mb-2 block ml-1">Figure Alt / Description</label>
                        <input
                            className="w-full p-2 bg-white border border-rose-100 rounded-xl font-medium text-xs text-slate-600 outline-none"
                            value={currentData.figure_alt || ""}
                            onChange={(e) => handleUpdate("figure_alt", e.target.value)}
                            placeholder="삽화에 대해 설명해주세요."
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
