window.onload = function() {

	var clock = new THREE.Clock();
	var intervalID;
	var scene, povCamera, renderer, controls, stats;
	var windowWidth, windowHeight;
	var maleHead, femaleHead;
	var orbiter, pattern = 1, orbitSpeed = 0.01;	
	var audioElement, panner, masterGain;
	var subjects = [], currentSubject = {}, currentSubjectIndex = -1;
	var tracks = [
		"assets/audio/core3.mp3",
		"assets/audio/trumpet.ogg",
		"assets/audio/rotor.wav",
		"assets/audio/square.wav"
	];
	var views = [
			{
				left: 0,
				bottom: 0,
				width: 0.7,
				height: 1.0,
				background: new THREE.Color().setRGB(0.5, 0.5, 0.7),
				pos: [0, 0, 0],
				up: [0, 1, 0],
				lookAt: [0, 0, 1],
				fov: 45,
			},
			{
				left: 0.7,
				bottom: 0.5,
				width: 0.3,
				height: 0.5,
				background: new THREE.Color().setRGB(0.7, 0.5, 0.5),
				pos: [3, 0, 0],
				up: [0, 1, 0],
				lookAt: [0, 0, 0],
				fov: 45,
			},
			{
				left: 0.7,
				bottom: 0,
				width: 0.3,
				height: 0.5,
				background: new THREE.Color().setRGB(0.5, 0.7, 0.5),
				pos: [0, 3, 0],
				up: [0, 1, 0],
				lookAt: [0, 0, 0],
				fov: 45
			}
	];

	init();
	animate();

	function init() {

		stats = initStats();
		scene = new THREE.Scene();
		for (var i = 0; i < views.length; ++i) {
			var view = views[i];
			var camera = new THREE.PerspectiveCamera(view.fov, window.innerWidth / window.innerHeight, 0.5, 100);
			camera.position.set(view.pos[0], view.pos[1], view.pos[2]);
			camera.up.set(view.up[0], view.up[1], view.up[2]);
			camera.lookAt(new THREE.Vector3(view.lookAt[0], view.lookAt[1], view.lookAt[2]));
			scene.add(camera);
			view.camera = camera;
		}
		povCamera = views[0].camera;

		renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		document.body.appendChild(renderer.domElement);

		controls = new THREE.FlyControls(views[0].camera, renderer.domElement);
		controls.movementSpeed = 0;
		controls.rollSpeed = Math.PI / 6;
		controls.autoForward = false;
		controls.dragToLook = true;

		var light = new THREE.PointLight(0xffffff);
		light.position.set(1, 2, -1);
		scene.add(light);

		// orbiter
		orbiter = new THREE.Mesh(new THREE.SphereGeometry(0.1, 64, 64), new THREE.MeshPhongMaterial({ color: 0x000000 }));
		scene.add(orbiter);
		// wireframe sphere
		scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), new THREE.MeshBasicMaterial({ color: 0xcccccc, wireframe: true })));

		loadHeadModels(function() { loadSubjectsData(); });
	}

	function initAudio() {

		try {
			var audioContext = new (window.AudioContext || window.webkitAudioContext)();
		}
		catch (e) {
			alert("Web Audio API is not supported in this browser");
		}

		audioElement = document.getElementById("player");
		var source = audioContext.createMediaElementSource(audioElement);

		masterGain = audioContext.createGain();
		masterGain.connect(audioContext.destination);
		masterGain.gain.value = 0.6;
		panner = new HRTFPanner(audioContext, source, currentSubject.hrtfContainer);
		panner.connect(masterGain);
		intervalID = setInterval(updatePanner, 50);
		audioElement.play();
	}

	function initStats() {

		var stats = new Stats();
		stats.setMode(0);

		stats.domElement.style.position = "absolute";
		stats.domElement.style.left = "0px";
		stats.domElement.style.top = "30px";

		document.body.appendChild(stats.domElement);

		return stats;
	}

	function initGUI() {

		var gui = new dat.GUI();
		gui.width = 300;

		var guiParams = {
			nextSubject: function() {
				if (currentSubjectIndex < subjects.length - 1) {
					var nextSubject = subjects[currentSubjectIndex + 1];
					loadSubject(nextSubject, function() {
						currentSubjectIndex++;
						panner.setHrtfContainer(subjects[currentSubjectIndex].hrtfContainer);
					});
				}
			},
			prevSubject: function() {
				if (currentSubjectIndex > 0) {
					var nextSubject = subjects[currentSubjectIndex - 1];
					loadSubject(nextSubject, function() {
						currentSubjectIndex--;
						panner.setHrtfContainer(subjects[currentSubjectIndex].hrtfContainer);
					});
				}
			},
			pause: function() {
				if (audioElement.paused)
					audioElement.play();
				else
					audioElement.pause();
			},
			crossoverFrequency: 200,
			updateInterval: 20,
			gain: masterGain.gain.value,
			sound: "",
			pattern: 1,
			speed: orbitSpeed
		}

		var folder1 = gui.addFolder("HRTF");
		folder1.add(currentSubject, "id").name("Subject ID").listen();
		folder1.add(currentSubject, "name").name("Name").listen();
		folder1.add(currentSubject, "headWidth").name("Head Width [cm]").listen();
		folder1.add(currentSubject, "headHeight").name("Head Height [cm]").listen();
		folder1.add(currentSubject, "headDepth").name("Head Depth [cm]").listen();
		folder1.add(guiParams, "nextSubject").name("NEXT SUBJECT");
		folder1.add(guiParams, "prevSubject").name("PREV SUBJECT");

		var folder2 = gui.addFolder("Panner settings");
		folder2.add(guiParams, "crossoverFrequency").min(0).max(5000).name("Crossover frequency").onChange(function(value) {
			panner.setCrossoverFrequency(value);
		});
		folder2.add(guiParams, "updateInterval").min(10).max(1000).name("Update interval").onChange(function(value) {
			clearInterval(intervalID);
			intervalID = setInterval(updatePanner, value);
		});

		var folder3 = gui.addFolder("Sound source");
		folder3.add(guiParams, "pause").name("Play/Pause");
		folder3.add(guiParams, "gain").min(0).max(1).name("Volume").onChange(function(value) {
			masterGain.gain.value = value;
		});
		folder3.add(guiParams, "sound").options({ "Robot": 0, "Trumpet": 1, "Helicopter": 2, "Saw": 3 }).name("Sound").onChange(function(value) {
			audioElement.src = tracks[value];
			audioElement.play();
		});
		folder3.add(guiParams, "pattern").options(1, 2, 3).name("Orbit pattern").onChange(function(value) {
			pattern = value;
		});
		folder3.add(guiParams, "speed").min(0).max(0.1).name("Orbit speed").onChange(function(value) {
			orbitSpeed = value;
		});
	}

	function hrirFilenameFromId(id) {

		id = parseInt(id);
		var filename = "HRTF/CIPIC/subject_";
		if (id < 100 && id >= 10)
			filename += '0';
		else if (id < 10)
			filename += '00';

		filename += id + ".bin";
		return filename;
	}

	function loadHeadModels(onLoad) {

		var loader = new THREE.OBJMTLLoader();
		loader.load("assets/obj/head_F.obj", "assets/obj/head_F.mtl", function(object) {
			object.position.y -= 0.7;
			object.scale.set(2.2, 2.2, 2.2);
			object.rotation.y += Math.PI;
			views[0].camera.add(object);
			femaleHead = object;
			femaleHead.visible = false;

			var loader = new THREE.OBJLoader();
			loader.load("assets/obj/head_M.obj", function(object) {
				object.scale.set(0.015, 0.015, 0.015);
				object.rotation.y += Math.PI;
				views[0].camera.add(object);
				maleHead = object;
				maleHead.visible = false;
				onLoad();
			});
		});
	}

	function loadSubject(subject, onLoad) {

		if (typeof subject.hrtfContainer == "undefined") {
			subject.hrtfContainer = new HRTFContainer();
			subject.hrtfContainer.loadHrir(hrirFilenameFromId(subject.id), onLoad);
		}
		else
			onLoad();

		for (var key in subject)
			currentSubject[key] = subject[key];
		if (subject.name == 'F') {
			femaleHead.visible = true;
			maleHead.visible = false;
		}
		else {
			femaleHead.visible = false;
			maleHead.visible = true;
		}
	}

	function loadSubjectsData() {

		var oReq = new XMLHttpRequest();
		oReq.open("GET", "HRTF/CIPIC/anthro.txt", true);
		oReq.onreadystatechange = function() {
			if (oReq.readyState === 4) {
				var lines = oReq.responseText.split('\n');
				for (var i = 1; i < lines.length; ++i) {
					var tokens = lines[i].split(';');
					subjects.push({
						id: tokens[0],
						name: tokens[1],
						headWidth: tokens[2],
						headHeight: tokens[3],
						headDepth: tokens[4]
					});
				}
				loadSubject(subjects[0], function() {
					initAudio();
					initGUI();
					currentSubjectIndex = 0;
				});

			}
		}
		oReq.send();
	}

	function animate() {

		requestAnimationFrame(animate);
		render();
		update();
	}

	var t = 0;
	function animateSource() {

		var R = 1;
		orbiter.lookAt(scene.position);
		if (pattern == 1) {
			orbiter.position.x = R * Math.cos(t);
			orbiter.position.y = 0;
			orbiter.position.z = R * Math.sin(t);
		}
		else if (pattern == 2) {
			orbiter.position.x = 0;
			orbiter.position.y = R * Math.cos(t);
			orbiter.position.z = R * Math.sin(t);
		}
		else if (pattern == 3) {
			orbiter.position.x = R * Math.sin(t) * Math.cos(t);
			orbiter.position.y = R * Math.cos(t) * Math.cos(t);
			orbiter.position.z = R * Math.sin(t);
		}
		t += orbitSpeed;
	}

	function update() {

		controls.update(clock.getDelta());
		stats.update();
		updateSize();
		animateSource();
	}

	function updatePanner() {
		
		// calculate source position relative to the listener (camera)
		var mInverse = new THREE.Matrix4().getInverse(povCamera.matrixWorld);
		var sourcePos = orbiter.position.clone();
		sourcePos.applyMatrix4(mInverse);
		var cords = cartesianToInteraural(sourcePos.x, -sourcePos.z, sourcePos.y);
		panner.update(cords.azm, cords.elv);
	}
	
	function updateSize() {

		if (windowWidth != window.innerWidth || windowHeight != window.innerHeight) {

			windowWidth = window.innerWidth;
			windowHeight = window.innerHeight;

			renderer.setSize(windowWidth, windowHeight);
		}
	}

	function render() {

		for (var i = 0; i < views.length; ++i) {

			view = views[i];
			camera = view.camera;

			var left = Math.floor(window.innerWidth * view.left);
			var bottom = Math.floor(window.innerHeight * view.bottom);
			var width = Math.floor(window.innerWidth * view.width);
			var height = Math.floor(window.innerHeight * view.height);
			renderer.setViewport(left, bottom, width, height);
			renderer.setScissor(left, bottom, width, height);
			renderer.enableScissorTest(true);
			renderer.setClearColor(view.background);

			camera.aspect = width / height;
			camera.updateProjectionMatrix();

			renderer.render(scene, camera);
		}

	}
}