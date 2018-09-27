var a3k = a3k || {};
a3k.activity = {
	initalized: false,
	js_id: null,
	acid: [],
	question_n: [],
	question_total: [],
	question_offset: [],
	guess_n: [],
	guesses: [],
	selected_letter: [],
	processing_click: false,
	choice_letters: ['A','B','C','D','E','F'],
	next_activity: [],
	show_feedback: true,
	strings: {},
	state: [],
	submitted: [],
	ajax_results: null,
	post: {ajax:1,resp:null},
	results_cache: {achievement:0,points:null,earcon:null},
	reload_page: false,

	Q_TYPES: {
		MULTIPLE_CHOICE: 'mc',
		DRAG_N_DROP: 'dnd',
		CITE_EVIDENCE: 'cite'
	},
	click_log: []
};

// return positive feedback string
a3k.activity.feedback = function() {
	var o = a3k.activity.strings.Feedback;
	for (var j, x, i = o.length; i; j = parseInt(Math.random() * i, 10), x = o[--i], o[i] = o[j], o[j] = x) {
	}
	return o[0] ? o[0] : a3k.activity.strings.Great;
};

//
/**
 * AJAX request to check answer against database.
 *
 * @param {string} js_id
 * @returns {boolean}
 */
a3k.activity.check_answer = function(js_id) {

	var a = a3k.activity;
	var qt = a.Q_TYPES;

	submit_time = new Date();
	if (a.submitted[js_id][a.question_n[js_id]+"."+a.guess_n[js_id]] == true) {
		return;
	}

	if (a.processing_click == true)
		return false;

	var f = a.get_question_form(js_id);
	var q_type = $('input[name="activity[question_type]"]', f).val();

	if (q_type === qt.MULTIPLE_CHOICE ) {
		if (!$('input[name="activity[mc_choice_id]"]', f).val()) {
			a3k.alert(a.strings.SelectChoice);
			return false;
		}
	} else if (q_type === qt.DRAG_N_DROP) {
		if(a3k.dnd.presubmit() === false) {
			a3k.alert(a.strings.CompleteActivity);
			return false;
		}
	} else if(q_type === qt.CITE_EVIDENCE) {
		if(a3k.cite.presubmit() === false) {
			a3k.alert(a.strings.CompleteActivity);
			return false;
		}
	}

	if(!a.post.ajax) {
		a3k.ajaxwait.add();
		f.submit();
		return true;
	}
	var href = f.attr('action');
	a.processing_click = true;
	a3k.ajaxwait.add();

	if (q_type == qt.MULTIPLE_CHOICE) {
		a.presubmit_check(js_id, submit_time);
	}

	$.ajax({
		type: 'GET',
		url: href,
		data: f.serialize(),
		dataType: "json",
		// timeout: 10000,
		error: a3k.ui.ajaxErrorHandler.handle,
		success: function(data) {
			var act_id = $('input[name="activity[activity_id]"]', f).val();
			a.process_check_answer(data, js_id, q_type, act_id, f, submit_time);
		},
        complete: function(jqXHR) {
            a3k.ajaxwait.remove();
        }
	});

	return false;
};

a3k.activity.presubmit_check = function(js_id, submit_time) {
	a = a3k.activity;
	f = a.get_question_form(js_id);
	err = {};

	//Does that JS variable match the form
	if (a.selected_letter[js_id] != $('input[name="activity[selected_letter]"]', f).val()) {
		err['js not equal form'] = {'JS': a.selected_letter[js_id], 'form': $('input[name="activity[selected_letter]"]', f).val() };
	}

	//Does the form match the css
	choice = $('li.activity_selected', f);
	tmp = choice.attr('id');


	if (tmp != "choice"+$('input[name="activity[mc_choice_id]"]', f).val()) {
		err['css not equal form'] = {'css': tmp,  'form': "choice"+$('input[name="activity[mc_choice_id]"]', f).val() };
	}

	 //Does the css match the JS
	tmp = $.trim(choice.attr('class').substr(0, 15).replace(/choice/g, ''));

	if (tmp != a.selected_letter[js_id]) {
		err['css not equal js'] = {'css': tmp,  'js': a.selected_letter[js_id]};
	}
}

