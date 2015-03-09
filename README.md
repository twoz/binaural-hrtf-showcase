# HRTF-Test
A showcase for the binaural audio using [Head Related Transform Functions](http://en.wikipedia.org/wiki/Head-related_transfer_function) (HRTF). This projects uses Web Audio API for audio and three.js for graphics.

Creating binaural sound by panning a sound source using HRTF allows to position the sound in the 3D space with realistic results that can't be achieved using other techniques.

Since each every human's head is geometrically different, different HRTFs gives worse or better results for different people. Here You can choose (in real-time) from 45 different HRTFs from [CIPIC Database](http://interface.cipic.ucdavis.edu/sound/hrtf.html) (will add more databases in the future).

#### HRTFContainer
This class is loads basic info on all the subjects from the file, then loads HRIRs (Head Related Impulse Response) from .bin files (each IR is of length 200, 32-bit float) and is responsible for returning the respective impulse response based on the given coordinates (in [Interaural-Polar Coordinate system](http://interface.cipic.ucdavis.edu/sound/tutorial/psych.html#coord)). Because HRTFs are recorded at sparse points, some kind of interpolation of must be done in order to achieve a continous binaural sound for a moving source.
I'm using the method proposed [here](http://scitation.aip.org/content/asa/journal/jasa/134/6/10.1121/1.4828983). For the triangulation, I used [delaunay.js](https://github.com/ironwallaby/delaunay). 

#### HRTFPanner
This class (defined in hrtf.js) takes a mono source and outputs a stereo, binaural signal, based on the relative position (angle) between the source and listener. This simply involves a process of convolution of the mono source with HRIR (Head Related Impulse Response) for left and right ear, respectively. The corresponding HRIRs are obtained from an instance of of HRTFContainer object at each update call.

Convolution is performed using Convolver Nodes from the Web Audio API. Two Biquad filters acts as a crossover (in order to compensate for the unnatural filtering of low frequencies by HRTF). 

My current goal is to make the HRTFPanner (and HRTFContainer) class being used as an ordinary Audio Node from the Web Audio API, in-place for the currently not-existent native browser's implementation.

Todo: 
- interpolation function optimization
- currently HRTFPanner uses three.js objects interfaces, this needs to be changed to not be dependent on any external libraries
