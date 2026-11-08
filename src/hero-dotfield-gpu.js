/** Continuous translucent engineering surfaces, rendered with one GPU submission. */
function createHeroDotfieldGpu(canvas) {
  const gl = canvas.getContext('webgl2', {alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  if (!gl || typeof gl.createShader !== 'function') return null;
  let program, vertex, fragment, vao;
  try {
    const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;};
    vertex=compile(gl.VERTEX_SHADER,`#version 300 es
precision highp float;
const vec2 QUAD[6]=vec2[6](vec2(-1.,-1.),vec2(1.,-1.),vec2(-1.,1.),vec2(-1.,1.),vec2(1.,-1.),vec2(1.,1.));
void main(){gl_Position=vec4(QUAD[gl_VertexID],0.,1.);}
`);
    fragment=compile(gl.FRAGMENT_SHADER,`#version 300 es
precision highp float;
uniform vec2 uViewport;
uniform float uInk,uScale;
uniform vec4 uLayers[4];
uniform vec4 uOpacity;
uniform vec2 uPointer;
uniform int uWaveCount;
uniform vec4 uWaves[6];
out vec4 outColor;
void main(){
  vec2 p=vec2(gl_FragCoord.x/uScale,uViewport.y-gl_FragCoord.y/uScale);
  float alpha=0.;
  for(int i=0;i<4;i++){
    vec4 layer=uLayers[i];
    float depth=i==0?3.:i==1?7.:i==2?12.:18.;
    layer.xy+=uPointer*vec2(depth,depth*.75);
    float d=(abs(p.x-layer.x)+abs(p.y-layer.y)-layer.z)*.70710678;
    float aa=max(fwidth(d),.25);
    float face=smoothstep(-layer.w-aa,-layer.w+aa,d)*(1.-smoothstep(-aa,aa,d));
    float outer=1.-smoothstep(.35,.35+aa,abs(d));
    float inner=1.-smoothstep(.2,.2+aa,abs(d+layer.w));
    float a=face*uOpacity[i]+outer*(.12+float(i)*.025)+inner*.075;
    alpha=1.-(1.-alpha)*(1.-a);
  }
  float pulse=0.;
  for(int i=0;i<6;i++){
    if(i>=uWaveCount)break;
    float delta=length(p-uWaves[i].xy)-uWaves[i].z;
    pulse+=(exp(-.5*pow(delta/2.3,2.))*.12+exp(-.5*pow((delta+30.)/2.,2.))*.035)*uWaves[i].w;
  }
  alpha=min(.7,alpha+pulse);
  outColor=vec4(vec3(uInk)*alpha,alpha);
}
`);
    program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.useProgram(program);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
    const names=['uViewport','uScale','uInk','uLayers[0]','uOpacity','uPointer','uWaveCount','uWaves[0]'];
    const uniforms=Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(program,name)]));
    const waveValues=new Float32Array(24);
    return {
      resize(width,height,pitch,dotSize,dark){
        gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);
        const layers=heroDiamondLayers(width,height);
        gl.uniform2f(uniforms.uViewport,width,height);gl.uniform1f(uniforms.uScale,canvas.width/width);
        gl.uniform1f(uniforms.uInk,dark?212/255:82/255);
        gl.uniform4fv(uniforms['uLayers[0]'],new Float32Array(layers.flatMap(l=>[l.x,l.y,l.radius,l.band])));
        gl.uniform4fv(uniforms.uOpacity,new Float32Array(layers.map(l=>l.alpha)));
      },
      draw(waves,now,pointer={x:0,y:0}){
        if(gl.isContextLost())return;
        waveValues.fill(0);
        for(let i=0;i<waves.length;i++){const w=waves[i],age=now-w.started;waveValues.set([w.x,w.y,age*.62,Math.exp(-age/1400)],i*4);}
        gl.useProgram(program);gl.bindVertexArray(vao);gl.uniform2f(uniforms.uPointer,pointer.x,pointer.y);gl.uniform1i(uniforms.uWaveCount,waves.length);gl.uniform4fv(uniforms['uWaves[0]'],waveValues);
        gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,6);
      },
      dispose(){gl.deleteVertexArray(vao);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);gl.getExtension('WEBGL_lose_context')?.loseContext();},
    };
  }catch{if(vao)gl.deleteVertexArray(vao);if(program)gl.deleteProgram(program);if(vertex)gl.deleteShader(vertex);if(fragment)gl.deleteShader(fragment);gl.getExtension('WEBGL_lose_context')?.loseContext();return null;}
}