/**
 * Handle the AJAX check answer response
 *
 * @param {object} data
 * @param {string} js_id
 * @param {string} q_type
 * @param {string} act_id
 * @param {object} f html form
 */
a3k.activity.process_check_answer = function(data, js_id, q_type, act_id, f, submit_time) {

	var ACT = a3k.activity;
	var QT = ACT.Q_TYPES;

	ACT.submitted[js_id][ACT.question_n[js_id]+"."+ACT.guess_n[js_id]] = true;
	// validate the response from the server
	ACT.is_valid_check_answer_response(data, js_id, submit_time);

	var lessonAnswerResponse = {
		"question_id":"688789","correct":1,"guess":1,"answer":"","question_type":"mc","q":1,"g":0,"answer_explanation":"","invalid_code":"","points":3,"earcon":"flash html object",
		"achievement":"", "results_points":"", "results_earcon":"", "alert":"",
		"score": { "responses":[], "guess1_total":1, "guess2_total":1 }
	};

	// {boolean} correct - the user has selected the correct answer
	// {boolean} try_again - incorrect answer and has not reached the maximum # of guesses.
	var correct   = data.correct === 1;
	var try_again = !correct && ACT.guesses[js_id] > ACT.guess_n[js_id];

	ACT.show_points(data.points);
	ACT.play_earcon(data.earcon);


	if (ACT.show_feedback != false) {

		// SF1. hide elements
		$('#submit-'+js_id).hide();
		$('#reset-'+js_id).hide();
		$('#question_counter-'+js_id).hide();


		// SF2. display feedback message
		var feedback = '';
		if( correct ) {
			feedback = ACT.feedback();
		} else {
			feedback = (q_type === QT.DRAG_N_DROP && a3k.dnd.part_correct(data) ? ACT.strings.OopsPartial : ACT.strings.Oops);
		}
		$('#feedback-'+js_id).html(feedback);


		// SF3. try again or continue
		if( try_again ) {
			if( q_type === QT.DRAG_N_DROP ){
				a3k.dnd.results(data, "noerrormessage");
			}
			ACT.ajax_results = data;
			$('#try_again-'+js_id).css('display', 'block');
			ACT.state[js_id] = 'retry';
			if( q_type === QT.CITE_EVIDENCE ) {
				a3k.cite.results(data);
			}
			else if( q_type == QT.MULTIPLE_CHOICE ){
				var letter = ACT.selected_letter[js_id];
				ACT.disable_choice(js_id, letter);
			}
		} else {
			if (!correct) {
				ACT.disable_choice(js_id, letter);
			}
		
			ACT.show_results(data, q_type, js_id, f, correct, submit_time);

			// check if there are more activities or questions
			if (ACT.next_activity[js_id] === true || ACT.question_n[js_id] < ACT.question_total[js_id])
				$('#next_question-'+js_id).show();
			else
				$('#view_results-'+js_id).show();
		}
	}
	else {
		ACT.next_question(js_id);
	}

	ACT.update_results_cache(data);
	ACT.show_score(data.score, act_id);
	ACT.processing_click = false;
	ACT.display_warning(data.invalid_code, data.alert);
};


/**
 * Error checking to ensure we are on the proper question and guess
 * @param {object} data
 * @param {string} js_id
 *
 * @returns {boolean}
 */
