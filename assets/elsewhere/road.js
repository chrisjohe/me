export function mountRoad(field) {
  const canvas = field.querySelector('canvas');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
  const fallback = field.querySelector('.elsewhere-road-fallback');
  const unavailable = { setPaused() {} };
  if (!gl) {
    fallback.hidden = false;
    return unavailable;
  }

  const clock = new Animation(new KeyframeEffect(null, [], { duration: 3600000, iterations: Infinity }), document.timeline);
  clock.currentTime = 18000;
  let visible = false;
  let paused = false;
  let pageActive = true;
  let frame = 0;
  let lost = false;
  let light = document.documentElement.dataset.theme === 'light';
  let scene;
  let glowA;
  let glowB;
  let pixelWidth = 0;
  let pixelHeight = 0;
  let seed = 7321;

  const projection = `
    uniform float uTime;
    uniform float uAspect;
    varying float vDistance;
    float roadX(float z) {
      float phase = uTime * 0.54;
      return 24.0 * sin(z * 0.019 + phase) + 7.0 * sin(z * 0.045 - phase * 0.7);
    }
    float roadY(float z) {
      return 5.0 * sin(z * 0.024 + uTime * 0.22);
    }
    vec4 project(vec3 p) {
      float depth = p.z + 5.0;
      float look = (roadX(22.0) - roadX(6.0)) * 0.004;
      p.x += roadX(p.z) - roadX(6.0) - look * depth;
      p.y += roadY(p.z) - roadY(6.0) - 8.0 + 0.015 * depth;
      vDistance = p.z;
      return vec4(p.x / uAspect, p.y, depth * 1.004 - 1.603, depth);
    }
  `;

  const roadVertex = `
    attribute vec3 aPosition;
    varying vec2 vRoad;
    ${projection}
    void main() {
      vRoad = aPosition.xz;
      gl_Position = project(aPosition);
    }
  `;

  const roadFragment = `
    uniform float uTime;
    uniform float uLight;
    varying vec2 vRoad;
    varying float vDistance;
    void main() {
      float across = abs(vRoad.x) - 1.0;
      float outside = 1.0 - smoothstep(0.025, 0.10, abs(across - 9.7));
      float inside = 1.0 - smoothstep(0.025, 0.10, abs(across - 0.3));
      float lane = min(abs(across - 3.333), abs(across - 6.667));
      float dashes = step(0.53, fract((vRoad.y + uTime * 120.0) / 15.0));
      float line = max(max(outside, inside), (1.0 - smoothstep(0.025, 0.075, lane)) * dashes);
      vec3 asphalt = mix(vec3(0.025, 0.025, 0.032), vec3(0.70, 0.71, 0.72), uLight);
      vec3 paint = mix(vec3(0.12, 0.13, 0.17), vec3(0.48, 0.49, 0.53), uLight);
      float fog = 1.0 - smoothstep(150.0, 400.0, vDistance);
      gl_FragColor = vec4(mix(asphalt, paint, line), (0.22 + line * 0.32) * fog);
    }
  `;

  const trailVertex = `
    attribute vec3 aShape;
    attribute vec4 aTravel;
    attribute vec4 aColorSize;
    attribute vec2 aHeightMirror;
    varying vec4 vColor;
    varying vec2 vTube;
    varying float vAlong;
    varying float vMirror;
    ${projection}
    void main() {
      float head = mod(aTravel.y + uTime * aTravel.z + 48000.0, 480.0) - 40.0;
      float z = head - sign(aTravel.z) * aShape.z * aTravel.w;
      float y = aHeightMirror.x + aShape.y * aColorSize.w;
      vMirror = aHeightMirror.y;
      y = mix(y, -y * 1.6, vMirror);
      vec3 p = vec3(aTravel.x + aShape.x * aColorSize.w, y, z);
      vColor = vec4(aColorSize.rgb, mix(0.92, 0.14, vMirror));
      vTube = aShape.xy;
      vAlong = aShape.z;
      gl_Position = project(p);
    }
  `;

  const trailFragment = `
    varying vec4 vColor;
    varying vec2 vTube;
    varying float vAlong;
    varying float vMirror;
    varying float vDistance;
    void main() {
      if (vDistance < 1.0 || vDistance > 420.0) discard;
      float edge = pow(max(0.0, 1.0 - abs(vTube.x)), 0.65);
      float ends = smoothstep(0.0, 0.045, vAlong) * (1.0 - smoothstep(0.65, 1.0, vAlong));
      float fog = 1.0 - smoothstep(100.0, 410.0, vDistance);
      float core = pow(edge, 10.0) * 0.25 * (1.0 - vMirror);
      gl_FragColor = vec4(mix(vColor.rgb, vec3(0.95, 0.93, 0.88), core), vColor.a * edge * ends * fog);
    }
  `;

  const detailVertex = `
    attribute vec3 aPosition;
    attribute vec2 aTravel;
    attribute vec4 aColor;
    varying vec4 vColor;
    ${projection}
    void main() {
      vec3 p = aPosition;
      p.z += mod(aTravel.x + uTime * aTravel.y + 48000.0, 440.0) - 20.0;
      vColor = aColor;
      gl_Position = project(p);
    }
  `;

  const detailFragment = `
    varying vec4 vColor;
    varying float vDistance;
    void main() {
      if (vDistance < 1.0 || vDistance > 400.0) discard;
      float fog = 1.0 - smoothstep(65.0, 400.0, vDistance);
      gl_FragColor = vec4(vColor.rgb, vColor.a * fog);
    }
  `;

  const screenVertex = `
    attribute vec2 aPosition;
    varying vec2 vUV;
    void main() {
      vUV = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const blurFragment = `
    uniform sampler2D uImage;
    uniform vec2 uStep;
    varying vec2 vUV;
    void main() {
      vec4 color = texture2D(uImage, vUV) * 0.227027;
      color += (texture2D(uImage, vUV + uStep * 1.384615) + texture2D(uImage, vUV - uStep * 1.384615)) * 0.316216;
      color += (texture2D(uImage, vUV + uStep * 3.230769) + texture2D(uImage, vUV - uStep * 3.230769)) * 0.070270;
      gl_FragColor = color;
    }
  `;

  const compositeFragment = `
    uniform sampler2D uImage;
    uniform sampler2D uGlow;
    uniform vec3 uBackground;
    uniform float uLight;
    varying vec2 vUV;
    void main() {
      vec4 sceneColor = texture2D(uImage, vUV);
      vec4 glow = texture2D(uGlow, vUV);
      vec3 color = uBackground * (1.0 - sceneColor.a) + sceneColor.rgb;
      vec3 darkColor = color + glow.rgb * 0.85;
      vec3 lightColor = mix(color, glow.rgb / max(glow.a, 0.01), min(glow.a * 0.22, 0.25));
      gl_FragColor = vec4(mix(darkColor, lightColor, uLight), 1.0);
    }
  `;

  function program(vertexSource, fragmentSource) {
    const result = gl.createProgram();
    [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]].forEach(([type, source]) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, `precision highp float;\n${source}`);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(result, shader);
      gl.deleteShader(shader);
    });
    gl.linkProgram(result);
    if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result));
    return { handle: result, uniforms: new Map() };
  }

  function uniform(shader, name) {
    if (!shader.uniforms.has(name)) shader.uniforms.set(name, gl.getUniformLocation(shader.handle, name));
    return shader.uniforms.get(name);
  }

  function batch(values, attributes) {
    const stride = attributes.reduce((sum, item) => sum + item[1], 0);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
    return { buffer, attributes, stride, count: values.length / stride };
  }

  function bind(shader, mesh) {
    gl.useProgram(shader.handle);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    let offset = 0;
    mesh.attributes.forEach(([name, size]) => {
      const location = gl.getAttribLocation(shader.handle, name);
      if (location >= 0) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, mesh.stride * 4, offset * 4);
      }
      offset += size;
    });
  }

  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function quad(values, corners, extra) {
    [0, 1, 2, 0, 2, 3].forEach(index => values.push(...corners[index], ...extra));
  }

  const roads = [];
  for (let z = 0; z < 420; z += 2) {
    [[-11, -1], [1, 11]].forEach(([left, right]) => {
      quad(roads, [[left, 0, z], [right, 0, z], [right, 0, z + 2], [left, 0, z + 2]], []);
    });
  }

  const trails = [];
  const reflections = [];
  const headColors = [[0.93, 0.91, 0.86], [0.84, 0.82, 0.76], [0.75, 0.73, 0.68]];
  const tailColors = [[0.46, 0.055, 0.09], [0.64, 0.085, 0.12], [0.76, 0.13, 0.16]];
  [-1, 1].forEach(side => {
    for (let index = 0; index < 36; index += 1) {
      const lane = Math.floor(random() * 3);
      const laneX = side * (1 + (lane + 0.5) * 10 / 3);
      const centerX = laneX + (random() - 0.5) * 0.65;
      const depth = random() * 480;
      const speed = side < 0 ? -(120 + random() * 40) : 60 + random() * 20;
      const length = 12 + random() * 60;
      const radius = 0.055 + random() * 0.065;
      const height = 0.2 + random() * 0.5;
      const color = (side < 0 ? headColors : tailColors)[Math.floor(random() * 3)];
      const separation = 0.45 + random() * 0.25;
      [-separation, separation].forEach(lamp => {
        [0, 1].forEach(mirror => {
          const extra = [centerX + lamp, depth, speed, length, ...color, radius, height, mirror];
          for (let segment = 0; segment < 10; segment += 1) {
            for (let face = 0; face < 6; face += 1) {
              const angle = face * Math.PI / 3;
              const nextAngle = (face + 1) * Math.PI / 3;
              quad(mirror ? reflections : trails, [
                [Math.cos(angle), Math.sin(angle), segment / 10],
                [Math.cos(nextAngle), Math.sin(nextAngle), segment / 10],
                [Math.cos(nextAngle), Math.sin(nextAngle), (segment + 1) / 10],
                [Math.cos(angle), Math.sin(angle), (segment + 1) / 10]
              ], extra);
            }
          }
        });
      });
    }
  });

  const details = [];
  [-1, 1].forEach(side => {
    for (let index = 0; index < 20; index += 1) {
      const x = side * 11.4;
      const height = 1.2 + random() * 0.6;
      const width = 0.05 + random() * 0.08;
      const depth = index * 22 + random() * 8;
      quad(details, [[x - width, 0, 0], [x + width, 0, 0], [x + width, height, 0], [x - width, height, 0]], [depth, -120, 0.88, 0.85, 0.79, 0.9]);
    }
  });
  for (let index = 0; index < 65; index += 1) {
    const x = (random() - 0.5) * 85;
    const y = 3 + random() * 32;
    const length = 0.6 + random() * 2;
    quad(details, [[x - 0.015, y, 0], [x + 0.015, y, 0], [x + 0.015, y, length], [x - 0.015, y, length]], [random() * 440, -150, 0.65, 0.64, 0.61, 0.2]);
  }

  let roadProgram;
  let trailProgram;
  let detailProgram;
  let blurProgram;
  let compositeProgram;
  try {
    roadProgram = program(roadVertex, roadFragment);
    trailProgram = program(trailVertex, trailFragment);
    detailProgram = program(detailVertex, detailFragment);
    blurProgram = program(screenVertex, blurFragment);
    compositeProgram = program(screenVertex, compositeFragment);
  } catch (error) {
    fallback.hidden = false;
    console.error('Elsewhere road:', error);
    return unavailable;
  }

  const roadMesh = batch(roads, [['aPosition', 3]]);
  const trailAttributes = [['aShape', 3], ['aTravel', 4], ['aColorSize', 4], ['aHeightMirror', 2]];
  const trailMesh = batch(trails, trailAttributes);
  const reflectionMesh = batch(reflections, trailAttributes);
  const detailMesh = batch(details, [['aPosition', 3], ['aTravel', 2], ['aColor', 4]]);
  const screenMesh = batch([-1, -1, 3, -1, -1, 3], [['aPosition', 2]]);
  const attributeCount = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);

  function target(width, height, depth) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    let depthBuffer = null;
    if (depth) {
      depthBuffer = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
    }
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Road render target is unavailable.');
    return { texture, framebuffer, depthBuffer, width, height };
  }

  function dispose(item) {
    if (!item) return;
    gl.deleteTexture(item.texture);
    gl.deleteFramebuffer(item.framebuffer);
    if (item.depthBuffer) gl.deleteRenderbuffer(item.depthBuffer);
  }

  function drawMesh(shader, mesh, time) {
    for (let index = 0; index < attributeCount; index += 1) gl.disableVertexAttribArray(index);
    bind(shader, mesh);
    gl.uniform1f(uniform(shader, 'uTime'), time);
    gl.uniform1f(uniform(shader, 'uAspect'), pixelWidth / pixelHeight);
    gl.uniform1f(uniform(shader, 'uLight'), light ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }

  function textureAt(texture, slot) {
    gl.activeTexture(gl.TEXTURE0 + slot);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  }

  function blur(source, destination, x, y) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, destination.framebuffer);
    gl.viewport(0, 0, destination.width, destination.height);
    bind(blurProgram, screenMesh);
    textureAt(source.texture, 0);
    gl.uniform1i(uniform(blurProgram, 'uImage'), 0);
    gl.uniform2f(uniform(blurProgram, 'uStep'), x, y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function render() {
    if (!scene || lost) return;
    const time = Number(clock.currentTime ?? 18000) / 1000 * 0.42;
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.framebuffer);
    gl.viewport(0, 0, pixelWidth, pixelHeight);
    gl.depthMask(true);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    drawMesh(roadProgram, roadMesh, time);
    gl.depthMask(false);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE);
    gl.disable(gl.DEPTH_TEST);
    drawMesh(trailProgram, reflectionMesh, time);
    gl.enable(gl.DEPTH_TEST);
    drawMesh(trailProgram, trailMesh, time);
    drawMesh(detailProgram, detailMesh, time);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    for (let index = 0; index < attributeCount; index += 1) gl.disableVertexAttribArray(index);
    blur(scene, glowA, 2 / pixelWidth, 0);
    blur(glowA, glowB, 0, 1 / glowA.height);
    blur(glowB, glowA, 1 / glowA.width, 0);
    blur(glowA, glowB, 0, 1 / glowA.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, pixelWidth, pixelHeight);
    bind(compositeProgram, screenMesh);
    textureAt(scene.texture, 0);
    textureAt(glowB.texture, 1);
    gl.uniform1i(uniform(compositeProgram, 'uImage'), 0);
    gl.uniform1i(uniform(compositeProgram, 'uGlow'), 1);
    gl.uniform1f(uniform(compositeProgram, 'uLight'), light ? 1 : 0);
    const background = light ? [247 / 255, 246 / 255, 243 / 255] : [13 / 255, 13 / 255, 13 / 255];
    gl.uniform3fv(uniform(compositeProgram, 'uBackground'), background);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function resize() {
    if (lost) return;
    const bounds = field.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (width === pixelWidth && height === pixelHeight) return;
    pixelWidth = canvas.width = width;
    pixelHeight = canvas.height = height;
    [scene, glowA, glowB].forEach(dispose);
    try {
      scene = target(width, height, true);
      glowA = target(Math.max(1, Math.round(width / 4)), Math.max(1, Math.round(height / 4)), false);
      glowB = target(glowA.width, glowA.height, false);
      render();
    } catch (error) {
      lost = true;
      fallback.hidden = false;
      syncMotion();
      console.error('Elsewhere road:', error);
    }
  }

  function tick() {
    render();
    frame = requestAnimationFrame(tick);
  }

  function syncMotion() {
    const moving = window.portraitMotion.enabled && !paused && visible && pageActive && !document.hidden && !lost;
    if (moving) {
      clock.play();
      if (!frame) frame = requestAnimationFrame(tick);
    } else {
      clock.pause();
      cancelAnimationFrame(frame);
      frame = 0;
      render();
    }
  }

  new ResizeObserver(resize).observe(field);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; syncMotion(); }).observe(field);
  new MutationObserver(() => { light = document.documentElement.dataset.theme === 'light'; render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.portraitMotion.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('pagehide', () => { pageActive = false; syncMotion(); });
  window.addEventListener('pageshow', () => { pageActive = true; syncMotion(); });
  canvas.addEventListener('webglcontextlost', () => { lost = true; fallback.hidden = false; syncMotion(); });
  resize();
  syncMotion();
  return {
    setPaused(value) {
      paused = value;
      syncMotion();
    }
  };
}
