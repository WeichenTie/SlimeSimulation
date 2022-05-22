// updatePosition shaders
const dat = require('./gui/dat.gui');
const vAgentShader = `#version 300 es
    in vec2 oldPosition;
    in float oldAngle;

    uniform vec2 canvasDimensions;
    uniform mat4 uMVP;
    uniform sampler2D uTexture;

    out vec2 newPosition;
    out float newAngle;



    vec2 euclideanModulo(vec2 n, vec2 m) {
        return mod(mod(n, m) + m, m);
    }

    float getDensestAngle(sampler2D heatMap, vec2 position, float angle, float sensAngle, float sensDist, float numRays, float samplesPerRay) {
        float angleOffset = sensAngle / numRays;
        
        float leftAngle = 0.0;
        float midAngle = 0.0;
        float rightAngle = 0.0;
        
        float startAngle = angle - sensAngle / 2.0;
        float leftThreshold = startAngle + sensAngle / 3.0;
        float midThreshold = startAngle + sensAngle / 1.5;
        float rightThreshold = sensAngle;

        float currentRayAngle = startAngle;
        while (currentRayAngle < leftThreshold) {
            vec2 rayVec = vec2(sensDist * cos(currentRayAngle), sensDist * sin(currentRayAngle));
            vec2 raySegment = rayVec / samplesPerRay;
            vec2 currentSeg = position;
            for (int i = 0; i < int(samplesPerRay); ++i) {
                vec4 texCoord = (uMVP * vec4(currentSeg, 0, 1) + 1.0) / 2.0;
                vec4 sampledTex = texture(uTexture, vec2(texCoord.xy));
                leftAngle += sampledTex.x;
                currentSeg += raySegment;
            }
            currentRayAngle += angleOffset;
        }
        while (currentRayAngle < midThreshold) {
            vec2 rayVec = vec2(sensDist * cos(currentRayAngle), sensDist * sin(currentRayAngle));
            vec2 raySegment = rayVec / samplesPerRay;
            vec2 currentSeg = position;
            for (int i = 0; i < int(samplesPerRay); ++i) {
                vec4 texCoord = (uMVP * vec4(currentSeg, 0, 1) + 1.0) / 2.0;
                vec4 sampledTex = texture(uTexture, vec2(texCoord.xy));
                midAngle += sampledTex.x;
                currentSeg += raySegment;
            }
            currentRayAngle += angleOffset;
        }
        while (currentRayAngle <= rightThreshold) {
            vec2 rayVec = vec2(sensDist * cos(currentRayAngle), sensDist * sin(currentRayAngle));
            vec2 raySegment = rayVec / samplesPerRay;
            vec2 currentSeg = position;
            for (int i = 0; i < int(samplesPerRay); ++i) {
                vec4 texCoord = (uMVP * vec4(currentSeg, 0, 1) + 1.0) / 2.0;
                vec4 sampledTex = texture(uTexture, vec2(texCoord.xy));
                rightAngle += sampledTex.x;
                currentSeg += raySegment;
            }
            currentRayAngle += angleOffset;
        }

        if (midAngle >= leftAngle && midAngle >= rightAngle) {
            return angle;
        }
        else if (leftAngle > rightAngle) {
            return startAngle + sensAngle / 6.0;
        }
        else {
            return startAngle + 5.0 * sensAngle / 6.0;
        }
        return currentRayAngle;
    }

    void main() {
        newAngle = oldAngle;
        float densestAngle = getDensestAngle(uTexture, oldPosition, oldAngle, 3.141592653, 10.0, 10.0, 10.0);
        newPosition = euclideanModulo(
            oldPosition + 1.0 * vec2(cos(densestAngle), sin(densestAngle)),
            canvasDimensions);
        gl_PointSize = 1.0;
        gl_Position = uMVP * vec4(newPosition, 0 , 1);
    }
`
const fAgentShader = `#version 300 es
    precision highp float;
    in vec2 newPosition;
    in float newAngle; 

    out vec4 fragColor;
    void main() {
        fragColor = vec4(0.7647,0.69411,0.88235,1);
    }
`
// updatePheromone shaders
// This shader will blur results and then add in the new updated position on to texture 2d
const vPheromoneShader = `#version 300 es
    in vec2 aTexCoords;
    in vec2 aPosition;

    out vec2 fTexCoords;

    void main() {
        gl_Position = vec4(aPosition, 0.0, 1);
        fTexCoords = aTexCoords;
    }
`
const fPheromoneShader = `#version 300 es
    precision highp float;
    in vec2 fTexCoords;
    
    uniform sampler2D uTexture;

    out vec4 fragColor;

    void main() {
        vec4 texColor = texture(uTexture, fTexCoords);
        fragColor =  vec4(texColor.xyz - 0.01, 1.0);
    }
`
// render slime shaders
// This shader will render the results of that texture 2d
const vRenderShader = `#version 300 es
    in vec2 aTexCoords;
    in vec2 aPosition;
    
    out vec2 fTexCoords;

    void main() {
        gl_Position = vec4(aPosition, 0.0, 1);
        fTexCoords = aTexCoords;
    }
    `
