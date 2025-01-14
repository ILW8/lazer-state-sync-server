function columnIndexToLetters(columnIndex) {
	var letter = '';
	while (columnIndex > 0) {
		var modulo = (columnIndex - 1) % 26;
		letter = String.fromCharCode(modulo + 65) + letter;
		columnIndex = Math.floor((columnIndex - 1) / 26);
	}
	return letter;
}

function columnLettersToIndex(columnLetters) {
	var columnIndex = 0;
	var length = columnLetters.length;

	// Loop through each character in the column name
	for (var i = 0; i < length; i++) {
		var char = columnLetters.charAt(i);
		columnIndex = columnIndex * 26 + (char.charCodeAt(0) - 65 + 1);
	}

	return columnIndex;
}

function sendUpdate(sheet) {
	// check first that we are in an active ref sheet
	var matchId = sheet.getRange('S2').getValue();
	if (matchId === '') {
		Logger.log(`match id unset, ignoring change in sheet ${sheet}`);
	}
	Logger.log(`match id field: '${matchId}'`);

	// check if the sheet has been configured with a sync auth key
	var authKey = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings').getRange('O4').getValue();
	if (authKey == '')
		return;

	var teamsOrder   = sheet.getRange('E9:E36').getValues();
	var actionsOrder = sheet.getRange('F9:F36').getValues();
	var mapsOrder    = sheet.getRange('H9:H36').getValues();

	var pickbans = {
		"match": `${matchId}`,  // ensure it is a string
		"bans": [],
		"picks": []
	};

	for (var cursor=0; cursor < teamsOrder.length; cursor++) {
		if (mapsOrder[cursor] == '')
			break;

		var team = teamsOrder[cursor][0];
		var action = actionsOrder[cursor][0];
		var map = mapsOrder[cursor][0];
		Logger.log(`have a row: team=${teamsOrder[cursor]} action=${actionsOrder[cursor]} map=${mapsOrder[cursor]}`);

		if (action == 'Ban') {
			pickbans.bans.push({
				"team": team == sheet.getRange('E2').getValue() ? "red" : "blue",
				"slot": map
			});
		}

		if (action == 'Pick' || action == 'Tiebreaker') {
			pickbans.picks.push({
				// this means TB will always be attributed to team blue
				"team": team == sheet.getRange('E2').getValue() ? "red" : "blue",
				"slot": map
			});
		}
	}
	Logger.log(JSON.stringify(pickbans));

	var url = 'https://lazer-state-sync.notactuallyajame.workers.dev/';
	var options = {
		"method": "post",
		"contentType": "application/json",
		"payload": JSON.stringify(pickbans),
		"headers": {
			"Authorization": authKey,
		}
	}

	var resp = UrlFetchApp.fetch(url, options);
	Logger.log(`Sent sync request, response code: ${resp.code}`);
}

function forceSyncMatchState() {
	var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
	sendUpdate(sheet);
}

// sends match state to external server for stream overlay consumption
// this should be the target of onEdit trigger
function syncMatchState(e) {
	var range = e.range;
	var sheet = range.getSheet();

	var row = range.getRow();
	var col = range.getColumn();
	var colLetter = columnIndexToLetters(col);

	Logger.log(`changed cell: row=${row} col=${col}(${colLetter})`)

	if (colLetter !== 'H' || row < 9 || row > 36){
		Logger.log('ignoring non-pickban related change');
		return; // we only care about map pickban changes
	}

	sendUpdate(sheet);
}
