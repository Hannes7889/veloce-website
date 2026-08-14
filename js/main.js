/* ============================================================
   VELOCE — main.js
   Three.js: Hero-Canvas, Produkt-Viewer mit Rotation,
   elegante Scroll-Animationen.
   ============================================================ */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/* ---------- Globale Zustände ---------- */
const modelsReady = {};
let pending = 0;

/* ---------- Loader ---------- */
const loaderEl = document.getElementById("loader");
const loaderText = document.getElementById("loader-text");

function markLoaded(name) {
  modelsReady[name] = true;
  pending = Math.max(0, pending - 1);
  if (pending === 0) {
    setTimeout(() => loaderEl.classList.add("hidden"), 350);
  }
}

/* ---------- Material ---------- */
const MIDNIGHT_BLUE = 0x23386a;

function makeMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: MIDNIGHT_BLUE,
    metalness: 0.95,
    roughness: 0.30,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28,
    envMapIntensity: 1.15,
  });
}

/* ---------- Szene + Umgebung ---------- */
function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

function createEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return envTex;
}

/* ---------- Modell passend einpassen ---------- */
function fitGeometry(geometry, targetSize) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / maxDim;
  const center = new THREE.Vector3();
  box.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(scale, scale, scale);
  geometry.computeVertexNormals();
}

/* ---------- Basis-Setup für einen Viewer ---------- */
function setupViewer(canvas, { targetSize = 9, autoRotate = true, hero = false } = {}) {
  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  scene.environment = createEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(40, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
  camera.position.set(0, 0, targetSize * 1.9);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.autoRotate = autoRotate;
  controls.autoRotateSpeed = hero ? 0.9 : 1.1;
  controls.minDistance = targetSize * 1.1;
  controls.maxDistance = targetSize * 4.5;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xbfd0ff, 0x0a0d16, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(4, 6, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x5f86e0, 1.6);
  rim.position.set(-6, -3, -6);
  scene.add(rim);

  let mesh = null;
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    if (mesh) {
      if (hero) {
        mesh.rotation.y = t * 0.18;
        mesh.position.y = Math.sin(t * 0.9) * 0.22;
      }
    }
    controls.update();
    renderer.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight || canvas.parentElement.parentElement.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return {
    renderer,
    scene,
    camera,
    controls,
    animate,
    resize,
    loadModel(url) {
      pending += 1;
      const loader = new STLLoader();
      loader.load(
        url,
        (geometry) => {
          fitGeometry(geometry, targetSize);
          const mat = makeMaterial();
          mesh = new THREE.Mesh(geometry, mat);
          scene.add(mesh);
          markLoaded(url);
        },
        undefined,
        (err) => {
          console.error("Modell konnte nicht geladen werden:", url, err);
          const stage = canvas.closest(".product-stage") || canvas.parentElement;
          const hint = document.createElement("div");
          hint.className = "stage-hint";
          hint.textContent = "Modell offline nicht verfügbar";
          stage.appendChild(hint);
          markLoaded(url);
        }
      );
    },
  };
}

/* ---------- Hero-Viewer ---------- */
const heroCanvas = document.getElementById("heroCanvas");
const heroViewer = setupViewer(heroCanvas, { targetSize: 10, autoRotate: false, hero: true });
heroViewer.loadModel("models/milano.stl");
heroViewer.animate();

/* ---------- Produkt-Viewer ---------- */
const productViewers = [];
document.querySelectorAll(".product-canvas").forEach((canvas) => {
  const url = canvas.dataset.model;
  const viewer = setupViewer(canvas, { targetSize: 9, autoRotate: true });
  viewer.loadModel(url);
  viewer.animate();
  productViewers.push(viewer);
});

/* ---------- Resize ---------- */
function resizeAll() {
  heroViewer.resize();
  productViewers.forEach((v) => v.resize());
}
window.addEventListener("resize", resizeAll);
setTimeout(resizeAll, 100);

/* ---------- Header: Scroll-Zustand ---------- */
const header = document.getElementById("siteHeader");
function onScrollHeader() {
  header.classList.toggle("scrolled", window.scrollY > 40);
}
window.addEventListener("scroll", onScrollHeader, { passive: true });
onScrollHeader();

/* ---------- Scroll-Reveal ---------- */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.14, rootMargin: "0px 0px -40px 0px" }
);
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

/* ---------- Parallax im Hero ---------- */
let ticking = false;
window.addEventListener(
  "scroll",
  () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (y < window.innerHeight) {
        heroCanvas.style.transform = `translateY(${y * 0.16}px)`;
      }
      ticking = false;
    });
  },
  { passive: true }
);
