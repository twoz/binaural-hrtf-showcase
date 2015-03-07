function HRTFContainer() {

	var subjects = [];
	var current = -1;

	this.loadDatabase = function (onLoad) {
		var oReq = new XMLHttpRequest();
		oReq.open("GET", "HRTF/CIPIC/subjects_data.txt", true);
		oReq.onreadystatechange = function () {
			if (oReq.readyState === 4) {
				lines = oReq.responseText.split("\n");
				for (var line = 0; line < lines.length; ++line) {
					var attrs = lines[line].split(";");
					var id = attrs[0];
					var name;
					if (id == 21)
						name = "KEMAR Large";
					else if (id == 165)
						name == "KEMAR Small";
					else
						name = attrs[1];
					subjects.push({
						id: id,
						name: name,
						headWidth: attrs[2],
						headHeight: attrs[3],
						headDepth: attrs[4]
					});
				}
				onLoad();
			}
		}
		oReq.send(null);
	}

	this.nextSubject = function () {
		if (current < subjects.length - 1) {
			if (typeof subjects[current + 1].hrir == "undefined")
				loadHrir(subjects[current + 1], function () { current++; });
			else
				current++;
		}
	}

	this.prevSubject = function () {
		if (current > 0)
			current--;
	}

	var loadHrir = function (subject, onLoad) {
		var oReq = new XMLHttpRequest();
		var id = subject.id;
		var idString = id.toString();
		if (id < 10)
			idString = "00" + idString;
		else if (id < 100)
			idString = "0" + idString;
		oReq.open("GET", "HRTF/CIPIC/subject_" + idString + ".bin", true);
		oReq.responseType = "arraybuffer";
		oReq.onload = function (oEvent) {
			var arrayBuffer = oReq.response;
			if (arrayBuffer) {
				var rawData = new Float32Array(arrayBuffer);
				var hrir = {};
				hrir.L = {};
				hrir.R = {};
				var azimuths = [-90, -80, -65, -55, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0,
                    5, 10, 15, 20, 25, 30, 35, 40, 45, 55, 65, 80, 90];
				var points = [];

				var hrirLength = 200;
				var k = 0;
				for (var i = 0; i < azimuths.length; ++i) {
					azi = azimuths[i];
					hrir['L'][azi] = {};
					hrir['R'][azi] = {};

					// -90 deg elevation
					hrir['L'][azi][-90] = rawData.subarray(k, k + hrirLength);
					k += hrirLength;
					hrir['R'][azi][-90] = rawData.subarray(k, k + hrirLength);
					k += hrirLength;

					points.push([azi, -90]);
					// 50 elevations: -45 + 5.625 * (0:49)
					for (var j = 0; j < 50; ++j) {
						var elv = -45 + 5.625 * j;
						hrir['L'][azi][elv] = rawData.subarray(k, k + hrirLength);
						k += hrirLength;
						hrir['R'][azi][elv] = rawData.subarray(k, k + hrirLength);
						k += hrirLength;
						points.push([azi, elv]);
					}

					// 270 deg elevation
					hrir['L'][azi][270] = rawData.subarray(k, k + hrirLength);
					k += hrirLength;
					hrir['R'][azi][270] = rawData.subarray(k, k + hrirLength);
					k += hrirLength;
					points.push([azi, 270]);
				}
				subject.hrir = hrir;
				subject.triangles = Delaunay.triangulate(points);
				subject.points = points;
				onLoad();
			}
			else {
				alert('Failed to load HRIR file');
			}
		};
		oReq.send(null);
	}

	this.currentSubject = function () {
		return subjects[current];
	}

	// todo for performance:
	// - pre-compute T^-1
	// - use adjacency walk instead of iterating through all triangles
	this.interpolateHRIR = function (azm, elv) {
		if (current > -1) {
			var triangles = subjects[current].triangles;
			var points = subjects[current].points;
			var hrir = subjects[current].hrir;
			var i = triangles.length - 1;
			var A, B, C, X, T, invT, det, g1, g2, g3;
			while (true) {
				A = points[triangles[i]]; i--;
				B = points[triangles[i]]; i--;
				C = points[triangles[i]]; i--;
				T = [A[0] - C[0], A[1] - C[1],
					 B[0] - C[0], B[1] - C[1]];
				// T^-1
				invT = [T[3], -T[1], -T[2], T[0]];
				det = 1 / (T[0] * T[3] - T[1] * T[2]);
				for (var j = 0; j < invT.length; ++j)
					invT[j] *= det;
				// g = (X - C) * T^-1
				X = [azm - C[0], elv - C[1]];
				g1 = invT[0] * X[0] + invT[2] * X[1];
				g2 = invT[1] * X[0] + invT[3] * X[1];
				g3 = 1 - g1 - g2;
				if (g1 >= 0 && g2 >= 0 && g3 >= 0) {
					var hrirL = new Float32Array(200);
					var hrirR = new Float32Array(200);
					for (var i = 0; i < 200; ++i) {
						hrirL[i] = g1 * hrir['L'][A[0]][A[1]][i] + g2 * hrir['L'][B[0]][B[1]][i] + g3 * hrir['L'][C[0]][C[1]][i];
						hrirR[i] = g1 * hrir['R'][A[0]][A[1]][i] + g2 * hrir['R'][B[0]][B[1]][i] + g3 * hrir['R'][C[0]][C[1]][i];
					}
					return [hrirL, hrirR];
				}
				else if (i < 0) {
					// return zeros arrays (silence)
					console.log('not found', azm, elv);
					break;
				}
			}
		}
		return [new Float32Array(200), new Float32Array(200)];
	}
}