a3k.activity.is_valid_check_answer_response = function(data, js_id, submit_time) {

	var ACT = a3k.activity;
	var valid = true, reload = false;
	var tmp, choice_id, err = {}, f = ACT.get_question_form(js_id);


	if (typeof(data.q) == 'undefined') {
		err['Empty Data Response'] = "We recieved an empty response from the server";
	}
		
	// There is 3 sets of data we must valid against each other:
	//   A. server response - the data sent back to browser from the server (AJAX response)
	//   B. request per server - the data the server is saying it received from the browser.
	//   C. request per local - the data the browser has saved (a3k.activity & HTML); it should be what was sent to the server

	// 1. Validate question and guess number - A vs C
	// we only validate the guess number is the answer is incorrect
	if( data.q && (data.q != ACT.question_n[js_id] || (data.g != ACT.guess_n[js_id] && data.correct != 1)) ) {
		err['Number Error'] = { 'Local': {'q': ACT.question_n[js_id], 'g': ACT.guess_n[js_id] }, 'Server': { 'q':data.q, 'g':data.g } };
		reload = true;
		valid = false;
	}

	if( data.question_type == ACT.Q_TYPES.MULTIPLE_CHOICE ){
		// 2. check if local data matches HTML - just dataset C.
		var letter = ACT.selected_letter[js_id];
		var choice = $('li.choice'+letter, f);
		choice_id = choice.attr('id');
		if( !choice.hasClass('activity_selected') ){
			// update the values to match the proper
			choice = $('li.activity_selected', f);
			tmp = choice.attr('id');

			// just log an error, this should not be the error we are trying to fix
			err['Selected Local Error'] = { 'Local':choice_id, 'HTML':tmp };

			choice_id = tmp;
			valid = false;
		}
		choice_id = choice_id.slice("choice".length);

		// 3. Compare dataset A & B
		tmp = ACT.validate_server_response(data);

		if( tmp ){
			err['A-B Error'] = tmp;
			valid = false;
		}

		// 4. Compare dataset B & C
		tmp = ACT.validate_server_response_vs_form(data, f);

		if( tmp ){
			err['B-C Error'] = tmp;
			valid = false;
		}
	}

	if( reload ) {
		self.location.reload();
	}

	return valid;
};

/**
 * Validates the data within server AJAX response. It compares the output from the
 * server against the input the server says it received.
 *
 * @param data
 * @returns {{}}
 */
a3k.activity.validate_server_response = function(data){
	var valid = true;
	var err = {};
	var fields = ['mc_id', 'mc_choice_id', 'question_id', 'question_type'];

	if( data.input && data.input.activity ){
		$.each( fields, function( k, v ){
			var res = data[v];
			var req = data.input.activity[v];

			if( res != req ){
				err[v] = {'res': res, 'req': req};
				valid = false;
			}
		});
	}

	return valid ? null : err;
};

/**
 * Validates the server AJAX response against the HTML Form data of the active question
 *
 * @param {object} data - server response; data object
 * @param {object} f - HTML Form object for the active question
 * @returns {{}}
 */
a3k.activity.validate_server_response_vs_form = function(data, f){
	var valid = true;
	var err = {};

	if( data.input && data.input.activity ){
		$.each( data.input, function( k, v ){
			if( $.type(v) !== "object" ){
				var fv = $('input[name="' + k  +'"]', f).val();
				if( v != fv ){
					err[k] = {'res': v, 'f': fv};
					valid = false;
				}
			}
		});

		err['activity'] = {};
		$.each( data.input.activity, function( k, v ){
			if( $.type(v) !== "object" ){
				var fv = $('input[name="activity[' + k  +']"]', f).val();
				if( v != fv ){
					err['activity'][k] = {'res': v, 'f': fv};
					valid = false;
				}
			}
		});
	}

	return valid ? null : err;
};

/**
 *
 * @param {string} points
 */
a3k.activity.show_points = function(points) {
	if (points != null && points != '') {
		$('#topPointsContainer', $('#MotivationalDashboardContainer')).html(points);
	}
};

/**
 * Play sound to denote if the answer is correct or not
 * @param {string} earcon
 */
