multiQuiz = true;//true 면 여러개 확인 버튼이 있는 유형 - common.js 에서 선언되었음
var dap1_array = ["\\pm\\sqrt{\\frac{3}{13}}"];
var dap2_array = ["\\pm\\sqrt{0.4}"];
//문제 확인버튼 여러개 유형
var q_len = 2;//확인버튼 개수
var qArange = [[1], [2]];// 각 확인버튼에 배정된 문제 번호
var chasi = "06";//차시별로 따로 지정해야 함
var qType_array = ["Q001"];//정오답형
var q_class = "quiz";//quiz 와 ssok 으로 구분 - 퀴즈 쏙 은 정답이 아니면 튕김
var char_no = 1;//캐릭터 번호 1:당근, 2토끼
var dap_array = dap1_array.concat(dap2_array);//전체 정답 배열

var saveType = "ok";// "ok"(확인 - btn-ok 클래스) or "save"(저장하기 - btn-save 클래스)
var ans_array = [];
var latexStr = "";
var pgQId = "Q" + chasi + "_" + curActNum + "_" + pageNum;//curActNum과 pageNum 은 common 에 선언되어 있음
var qType = qType_array[0];

var quiz_on_array = [];

var i = 0;
var qCorrectType_bool = true;//quiz_input 타입과 quiz_correct 타입이 동시에 선언되어 있음을 체크

var dapObj = {};//개별 답을 저장하는 객체
var ansObj = {};//사용자 입력값을 저장하는 객체
var qIdObj = {};//문제 아이디를 저장하는 객체
var correctObj = {};//맞춤,틀림 정보를 저장하는 객체
var saveBtnObj = {};
var retryBtnObj = {};//재시도 버튼을 저장하는 객체
var solveBtnObj = {};//정답보기 버튼을 저장하는 객체
for (i = 0; i < q_len; i++) {//정답의 갯수만큼 dap1_array, dap2_array 등으로 개별 답을 저장
	dapObj["dap" + (i + 1)] = eval("dap" + (i + 1) + "_array");//dapObj.dap1, dapObj.dap2 등으로 개별 답을 선언
	ansObj["ans" + (i + 1)] = [];//ansObj.ans1, ansObj.ans2 등으로 개별 답을 선언
	qIdObj["qId" + (i + 1)] = pgQId + "_" + (i + 1);//문제 아이디를 저장하는 객체
	correctObj["correct" + (i + 1)] = null;
	quiz_on_array[i] = true;//퀴즈 진행여부
}