const fRenderShader = `#version 300 es
    precision highp float;
    in vec2 fTexCoords;
    
    uniform sampler2D uTexture;

    out vec4 fragColor;

    void main() {
        fragColor = texture(uTexture, fTexCoords);
    }
`

// Code to create a program and shader
function createShader(gl, shaderSrc, shaderType) {
    const shader = gl.createShader(shaderType);
    gl.shaderSource(shader, shaderSrc);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
}


function createProgram(gl, vShaderSrc, fShaderSrc, transformFeedbackVaryings) {
    const program = gl.createProgram();
    const vShader = createShader(gl, vShaderSrc, gl.VERTEX_SHADER);
    const fShader = createShader(gl, fShaderSrc, gl.FRAGMENT_SHADER);
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);

    if (transformFeedbackVaryings != null) {
        gl.transformFeedbackVaryings(program, transformFeedbackVaryings, gl.INTERLEAVED_ATTRIBS);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramParameter(program));
    }
    gl.deleteShader(vShader);
    gl.deleteShader(fShader);
    return program;
}

function createBuffer(gl, type, data, usage) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(type, buffer);
    gl.bufferData(type, data, usage);
    gl.bindBuffer(type, null);
    return buffer;
}

function createVAO(gl) {
    return gl.createVertexArray();
}

function vaoAddBuffer(gl, vao, vbo, layout) {
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    for (let l of layout) {
        gl.enableVertexAttribArray(l.location);
        gl.vertexAttribPointer(l.location, l.size, l.type, l.normalize, l.stride, l.offset);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
}

function createTexture2D(gl, texI) {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + texI);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // Set filtering
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    return texture;
}

function createTransformFeedback(gl, buffer) {
    const tf = gl.createTransformFeedback();
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buffer);
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
    return tf;
}

// get canvas and gl context
/** @type {HTMLCanvasElement} */
const canvas = document.getElementById('gl-canvas');
const gl = canvas.getContext('webgl2');
gl.canvas.width = 2560;
gl.canvas.height = 1440;
gl.viewport(0, 0, canvas.width, canvas.height);
// Create Programs
const updateAgentProg = createProgram(gl, vAgentShader, fAgentShader, ['newPosition', 'newAngle']);

// Get the attibute and uniform locations of programs
const updateAgentProgLocs = {
    oldPosition: gl.getAttribLocation(updateAgentProg, 'oldPosition'),
    oldAngle: gl.getAttribLocation(updateAgentProg, 'oldAngle'),
    uMVP: gl.getUniformLocation(updateAgentProg, 'uMVP'),
    // deltaTime: gl.getUniformLocation(updateAgentProg, 'deltaTime'),
    // velocity: gl.getUniformLocation(updateAgentProg, 'velocity'),
    canvasDimensions: gl.getUniformLocation(updateAgentProg, 'canvasDimensions'),
    //sensor: gl.getUniformLocation(updateAgentProg, 'uSensor'),
    uTexture: gl.getUniformLocation(updateAgentProg, 'uTexture')
}

// load in the agents
const numAgents = 100000;
const agentsArr = [];
for (let i = 0; i < numAgents; i++) {
    agentsArr.push(Math.random() * canvas.width);
    agentsArr.push(Math.random() * canvas.height);
    agentsArr.push(Math.random() * Math.PI * 2);
}

// Create agents VBO
const agentsVBO1 = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(agentsArr), gl.DYNAMIC_DRAW);
const agentsVBO2 = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(agentsArr), gl.DYNAMIC_DRAW);

// Create the agent layout
const agentLayout = [
    { location: updateAgentProgLocs.oldPosition, size: 2, type: gl.FLOAT, normalize: false, stride: 4 * 3, offset: 0 },
    { location: updateAgentProgLocs.oldAngle, size: 1, type: gl.FLOAT, normalize: false, stride: 4 * 3, offset: 4 * 2}
]

// Create VAOs
const updateAgentVAO1 = createVAO(gl);
vaoAddBuffer(gl, updateAgentVAO1, agentsVBO1, agentLayout);
const updateAgentVAO2 = createVAO(gl);
vaoAddBuffer(gl, updateAgentVAO2, agentsVBO2, agentLayout);
// Transform feedback buffer
const agentTF1 = createTransformFeedback(gl, agentsVBO1);
const agentTF2 = createTransformFeedback(gl, agentsVBO2);

// Buffer that covers the viewport
const viewportVBO = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array([
    -1.0, -1.0,     0, 0,
    -1.0,  1.0,     0, 1,
    1.0,  1.0,     1, 1,
    1.0,  1.0,     1, 1,
    1.0, -1.0,     1, 0,
    -1.0, -1.0,     0, 0
]), gl.STATIC_DRAW);