a3k.activity.play_earcon = function(earcon) {
	if (earcon != null && earcon != '') {
		$('#earconContainer').html(earcon);
	}
};

/**
 * Show score
 * @param {object} score
 * @param {array} score.responses
 * @param {number} score.guess1_total
 * @param {number} score.guess2_total
 * @param {string} act_id
 */
a3k.activity.show_score = function(score, act_id){
	if (score) {
		var responses = score.responses;
		var resp_cnt = 0;
		$.each(responses, function (k,v) {
			var last_value = 0;
			$.each(v, function(k2,v2) {
				var score_slot = $('#img-score'+(k2 == 2 ? '2' : '')+'-'+k);
				if (!score_slot)
					return;

				resp_cnt++;
				var image_string = "/assets/images/lesson/content_area/review/";
				if (v2 == 0)
					image_string += 'x.png';
				else if (v2 === last_value)
					image_string += 'dash.png';
				else
					image_string += 'check.png';

				score_slot.attr('src',image_string);
				last_value = v2;
			});
		});
		$('#A'+act_id+"_score").html(score.guess1_total+"%");
		try { $('#A'+act_id+"_score2").html(score.guess2_total+"%"); } catch (e) { }
		if(resp_cnt === 0) { // set reload page to force lookup for results page
			a3k.activity.reload_page = true;
		}
	}
};

/**
 * Shows warning message if error code is present
 * @param {string|number} code
 * @param {string} msg
 */
a3k.activity.display_warning = function(code, msg){
	if (code != null && code != 0) {
		var warning_dialog = $('<div class="activityWarningDialog"></div>');
		warning_dialog.html(msg);
		warning_dialog.dialog({
			autoOpen: true,
			height: 'auto',
			width: '300px',
			autoResize: true,
			modal: true,
			draggable: false,
			resizable: false
		});
	}
};

/**
 *
 * @param data
 * @param data.achievement
 * @param data.results_points
 * @param data.results_earcon
 */
a3k.activity.update_results_cache = function(data){
	var ACT = a3k.activity;
	if (data.achievement) {
		ACT.results_cache.achievement = data.achievement;
		ACT.results_cache.points = data.results_points;
		ACT.results_cache.earcon = data.results_earcon;
	}
};

a3k.activity.reset = function(js_id) {
	var ACT = a3k.activity;
	var f = ACT.get_question_form(js_id);
	var val = ACT.selected_letter[js_id];
	var item = $('li.choice'+val, f);
	item.removeClass('activity_selected').removeClass('choice'+ val +'_active');

	$('input[name="activity[mc_choice_id]"]', f).val('');

	// just reset class for non-ajax requests
	if(!ACT.post.ajax) {
		$.each(ACT.choice_letters, function(k, v) {
			$('.choice'+v, f).attr('class', 'choice choice'+v);
		});
	}
};

a3k.activity.mc_show_results = function(data, js_id, submit_time) {
	var ACT = a3k.activity;
	ACT.show_answer_prompt(data, js_id);

	var id = ACT.question_n[js_id]+'-'+js_id;

	try {
		$('#btn-hint-'+id).css('display','none');
	} catch (e) { }

	var q = $('#question-'+id);

	$('.choice', q).removeClass('activity_selected');
	$('#choice'+data.answer, q).addClass('activity_selected');
	$.each(ACT.choice_letters, function (index, item) {

		if ($('#choice'+data.answer, q).hasClass('choice'+item)) {
			$('#choice'+data.answer, q).addClass('choice'+item+'_active');
		} else {
			var o = $('.choice'+item, q);
			o.removeClass('choice'+item+'_active');
			o.addClass('choice_disabled');
			o.addClass('choice'+item+'_disabled');
			if(ACT.post.ajax) { // only disable click handler for ajax requests
				o.attr('onClick',null);
			}
		}
	});
};

a3k.activity.cite_show_results = function(data, js_id) {
	a3k.activity.show_answer_prompt(data, js_id);
	a3k.cite.results(data);
};

