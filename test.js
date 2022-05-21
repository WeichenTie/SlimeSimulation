
const vRenderShader = `#version 300 es
    in vec2 aPosition;

    void main() {
        gl_Position = vec4(aPosition, 0.0,1 );
    }
    `
const fRenderShader = `#version 300 es
    precision highp float;
    out vec4 fragColor;

    void main() {
        fragColor = vec4(1,1,1,1);
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
        console.log(l);
        gl.enableVertexAttribArray(l.location);
        gl.vertexAttribPointer(l.location, l.size, l.type, l.normalize, l.stride, l.offset);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    //gl.bindVertexArray(null);
}
// get canvas and gl context
const canvas = document.getElementById('gl-canvas');
const gl = canvas.getContext('webgl2');
gl.canvas.width = 800;
gl.canvas.height = 600;
gl.viewport(0, 0, 800, 600);

const renderProg = createProgram(gl, vRenderShader, fRenderShader, null);
const renderProgLocs = {
    position: gl.getAttribLocation(renderProg, 'aPosition'),
    textCoords: gl.getAttribLocation(renderProg, 'aTexCoords'),
    //uTexture: gl.getUniformLocation(renderProg, 'uTexture')
}

const renderLayout = [
    { location: renderProgLocs.position, size: 2, type: gl.FLOAT, normalize: false, stride: 0, offset: 0 }
]

console.log(renderLayout);
const renderVAO = createVAO(gl);
const renderVBO = createBuffer(gl, gl.ARRAY_BUFFER, 
    new Float32Array([
    0, 0,
    0,  0.5,
    0.7,  0
]), gl.STATIC_DRAW);
vaoAddBuffer(gl, renderVAO, renderVBO, renderLayout);


// Pre-render setup
gl.clearColor(0,0,0,1);
function render() {
    gl.clearColor(0.5,0.5,0.5,1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(renderProg);
    gl.bindVertexArray(renderVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    requestAnimationFrame(render);
}

render();
console.log('done');
