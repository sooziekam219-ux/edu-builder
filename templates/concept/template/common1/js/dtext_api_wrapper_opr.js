/**
 * @ver v1.0.9
 * @create date 2024-05-13
 * @desc 학습창 콘텐츠 공통 API
 */
/*############################################
 * Iframe Connect
##############################################*/
/**
 * 전송
 */
function sendMessage(params) {
    window.parent.postMessage(params, "*");
}
function sendPostMessage({ property, mainKey, subKey, sendData, callBackFn }) {
    sendMessage({ property, mainKey, subKey, sendData, callBackFn });
}
/**
 * 수신
 */
window.addEventListener("message", receiveMessage);
function receiveMessage(evt) {
    const { data } = evt;
    getPostMessage(data);
}
function getPostMessage({ returnData = "", callBackFn = "" }) {
    if (typeof returnData !== "string") returnData = JSON.stringify(returnData);
    if (callBackFn) {
        excuteCallBackFn({
            callBackFn,
            params: returnData,
        });
    }
    return {};
}
/**
 * 콜백함수 실행
 */
function excuteCallBackFn({ callBackFn, params }) {
    // [배포파일수정]
    // +++
    if (!window[callBackFn]) {
        const msg = "콜백함수가 존재하지 않습니다";
        setErrorHistory(msg);
    }
    // +++
    window[callBackFn](params);
}

/*############################################
 * API
##############################################*/
/**
 * 전역 데이터 가져오기
 * @param {String} mainKey 메인 키
 * @param {String} callBackFn 콜백함수
 * @returns
 */
function getGlobalLMSData(mainKey, callBackFn) {
    initActivityFunc("getGlobalLMSData", mainKey, callBackFn);
    sendPostMessage({ property: "get", mainKey, callBackFn });
}
/**
 * 학습Activity 데이터 저장하기
 * @param {String} mainKey 메인변수
 * @param {Object} subKey 서브변수
 * @param {String|Array|Object} saveData 저장데이터
 * @returns
 */
function setActivityData(mainKey, subKey, saveData) {
    const init = initActivityFunc("setActivityData", mainKey, subKey, saveData);
    sendPostMessage({ property: "set", mainKey, subKey, sendData: init });
}
/**
 * 학습Activity 데이터 가져오기
 * @param {String} mainKey 메인변수
 * @param {Object} subKey 서브변수
 * @param {String} callBackFn 콜백함수
 * @returns
 */
function getActivityData(mainKey, subKey, callBackFn) {
    initActivityFunc("getActivityData", mainKey, subKey, callBackFn);
    sendPostMessage({ property: "get", mainKey, subKey, callBackFn });
}

/**
 * 학습 액티비티 안에서 콘텐츠 도구를 호출하는 함수
 * @param {String} mainKey 메인변수
 * @param {Object} saveData 서브변수
 * @returns
 */
function callContentsTool(mainKey, saveData) {
    let callBackFn = "";
    let saveDataJson = {};
    try {
        saveDataJson = parseJSON(saveData);
        callBackFn = saveDataJson["callback"] ?? "";
    } catch (e) {
        saveDataJson = {};
    }
    if (callBackFn) {
        initActivityFunc("callContentsTool", mainKey, saveData, callBackFn);
    } else {
        initActivityFunc("callContentsTool", mainKey, saveData);
    }
    sendPostMessage({
        property: "call",
        mainKey,
        sendData: saveData,
        callBackFn,
    });
}
/*############################################
 * Init
##############################################*/
/**
 * getActivityData/setActivityData 함수 진입시 실행
 * - 실행/오류 이력 출력
 * - params string 타입여부 확인
 * - params 규격준수 여부 확인
 * - callback 함수 string 여부 확인
 */
function initActivityFunc(excuteKey, ...arguments) {
    // stringify 데이터 변환
    let arg = arguments.map((x) => {
        if (typeof x === "string") {
            return parseJSON(x);
        } else {
            let typeX = Array.isArray(x) ? "array" : typeof x;
            let arg = JSON.stringify(x) || String(x);
            setErrorHistory(
                `params '${arg}(${typeX})' 의 타입이 유효하지 않습니다. String 타입으로 전달되어야 합니다.`,
            );
        }
    });
    if (excuteKey.includes("getGlobalLMSData")) {
        let [key, callBackFn] = arguments.flat();
        return isValidCallbackFn(callBackFn);
    } else if (excuteKey.includes("set")) {
        return isValidActivityParams("set", arg);
    } else if (excuteKey.includes("get")) {
        return isValidActivityParams("get", arg);
    } else {
        return isValidActivityParams("", arg);
    }
}
/**
 * translate JSON
 */
