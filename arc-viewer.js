import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export async function createArcViewer(container, callbacks) {
  const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0; canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Interactive ARC-Tesla backpack. Drag or use arrow keys to rotate. Scroll, pinch, or use plus and minus to zoom.');
  container.prepend(canvas);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#080e10');
  const camera = new THREE.PerspectiveCamera(36, 1, .01, 20);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .08;
  controls.enablePan = false; controls.autoRotateSpeed = .65;
  controls.minDistance = .48; controls.maxDistance = 2;
  controls.minPolarAngle = .12; controls.maxPolarAngle = Math.PI - .12;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment(); const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture; scene.environmentIntensity = .65;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xc4e9ff, 0x212c20, 1.5));
  const key = new THREE.DirectionalLight(0xe5f4ff, 3.0); key.position.set(-1, 2, -2); scene.add(key);
  const rim = new THREE.DirectionalLight(0x65c9e8, 2); rim.position.set(1, .8, 1); scene.add(rim);
  const flash = new THREE.PointLight(0x88cfff, 0, 1.2, 2); flash.position.set(0, .22, -.24); scene.add(flash);
  const renderTarget = new THREE.WebGLRenderTarget(400, 400, {type:THREE.HalfFloatType, samples:4});
  const composer = new EffectComposer(renderer, renderTarget);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(400,400), .32, .35, 1.5));
  composer.addPass(new OutputPass());
  let model, rotor, rotorBase, running = false, animation = true, rotate = true, frame = 0, previous = 0, time = 0, failed = false, dirty = true;
  const bolts = [], animatedMaterials = [], signals = [];
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); composer.setSize(w,h); camera.aspect = w/h; camera.updateProjectionMatrix(); dirty = true;
  }
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  function stop() { running = false; cancelAnimationFrame(frame); previous = 0; }
  function dispose() {
    stop(); observer.disconnect(); controls.dispose();
    model?.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    const materials = new Set(); model?.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); });
    const textures = new Set(); materials.forEach(m => { for (const v of Object.values(m)) if (v?.isTexture) textures.add(v); m.dispose(); });
    textures.forEach(t => t.dispose()); environment.dispose(); composer.passes.forEach(p => p.dispose?.()); composer.dispose(); renderer.dispose(); canvas.remove();
  }
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); failed = true; stop(); callbacks.onFailure(); });
  function updateEffects() {
    if (rotor) { rotor.quaternion.copy(rotorBase); rotor.rotateZ(-time * Math.PI); }
    let discharge = false;
    for (const bolt of bolts) {
      const phase = ((time - (bolt.group - 1)*.8 - .5) % (8/3) + 8/3) % (8/3);
      const active = bolt.alternate === 0 ? (phase < .09 || (phase >= .19 && phase < .28)) : ((phase >= .10 && phase < .18) || (phase >= .29 && phase < .37));
      bolt.object.visible = active; discharge ||= active;
    }
    flash.intensity = discharge ? .07 : 0;
    for (const {material, maps, direction, period} of animatedMaterials) {
      maps.forEach(map => { map.offset[direction] = (time / period) % 1; });
      if (material.name === 'ARC_ReactorCore') material.emissiveIntensity = 1.1 + .18*Math.sin(time*Math.PI*2/3);
    }
    for (const {object, index} of signals) object.visible = index <= 4 + Math.round(3*(.5+.5*Math.sin(time*.85)));
  }
  function tick(now) {
    if (!running || failed) return;
    frame = requestAnimationFrame(tick);
    const dt = previous ? Math.min((now-previous)/1000, .05) : 0; previous = now;
    if (animation) time += dt;
    updateEffects(); controls.autoRotate = rotate;
    const changed = controls.update(dt);
    if (animation || rotate || changed || dirty) { composer.render(); dirty = false; }
  }
  function reset() { camera.position.set(.37, .18, -1.05); controls.target.set(0, 0, 0); controls.update(); }
  controls.addEventListener('start', callbacks.onInteract);
  canvas.addEventListener('keydown', e => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key)) return;
    e.preventDefault(); callbacks.onInteract();
    const offset = camera.position.clone().sub(controls.target), sphere = new THREE.Spherical().setFromVector3(offset);
    if (e.key === 'ArrowLeft') sphere.theta += .15;
    if (e.key === 'ArrowRight') sphere.theta -= .15;
    if (e.key === 'ArrowUp') sphere.phi -= .12;
    if (e.key === 'ArrowDown') sphere.phi += .12;
    if (e.key === '+' || e.key === '=') sphere.radius *= .9;
    if (e.key === '-') sphere.radius *= 1.1;
    sphere.phi = THREE.MathUtils.clamp(sphere.phi, .12, Math.PI-.12); sphere.radius = THREE.MathUtils.clamp(sphere.radius, .48, 2);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sphere)); controls.update();
  });
  try {
    const gltf = await new GLTFLoader().loadAsync('assets/previews/arc-tesla/model.glb', event => { if (event.total) callbacks.onProgress(Math.round(event.loaded/event.total*100)); });
    model = gltf.scene;
    const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3()); model.position.sub(center); scene.add(model);
    const seen = new Set();
    model.traverse(object => {
      if (object.name === 'ARC_RotorPivot') { rotor = object; rotorBase = object.quaternion.clone(); }
      const bolt = /^ARC_BoltGate_(\d)_(\d)$/.exec(object.name);
      if (bolt) bolts.push({object, group:Number(bolt[1]), alternate:Number(bolt[2])});
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (/^ARC_Signal\d/.test(material.name)) signals.push({object,index:Number(material.name.match(/\d/)[0])});
        if (seen.has(material)) continue; seen.add(material);
        if (material.transparent) material.depthWrite = false;
        for (const value of Object.values(material)) if (value?.isTexture) value.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
        if (/ARC_Fluid|ARC_Graph|ARC_Ticker|ARC_ReactorCore|ARC_Arc_/.test(material.name)) {
          const maps=[];
          for (const slot of ['map','emissiveMap']) if (material[slot] && material.name !== 'ARC_ReactorCore') { material[slot] = material[slot].clone(); material[slot].wrapS = material[slot].wrapT = THREE.RepeatWrapping; maps.push(material[slot]); }
          const fluid = material.name.includes('Fluid');
          const period = material.name.includes('Amber') ? 21 : material.name.includes('Right') ? 23 : fluid ? 18 : material.name === 'ARC_Ticker' ? 12 : 6;
          animatedMaterials.push({material, maps, direction:fluid ? 'y' : 'x', period});
        }
      }
    });
    reset(); updateEffects(); resize(); composer.render();
  } catch (error) { dispose(); throw error; }
  return {
    setActive(active) { if (!active || failed) { stop(); return; } if (!running) { running = true; resize(); frame = requestAnimationFrame(tick); } },
    setVisible(visible) { canvas.hidden = !visible; },
    setMotion(animate, turntable) { animation = animate; rotate = turntable; },
    reset,
    dispose
  };
}