$(function () {
	BtnSet_fn();
	for (var i = 0; i < q_len; i++) {
		var no = i + 1;
		getQuizVal_fn(qIdObj["qId" + no], qType, "getQData" + no + "_fn");
	}
	try { correctSet_fn(dap_array) } catch (e) { console.log(e.error) };//정답을 미리세팅 - correctSet_fn 은 common.js 에 선언
	//최종 오답창에서 정답보기 버튼 클릭시
	$(window).on("CorrectShow", function () {
		//chkDap_fn(1); 
	});
	// 교사 정답보기 이벤트
	$(window).on("teacherSave", function () {
		//chkDap_fn(1); 
	});
});
function findQArange(idx) {//확인버튼 번호에 해당하는 문제 번호를 리턴하는 함수
	var qArange_idx = 0;
	for (var i = 0; i < qArange.length; i++) {
		if (qArange[i].includes(idx)) {
			qArange_idx = i + 1;
			break;
		}
	}
	return qArange_idx;
}
function BtnSet_fn() {
	const okBtns = $(".btn.btn-ok");
	const quizIns = $("[id^='QuizInput']");
	let qiIndex = 0;                      // QuizInput 순번용

	okBtns.each(function (i, btn) {
		qiIndex = 0;
		// ① 이 OK 버튼이 들어 있는 문제 블록 (.flex-col)
		const $block = $(btn).closest(".flex-col");

		// ② 블록 안의 .correct 전부에 correct{n} 클래스
		$block.find(".correct").addClass("correct_" + (i + 1));

		// ③ 블록 안의 QuizInput(p 태그)에도 QuizInput{n} 클래스·data 부여
		$block.find("[id^='QuizInput']").each(function () {
			$(this)
				.addClass("QuizInput" + (i + 1))
				.data("class_idx", i + 1)
				.data("no_idx", ++qiIndex);
		});

		// ④ 버튼 객체들 보관
		saveBtnObj["saveBtn" + (i + 1)] = $(btn);
		retryBtnObj["retryBtn" + (i + 1)] = $block.find(".btn.btn-retry");
		solveBtnObj["solveBtn" + (i + 1)] = $block.find(".btn.btn-solve");
	});
	$(".correct").removeClass("show");
	$(".correct").css("pointerEvents", "none");
	//if(q_class == "quiz") dapHide_bool=true;//문제 유형에서는 오답시 정답보기 버튼이 뜨면서 답이 가려짐 (dapHide_bool은 common.js 에 선언되어 있음)
	$saveBtn = (saveType == "ok") ? $(".btn.btn-ok") : $(".btn.btn-save");
	$saveBtn.click(function () {//확인 버튼 클릭시
		var no_idx = $saveBtn.index(this) + 1;//몇번째 확인버튼을 클릭했는지

		if (!chkAnsAll_fn(no_idx)) {
			$(".pop.feedback").removeClass("correct" + char_no + " incorrect" + char_no);
			$(".pop.feedback").addClass("blank" + char_no + " show");
			$("#feedbacktext").html("<strong>빈칸을</strong> 입력하세요.") // a11y
			$(this).addClass("on");
			return;
		}
		if (isWrong_fn(no_idx)) {//오답이 있는 경우
			$(".pop.feedback").removeClass("blank" + char_no);
			$(".pop.feedback").addClass("incorrect" + char_no + " show");
			$(".pop.feedback").data("no_idx", no_idx);
			(isEmpty($("#feedbacktext").attr("data-o"))) ? $(".pop #feedbacktext").html("<strong>오답</strong> 입니다!") : $(".pop #feedbacktext").html($("#feedbacktext").attr("data-x"));
			correctObj["correct" + no_idx] = false;
		} else {//정답인 경우
			if (q_class == "quiz") {
				$(".pop.feedback").removeClass("blank" + char_no);
				$(".pop.feedback").removeClass("incorrect" + char_no);
				$(".pop.feedback").addClass("correct" + char_no + " show");
				$(".pop.feedback").data("no_idx", no_idx);
				(isEmpty($("#feedbacktext").attr("data-o"))) ? $(".pop #feedbacktext").html("<strong>정답</strong>입니다!") : $(".pop #feedbacktext").html($("#feedbacktext").attr("data-o"));
				correctObj["correct" + no_idx] = true;
				chkDap_fn(no_idx);
			}
			$(".inp-wrap input").addClass("correct");
		}

		var ansStr = JSON.stringify(ansObj["ans" + no_idx]);
		var qId = qIdObj["qId" + no_idx];
		var dapStr = JSON.stringify(dapObj["dap" + no_idx]);
		saveQuiz_fn(qId, qType, dapStr, ansStr);
		retryBtnObj["retryBtn" + no_idx].show();
		solveBtnObj["solveBtn" + no_idx].show();
		$(this).hide();
		quiz_on_array[no_idx - 1] = false;//퀴즈가 끝났음을 체크
		if (!chkOxType_fn(q_class)) chkDap_fn(no_idx);//정오답 보이기
	})
	$(".btn.btn-retry").click(function () {
		var no_idx = $(".btn.btn-retry").index(this) + 1;//몇번째 다시하기버튼을 클릭했는지
		retry_fn(no_idx);
	})

	$('.btn-close').on('click', function () {
		$(this).parents('.pop').removeClass('show');
		((typeof $saveBtn !== "undefined" && $saveBtn) || ($(".btn.btn-ok").length && $(".btn.btn-ok")) || $(".btn.btn-save")).removeClass("on");
	});
}
function chkAnsAll_fn(no_idx) {//모두 다 완료했는지 체크- 여기서는 체크한 게 있으면 true 값을 넘김
	var dap_arr = dapObj["dap" + no_idx];
	var ans_arr = ansObj["ans" + no_idx];
	var ansAll_bool = true;
	for (var i = 0; i < dap_arr.length; i++) {
		if (isEmpty(ans_arr[i])) {
			ansAll_bool = false;
		}
	}
	return ansAll_bool;
}
function isWrong_fn(no_idx = 0) {//정오답 체크 및 색상 처리
	if (no_idx == 0) return;
	var isWrong_bool = false;
	var dap_arr = dapObj["dap" + no_idx];
	var ans_arr = ansObj["ans" + no_idx];
	for (var i = 0; i < dap_arr.length; i++) {
		if (!compareAnsDap(ans_arr[i], dap_arr[i])) {
			isWrong_bool = true;
		}
	}
	return isWrong_bool;
}
function chkDap_fn(no_idx) {
	if (isEmpty(no_idx)) return;
	var dap_arr = dapObj["dap" + no_idx];
	var ans_arr = ansObj["ans" + no_idx];
	var qlen = dap_arr.length;
	correctObj["correct" + no_idx] = true;
	for (var i = 0; i < qlen; i++) {
		if (compareAnsDap(ans_arr[i], dap_arr[i])) {//정답
			$(".QuizInput" + no_idx).eq(i).css("color", o_color);
		} else {//오답
			$(".QuizInput" + no_idx).eq(i).css("color", "");
			$(".correct_" + no_idx).eq(i).addClass("show");
			correctObj["correct" + no_idx] = false;
		}
	}
}