function HRTFPanner(context, hrtfContainer, source, listener) {
	this.listener = listener;
	this.source = source;
	this.crossfadeDurationMs = 25;
	
	function HRTFConvolver() {
		this.buffer = context.createBuffer(2, 200, context.sampleRate);
		this.convolver = context.createConvolver();
		this.convolver.normalize = false;
		this.convolver.buffer = this.buffer;
		this.gainNode = context.createGain();

		this.convolver.connect(this.gainNode);

		this.setBuffer = function (hrirLR) {
			var bufferL = this.buffer.getChannelData(0);
			var bufferR = this.buffer.getChannelData(1);
			for (var i = 0; i < this.buffer.length; ++i) {
				bufferL[i] = hrirLR[0][i];
				bufferR[i] = hrirLR[1][i];
			}
			this.convolver.buffer = this.buffer;
		}
	}

	var convolver1 = new HRTFConvolver();
	var convolver2 = new HRTFConvolver();

	var loPass = context.createBiquadFilter();
	var hiPass = context.createBiquadFilter();
	loPass.type = "lowpass";
	loPass.frequency = 200
	hiPass.type = "highpass";
	hiPass.frequency = 200;

	source.connect(loPass);
	source.connect(hiPass);
	hiPass.connect(convolver1.convolver);
	hiPass.connect(convolver2.convolver);

	this.connect = function (destination) {
		loPass.connect(destination);
		convolver1.gainNode.connect(destination);
		convolver2.gainNode.connect(destination);
	}

	this.setSource = function(newSource) {
		this.source.disconnect(loPass);
		this.source.disconnect(hiPass);
		newSource.connect(loPass);
		newSource.connect(hiPass);
		this.source = newSource;
	}

	this.setCrossoverFrequency = function (freq) {
		loPass.frequency = freq;
		hiPass.frequency = freq;
	}

	this.update = function () {
		// calculate source position relative to the listener
		var mInverse = new THREE.Matrix4().getInverse(listener.matrixWorld);
		var sourcePos = source.position.clone();
		sourcePos.applyMatrix4(mInverse);
		var cords = cartesianToInterauralPolar(sourcePos.x, -sourcePos.z, sourcePos.y);
		convolver2.setBuffer(hrtfContainer.interpolateHRIR(cords.azm, cords.elv));
		// start crossfading
		convolver2.gainNode.gain.setValueAtTime(0, context.currentTime);
		convolver2.gainNode.gain.linearRampToValueAtTime(1, context.currentTime + this.crossfadeDurationMs / 1000);
		convolver1.gainNode.gain.setValueAtTime(1, context.currentTime);
		convolver1.gainNode.gain.linearRampToValueAtTime(0, context.currentTime + this.crossfadeDurationMs / 1000);
		// swap convolvers
		var t = convolver2;
		convolver2 = convolver1;
		convolver1 = t;
	}

	var id;
	this.setUpdateInterval = function (intervalMs) {
		clearInterval(id);
		var that = this;
		id = setInterval(function () { that.update(); }, intervalMs);
	}

	this.setUpdateInterval(25);
}

// x1 - axis that cross through the ears from left to right
// x2 - axis that cross "between the eyes" and point ahead
// x3 - axis that points above the head
function cartesianToInterauralPolar(x1, x2, x3) {
	var r = Math.sqrt(x1 * x1 + x2 * x2 + x3 * x3);
	var azm = Math.asin(x1 / r) * 180 / Math.PI;
	var elv = Math.atan2(x3, x2) * 180 / Math.PI;
	if (x2 < 0 && x3 < 0)
		elv += 360;
	return { azm: azm, elv: elv };
}