// updatePosition shaders
const vAgentShader = `#version 300 es
    in vec2 oldPosition;
    in float oldAngle;

    //uniform float deltaTime;
    //uniform float velocity;
    //uniform vec2 canvasDimensions;
    uniform mat4 uMVP;

    out vec2 newPosition;
    out float newAngle;
    void main() {
        newPosition = oldPosition;
        newAngle = oldAngle;
        
        gl_PointSize = 10.0;
        gl_Position =  uMVP* vec4(oldPosition, 0, 1);
    }
`
const fAgentShader = `#version 300 es
    precision highp float;
    in vec2 newPosition;
    in float newAngle; 

    out vec4 fragColor;
    void main() {
        fragColor = vec4(1,1,1,1);
    }
`
// updatePheromone shaders
// This shader will blur results and then add in the new updated position on to texture 2d
const vPheromoneShader = `#version 300 es
    in vec2 aTexCoords;
    in vec2 aPosition;

    out vec2 fTexCoords;

    void main() {
        gl_PointSize = 10.0;
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
        fragColor = texture(uTexture, fTexCoords) * 0.7;
    }
`
// render slime shaders
// This shader will render the results of that texture 2d
const vRenderShader = `#version 300 es
    in vec2 aTexCoords;
    in vec2 aPosition;
    
    out vec2 fTexCoords;

    void main() {
        gl_PointSize = 10.0;
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
        gl.transformFeedbackVaryings(program, transformFeedbackVaryings, gl.SEPARATE_ATTRIBS)
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

function createTexture2D(gl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // Set filtering
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
}

// get canvas and gl context
const canvas = document.getElementById('gl-canvas');
const gl = canvas.getContext('webgl2');
gl.canvas.width = 800;
gl.canvas.height = 600;
gl.viewport(0, 0, 800, 600);
// Create Programs
const updateAgentProg = createProgram(gl, vAgentShader, fAgentShader, null )//['newPosition', 'newAngle']);
//const updatePheromoneProg = createProgram(gl, vPheromoneShader, fPheromoneShader, null);


// Get the attibute and uniform locations of programs
const updateAgentProgLocs = {
    oldPosition: gl.getAttribLocation(updateAgentProg, 'oldPosition'),
    oldAngle: gl.getAttribLocation(updateAgentProg, 'oldAngle'),
    uMVP: gl.getUniformLocation(updateAgentProg, 'uMVP')
}


// load in the agents
const numAgents = 200;
const agentsArr = [];
for (let i = 0; i < numAgents; i++) {
    agentsArr.push(Math.random() * canvas.width);
    agentsArr.push(Math.random() * canvas.height);
    agentsArr.push(Math.random());
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

//const renderVAO1()


// Textures to render pheromones on
gl.activeTexture(gl.TEXTURE0);
const pheromonesTex1 = createTexture2D(gl);
gl.activeTexture(gl.TEXTURE1);
const pheromonesTex2 = createTexture2D(gl);

// Create frame buffer object
const frameBuffer = gl.createFramebuffer();

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
const renderVBO = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array([
    -1.0, -1.0,     0, 0,
    -1.0,  1.0,     0, 1,
     1.0,  1.0,     1, 1,
     1.0,  1.0,     1, 1,
     1.0, -1.0,     1, 0,
    -1.0, -1.0,     0, 0
]), gl.STATIC_DRAW);
vaoAddBuffer(gl, renderVAO, renderVBO, renderLayout);


// Pre-render setup
gl.clearColor(0,0,0,1);
function render() {
    
    // Update Agents
    // Setup frame buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, pheromonesTex1, 0);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(updateAgentProg);
    gl.bindVertexArray(updateAgentVAO1);
    gl.uniformMatrix4fv(
        updateAgentProgLocs.uMVP,
        false,
        m4.orthographic(0, canvas.width, 0, canvas.height, -1, 1)
    );
    gl.drawArrays(gl.POINTS, 0, numAgents);
    // TODO: Update phero texture
        
    // Render phero texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0.5,0.5,0.5,1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(renderProg);
    
    gl.bindVertexArray(renderVAO);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, pheromonesTex1);
    gl.uniform1i(renderProgLocs.uTexture, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
}

render();
console.log('done');
