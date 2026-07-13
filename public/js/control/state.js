// Estado global y configuración base de control
let selectingArea = false;
let selAreaStart = { x: 0, y: 0 };
let selAreaEnd = { x: 0, y: 0 };

const OVERLAY_W = 1920;
const OVERLAY_H = 1080;
const DRAW_LAYER_ID = 'draw_layer_main';
let activeDrawLayerId = DRAW_LAYER_ID;

const socket = io();
const canvas = document.getElementById('canvas-main');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('canvas-wrap');
const textEl = document.getElementById('text-input-el');
const guide = document.getElementById('canvas-overlay');
const dropZone = document.getElementById('canvas-wrap');
const dropOverlay = document.getElementById('drop-overlay');

let herramienta = 'select';
let objetos = {};
let selId = null;
let pintando = false;
let lastX = 0;
let lastY = 0;
let dragging = false;
let resizing = false;
let dragOffX = 0;
let dragOffY = 0;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartW = 0;
let resizeStartH = 0;
let resizeStartOX = 0;
let resizeStartOY = 0;
let textPos = null;
let toastTimer;

let trazoActualLineas = [];
let trazoMinX = Infinity;
let trazoMinY = Infinity;
let trazoMaxX = -Infinity;
let trazoMaxY = -Infinity;

let historialUndo = [];
const MAX_PASOS_HISTORIAL = 30;

function canvasScale() {
  return canvas.getBoundingClientRect().width / OVERLAY_W;
}

function toOverlay(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const s = canvasScale();
  return { x: (clientX - r.left) / s, y: (clientY - r.top) / s };
}

function fitCanvas() {
  const maxW = wrap.clientWidth - 32;
  const maxH = wrap.clientHeight - 32;
  const scale = Math.min(maxW / OVERLAY_W, maxH / OVERLAY_H);

  canvas.width = OVERLAY_W;
  canvas.height = OVERLAY_H;
  canvas.style.width = (OVERLAY_W * scale) + 'px';
  canvas.style.height = (OVERLAY_H * scale) + 'px';

  if (!guide.getAttribute('src') || guide.style.display === 'none') {
    guide.style.display = 'none';
    guide.src = '';
    const btnNone = document.getElementById('guide-none');
    if (btnNone) btnNone.classList.add('activo');
  } else {
    guide.style.width = canvas.style.width;
    guide.style.height = canvas.style.height;
  }

  redraw();
}
