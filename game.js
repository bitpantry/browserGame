import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas') });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// basic audio setup
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playGunSound() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

function playDestroySound() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
  osc.stop(audioCtx.currentTime + 0.3);
}

const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');

instructions.addEventListener('click', () => {
  controls.lock();
  audioCtx.resume();
});

controls.addEventListener('lock', () => blocker.classList.add('hidden'));
controls.addEventListener('unlock', () => blocker.classList.remove('hidden'));

// basic movement variables
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

// bullet/tracer storage
const bullets = [];
const bulletSpeed = 400; // units per second
const bulletMaxDistance = 200;

const onKeyDown = function (event) {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = true;
      break;
  }
};

const onKeyUp = function (event) {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = false;
      break;
  }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

document.addEventListener('click', shoot);

function shoot() {
  if (!controls.isLocked) return;
  playGunSound();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  const bullet = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffff00 })
  );
  bullet.position.copy(camera.position);
  scene.add(bullet);
  bullets.push({ mesh: bullet, direction: dir.clone(), distance: 0 });

  const raycaster = new THREE.Raycaster(camera.position, dir);
  const intersects = raycaster.intersectObjects(targets, false);
  if (intersects.length > 0) {
    const obj = intersects[0].object;
    scene.remove(obj);
    targets.splice(targets.indexOf(obj), 1);
    playDestroySound();
  }
}

// floor and walls
const floorGeometry = new THREE.PlaneGeometry(200, 200);
const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x808080 });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const wallMaterial = new THREE.MeshBasicMaterial({ color: 0x444444, side: THREE.DoubleSide });
function createWall(width, height, depth, x, y, z) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geometry, wallMaterial);
  mesh.position.set(x, y, z);
  scene.add(mesh);
}
createWall(200, 20, 2, 0, 10, -100); // back wall
createWall(200, 20, 2, 0, 10, 100); // front wall
createWall(2, 20, 200, -100, 10, 0); // left wall
createWall(2, 20, 200, 100, 10, 0); // right wall

// targets to shoot
const targetMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const targets = [];
for (let i = 0; i < 5; i++) {
  const cube = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), targetMaterial);
  cube.position.set((Math.random() - 0.5) * 80, 2.5, (Math.random() - 0.5) * 80);
  scene.add(cube);
  targets.push(cube);
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  if (controls.isLocked) {
    const delta = Math.min(clock.getDelta(), 0.1); // avoid large jumps

    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);

    // update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      const move = bulletSpeed * delta;
      const prevPos = b.mesh.position.clone();
      b.mesh.position.add(b.direction.clone().multiplyScalar(move));
      b.distance += move;

      const ray = new THREE.Raycaster(prevPos, b.direction, 0, move);
      const hits = ray.intersectObjects(targets, false);
      if (hits.length > 0) {
        const obj = hits[0].object;
        scene.remove(obj);
        targets.splice(targets.indexOf(obj), 1);
        playDestroySound();
        scene.remove(b.mesh);
        bullets.splice(i, 1);
        continue;
      }

      if (b.distance > bulletMaxDistance) {
        scene.remove(b.mesh);
        bullets.splice(i, 1);
      }
    }
  }

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
