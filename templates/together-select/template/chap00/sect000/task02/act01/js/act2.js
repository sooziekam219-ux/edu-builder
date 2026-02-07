var dap_array = [2,2,2];
//G 빈칸보기 택일
var chasi = "08";//차시별로 따로 지정해야 함
var qType_array = ["Q001"];//선택형
var q_class = "selfquiz";//quiz 와 ssok 으로 구분 - 퀴즈 쏙 은 정답이 아니면 튕김
var char_no = 1;//캐릭터 번호 1:당근, 2토끼

var saveType = "ok";// "ok"(확인 - btn-ok 클래스) or "save"(저장하기 - btn-save 클래스)
if (q_class == "ssok") saveType = "save";

var ans_array = [];
var q_len = dap_array.length;
var pgQId = "Q" + chasi + "_" + curActNum + "_" + pageNum;//curActNum과 pageNum 은 common 에 선언되어 있음
var qId_array = [pgQId];// 여러개의 아이디가 필요한 경우 pgQId+"_1",pgQId+"_2" 형식으로 붙임
var qId = qId_array[0];
var qType = qType_array[0];
var quiz_on = true;

$(function () {
	BtnSet_fn();
	getQuizVal_fn(qId, qType, "getQData_fn");
});
function BtnSet_fn() {
	$saveBtn = (saveType == "ok") ? $(".btn.btn-ok") : $(".btn.btn-save");//btn-save or btn-ok
    $(".correct").removeClass("show");
	$saveBtn.click(function () {//저장 버튼 클릭시
        var index = $(".saveBtn").index(this);
		if (!chkAnsAll_fn()) {
			$(".pop.feedback").removeClass("correct" + char_no + " incorrect" + char_no);
			$(".pop.feedback").addClass("blank" + char_no + " show");
			$("#feedbacktext").html("<strong>정답을</strong> 선택하세요.") // a11y
			$saveBtn.addClass("on");
			return;
		}
		if (chkOxType_fn(q_class)) {
			if (isWrong_fn()) {//오답이 있는 경우
				$(".pop.feedback").removeClass("blank" + char_no);
				$(".pop.feedback").addClass("incorrect" + char_no + " show");
				$(".pop.feedback").data("index", index);
				(isEmpty($("#feedbacktext").attr("data-o"))) ? $(".pop #feedbacktext").html("<strong>오답</strong>입니다.") : $(".pop #feedbacktext").html($("#feedbacktext").attr("data-x"));
			} else {//정답인 경우
				$(".pop.feedback").removeClass("blank" + char_no);
				$(".pop.feedback").removeClass("incorrect" + char_no);
				$(".pop.feedback").addClass("correct" + char_no + " show");
				$(".pop.feedback").data("index", index);
				(isEmpty($("#feedbacktext").attr("data-o"))) ? $(".pop #feedbacktext").html("<strong>정답</strong>입니다!") : $(".pop #feedbacktext").html($("#feedbacktext").attr("data-o"));
				$(".inp-wrap input").addClass("correct");
                chkDap_fn();
			}
		}
		var ansStr = JSON.stringify(ans_array);
		saveQuiz_fn(qId, qType, JSON.stringify(dap_array), ansStr);
		$(".btn.btn-retry").show();
		$(".btn.btn-solve").show();
		$(this).hide();
		$('.btn').addClass('reload');
		quiz_on = false;
        if (!chkOxType_fn(q_class)) chkDap_fn();
	})
	$(".btn.btn-retry").click(function () {
		retry_fn();
	})
	// 빈칸보기 택일 스크립트 시작
	$(".check-blank").on('click', function(event) {
		event.preventDefault(); // 체크박스의 기본 체크 동작을 막음
	});
	$(".btn-blank").on("click", function (event) {
		event.preventDefault(); // 기본 동작 막기
		if(quiz_on == false) return;
		var checkbox = $(this).siblings(".check-blank");
		var isChecked = checkbox.prop("checked");
		$(".check-blank").prop("checked", false);// 모든 체크박스를 체크 해제
        checkbox.prop("checked", !isChecked);
	});
	$(".btn-select").on("click", function () {
		var t = $(this).html();
		var mun_idx = $(this).parents(".btn-blank-wrap").index(".btn-blank-wrap");//몇번째 문제인지 (0,1,2)
		var parentLi = $(this).closest('li');
		var idx = parentLi.index();//선택한 항목이 몇번인지(0,1)
		var ans = (idx + 1);
		
		ans_array[mun_idx] = ans;
		//$(this).parents(".btn-blank-wrap").find("label, ul").hide().siblings(".write-txt").html(t).fadeIn();
		$(this).parents(".btn-blank-wrap").find(".check-blank").prop("checked", false).next(".btn-blank").css({ "opacity": 0 }).siblings(".write-txt").html(t).fadeIn(); // ff(수정/20240626)
	});
	$('.pop.feedback .btn-close').on('click', function () {
		$(this).parents('.pop').removeClass('show');
		$saveBtn.removeClass("on");
	})
}
function retry_fn() {
	$(".wrap").attr("tabindex", 0).focus();
	ans_array = [];
	$saveBtn.show();
	$(".btn.btn-retry").hide();
    $(".btn.btn-solve").hide();
	$('.correct').removeClass('show');
	$('.btn').addClass('reload');
	$(".btn-blank-wrap").find(".write-txt").html("");
	$(".btn-blank-wrap .btn-blank, .btn-blank-wrap").show();
	$(".btn-blank-wrap input").prop("checked", false);
	$(".btn-blank-wrap ul").css("display", "");
	$(".write-txt").css("color", b_color);
	$(".btn-blank").css("opacity", 1);
	quiz_on=true;
}
function chkAnsAll_fn() {//모두 다 완료했는지 체크
	var ansAll_bool = true;
	for (var i = 0; i < dap_array.length; i++) {
		if (ans_array[i]) {//체크한 값이 있으면

		} else {//체크한 값이 없으면
			ansAll_bool = false;
			break;
		}
	}
	return ansAll_bool;
}
function isWrong_fn() {//정오답 체크
	var isWrong_bool = false;
	for (var i = 0; i < dap_array.length; i++) {
		if (isEmpty(ans_array[i])) continue;
		if (!compareAnsDap(ans_array[i], dap_array[i])) {
			isWrong_bool = true;
		}
	}
	return isWrong_bool;
}
function chkDap_fn() {
	//$(".correct").addClass("show");
	for (var i = 0; i < q_len; i++) {
		if (compareAnsDap(ans_array[i], dap_array[i])) {//정답
			$(".write-txt").eq(i).css("color", o_color);
		} else {//오답
			if ($('.correct').length > 0) {
				$('.correct').eq(i).addClass('show');
				$(".correct").eq(i).focus(); // a11y
			}
		}
	}
}
function getQData_fn(data) {//처음 페이지 진입시 데이타 받아오는 함수
	if (!isEmpty(data) && !isEmpty(data.input)) {
		ans_array = JSON.parse(data.input);
		if (!isEmpty(ans_array) && ans_array.length > 0) {
			var l_len = ans_array.length;
			for (var i = 0; i < l_len; i++) {
				var anum = parseInt(ans_array[i]);
				if (anum > 0) {
					$(".btn-blank-wrap input").eq(i).prop("checked", true);
					$(".btn-blank-wrap .select-wrap").eq(i).find("li").eq(anum - 1).children("button").click();
				}
			}
			chkDap_fn();
			if (ans_array.length == dap_array.length) {
				$(".btn.btn-retry").show();
                $(".btn.btn-solve").show();
				$saveBtn.hide();
				quiz_on = false;
			}
		}
	}
}