function parseJSON(data) {
    try {
        const parsed = JSON.parse(data);
        // [배포파일수정] JSON.parse("1") => 1, JSON.parse("0") => 0 등등 문자열이 숫자로 바뀌는 경우가 있음...
        // +++
        if (typeof parsed === "number") {
            return parsed + "";
        }
        // +++
        return parsed;
    } catch (e) {
        return data;
    }
}
/*############################################
 * Check Validation
#############################################*/
/**
 * 호출시 각 함수별params 검증
 * params 기본 데이터 필수 키값 가져오기
 * @param {String} type get | set | '' 택 1
 * @param {String} mainKey 메인변수값
 * @returns {Object} params 필수 키 값
 */
function getFormatDefault(type, mainKey) {
    // 필수값
    const defaultType = {
        QUIZ_INPUT: {
            id: "", // 퀴즈아이디
            type: "", // 퀴즈유형
        },
        QUIZ_CORRECT: {
            id: "", // 퀴즈아이디
            type: "", // 퀴즈유형
        },
        STUDY_ACT: {
            id: "", // 활동아이디
            type: "", // 활동유형
        },
        ETC: {
            id: "", // 기타아이디
            type: "", // 기타유형
        },
        VIDEO: {
            id: "", // 비디오아이디
            event: "", // 이벤트 (start | pause | stop | playtime | speed)
        },
        LAST_PAGE: {
            type: "", // 구분값
        },
        OCR: {
            id: "", // 식별ID
            type: "", // 유형 ( math | english )
            callback: "", // 콜백함수
        },
        OCR_DIRECT: {
            id: "", // 식별ID
            type: "", // 유형 ( math | english )
            dataBase64: "", // 필기 이미지
            callback: "", // 콜백함수
        },
        STT: {
            id: "", // 식별ID
            callback: "", // 콜백함수
        },
        STT_W_TEST: {
            id: "", // 식별ID
            callback: "", // 콜백함수
        },
        STT_S_TEST: {
            id: "", // 식별ID
            callback: "", // 콜백함수
        },
        VOICE_TEST: {
            id: "", // 식별ID
            callback: "", // 콜백함수
        },
        TOOL: {
            id: "", // 식별ID
        },
        ALGEOMETH: {
            type: "", // 2D/3D 구분
            key : ""  // 초기화콘텐츠키
        },
        EXPRESS: {
            id: "", // 식별ID
            key: "", // 초등(E), 중등(M), 고등(H)
            callback: "", // 콜백함수
        },
        CLASSBOARD: {},
        CORRECT: {
            id: "", //퀴즈구분자
            question: "", //질문
            answer: "", //학습자답변
            callback: "", //콜백함수명
        },
		NAVIGATE: {
            view: "", // 탭 페이지 뷰
        },
        VIEW_STATUS: {
            view: "", // view 번호
        },
        VIEW_CORRECT: {
            view: "", // view 번호
        },
        STUDY_OCR: {
            id: "", // 학습활동 식별id
            type: "", // 학습활동 유형
        },
    };
    // 선택값
    const typeCall = {
        OCR: {
            imgPath: "", // 배경이미지
        },
        STT: {
            text: "", // 예상발음결과
            imgPath: "", // text 이미지 path
            modelId: "", // AI 모델 ID
            audioPath: "", // 음성정보 path
        },
        STT_W_TEST: {
            text: "", // 평가문장
            imgPath: "", // text 이미지 path
            modelId: "", // AI 모델 ID
            audioPath: "", // 음성정보 path
        },
        STT_S_TEST: {
            text: "", // 평가문장
            imgPath: "", // text 이미지 path
            modelId: "", // AI 모델 ID
            audioPath: "", // 음성정보 path
        },
        VOICE_TEST: {
            key: "", // AI센터에 등록한 KEY 정보
            text: "", // 평가문장
            modelId: "", // AI 모델 ID
            type: "", // 평가구분 (E | R)
            imgPath: "", // text 이미지 path
            audioPath: "", // 원어민 음성정보 path
        },
        TOOL: {
            text: "", // 평가문장
            imgPath: "", // text 이미지 path
            audioPath: "", // 원어민 음성정보 path
        },
        EXPRESS: {
            latex: "", //현재입력값(LATEX 값)
        },
    };
    const typeSet = {
        QUIZ_INPUT: {
            input: "", // 입력값
            answer: "", // 정답
            solveTime: "", // 풀이시간
        },
        QUIZ_CORRECT: {
            result: "", // 정답
        },
        STUDY_ACT: {
            data: "", // 활동데이터 : STRING 유형별 체크 필요
        },
        ETC: {
            data: "", // 활동데이터 : STRING, ARRAY, OBJECT 기타등등 유형별 체크 필요
        },
        VIDEO: {
            data: "", // 이벤트 데이터
        },
        LAST_PAGE: {
            data: "", // 마지막 페이지 정보
        },
		STUDY_OCR: {
            data: "", // 학습활동정보
        },
        NAVIGATE: {
            data: "", // View 마지막 정보
        },
    };
    const typeGet = {
        QUIZ_INPUT: {
            callback: "", // 콜백함수
        },
        QUIZ_CORRECT: {
            callback: "", // 콜백함수
        },
        STUDY_ACT: {
            callback: "", // 콜백함수
        },
        LAST_PAGE: {
            callback: "", // 콜백함수
        },
        ETC: {
            callback: "", // 콜백함수
        },
        VIDEO: {
            callback: "", // 콜백함수
        },
		STUDY_OCR: {
            callback: "", // 콜백함수
        },
    };

    if (type.includes("set")) {
        return Object.assign(defaultType[mainKey], typeSet[mainKey]);
    } else if (type.includes("get")) {
        return Object.assign(defaultType[mainKey], typeGet[mainKey]);
    } else {
        return defaultType[mainKey];
    }
}
function isValidActivityParams(type = "", arguments) {
    const [mainKey, subKey, saveData = {}] = arguments;
    if (!mainKey || !subKey || !saveData) {
        setErrorHistory("함수 호출시 키 값은 모두 입력되어야 합니다");
    }
    const defaultFormat = getFormatDefault(type, mainKey);

    let typeKey, data;
    switch (mainKey) {
        case "LAST_PAGE":
            typeKey = { type: subKey };
            data = { data: saveData };
            break;
        case "QUIZ_CORRECT":
            typeKey = subKey;
            data = { result: saveData };
            break;
        case "STUDY_ACT":
        case "ETC":
		case "STUDY_OCR":
        case "VIDEO":
            typeKey = subKey;
            data = { data: saveData };
            break;
        default:
            typeKey = subKey;
            data = saveData;
            break;
    }
    if (type === "get") {
        data = { callback: saveData };
    }
    obj = Object.assign(typeKey, data);

    // 유효성 체크
    Object.keys(defaultFormat).forEach((key) => {
        if (!obj.hasOwnProperty(key)) {
            // params 내에 키 값 모두 있는지 확인
            let msg = `'${key}' 키값이 존재하지 않습니다. '${key}'를 입력해주세요`;
            setErrorHistory(msg);
        }
        // [배포파일수정] 값을 빈 문자열로 넘기는 경우 허용
        // if (!obj[key]) {
        if (obj[key] === undefined || obj[key] === null) {
            let msg = `'${key}' 의 값이 없습니다. 해당 값을 넣어주세요`;
            setErrorHistory(msg);
        }
        if (key === "callback") {
            // 콜백함수 확인
            isValidCallbackFn(obj.callback);
        }
    });
    return JSON.stringify(obj);
}

/**
 * 콜백함수 검증
 */
function isValidCallbackFn(callback, arguments = null) {
    if (typeof callback !== "string") {
        const msg = "콜백함수 명은 String이어야 합니다";
        setErrorHistory(msg, callback);
        return false;
    }
    if (typeof window[callback] !== "function") {
        const msg = `콜백함수가 유효하지 않습니다`;
        setErrorHistory(msg, callback);
        return false;
    }
    return true;
}

// 오류 로그이력
function setErrorHistory(msg, callback = "") {
    throw new Error(msg, callback);
}
