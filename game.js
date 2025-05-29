import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas') });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// player settings
const playerHeight = 5;
camera.position.y = playerHeight;
let walkTime = 0;
let verticalVelocity = 0;
const gravity = 800;
const jumpSpeed = 150; // reduce jump height so walls stay visible

// basic audio setup
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playShotSound() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);
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

function playClangSound() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(300, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
  osc.stop(audioCtx.currentTime + 0.2);
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

const gun = new THREE.Mesh(
  new THREE.BoxGeometry(0.2, 0.2, 1),
  new THREE.MeshBasicMaterial({ color: 0x222222 })
);
gun.position.set(0.5, -0.5, -1);
camera.add(gun);

const bullets = [];
const explosions = [];
const stains = [];

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
    case 'Space':
      if (controls.isLocked && controls.getObject().position.y <= playerHeight + 0.01) {
        verticalVelocity = jumpSpeed;
      }
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
    case 'Space':
      break;
  }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

document.addEventListener('click', shootGun);

function shootGun() {
  if (!controls.isLocked) return;
  playShotSound();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  const raycaster = new THREE.Raycaster(camera.position, dir, 0, 200);
  const intersects = raycaster.intersectObjects([enemy].concat(environment), true);

  let maxDist = 200;
  if (intersects.length > 0) {
    const hit = intersects[0];
    maxDist = hit.distance;
    const obj = hit.object;
    if (obj === enemy || enemy.children.includes(obj)) {
      createExplosion(enemy.position);
      addStain(enemy.position);
      scene.remove(enemy);
      enemy = spawnEnemy();
      playDestroySound();
    } else {
      playClangSound();
    }
  }

  const bullet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 1, 8),
    new THREE.MeshBasicMaterial({ color: 0xffff00 })
  );
  bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  bullet.position.copy(camera.position).add(dir.clone().multiplyScalar(1));
  bullet.userData.dir = dir.clone();
  bullet.userData.speed = 600;
  bullet.userData.remaining = maxDist;
  scene.add(bullet);
  bullets.push(bullet);
}

// floor, ceiling and walls
const environment = [];
const floorGeometry = new THREE.PlaneGeometry(200, 200);
const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x808080, side: THREE.DoubleSide });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
environment.push(floor);

const ceiling = new THREE.Mesh(floorGeometry, floorMaterial);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = 20;
scene.add(ceiling);
environment.push(ceiling);

const wallMaterial = new THREE.MeshBasicMaterial({ color: 0x444444, side: THREE.DoubleSide });
function createWall(width, height, depth, x, y, z) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geometry, wallMaterial);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  environment.push(mesh);
}
createWall(200, 20, 2, 0, 10, -100); // back wall
createWall(200, 20, 2, 0, 10, 100); // front wall
createWall(2, 20, 200, -100, 10, 0); // left wall
createWall(2, 20, 200, 100, 10, 0); // right wall

// chasing enemy
const enemyMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const faceMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
let enemy;
function spawnEnemy() {
  const body = new THREE.Mesh(new THREE.SphereGeometry(2.5, 16, 16), enemyMaterial);
  const eyeGeom = new THREE.SphereGeometry(0.3, 8, 8);
  const leftEye = new THREE.Mesh(eyeGeom, faceMaterial);
  leftEye.position.set(-0.8, 0.8, 2.2);
  const rightEye = new THREE.Mesh(eyeGeom, faceMaterial);
  rightEye.position.set(0.8, 0.8, 2.2);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.5), faceMaterial);
  mouth.position.set(0, -0.5, 2.3);
  body.add(leftEye, rightEye, mouth);
  body.position.set((Math.random() - 0.5) * 60, 2.5, (Math.random() - 0.5) * 60);
  scene.add(body);
  return body;
}
enemy = spawnEnemy();
const enemySpeed = 20;

function createExplosion(pos) {
  for (let i = 0; i < 20; i++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    p.position.copy(pos);
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 2,
      (Math.random() - 0.5) * 2
    ).normalize();
    p.userData.velocity = dir.multiplyScalar(40 + Math.random() * 40);
    p.userData.life = 1;
    scene.add(p);
    explosions.push(p);
  }
}

function addStain(pos) {
  const stain = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 16),
    new THREE.MeshBasicMaterial({ color: 0x550000 })
  );
  stain.rotation.x = -Math.PI / 2;
  stain.position.set(pos.x, 0.05, pos.z);
  scene.add(stain);
  stains.push(stain);
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

    const pos = controls.getObject().position;
    const boundary = 98;
    pos.x = Math.max(-boundary, Math.min(boundary, pos.x));
    pos.z = Math.max(-boundary, Math.min(boundary, pos.z));

    const onGround = pos.y <= playerHeight + 0.01;
    if (onGround) {
      if (moveForward || moveBackward || moveLeft || moveRight) {
        walkTime += delta * 8;
      } else {
        walkTime = 0;
      }
    }

    if (!onGround || verticalVelocity !== 0) {
      walkTime = 0;
    }

    verticalVelocity -= gravity * delta;
    pos.y += verticalVelocity * delta;
    if (pos.y > ceiling.position.y - 1) {
      pos.y = ceiling.position.y - 1;
      verticalVelocity = 0;
    }
    if (pos.y <= playerHeight) {
      pos.y = playerHeight;
      verticalVelocity = 0;
    }

    if (pos.y === playerHeight) {
      pos.y += Math.sin(walkTime) * 0.2;
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      const step = b.userData.speed * delta;
      b.position.add(b.userData.dir.clone().multiplyScalar(step));
      b.userData.remaining -= step;
      if (b.userData.remaining <= 0) {
        scene.remove(b);
        bullets.splice(i, 1);
      }
    }

    for (let i = explosions.length - 1; i >= 0; i--) {
      const p = explosions[i];
      p.userData.velocity.y -= gravity * 0.3 * delta;
      p.position.add(p.userData.velocity.clone().multiplyScalar(delta));
      p.userData.life -= delta;
      if (p.userData.life <= 0) {
        scene.remove(p);
        explosions.splice(i, 1);
      }
    }

    if (enemy) {
      const playerPos = controls.getObject().position;
      const dirToPlayer = playerPos.clone().sub(enemy.position);
      const dist = dirToPlayer.length();
      dirToPlayer.normalize();
      enemy.position.add(dirToPlayer.multiplyScalar(enemySpeed * delta));
      enemy.position.y = 2.5;
      if (dist < 3) {
        alert('You were caught!');
        window.location.reload();
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