a3k.activity.dnd_show_results = function(data) {
	a3k.dnd.results(data);
};

a3k.activity.show_results = function(data, type, js_id, f, correct, submit_time) {
	var ACT = a3k.activity;
	var QT = ACT.Q_TYPES;

	// give answer explanation
	if( !correct ) {
		$('.answer-explanation', f).html(data.answer_explanation);
	}

	if( type == QT.MULTIPLE_CHOICE )
		ACT.mc_show_results(data, js_id, submit_time);
	else if( type == QT.CITE_EVIDENCE )
		ACT.cite_show_results(data, js_id);
	else if( type == QT.DRAG_N_DROP )
		ACT.dnd_show_results(data);
};

a3k.activity.show_answer_prompt = function( data, js_id ) {
	var prompt = $('#answer_prompt-'+a3k.activity.question_n[js_id]+'-'+js_id);
	prompt.html( data.correct != "0" ? a3k.activity.strings.Answer : a3k.activity.strings.CorrectAnswer ).show();
};

a3k.activity.notify = function(qid, js_id) {
	$(document).trigger("activityQuestionNotification", [qid,js_id])
};

a3k.activity.repeat = function(js_id) {
	var ACT = a3k.activity;
	var QT = ACT.Q_TYPES;
	var id = ACT.question_n[js_id]+'-'+js_id;
	ACT.guess_n[js_id]++;
	ACT.reset(js_id);

	$('#feedback-'+js_id).html('');
	$('#try_again-'+js_id).css('display', 'none');
	ACT.state[js_id] = null;
	$('#question_counter-'+js_id).css('display', 'block');
	$('#submit-'+js_id).css('display', '');
	$('#answer_prompt-'+id).html('').hide();
	$('.choice').css('visibility','visible');

	var f = ACT.get_question_form(js_id);
        var q_type = $('input[name="activity[question_type]"]', f).val();
        if (q_type == QT.DRAG_N_DROP) {
                $('#reset-'+js_id).show();
                a3k.dnd.reset(ACT.ajax_results);
        }
        else if (q_type == QT.CITE_EVIDENCE) {
                a3k.cite.enable();
        }

};

// display next question
a3k.activity.next_question = function(js_id) {
	var ACT = a3k.activity;
	ACT.question_n[js_id]++;
	ACT.guess_n[js_id] = 1;

	if (js_id === "step18page1") {
		window.location.reload();
		return;
	}

	// all done? jump to part 2
	if(ACT.question_n[js_id] > ACT.question_total[js_id]) {
		if (ACT.results_cache.earcon != null && ACT.results_cache.earcon != '') {
			$('#earconContainer').html(ACT.results_cache.earcon);
		}

		$('#link-'+js_id).addClass('disabled').attr('onClick', null);
		ACT.next_page(js_id);
		if (ACT.results_cache.achievement !== 0) {
            achievement_window('/motivation/achievement?achievement='+ACT.results_cache.achievement);
			ACT.results_cache.achievement = 0;
		}
		if (ACT.results_cache.points != null && ACT.results_cache.points != '') {
			$('#topPointsContainer', $('#MotivationalDashboardContainer')).html(ACT.results_cache.points);
			ACT.results_cache.points = null;
			ACT.results_cache.earcon = null;
		}
		
		if(ACT.reload_page) {
			window.location.reload();
		}

		if (ACT.next_activity[js_id] === true) {

			js_ids = Object.keys(ACT.acid);

			for (i=0; i<js_ids.length; i++) {
				if (js_id == js_ids[i]) {
					ACT.initialize_question(js_ids[i +1]);	
				}
			}
		}
	}
	else {
		var id = ACT.question_n[js_id]+'-'+js_id;

		$('.question').removeClass('active');
		$('#feedback-'+js_id).html('');
		$('#current_question-'+js_id).html((ACT.question_n[js_id]*1)+(ACT.question_offset[js_id]*1));
		$('#next_question-'+js_id).hide();
		$('#answer_prompt-'+id).html('').hide();
		$('.choice').css('visibility','visible');


		ACT.initialize_question(js_id);
	}
	return false;
};

