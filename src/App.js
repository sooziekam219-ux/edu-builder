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
        '개념': 'https://i.imgur.com/cjOaHRg.png',
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
const KIM_HWA_KYUNG_PROMPT = `
  **Role:** Expert digital textbook converter for 'Kim Hwa-kyung'.
  Analyze input textbook image(s) and split content into logical sections for a Storyboard.
  
  **Splitting Rules:**
  - Detect visual separators like "개념", "문제 1", "함께 풀기", "함께 풀기 + 스스로 풀기".
  - **Type:** '문제', '함께 풀기', '함께 풀기 + 스스로 풀기', '개념'
  - **Body Text:** Use LaTeX \\( ... \\). Use \\n to separate distinct questions or sentences.
  - **답이 스토리보드에 포함되지 않도록 주의** 

  **Specific Rules for '함께 풀기 + 스스로 풀기':**
    "중요: '함께 풀기'와 '스스로 풀기'는 반드시 서로 다른 별개의 'section' 객체로 나누어서 응답할 것."
  1. **Preserve Full Text:** Do NOT omit any sentences. Extract the entire explanation process.
  2. **Together Part (함께 풀기):** Keep the text as is. Ensure LaTeX is correctly formatted.
  3. **Self Part (스스로 풀기):** Identify areas that are underlined in the image and represent them as '_'. one explanation has to be included.
  - **Answers:** Extract or solve for correct answers.
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
        "subtype": "복합형",
        "content": { "title": "함께 풀기", "instruction": "...", "body": "전체 텍스트..." },
        "answers": ["정답"]
      }
    ]
  }
  
  
  
`;

const UNIVERSAL_BUILDER_PROMPT = `당신은 수학 교육 콘텐츠 전문 개발자입니다. 
이미지를 분석하여 시각적 증거(로고, 아이콘)를 기반으로 유형을 분류하고, 정해진 규격의 JSON을 생성하라.

### STEP 1: 시각적 증거 분석 (Visual Evidence First)
JSON을 생성하기 전, 다음 항목을 먼저 확인하여 내부적으로 판단하라:
1. 상단 또는 좌측에 '함께 풀기' 로고/아이콘이 있는가?
2. '스스로 풀기' 로고/아이콘이 있는가?
3. 한 페이지 내에 두 로고가 모두 존재하는가?

### STEP 2: 유형 결정 규칙 (Strict Decision Table)
반드시 아래 규칙에 따라 'typeKey'를 결정하라:
- 이미지에 '함께 풀기'와 '스스로 풀기' 이미지가 모두 포함된 경우([함께(O) + 스스로(O)]): together.self (복합형)
- 이미지에 '함께 풀기' 이미지만 포함된 경우([함께(O) + 스스로(X)]): together.select (함께 풀기 전용)
- 이미지에 '스스로 풀기' 이미지만 포함된 경우([함께(X) + 스스로(O)]): together.self 
- 이미지에 '함께 풀기'와 '스스로 풀기' 이미지가 모두 포함되지 않은 경우: question.mathinput 유형


**공통 규칙:**
- 모든 수식은 반드시 '\\\\( ... \\\\)' 형태로 감싸세요. (백슬래시 2개)
- 'mainQuestion'과 'guideText'를 이미지 맥락에 맞게 생성하세요.
- 유형 안에 삽화나 도형이 있다면 'figure_bounds'([ymin, xmin, ymax, xmax])를 0~1000 좌표계로 추출하세요. 없으면 [0,0,0,0].

**유형별 데이터 구조:**

1. **together 계열 (together.self, together.select)**:
   - 'lines' 배열을 사용하세요.
   - 각 line은 'label'과 'parts' 배열을 가집니다.
   - 'parts'의 각 항목은 { 'type': 'text', 'content': '...' } 또는 { 'type': 'blank', 'options': [...], 'correctIndex': n, 'explanation': '...' } 입니다.
   - **중요(together.select 전용):** 'blank'의 'options' 배열에는 반드시 **3개의 선택지**를 포함하세요.
     - Option 0(정답): 실제 수치/텍스트.
     - Option 1, 2(오답): 학생들이 가장 많이 하는 실수(부호 오류, 연산 순서 오류, 단위 누락 등)를 반영하여 **현실적이고 매력적인 오답**을 생성하세요.

2. **question / concept 계열 (question.mathinput, concept)**:
   - 'subQuestions' 배열을 사용하세요.
   - 각 항목은 { 'label': '...', 'passage': '...', 'answer': '...', 'explanation': '...' } 형태입니다.

**최종 JSON 응답은 마크다운 코드 블록 없이 순수 JSON만 반환하세요.**
JSON 구조 예시:
{
  "typeKey": "question.mathinput",
  "mainQuestion": "문제 제목",
  "guideText": "가이드 텍스트",
  "figure_bounds": [0,0,0,0],
  "figure_alt": "이미지 설명",
  "subQuestions": [
    { "label": "(1)", "passage": "내용", "answer": "정답", "explanation": "해설" }
  ]
}`;


