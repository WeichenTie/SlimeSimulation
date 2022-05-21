'use strict';

/* eslint no-alert: 0 */

function main() {
  const updatePositionVS = `#version 300 es
  in vec2 oldPosition;
  in vec2 velocity;

  uniform float deltaTime;
  uniform vec2 canvasDimensions;
  uniform mat4 matrix;

  out vec2 newPosition;

  vec2 euclideanModulo(vec2 n, vec2 m) {
  	return mod(mod(n, m) + m, m);
  }

  void main() {
    newPosition = euclideanModulo(
        oldPosition + velocity * deltaTime * 0.05,
        canvasDimensions);
    gl_PointSize = 20.0;
    gl_Position = matrix * vec4(newPosition, 0 , 1);
  }
  `;

  const updatePositionFS = `#version 300 es
  precision highp float;
  out vec4 fragColor;
  void main() {
    fragColor = vec4(0,0,0,1);
  }
  `;

  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#gl-canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    return;
  }
  function createShader(gl, type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  function createProgram(gl, shaderSources, transformFeedbackVaryings) {
    const program = gl.createProgram();
    [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER].forEach((type, ndx) => {
      const shader = createShader(gl, type, shaderSources[ndx]);
      gl.attachShader(program, shader);
    });
    if (transformFeedbackVaryings) {
      gl.transformFeedbackVaryings(
          program,
          transformFeedbackVaryings,
          gl.SEPARATE_ATTRIBS,
      );
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramParameter(program));
    }
    return program;
  }

  const updatePositionProgram = createProgram(
      gl, [updatePositionVS, updatePositionFS], ['newPosition']);

  const updatePositionPrgLocs = {
    oldPosition: gl.getAttribLocation(updatePositionProgram, 'oldPosition'),
    velocity: gl.getAttribLocation(updatePositionProgram, 'velocity'),
    canvasDimensions: gl.getUniformLocation(updatePositionProgram, 'canvasDimensions'),
    deltaTime: gl.getUniformLocation(updatePositionProgram, 'deltaTime'),
    matrix: gl.getUniformLocation(updatePositionProgram, 'matrix'),
  };

  // we're going to base the initial positions on the size
  // of the canvas so lets update the size of the canvas
  // to the initial size we want
  webglUtils.resizeCanvasToDisplaySize(gl.canvas);

  // create random positions and velocities.
  const rand = (min, max) => {
    if (max === undefined) {
      max = min;
      min = 0;
    }
    return Math.random() * (max - min) + min;
  };
  const numParticles = 200;
  const createPoints = (num, ranges) =>
     new Array(num).fill(0).map(_ => ranges.map(range => rand(...range))).flat();
  const positions = new Float32Array(createPoints(numParticles, [[canvas.width], [canvas.height]]));
  const velocities = new Float32Array(createPoints(numParticles, [[-300, 300], [-300, 300]]));

  function makeBuffer(gl, sizeOrData, usage) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, sizeOrData, usage);
    return buf;
  }

  const position1Buffer = makeBuffer(gl, positions, gl.DYNAMIC_DRAW);
  const position2Buffer = makeBuffer(gl, positions, gl.DYNAMIC_DRAW);
  const velocityBuffer = makeBuffer(gl, velocities, gl.STATIC_DRAW);

  function makeVertexArray(gl, bufLocPairs) {
    const va = gl.createVertexArray();
    gl.bindVertexArray(va);
    for (const [buffer, loc] of bufLocPairs) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(
          loc,      // attribute location
          2,        // number of elements
          gl.FLOAT, // type of data
          false,    // normalize
          0,        // stride (0 = auto)
          0,        // offset
      );
    }
    return va;
  }

  const updatePositionVA1 = makeVertexArray(gl, [
    [position1Buffer, updatePositionPrgLocs.oldPosition],
    [velocityBuffer, updatePositionPrgLocs.velocity],
  ]);
  const updatePositionVA2 = makeVertexArray(gl, [
    [position2Buffer, updatePositionPrgLocs.oldPosition],
    [velocityBuffer, updatePositionPrgLocs.velocity],
  ]);

  function makeTransformFeedback(gl, buffer) {
    const tf = gl.createTransformFeedback();
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buffer);
    return tf;
  }

  const tf1 = makeTransformFeedback(gl, position1Buffer);
  const tf2 = makeTransformFeedback(gl, position2Buffer);

  // unbind left over stuff
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);

  let current = {
    updateVA: updatePositionVA1,  // read from position1
    tf: tf2,                      // write to position2
  };
  let next = {
    updateVA: updatePositionVA2,  // read from position2
    tf: tf1,                      // write to position1
  };

  let then = 0;
  function render(time) {
    // convert to seconds
    time *= 0.001;
    // Subtract the previous time from the current time
    const deltaTime = time - then;
    // Remember the current time for the next frame.
    then = time;

    webglUtils.resizeCanvasToDisplaySize(gl.canvas);

    gl.clear(gl.COLOR_BUFFER_BIT);

    // compute the new positions
    gl.useProgram(updatePositionProgram);
    gl.bindVertexArray(current.updateVA);
    gl.uniform2f(updatePositionPrgLocs.canvasDimensions, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(updatePositionPrgLocs.deltaTime, deltaTime);

    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, current.tf);
    gl.beginTransformFeedback(gl.POINTS);
    gl.uniformMatrix4fv(
        updatePositionPrgLocs.matrix,
        false,
        m4.orthographic(0, gl.canvas.width, 0, gl.canvas.height, -1, 1));
    gl.drawArrays(gl.POINTS, 0, numParticles);
    gl.endTransformFeedback();
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    {
        const temp = current;
        current = next;
        next = temp;
      }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();
