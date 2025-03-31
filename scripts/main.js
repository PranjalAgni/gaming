import * as THREE from 'three';
import {io} from "socket.io-client";
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { World } from './world';
import { Player } from './player';
import { Physics } from './physics';
import { setupUI } from './ui';
import { ModelLoader } from './modelLoader';
import { ToolManager } from './toolManager';


// Create a instance of tool manager
/** @type {ToolManager} */
const toolManager = new ToolManager();

// Socket setup
const socket = io("http://localhost:3000");

// Track remote players
const remotePlayers = {};

/*
  Listen for initial world state (e.g., all connected players).
  We create or position them in the scene so we can render them just like local player.
*/
socket.on('worldState', (data) => {
  for (const playerId in data.players) {
    // don't create local player again
    if (playerId === socket.id) continue; 
    
    // Create a remote player in your scene
    const remotePlayer = new Player(scene, world); 
    remotePlayer.position.set(
      data.players[playerId].x,
      data.players[playerId].y,
      data.players[playerId].z
    );

    toolManager.subscribe((toolModel) => {
      remotePlayer.setTool(toolModel.clone());
    });

    remotePlayers[playerId] = remotePlayer;
  }
});

socket.on('blockUpdated', ({ x, y, z, blockId, type }) => {
  if (type === 'place') {
    world.addBlock(x, y, z, blockId);
  } else if (type === 'remove') {
    world.removeBlock(x, y, z);
  }
});

// When a new player joins
socket.on('playerJoined', ({ id, state }) => {
  console.log("Someone joined our game = ", {id, state});
  if (id === socket.id) return; // ignore self
  
  const remotePlayer = new Player(scene, world);
  remotePlayer.position.set(state.x, state.y, state.z);

  toolManager.subscribe((toolModel) => {
    remotePlayer.setTool(toolModel.clone());
  });

  remotePlayers[id] = remotePlayer;
});

// When a remote player moves
socket.on('playerMoved', ({ id, state }) => {
  if (!remotePlayers[id]) return;
  remotePlayers[id].position.set(state.x, state.y, state.z);
  // Optionally update rotation, velocity, etc. if you track those
});

// If a remote player leaves, remove them from the scene
socket.on('playerLeft', ({ id }) => {
  if (remotePlayers[id]) {
    // Remove their bounding cylinder, camera, or whatever else from the scene
    scene.remove(remotePlayers[id].boundsHelper);
    scene.remove(remotePlayers[id].camera);
    // etc.

    delete remotePlayers[id];
  }
});

// Emit local player’s position each frame
function syncLocalPlayerPosition() {
  // For example, run this inside your animate() or physics loop
  socket.emit('movePlayer', {
    x: player.position.x,
    y: player.position.y,
    z: player.position.z
    // Possibly send rotation, velocity...
  });
}

// Send block updates (placing or removing) to the server
window.handleBlockUpdate = (x, y, z, blockId, type) => {
  socket.emit('blockUpdate', { x, y, z, blockId, type });
}

// UI Setup
const stats = new Stats();
document.body.appendChild(stats.dom);

// Renderer setup
const renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x80a0e0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Scene setup
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x80a0e0, 50, 75);

const world = new World();
world.generate();
scene.add(world);

const player = new Player(scene, world);
const physics = new Physics(scene);

// Camera setup
const orbitCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
orbitCamera.position.set(24, 24, 24);
orbitCamera.layers.enable(1);

const controls = new OrbitControls(orbitCamera, renderer.domElement);
controls.update();


const modelsToLoad = {
  pickaxe: './models/pickaxe.glb',
};

const modelLoader = new ModelLoader(modelsToLoad, (models) => {
  // Attach the pickaxe as your "tool"
  player.setTool(models.pickaxe);
  toolManager.setToolModel(models.pickaxe);
});



let sun;
function setupLights() {
  sun = new THREE.DirectionalLight();
  sun.intensity = 1.5;
  sun.position.set(50, 50, 50);
  sun.castShadow = true;

  // Set the size of the sun's shadow box
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 200;
  sun.shadow.bias = -0.0001;
  sun.shadow.mapSize = new THREE.Vector2(2048, 2048);
  scene.add(sun);
  scene.add(sun.target);

  const ambient = new THREE.AmbientLight();
  ambient.intensity = 0.2;
  scene.add(ambient);
}

// Render loop
let previousTime = performance.now();
function animate() {
  requestAnimationFrame(animate);

  const currentTime = performance.now();
  const dt = (currentTime - previousTime) / 1000;

  // Only update physics when player controls are locked
  if (player.controls.isLocked) {
    physics.update(dt, player, world);
    player.update(world);
    world.update(player);

    // Position the sun relative to the player. Need to adjust both the
    // position and target of the sun to keep the same sun angle
    sun.position.copy(player.camera.position);
    sun.position.sub(new THREE.Vector3(-50, -50, -50));
    sun.target.position.copy(player.camera.position);

    // Update positon of the orbit camera to track player 
    orbitCamera.position.copy(player.position).add(new THREE.Vector3(16, 16, 16));
    controls.target.copy(player.position);
  }

  renderer.render(scene, player.controls.isLocked ? player.camera : orbitCamera);
  stats.update();
  
  // Send local player's updated position
  syncLocalPlayerPosition();

  previousTime = currentTime;
}

window.addEventListener('resize', () => {
  // Resize camera aspect ratio and renderer size to the new window size
  orbitCamera.aspect = window.innerWidth / window.innerHeight;
  orbitCamera.updateProjectionMatrix();
  player.camera.aspect = window.innerWidth / window.innerHeight;
  player.camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById('craftStonePickaxe').addEventListener('click', () => {
  // Example: set the player’s activeBlockId or tool model to a “stone pickaxe”
  alert('Stone Pickaxe Crafted!');
});

setupUI(world, player, physics, scene);
setupLights();
animate();