// --- Helpers ---
// edubuilder_260206.jsx 상단의 sanitizeLaTeX 함수 수정
const sanitizeLaTeX = (str) => {
    if (!str) return "";
    let sanitized = str;

    // 1. $ ... $ 형태를 \( ... \) 형태로 치환
    sanitized = sanitized.replace(/\$(.*?)\$/g, '\\($1\\)');

    // 2. 기존 로직: 백슬래시나 수식 기호가 있는데 \( 가 없는 경우 보정
    // 단, '_' 가 단독으로 있거나 공백 사이에 있는 경우는 빈칸 기호이므로 제외
    if ((sanitized.includes('\\') || sanitized.includes('^') || (sanitized.includes('_') && /[a-zA-Z0-9]_[a-zA-Z0-9]/.test(sanitized))) && !sanitized.includes('\\(')) {
        sanitized = `\\(${sanitized}\\)`;
    }

    // 3. 중복된 \( \( 제거 (방어적 코드)
    sanitized = sanitized.replace(/\\\((\\\(.*?\\\))\\\)/g, '$1');

    return sanitized;
};

const generateLogicText = (type, subtype, answers) => {
    const hasAnswer = answers && answers.length > 0;
    const answerSection = hasAnswer ? `[정답 설정]\n- 정답: ${answers.join(', ')}\n\n` : '';

    // 1. 개념 학습
    if (type === '개념') {
        return `[개념 학습]\n1. 단순 열람 모드.\n2. 페이지 넘김 기능 활성화.`;
    }

    // 2. 함께 풀기 + 스스로 풀기 (복합 유형)
    if (type === '함께 풀기 + 스스로 풀기') {
        const baseText = subtype === 'together_part' || subtype === '복합형'
            ? `[복합형: 함께 풀기]\n1. 하늘색 네모(□) 클릭 시 라벨이 사라지며 정답 텍스트 노출.\n2. [확인] 버튼 없음. [저장] 버튼 클릭 시 학습 완료 처리.\n3. 정오 판별 로직 제외.`
            : `[복합형: 스스로 풀기]\n1. 빈칸 클릭 시 수식 입력기 호출.\n2. [확인] 클릭 시 정오답 판별.\n3. 정답 시: 파란색(#0000FF) 표시.\n4. 오답 시: 붉은색 노출 및 재도전 유도.`;
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
    figureBounds = null, figureAlt = "",
    isTogether = false, // [NEW] Together Mode Flag
    isSelfStudy = false // [NEW] Self Study Flag
}) => {
    // 1. Concept Type
    if (typeKey === TYPE_KEYS.CONCEPT) {
        return {
            typeKey: TYPE_KEYS.CONCEPT,
            baseTemplateTypeKey: TYPE_KEYS.CONCEPT,
            manifest: {},
            strategy: {
                name: 'concept_v1',
                options: { hasImage, contentImageUrl, figureBounds, figureAlt }
            }
        };
    }

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
                    figureBounds,
                    figureAlt,
                    isSelfStudy // [NEW] Pass flag
                }
            }
        };
    }

    // 3. Together Type or Standard Input
    return {
        typeKey: isTogether ? "together.custom" : "input.custom", // Dynamic Type Key
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
                figureBounds,
                figureAlt
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
            typeKey: "concept",
            label: "개념",
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
        } else if (tKey.startsWith("question") || tKey === TYPE_KEYS.CONCEPT) {
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
        else if (typeStr.includes("문제") || typeStr.includes("예제")) detectedTypeKey = TYPE_KEYS.QUESTION_MATHINPUT;
        else if (typeStr.includes("개념")) detectedTypeKey = TYPE_KEYS.CONCEPT;
    }

    // 3️⃣ 기존 템플릿 존재 여부
    const hasExactTemplate = detectedTypeKey
        ? templates.some(t => t.typeKey === detectedTypeKey)
        : false;

    // 4️⃣ Detection Status 결정
    let detectionStatus = "UNKNOWN"; // EXACT | SIMILAR | NEW

    if (!detectedFamily) {
        detectionStatus = "UNKNOWN";
    } else if (hasExactTemplate) {
        detectionStatus = "EXACT";
    } else if (detectedTypeKey === TYPE_KEYS.TOGETHER_SELF) {
        detectionStatus = "SIMILAR"; // together_self_v1 전략으로 생성 가능
    } else if (detectedFamily === "input") {
        detectionStatus = "SIMILAR"; // input_v1 전략으로 생성 가능
    } else {
        detectionStatus = "NEW";
    }


    // 2. Filter Templates: If manual type selected, use it. Else if detected, use matching. Else show all?
    // User said: "Advanced option can select existing". 
    // Let's filter by selectedTypeKey if present.
    const filteredTemplates = templates.filter(t => !selectedTypeKey || t.typeKey === selectedTypeKey);

    // 3. Status Logic
    // EXISTING: Found templates matching the DETECTED type (regardless of selection?) -> Auto-match
    // DRAFT: No matching templates for DETECTED type, but structure allows Input V1

    // Find templates that match the *detected* type
    const matchingDetectedTemplates = templates.filter(t => t.typeKey === detectedTypeKey);
    const hasExistingTemplate = matchingDetectedTemplates.length > 0;

    const isInputType = detectedFamily === "input" || detectedFamily === "together";

    // [Strict Detection Logic]

    // Header Mapping (Title Type -> Template TypeKey)
    const TYPE_MAPPING = {
        [TYPE_KEYS.QUESTION_MATHINPUT]: ["문제", "예제", "따라 하기"], // Exact header matches
        "together.select": ["함께 풀기"],
        "together.self": ["함께 풀기 + 스스로 풀기"]
    };

    if (detectedTypeKey) {
        // [New Logic using activeData.type if available]
        const headerType = activeData?.type || "";
        const allowedHeaders = TYPE_MAPPING[detectedTypeKey] || [];
        const isHeaderMatch = allowedHeaders.some(h => headerType.includes(h));

        if (hasExistingTemplate && isHeaderMatch) {
            detectionStatus = "EXACT";
        } else if (hasExistingTemplate && detectedTypeKey === TYPE_KEYS.QUESTION_MATHINPUT) {
            // Structure OK, Key OK, but Header Mismatch -> Similar -> Draft
            detectionStatus = "SIMILAR";
        } else if (isInputType) {
            detectionStatus = "SIMILAR"; // Draft mode for input
        } else {
            detectionStatus = "NEW";
        }
    }

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

        return <GenericFallbackEditor currentData={currentData} onChange={updateCurrentPageData} />;
    }


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
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Question / Passage</label>
                                <textarea
                                    rows={2}
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
                                <label className="text-[10px] font-bold text-emerald-500 uppercase mb-2 block">Correct Answer</label>
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
                                <label className="text-[10px] font-bold text-indigo-400 uppercase mb-2 block">Explanation</label>
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

                <button
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
                    + Add Sub Question
                </button>
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
                        <div className="text-xs font-black uppercase tracking-widest text-blue-600">Together Select Section</div>
                        <div className="text-sm font-bold text-slate-600 mt-1">각 빈칸의 정답과 오답 선택지를 설정하세요.</div>
                    </div>

                    <div className="space-y-4">
                        {blanks.map(({ li, pi, part }, idx) => (
                            <div key={`${li}-${pi}`} className="bg-white rounded-2xl border border-blue-100 p-6 space-y-4 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-500 text-white font-black flex items-center justify-center text-xs">
                                        {idx + 1}
                                    </div>
                                    <span className="font-bold text-slate-700">빈칸 #{idx + 1} 선택지 설정</span>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block">Correct Answer (Option 1)</label>
                                        <input
                                            className="w-full p-3 rounded-xl border border-emerald-100 bg-emerald-50/30 font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                                            value={part.options?.[0] || ""}
                                            onChange={(e) => updateOption(li, pi, part, 0, e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest block">Wrong Answer 1 (Option 2)</label>
                                        <input
                                            className="w-full p-3 rounded-xl border border-rose-100 bg-rose-50/30 font-bold text-sm outline-none focus:ring-2 focus:ring-rose-200"
                                            value={part.options?.[1] || ""}
                                            onChange={(e) => updateOption(li, pi, part, 1, e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest block">Wrong Answer 2 (Option 3)</label>
                                        <input
                                            className="w-full p-3 rounded-xl border border-rose-100 bg-rose-50/30 font-bold text-sm outline-none focus:ring-2 focus:ring-rose-200"
                                            value={part.options?.[2] || ""}
                                            onChange={(e) => updateOption(li, pi, part, 2, e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Explanation</label>
                                    <input
                                        className="w-full p-3 rounded-xl border border-slate-100 bg-slate-50/50 text-sm font-medium"
                                        placeholder="이 문항에 대한 해설을 입력하세요 (선택 사항)"
                                        value={part.explanation || ""}
                                        onChange={(e) => patchPart(li, pi, { ...part, explanation: e.target.value })}
                                    />
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

    // together.self 전용
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

    function TogetherSelfEditor({ currentData, onChange }) {
        const lines = Array.isArray(currentData?.lines) ? currentData.lines : [];
        const isSelfStudy = !!currentData?.strategy?.options?.isSelfStudy;

        // blank 파트만 한 번에 모으기(순서 유지)
        const blanks = [];
        lines.forEach((line, li) => {
            (line.parts || []).forEach((part, pi) => {
                if (part?.type === "blank") blanks.push({ li, pi, part });
            });
        });

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
            // 엔진(base.js)이 options+correctIndex로 답을 뽑으니까 그 규칙 그대로 맞춤
            patchPart(li, pi, { ...part, options: [value], correctIndex: 1 });
        };

        const toggleLabel = (li, pi, part) => {
            patchPart(li, pi, { ...part, labelEnabled: !part.labelEnabled });
        };

        // 해설 1개만: 첫 번째 blank에만 저장
        const firstBlank = blanks[0];
        const singleExplanation =
            firstBlank?.part?.explanation || "";

        const setSingleExplanation = (value) => {
            if (!firstBlank) return;
            patchPart(firstBlank.li, firstBlank.pi, { ...firstBlank.part, explanation: value });
        };

        return (
            <div className="space-y-8">
                {/* Together Section */}
                <div className="p-8 bg-amber-50/60 border border-amber-200 rounded-[2.5rem] space-y-5">
                    <div>
                        <div className="text-xs font-black uppercase tracking-widest text-amber-600">
                            Together Section
                        </div>
                        <div className="text-sm font-bold text-slate-600 mt-1">
                            각 딱지(blank)의 숫자 값 + 라벨 표시 여부
                        </div>
                        <div className="text-xs font-bold text-slate-400 mt-1">
                            (다운로드는 아래 “콘텐츠 다운로드” 버튼을 누르면 반영됨)
                        </div>
                    </div>

                    <div className="space-y-3">
                        {blanks.map(({ li, pi, part }, idx) => (
                            <div
                                key={`${li}-${pi}`}
                                className="flex items-center gap-3 bg-white rounded-2xl border border-amber-100 p-4"
                            >
                                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white font-black flex items-center justify-center">
                                    {idx + 1}
                                </div>

                                <div className="flex-1 grid grid-cols-3 gap-3 items-center">
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                            Number Value
                                        </label>
                                        <input
                                            type="number"
                                            className="w-full p-3 rounded-xl border border-slate-200 font-bold"
                                            value={getBlankAnswer(part)}
                                            onChange={(e) => setBlankAnswer(li, pi, part, e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                            Label
                                        </label>
                                        <button
                                            onClick={() => toggleLabel(li, pi, part)}
                                            className={`w-full py-3 rounded-xl font-black text-xs transition-all ${part.labelEnabled
                                                ? "bg-slate-900 text-white"
                                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                                }`}
                                        >
                                            {part.labelEnabled ? "ON" : "OFF"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {blanks.length === 0 && (
                            <div className="p-6 bg-white rounded-2xl border border-amber-100 text-slate-400 font-bold">
                                blank(딱지) 파트가 없습니다. lines/parts 구조를 확인하세요.
                            </div>
                        )}
                    </div>
                </div>

                {/* Self Section */}
                <div className="p-8 bg-indigo-50/60 border border-indigo-200 rounded-[2.5rem] space-y-6">
                    <div>
                        <div className="text-xs font-black uppercase tracking-widest text-indigo-600">
                            Self Section
                        </div>
                        <div className="text-sm font-bold text-slate-600 mt-1">
                            빈칸 정답 + 해설(1개)
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {blanks.map(({ li, pi, part }, idx) => (
                            <div key={`self-${li}-${pi}`} className="bg-white rounded-2xl border border-indigo-100 p-4">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">
                                    Blank Answer #{idx + 1}
                                </label>
                                <input
                                    className="w-full p-3 rounded-xl border border-slate-200 font-bold"
                                    value={getBlankAnswer(part)}
                                    onChange={(e) => setBlankAnswer(li, pi, part, e.target.value)}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="bg-white rounded-2xl border border-indigo-100 p-4">
                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">
                            Explanation (1개) — 첫 번째 빈칸에 저장
                        </label>
                        <textarea
                            rows={3}
                            className="w-full p-3 rounded-xl border border-slate-200 font-medium resize-none"
                            value={singleExplanation}
                            onChange={(e) => setSingleExplanation(e.target.value)}
                        />
                    </div>
                </div>
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
            else if (typeStr.includes("개념")) currentType = TYPE_KEYS.CONCEPT;
            else currentType = TYPE_KEYS.QUESTION_MATHINPUT;
        }

        // 2. 기본 플래그 설정
        const isConcept = currentType === TYPE_KEYS.CONCEPT;
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
            if (isConcept) baseTypeKey = TYPE_KEYS.CONCEPT;
            else if (isTogetherSelf) baseTypeKey = TYPE_KEYS.TOGETHER_SELF;
            else if (isTogether) baseTypeKey = TYPE_KEYS.TOGETHER_SELECT;

            const fallback = templates.find(t => t.typeKey === baseTypeKey);
            finalTemplateId = fallback?.id;
            console.log("[ZIP] Fallback applied:", baseTypeKey, finalTemplateId);
        }

        // B. 커스텀 설정(Draft Config) 생성 로직
        // EXACT 모드가 아닐 때는 사용자가 편집한 내용을 덮어씌워야 하므로 Config를 생성함
        if (detectionStatus !== "EXACT" || selectedTypeKey) {
            let headerType = "문제";
            if (isConcept) headerType = "개념";
            else if (isTogetherSelf) {
                // [FIX] Determine header type based on title (함께/스스로)
                const title = currentData?.title || "";
                if (title.includes("스스로")) headerType = "스스로 풀기";
                else headerType = "함께 풀기";
            }
            else if (isTogether) headerType = "함께 풀기";
            else if (currentData?.type) headerType = currentData.type;

            const hUrl = ASSETS.TITLES[headerType] || ASSETS.TITLES['문제'];
            const cImg = buildPages[activePageIndex]?.image || "";
            const isSelfStudy = headerType === "스스로 풀기";

            customConfig = buildDraftInputConfig({
                typeKey: currentType,
                inputKind,
                hasImage,
                headerUrl: hUrl,
                contentImageUrl: cImg,
                figureBounds: currentData?.figure_bounds,
                figureAlt: currentData?.figure_alt,
                isTogether,
                isSelfStudy // [NEW]
            });
        }

        if (!finalTemplateId) {
            setStatusMessage({ title: "알림", message: "사용할 템플릿을 찾을 수 없습니다.", type: "error" });
            return;
        }

        // 최종 실행
        processAndDownloadZip({
            templates,
            selectedTemplateId: finalTemplateId,
            buildPages,
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

    const renderMathToHTML = (text, typeKey, pageTitle) => {
        if (!text) return null;

        // 스스로 풀기 여부 확인
        const isSelfStudy = typeKey === "together.self" && pageTitle.includes('스스로');
        const isTogether = typeKey === "together.self" && pageTitle.includes('함께');

        const parts = text.split(/(\\\(.*?\\\)|□)/g);
        return parts.map((part, i) => {
            if (!part) return null;

            if (part.startsWith('\\(')) {
                const latex = part.replace(/^\\\(|\\\)$/g, '');
                // 수식 내부에 _ 가 있다면 (보통 아래첨자용), CodeCogs 서버가 에러낼 수 있으므로 
                // 빈칸 성격의 _ 인지 확인하여 처리 (여기서는 수식 블록 내부면 렌더링 시도)
                const url = `https://latex.codecogs.com/png.latex?\\dpi{150}\\bg_white ${encodeURIComponent(latex)}`;
                return <img key={i} src={url} alt="math" className="inline-block align-middle mx-1 h-5" />;
            } else if (part === '□') {
                return (
                    <span
                        key={i}
                        className={`inline-flex items-center justify-center align-middle mx-1 rounded-md border-2 transition-all ${isSelfStudy
                            ? 'w-16 h-10 bg-white border-slate-300 shadow-sm' // 스스로 풀기: 하얀 입력창
                            : isTogether
                                ? 'w-10 h-9 bg-[#00bcf1] border-[#00bcf1]'        // 함께 풀기: 약간 길쭉한 파란 박스
                                : 'w-10 h-10 bg-[#00bcf1] border-[#00bcf1]'        // 기타: 기본 정사각형
                            }`}
                    >
                        {isSelfStudy && <img src="https://i.imgur.com/5LhWfL3.png" className="w-5 h-5 object-contain opacity-50" />}
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
                const img = analysisImages[imgIdx];
                const base64 = await new Promise(r => {
                    const reader = new FileReader();
                    reader.onload = () => r(reader.result.split(',')[1]);
                    reader.readAsDataURL(img.file);
                });

                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: KIM_HWA_KYUNG_PROMPT }, { inlineData: { mimeType: "image/png", data: base64 } }] }],
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

                // 1. JSON 파싱 보정
                const sanitizedJson = rawJsonText
                    .replace(/\\/g, "\\\\")
                    .replace(/\\\\"/g, '\\"')
                    .replace(/\\\\n/g, '\\n')
                    .replace(/\n/g, " ");

                const parsed = JSON.parse(sanitizedJson);

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

                const pageSections = deepRestore(parsed.sections || []);
                const hasTogether = pageSections.some(s => (s.content.title || "").includes("함께"));
                const hasSelf = pageSections.some(s => (s.content.title || "").includes("스스로"));
                const isTogetherSelfSet = hasTogether && hasSelf;

                pageSections.forEach((sec, sIdx) => {
                    const title = sec.content.title || "";
                    const secTitle = title.toLowerCase();
                    const isThisSecSelf = secTitle.includes('스스로');
                    const isThisSecTogether = secTitle.includes('함께');

                    let detectedTypeKey = "";
                    let type = "";

                    if (isTogetherSelfSet && (isThisSecTogether || isThisSecSelf)) {
                        detectedTypeKey = TYPE_KEYS.TOGETHER_SELF;
                        type = isThisSecSelf ? '스스로 풀기' : '함께 풀기 + 스스로 풀기';
                    } else if (isThisSecTogether) {
                        detectedTypeKey = TYPE_KEYS.TOGETHER_SELECT;
                        type = '함께 풀기';
                    } else if (isThisSecSelf) {
                        detectedTypeKey = TYPE_KEYS.TOGETHER_SELF;
                        type = '스스로 풀기';
                    } else {
                        detectedTypeKey = TYPE_KEYS.QUESTION_MATHINPUT;
                        type = '문제';
                    }

                    let body = (sec.content.body || "").replace(/(답|정답|풀이|해설)\s*[:\.]\s*.*(\n|$)/g, "").trim();
                    let finalAnswers = [...(sec.answers || [])];

                    // 함께 풀기 유형에서 수식 중간에 라벨을 입히기 위한 필수 로직
                    if (detectedTypeKey === TYPE_KEYS.TOGETHER_SELF && !body.includes('□') && !body.includes('_')) {
                        const extracted = [];
                        // 수식 블록 내의 = 뒤 내용을 찾아서 □로 바꾸고 extracted에 저장
                        body = body.replace(/=\s*([^=\n]+?)(?=\s*\\\)|\s*\n|\s*=|$)/g, (match, p1) => {
                            extracted.push(p1.trim());
                            return '= \\) □ \\('; // 수식을 닫고 □ 넣고 다시 열기
                        });
                        body = body.replace(/\\\( *\\\)/g, ''); // 빈 수식 블록 정리
                        if (extracted.length > 0) finalAnswers = extracted;
                    }
                    // --- 그룹화 로직 (pendingPassage 적용 및 에러 수정) ---
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
                            const blankCount = (rawText.match(/□|_/g) || []).length || 1;
                            const chunk = finalAnswers.slice(answerPointer, answerPointer + blankCount);
                            answerPointer += blankCount;

                            // 번호 앞에 쌓인 지문이 있다면 합쳐줌
                            const finalPassage = pendingPassage ? `${pendingPassage}\n${rawText}` : rawText;
                            pendingPassage = "";

                            currentSq = {
                                id: Date.now() + i + Math.random(),
                                label: labelMatch[0].trim(),
                                passage: finalPassage,
                                answer: chunk.length > 1 ? chunk : (chunk[0] || ""),
                                // Together 유형일 때만 라벨 기능을 기본적으로 활성화
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
                            // 번호가 아직 안 나왔으므로 임시 보관 (여기에 rawText가 아닌 trimmedLine 사용)
                            pendingPassage = pendingPassage ? `${pendingPassage}\n${trimmedLine}` : trimmedLine;
                        }
                    });


                    // 만약 루프가 끝났는데 pendingPassage에만 데이터가 있고 문항이 하나도 안 만들어졌을 때 처리
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
                    let lines = null;
                    if (isTogetherType) {
                        // AI가 응답한 lines에서 blank 파트만 추출하여 options 정보를 확보함
                        const aiBlanks = [];
                        if (Array.isArray(sec.lines)) {
                            sec.lines.forEach(l => {
                                (l.parts || []).forEach(p => {
                                    if (p.type === 'blank' && Array.isArray(p.options)) aiBlanks.push(p);
                                });
                            });
                        }

                        let blankSerialIdx = 0;
                        lines = updatedSubQs.map((sq, sqIdx) => {
                            const parts = [];

                            // [수정] 수식 밸런싱: 수식(\(...\)) 내부에 빈칸이 있으면 수식을 닫고 빈칸 뒤에 다시 열어줌
                            let balancedPassage = (sq.passage || "");
                            balancedPassage = balancedPassage.replace(/\\\((.*?)\\\)/g, (match, content) => {
                                if (content.includes('□') || content.includes('_')) {
                                    return `\\(${content.replace(/[□_]/g, '\\) □ \\(')}\\)`;
                                }
                                return match;
                            });
                            // 빈 수식(\( \)) 정리
                            balancedPassage = balancedPassage.replace(/\\\( *\\\)/g, "");

                            const textParts = balancedPassage.split(/□|_/);
                            const sqAnswers = Array.isArray(sq.answer) ? sq.answer : (sq.answer ? [sq.answer] : []);

                            textParts.forEach((tp, i) => {
                                if (tp) parts.push({ type: 'text', content: tp.trim() });
                                if (i < textParts.length - 1) {
                                    // 1) AI가 생성한 options가 있다면 (3개 이상) 가져옴
                                    let finalOptions = ["", "", ""];
                                    const aiSource = aiBlanks[blankSerialIdx];

                                    if (aiSource && aiSource.options?.length >= 3) {
                                        finalOptions = aiSource.options.slice(0, 3);
                                    } else {
                                        // 2) 없으면 정답 + 휴리스틱 오답 생성
                                        const ans = String(sqAnswers[i] || "정답");
                                        const numMatch = ans.match(/^-?\d*\.?\d+$/); // 숫자 여부 확인

                                        if (numMatch) {
                                            const n = parseFloat(ans);
                                            // 헷갈릴만한 숫자 오답: n+1, n-1 혹은 자릿수 변경 등
                                            const w1 = n > 5 ? String(n - 1) : String(n + 2);
                                            const w2 = n > 10 ? String(n - 10) : String(n + 10);
                                            finalOptions = [ans, w1, w2];
                                        } else {
                                            finalOptions = [ans, "오답1", "오답2"];
                                        }
                                    }

                                    parts.push({
                                        type: 'blank',
                                        options: finalOptions,
                                        correctIndex: 1,
                                        labelEnabled: true,
                                        isLabelTarget: true,
                                        label: sq.label || `(${sqIdx + 1})`,
                                        explanation: aiSource?.explanation || ""
                                    });
                                    blankSerialIdx++;
                                }
                            });
                            return { label: sq.label || `(${sqIdx + 1})`, parts: parts, labelEnabled: true };
                        });
                    }

                    let instructionRaw = sec.content.instruction || "";
                    let finalInstruction = instructionRaw.replace(/\\\\/g, "\\");

                    if (!finalInstruction) {
                        finalInstruction = (detectedTypeKey === TYPE_KEYS.QUESTION_MATHINPUT) ? "다음을 계산하세요." : "문제를 해결해 보세요.";
                    }

                    let guideRaw = "";
                    let guide = (guideRaw.replace(/\\\\/g, "\\")) || "";

                    if (!guide) {
                        guide = (detectedTypeKey === TYPE_KEYS.QUESTION_MATHINPUT) ? "▷ 빈칸에 들어갈 값을 입력해 보세요." : "▷ 빈칸을 클릭하여 문제를 해결해 보세요.";
                    }

                    if (type === '문제' && updatedSubQs.length >= 3) {
                        for (let i = 0; i < updatedSubQs.length; i += 2) {
                            const chunk = updatedSubQs.slice(i, i + 2);
                            newPages.push({
                                id: Date.now() + sIdx + i + imgIdx * 1000,
                                type, typeKey: detectedTypeKey,
                                title: i === 0 ? title : `${title} (계속)`,
                                mainQuestion: i === 0 ? title : `${title} (계속)`,
                                content: finalInstruction, guide: guide,
                                body: chunk.map(q => q.passage).join('\n'),
                                answers: chunk.flatMap(q => Array.isArray(q.answer) ? q.answer : [q.answer]),
                                description: [{ text: generateLogicText(type, sec.subtype, []) }],
                                subQuestions: chunk, lines: lines
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
                            subQuestions: updatedSubQs, lines: lines
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
                const extracted = await analyzeImage(file);
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
                                {uploadProgress > 0 ? `업로드 중... ${uploadProgress}%` : "AI 엔진 가동 중..."}
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
                                {activeTab === 'analysis' && "교과서 이미지를 업로드하고 스토리보드를 생성하세요."}
                                {activeTab === 'storyboard' && "생성된 스토리보드 화면을 확인하고 콘텐츠 생성을 진행하세요."}
                                {activeTab === 'builder' && "한 act파일을 구성한 후 세부 내용을 수정하여 최종 결과물을 다운받으세요."}
                                {activeTab === 'library' && "템플릿 업로드 페이지입니다."}
                            </p>
                        </div>
                        <div className="flex gap-4">
                            {activeTab === 'analysis' && (
                                <button onClick={runAnalysis} className="px-10 py-4 bg-gray-900 text-white rounded-full font-bold text-lg shadow-xl shadow-gray-200 hover:scale-[1.02] hover:shadow-2xl active:scale-95 transition-all flex items-center gap-3">
                                    <MonitorPlay size={20} /> 분석 시작
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
                                                    let titleImg = ASSETS.TITLES[page.type] || ASSETS.TITLES['개념'];
                                                    if (page.type === '함께 풀기 + 스스로 풀기') {
                                                        if (page.title.includes('함께')) titleImg = ASSETS.TITLES['함께 풀기'];
                                                        else if (page.title.includes('스스로')) titleImg = ASSETS.TITLES['스스로 풀기'];
                                                    }
                                                    return <img src={titleImg} className="h-10 mb-4 object-contain brightness-95" />;
                                                })()}

                                                <div className="space-y-2">
                                                    <h4 className="text-2xl font-bold text-slate-800 leading-snug tracking-tight">{renderMathToHTML(page.content)}</h4>
                                                    <h5 className="text-lg text-slate-400 leading-snug tracking-tight mb-6">{page.guideText}</h5>

                                                    <div className="space-y-6 mt-8 pl-2 border-l-2 border-slate-100">
                                                        {/* 1. 질문 리스트 렌더링 */}
                                                        {page.subQuestions.length > 0 ? page.subQuestions.map((sq, i) => (
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

                                                                    {/* [수정] 일반 문제(mathinput) 유형일 때만 각 문항 옆에 확인 버튼 배치 */}
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
                                                        // 1. Prepare Text Prompt from Storyboard Page
                                                        const sbContent = JSON.stringify({
                                                            type: page.type,
                                                            content: page.content,
                                                            body: page.body,
                                                            answers: page.answers, // [추가됨]
                                                            subQuestions: page.subQuestions,
                                                            description: page.description[0].text
                                                        }, null, 2);

                                                        const systemPrompt = UNIVERSAL_BUILDER_PROMPT;
                                                        const isTogetherSelf = page.typeKey === TYPE_KEYS.TOGETHER_SELF || page.type === '함께 풀기 + 스스로 풀기';
                                                        let titleImg = ASSETS.TITLES[page.type] || ASSETS.TITLES['개념'];

                                                        // [Issue 1] TOGETHER_SELF인 경우 타이틀에 따라 이미지 분기
                                                        if (isTogetherSelf) {
                                                            if (page.title.includes('함께')) {
                                                                titleImg = ASSETS.TITLES['함께 풀기'];
                                                            } else if (page.title.includes('스스로')) {
                                                                titleImg = ASSETS.TITLES['스스로 풀기'];
                                                            }
                                                        }

                                                        // 2. Call Gemini
                                                        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                contents: [{
                                                                    parts: [
                                                                        { text: systemPrompt },
                                                                        { text: `Extract build data from this JSON representation of a textbook page:\n\n${sbContent}` }
                                                                    ]
                                                                }],
                                                                generationConfig: { responseMimeType: "application/json" }
                                                            })
                                                        });

                                                        if (!res.ok) throw new Error("API Error");
                                                        const data = await res.json();
                                                        const text = data.candidates[0].content.parts[0].text;
                                                        const extracted = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());

                                                        const isSelfSection =
                                                            (page.type || "").includes("스스로");


                                                        const finalExtracted = {
                                                            ...extracted,
                                                            typeKey: page.typeKey || TYPE_KEYS.TOGETHER_SELF, // 스토리보드 페이지가 가진 타입을 유지
                                                            strategy: {
                                                                ...(extracted.strategy || {}),
                                                                options: {
                                                                    ...(extracted.strategy?.options || {}),
                                                                    isSelfStudy: isSelfSection,
                                                                }

                                                            }
                                                        };
                                                        // 3. Add to Build Pages
                                                        const newBuildPages = [...buildPages];
                                                        if (!newBuildPages[activePageIndex].data && !newBuildPages[activePageIndex].image) {
                                                            newBuildPages[activePageIndex] = { ...newBuildPages[activePageIndex], data: finalExtracted };
                                                        } else {
                                                            if (newBuildPages.length < 4) {
                                                                newBuildPages.push({ id: newBuildPages.length + 1, image: null, data: finalExtracted });
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
                                                        setSelectedTypeKey(page.typeKey || TYPE_KEYS.TOGETHER_SELF);
                                                        // Set Type Key
                                                        // Set Type Key
                                                        // [Updated] Use Pre-detected typeKey if available (Context Aware)
                                                        if (page.typeKey) {
                                                            setSelectedTypeKey(page.typeKey);
                                                        } else {
                                                            const typeMap = {
                                                                '함께 풀기': TYPE_KEYS.TOGETHER_SELECT,
                                                                '함께 풀기 + 스스로 풀기': TYPE_KEYS.TOGETHER_SELF,
                                                                '문제': TYPE_KEYS.QUESTION_MATHINPUT,
                                                                '수식 입력형': TYPE_KEYS.QUESTION_MATHINPUT,
                                                                '스스로 풀기': TYPE_KEYS.QUESTION_MATHINPUT,
                                                                '연습 하기': TYPE_KEYS.QUESTION_MATHINPUT,
                                                                '개념': TYPE_KEYS.CONCEPT
                                                            };
                                                            setSelectedTypeKey(typeMap[page.type] || TYPE_KEYS.QUESTION_MATHINPUT);
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
                                    <p className="font-bold text-slate-400 text-xl max-w-md mx-auto leading-relaxed">No storyboard data found.<br />Please proceed with <span className="text-indigo-500">Textbook Analysis</span> first.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'builder' && (

                        <div className="grid grid-cols-3 gap-12 animate-in fade-in duration-500">
                            <div className="col-span-1 space-y-8">
                                <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm">

                                    <label className="text-xs font-black text-slate-400 uppercase mb-5 block ml-2 tracking-widest">UPLOAD SB IMAGES</label>

                                    <div className="flex gap-2 mb-4 flex-wrap">
                                        {buildPages.map((p, idx) => (
                                            <button
                                                key={p.id}
                                                onClick={() => setActivePageIndex(idx)}
                                                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activePageIndex === idx ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                            >
                                                Page {p.id}
                                                {buildPages.length > 1 && (
                                                    <span onClick={(e) => { e.stopPropagation(); removePage(idx); }} className="hover:text-red-300"><X size={12} /></span>
                                                )}
                                            </button>
                                        ))}
                                        {buildPages.length < 4 && (
                                            <button onClick={addPage} className="px-4 py-2 rounded-xl font-bold text-sm bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all flex items-center gap-1">
                                                <Plus size={14} /> Add
                                            </button>
                                        )}
                                    </div>

                                    <div onClick={() => templateZipInputRef.current.click()} className="aspect-[4/5] bg-slate-50 border-4 border-dashed border-slate-100 rounded-[3rem] flex items-center justify-center overflow-hidden cursor-pointer group hover:bg-indigo-50 hover:border-indigo-200 transition-all relative">
                                        <input ref={templateZipInputRef} type="file" multiple accept="image/*" onChange={handleBuilderImage} className="hidden" />
                                        {buildPages[activePageIndex]?.image ? <img src={buildPages[activePageIndex].image} className="w-full h-full object-cover" /> : <div className="text-center text-slate-300"><ImageIcon className="mx-auto mb-2" size={48} /><span className="text-xs font-bold">Upload Image(s)</span></div>}
                                    </div>

                                    <details className="mt-10 mb-5 text-slate-400">
                                        <summary className="cursor-pointer text-xs font-black uppercase tracking-widest hover:text-indigo-500 transition-colors">[선택] 유형 및 템플릿 직접 설정</summary>
                                        <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">

                                            <div>
                                                <label className="text-xs font-black text-slate-400 uppercase mb-2 block tracking-widest">
                                                    Manual Type Filtering
                                                </label>
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
                                                        <option key={t.typeKey} value={t.typeKey}>
                                                            {t.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="text-xs font-black text-slate-400 uppercase mb-2 block tracking-widest">
                                                    Select Template
                                                </label>
                                                <select
                                                    value={selectedTemplateId || ""}
                                                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-300"
                                                >
                                                    <option value="">
                                                        {selectedTypeKey ? "Select a template..." : "Auto Select based on detection"}
                                                    </option>
                                                    {filteredTemplates.map((t) => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                    {filteredTemplates.length === 0 && <option disabled>No templates available</option>}
                                                </select>
                                            </div>
                                        </div>
                                    </details>
                                </div>
                            </div>
                            <div className="col-span-2">
                                <div className="bg-white p-12 rounded-[4.5rem] border border-slate-200 shadow-sm min-h-[600px] flex flex-col relative overflow-hidden">

                                    {buildPages[activePageIndex]?.data ? (
                                        <div className="w-full space-y-10 animate-in slide-in-from-right-10 duration-500">

                                            {/* [NEW] Universal Strategy Card */}
                                            <div className={`p-6 rounded-[2.5rem] border-2 transition-all ${detectedTypeKey ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <ShieldCheck size={20} className="text-indigo-600" />
                                                        <span className="font-black text-xs uppercase tracking-wider text-slate-500">템플릿 탐색 결과</span>
                                                    </div>
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase text-white ${hasExactTemplate ? 'bg-emerald-500' : 'bg-indigo-500'}`}>
                                                        {hasExactTemplate ? '일치' : '불일치'}
                                                    </span>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-indigo-100 shadow-sm">
                                                        <span className="text-xs font-bold text-slate-400 uppercase">콘텐츠 유형</span>
                                                        <span className="text-sm font-black text-slate-800">{detectedTypeKey || "Not Detected"}</span>
                                                    </div>

                                                    {!hasExactTemplate && (
                                                        <div className="flex items-center gap-4">
                                                            <div className="bg-white p-3 rounded-xl border border-indigo-100 flex-1">
                                                                <label className="text-[10px] font-black text-indigo-400 uppercase block mb-1">Input Style</label>
                                                                <div className="flex bg-indigo-50 rounded-lg p-1">
                                                                    {['math', 'text', 'ocr'].map(k => (
                                                                        <button
                                                                            key={k}
                                                                            onClick={() => setInputKind(k)}
                                                                            className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${inputKind === k ? 'bg-white shadow-sm text-indigo-600' : 'text-indigo-300 hover:text-indigo-500'}`}
                                                                        >
                                                                            {k}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div className="bg-white p-3 rounded-xl border border-indigo-100 flex-1">
                                                                <label className="text-[10px] font-black text-indigo-400 uppercase block mb-1">Illustration</label>
                                                                <button
                                                                    onClick={() => setHasImage(!hasImage)}
                                                                    className={`w-full py-2 text-xs font-bold rounded-lg transition-all ${hasImage ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                                                                >
                                                                    {hasImage ? 'Enabled' : 'Disabled'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between mt-8">
                                                <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">Page {buildPages[activePageIndex].id} Data</h3>
                                                <span className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border border-emerald-100 flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Engine Ready
                                                </span>
                                            </div>

                                            <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-2">Main Question</label>
                                                    <input className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 font-bold text-lg text-slate-800 focus:bg-white transition-all" value={buildPages[activePageIndex].data.mainQuestion} onChange={e => updateCurrentPageData({ ...buildPages[activePageIndex].data, mainQuestion: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-2">Guide Text</label>
                                                    <input className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium text-sm text-slate-600 focus:bg-white transition-all" value={buildPages[activePageIndex].data.guideText || ""} onChange={e => updateCurrentPageData({ ...buildPages[activePageIndex].data, guideText: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
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