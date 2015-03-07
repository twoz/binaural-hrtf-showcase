# HRTF-Test
A showcase for the binaural audio using Head Related Transform Functions (HRTF). 

Creating binaural sound by panning a sound source using HRTF allows to position the sound in the 3D space with realistic results that can't be achieved using other techniques.

Since each every human's head is geometrically different, different HRTFs gives worse or better results for different people. Here You can choose (in real-time) from 45 different HRTFs from [CIPIC Database](http://interface.cipic.ucdavis.edu/sound/hrtf.html) (will add more databases in the future).

Because HRTFs are recorded at sparse points, some kind of interpolation must be done in order to achieve a continous binaural sound for a moving source.
I'm using the method proposed [here](http://scitation.aip.org/content/asa/journal/jasa/134/6/10.1121/1.4828983).
This projects uses Web Audio API for audio.