// initialize activity page
a3k.activity.init = function(js_id, acid, question_n, question_total, question_offset, guess_n, show_feedback, guesses, next_activity, language, post) {
	this.js_id = js_id;
	this.acid[js_id] = acid; // activity
	this.question_n[js_id] = question_n; // n'th position of first unanswered question
	this.question_total[js_id] = question_total; // total number of questions
	this.question_offset[js_id] = question_offset;
	this.guess_n[js_id] = guess_n; // current guess
	this.guesses[js_id] = (guesses ? guesses : 1); // total guess allowed per question
	this.selected_letter[js_id] = ''; // for mc activity
	this.next_activity[js_id] = next_activity;
	this.show_feedback = show_feedback;
	this.ajax_results = null;

	//initialize variable we are going to use for if question was submitted or not

	this.submitted[js_id] = new Array();
	for (i=1; i<=question_total; i++) {
		for(j=1; j<=guesses; j++) {
			this.submitted[js_id][i+"."+j] = false;
		}
	}

	if(typeof post !== 'undefined') {
		this.post = post;
	}

	$('.activity-buttons').show();
	$('.progressBarFooter').show();
	$('.activityResultsContainer').show();

	a3k.activity.load_strings(language);

	var a = $('#'+js_id);
	$('[id^="dialog"]', a).css('display','none');
	$.each($('[id^="dialog"]', a), function () {
		var id = $(this).attr('id');
		var new_id = id.replace("dialog","btn");
		var i = $("#"+new_id);
		if( i ) {
			i.click(function() {
				a3k.alert($("#"+id).html(),400);
			});
		}
	});

	// set up callbacks
	$('#next_question-'+js_id+', #view_results-'+js_id).bind('click', function() {
		a3k.activity.next_question(js_id);
	});
	try {
		$('#try_again-'+js_id).bind('click', function() { a3k.activity.repeat(js_id); });
	} catch(e) {}

	$('#submit-'+js_id).unbind('click').click(function() { a3k.activity.check_answer(js_id); });
	$('#reset-'+js_id).css('display','none');

	if(post.ajax === 0) {
		a3k.activity.no_ajax(post.resp);
	}

	// display first unanswered question
	if(this.question_n[js_id] > this.question_total[js_id]) {
		$('#questions-'+js_id).css('display','none');
	} else {
		var qid = 'question-'+this.question_n[js_id]+'-'+js_id;
		$('#'+qid).addClass('active');
		a3k.activity.notify(qid, js_id);
	}


	a3k.activity.response_link_activate();
};

a3k.activity.no_ajax_results = function(evt) {
	$(evt.data.page1).hide();
	$(evt.data.page2).show();
	$('.nextContainer').show();
};

a3k.activity.no_ajax_ui_hide = function() {
	var a = a3k.activity;
	$('.nextContainer').hide();
	$('#submit-'+a.js_id).hide();
	$('#reset-'+a.js_id).hide();
	$('#question_counter-'+a.js_id).hide();
	a3k.dnd.disable();
};