function retry_fn(no_idx) {
	$(".wrap").attr("tabindex", 0).focus();
	ansObj["ans" + no_idx] = [];
	$(".QuizInput" + no_idx).html("").css("color", "");
	saveBtnObj["saveBtn" + no_idx].show().addClass('reload');
	retryBtnObj["retryBtn" + no_idx].hide().addClass('reload');
	solveBtnObj["solveBtn" + no_idx].hide().addClass('reload');
	$(".correct_" + no_idx).removeClass("show");
	for (var i = 0; i < qArange[no_idx - 1].length; i++) {
		var no_idx2 = qArange[no_idx - 1][i];
		showBtnMath_fn(no_idx2 - 1);
	}
	quiz_on_array[no_idx - 1] = true;
}
function delayHidePop() {
	setTimeout(function () {
		$(".pop.correct2").removeClass("show");
	}, 2500);
}
for (i = 1; i <= dap_array.length; i++) {
	window['ExpRtn' + i] = function (data) { ExpRtn_fn(data); };
	window['OcrRtn' + i] = function (data) { OcrRtn_fn(data); };
}
function ExpRtn_fn(data) {//수식 입력기 입력 후 리턴 받는 함수
	//alert("수식입력기:" + data.latex);
	if (isEmpty(data)) return;
	var input_idx = Number(data.id.split("_")[1]);
	var class_idx = $("#QuizInput" + input_idx).data("class_idx");
	var no_idx = $("#QuizInput" + input_idx).data("no_idx");
	latexStr = chglatexStr_fn(data.latex);
	var ans_arr = ansObj["ans" + class_idx];
	ans_arr[no_idx - 1] = latexStr;
	viewMathJaxStr(latexStr, $("#QuizInput" + input_idx)); //common.js에 선언되어 있음
}
function OcrRtn_fn(data) {//수식 입력기 입력 후 리턴 받는 함수
	//alert("수식입력기:" + data.latex);
	if (isEmpty(data)) return;
	var input_idx = Number(data.id.split("_")[2]);
	var class_idx = $("#QuizInput" + input_idx).data("class_idx");
	var no_idx = $("#QuizInput" + input_idx).data("no_idx");
	latexStr = chglatexStr_fn(data.latex);
	var ans_arr = ansObj["ans" + class_idx];
	ans_arr[no_idx - 1] = latexStr;
	viewMathJaxStr(latexStr, $("#QuizInput" + input_idx)); //common.js에 선언되어 있음
}
function makeGetQData(no_idx) {
	return function (data) {
		if (!isEmpty(data)) {
			var data_obj = JSON.parse(data);
			var ans_arr = [];//빈 배열로 초기화
			if (isEmpty(data_obj.input)) {
				return;
			} else {
				ans_arr = JSON.parse(data_obj.input);
			}
			ans_arr.forEach((str, i) => {
				viewMathJaxStr(str, $(".QuizInput" + no_idx).eq(i)); //common.js에 선언되어 있음
			});
			ansObj["ans" + no_idx] = ans_arr;
			chkDap_fn(no_idx);//정오답 보이기
			solveBtnObj["solveBtn" + no_idx].show();
			retryBtnObj["retryBtn" + no_idx].show();
			saveBtnObj["saveBtn" + no_idx].hide();
			quiz_on_array[no_idx - 1] = false;//퀴즈가 끝났음을 체크
		}
	};
}
for (i = 1; i <= q_len; i++) {
	window["getQData" + i + "_fn"] = makeGetQData(i);
}