// Pheromones Buffers and Objects
const updatePheromoneProg = createProgram(gl, vPheromoneShader, fPheromoneShader, null);
const updatePheromoneVAO = createVAO(gl);
const updatePheromoneProgLocs = {
    position: gl.getAttribLocation(updatePheromoneProg, 'aPosition'),
    textCoords: gl.getAttribLocation(updatePheromoneProg, 'aTexCoords'),
    uTexture: gl.getUniformLocation(updatePheromoneProg, 'uTexture')
}
const updatePheromoneLayout = [
    { location: updatePheromoneProgLocs.position, size: 2, type: gl.FLOAT, normalize: false, stride: 4 * 4, offset: 0 },
    { location: updatePheromoneProgLocs.textCoords, size: 2, type: gl.FLOAT, normalize: false, stride: 4 * 4, offset: 4 * 2}
]
vaoAddBuffer(gl, updatePheromoneVAO, viewportVBO, updatePheromoneLayout);

// Textures to render pheromones on
gl.activeTexture(gl.TEXTURE0, 0);
const pheromonesTex1 = createTexture2D(gl, 0);

// Create Render buffer
const renderbuffer = gl.createRenderbuffer();
gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
gl.renderbufferStorageMultisample(gl.RENDERBUFFER, 4, gl.RGBA8, canvas.width, canvas.height);

// Create frame buffer object
const frameRenderBuffer = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, frameRenderBuffer);
gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, renderbuffer, 0);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

const frameColorBuffer = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, frameColorBuffer);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pheromonesTex1, 0);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);


// Create Rendering buffers and objects

const renderProg = createProgram(gl, vRenderShader, fRenderShader, null);
const renderProgLocs = {
    position: gl.getAttribLocation(renderProg, 'aPosition'),
    textCoords: gl.getAttribLocation(renderProg, 'aTexCoords'),
    uTexture: gl.getUniformLocation(renderProg, 'uTexture')
}
const renderLayout = [
    { location: renderProgLocs.position, size: 2, type: gl.FLOAT, normalize: false, stride: 4 * 4, offset: 0 },
    { location: renderProgLocs.textCoords, size: 2, type: gl.FLOAT, normalize: false, stride: 4 * 4, offset: 4 * 2}
]

const renderVAO = createVAO(gl);
vaoAddBuffer(gl, renderVAO, viewportVBO, renderLayout);


////////////////////////////////////////////////////////////////
//                         GUI
////////////////////////////////////////////////////////////////
GUI

// Pre-render setup
gl.clearColor(0,0,0,1);
//gl.enable(gl.BLEND);
//gl.blendFunc(gl.SRC_ALPHA, gl.DST_ALPHA);

let current = {
    updateVA: updateAgentVAO1,  // read from position1
    tf: agentTF2,                      // write to position2
    //drawVA: drawVA2,              // draw with position2
  };
let next = {
    updateVA: updateAgentVAO2,  // read from position2
    tf: agentTF1,                      // write to position1
    //drawVA: drawVA1,              // draw with position1
};
let then = 0;
let iterations = 1;
function render(time) {
    // convert to seconds
    time *= 0.001;
    // Subtract the previous time from the current time
    const deltaTime = time - then;
    // Remember the current time for the next frame.
    then = time;
    // Update Agents
    // Setup frame buffer
    for (let i = 0; i < iterations; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameRenderBuffer);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.colorMask(true, true, true, true);
        gl.clearColor(0,0,0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // TODO: Update phero texture
        gl.useProgram(updatePheromoneProg);
        gl.bindVertexArray(updatePheromoneVAO);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
    
        // UPDATE AGENTs
    
        gl.useProgram(updateAgentProg);
        gl.bindVertexArray(current.updateVA);
        gl.uniform2f(updateAgentProgLocs.canvasDimensions, gl.canvas.width, gl.canvas.height)
        gl.uniformMatrix4fv(
            updateAgentProgLocs.uMVP,
            false,
            m4.orthographic(0, canvas.width, 0, canvas.height, -1, 1)
        );
        gl.uniform1i(updateAgentProgLocs.uTexture, 0);
    
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, current.tf);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, numAgents);
        gl.endTransformFeedback();
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, frameRenderBuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, frameColorBuffer);
        gl.clearBufferfv(gl.COLOR, 0, [0.0, 0.0, 0.0, 1.0]);
        gl.blitFramebuffer(
            0, 0, canvas.width, canvas.height,
            0, 0, canvas.width, canvas.height,
            gl.COLOR_BUFFER_BIT, gl.NEAREST
        );
    }
    // Render phero texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0,0,0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(renderProg);
    
    gl.bindVertexArray(renderVAO);
    gl.uniform1i(renderProgLocs.uTexture, 0);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    {
        const temp = current;
        current = next;
        next = temp;
    }
    requestAnimationFrame(render);
}

render();
console.log('done');


// Update position -> 