a3k.activity.no_ajax = function(r) {
	var f, a = a3k.activity;
	var QT = a.Q_TYPES;

	if(r === null) {
		return;
	}

	if(r.question_type === QT.DRAG_N_DROP) {
		var qid = 'question-'+r.q+'-'+a.js_id;
		var q = $('#'+qid);
		var dnd_type = $('.dnd_type', q).text();
		a3k.dnd.no_ajax_init(qid, a.js_id, dnd_type);
	}

	if(a.show_feedback) {
		f = r.correct === 0 ? a.strings.Oops : a.feedback();
		$('#feedback-'+a.js_id).html(f);
		if (r.earcon != null && r.earcon != '') {
			$('#earconContainer').html(r.earcon);
		}
	}
	$('.nextContainer').hide();
	$('#submit-'+a.js_id).hide();
	$('#reset-'+a.js_id).hide();
	$('#question_counter-'+a.js_id).hide();

	// display fixes
	a.question_n[a.js_id] = r.q; // reset to question just answered
	$('.question').removeClass('active');
	if( r.question_type === QT.MULTIPLE_CHOICE ) {
		f = r.activity_form_values;
		$('#choice'+f.mc_choice_id).addClass('activity_selected choice'+f.selected_letter+'_active');
	}


	if(r.correct === 0 && r.guess === 1) {
		$('#try_again-'+a.js_id).show();
		a.state[a.js_id] = 'retry';
	} else {
		$('#next_question-'+a.js_id).show();
	}

	if(r.correct === 0 && r.guess === 2) {
		f = a.get_question_form(a.js_id);
		$('.answer-explanation', f).html(r.answer_explanation);
	}

	if(r.correct === 1 || r.guess === 2) {
		if(r.question_type === QT.MULTIPLE_CHOICE) {
			a.mc_show_results(r, a.js_id);
		}
		if(r.question_type === QT.DRAG_N_DROP) {
			a.dnd_show_results(r);
		}
	}

	if(r.score !== undefined) { // results info
		var page1 = '#'+a.js_id;
		var page2 = page1.slice(0, -1) + '2';
		$(page1).show();
		$(page2).hide();
		if(a.next_activity[a.js_id] === true) { // show next question button to advance to part 2
			$('#next_question-'+a.js_id).show();
		} else { // else show view results button
			$('#next_question-'+a.js_id).hide();
			var vr = $('#view_results-'+a.js_id);
			vr.show();
			vr.unbind('click');
			vr.bind('click', {page1:page1,page2:page2}, a.no_ajax_results);
		}
	}
};

a3k.activity.response_link_activate = function() {
    $('.activity_response_link').unbind('click');
	$('.activity_response_link').on('click', function() {
		$.ajax({
			url: this.href,
			dataType: 'script'
		});

		return false;
	});
};

a3k.activity.mc_select_choice = function(js_id, mc_choice_id, selected_letter) {

	a = a3k.activity;
	if (a.processing_click == true) {
		return;	
	}

	if (a.state[js_id] === 'retry')
		return;

	var choice = $('#choice'+mc_choice_id);
	if( choice.hasClass('choice_disabled') )
		return;

	a.processing_click = true;
	
	var q = $('#question-'+a.question_n[js_id]+'-'+js_id);
	$('li', q).removeClass('activity_selected');
	$('li', q).removeClass('choice'+a.selected_letter[js_id]+'_active');

	clickTime = new Date();
	if (a.click_log[js_id] !== undefined ) 
		a.click_log[js_id] += mc_choice_id +" was selected at: "+clickTime.getTime()+"---";
	else 
		a.click_log[js_id] = mc_choice_id +" was selected at: "+clickTime.getTime()+"---";

	choice.addClass('activity_selected choice'+selected_letter+'_active');
	a.selected_letter[js_id] = selected_letter;
	var f = a.get_question_form(js_id);
	$('input[name="activity[mc_choice_id]"]', f).val(mc_choice_id); 
	$('input[name="activity[selected_letter]"]', f).val(selected_letter);

	a.processing_click = false;

};

a3k.activity.questionAlert = function(acid, qid) {
	var a = $('#'+acid+'question-q'+qid);
	$('.scoredActivity',a).css('width','350px');
	$('[id^="btn-hint"]',a).css('display','none');
	$('[id^="answer_prompt"]',a).hide();

	$.each(a3k.activity.choice_letters, function (index, item) {
		$('.choice'+item,a).removeClass('choice'+item+'_disabled');
		$('.choice'+item,a).attr('onClick',null);
	});
	$('[id^="choice"]',a).removeClass('choice_disabled');
	a3k.alert(a.html());
};

a3k.activity.next_page = function(js_id) {
	var a = a3k.activity;
	if (a3k.lesson) {
		var current_page = a3k.lesson.current_page + 1;
		if(!a.post.ajax) {
			if(current_page > 2) {
				current_page=2;
				var page1 = '#'+a.js_id;
				var page2 = page1.slice(0, -1) + '2';
				$(page1).hide();
				$(page2).show();
			}
		}
		a3k.lesson.view_page(a3k.lesson.current_step, current_page);
	}
	else if (a3k.chapter_test) {
		a3k.chapter_test.next_page(js_id);
	}
};

a3k.activity.get_question_form = function( js_id ){
	return $( '#form-' + js_id + 'question' + a3k.activity.question_n[js_id] );
};

a3k.activity.disable_choice = function(js_id, letter) {
	var a = a3k.activity;
	var f = a.get_question_form(js_id);
	var choice = $('li.choice' + letter, f);
	choice.removeClass('activity_selected').removeClass('choice'+ letter +'_active').addClass('choice_disabled choice' + letter + '_disabled').attr('onclick','');
};

 a3k.activity.initialize_question = function(js_id) {
	var ACT = a3k.activity;

	var id = ACT.question_n[js_id]+'-'+js_id;
	var f = ACT.get_question_form(js_id);
	var q_type = $('input[name="activity[question_type]"]', f).val();
	var q_counter = $('#question_counter-'+js_id).show();
	var submit = $('#submit-'+js_id).show();

	var qid = 'question-'+id;
	$('#'+qid).addClass('active');
	ACT.notify(qid, js_id);

	if (q_type == ACT.Q_TYPES.DRAG_N_DROP) {
		q_counter.show();
		submit.show();
		$('#reset-'+js_id).show();
		a3k.dnd.enable();
  } else if (q_type == ACT.Q_TYPES.CITE_EVIDENCE) {
    a3k.cite.init(qid, js_id);
  }

	try {
		$('#btn-hint-'+id).css('display','block');
	} catch (e) { }
}


a3k.activity.load_strings = function(language) {
	if (language == 2) {
		a3k.activity.strings = {
			"Feedback":["¡Magnífico!","¡Fabuloso!","¡Súper!","¡Increíble!","¡Impresionante!","¡Fenomenal!","¡Correcto!","¡Excelente!","¡Fantástico!","¡Buen trabajo!","¡Sigue así!","¡Bien!","¡Estupendo!","¡Muy bien!","¡Perfecto!","¡Bien hecho!","¡Maravilloso!"],
			"Great":"¡Magnífico!",
			"SelectChoice":"Favor de elegir una respuesta.",
			"CompleteActivity":"Favor de completar la actividad.",
			"Oops":"¡Lo siento! Tu respuesta es incorrecta.",
			"OopsPartial":"¡Lo siento! Parte de tu respuesta es incorrecta.",
			"Answer":"LA RESPUESTA",
			"CorrectAnswer":"LA RESPUESTA CORRECTA ES"
		};
	} else {
		a3k.activity.strings = {
			"Feedback":["Great!","Terrific!","Wow!","Very nice!","Fantastic!","Super!","Very good!","Excellent!","Way to go!","Wonderful!","Good job!","Well done!","Keep it up!","Nice!","Amazing!","Awesome!","Correct!","Cool!"],
			"Great":"Great!",
			"SelectChoice":"Please select an answer choice.",
			"CompleteActivity":"Please complete the activity.",
			"Oops":"Oops! You answered this question incorrectly.",
			"OopsPartial":"Oops! Part of your answer is incorrect.",
			"Answer":"ANSWER",
			"CorrectAnswer":"THE CORRECT ANSWER IS"
		};
	}
};
