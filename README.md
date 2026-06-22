# ⚡ DrawCast DannDato
> **Sistema Profesional Modular de Overlay Interactivo en Tiempo Real para OBS Studio.**

DrawCast es una infraestructura web modular basada en **Node.js, Express y WebSockets (Socket.io)** que permite a un streamer o sus moderadores pintar, inyectar textos, arrastrar imágenes/GIFs y controlar capas en tiempo real directamente sobre una fuente de navegador de OBS Studio.

---

## 🗺️ ¿Cómo funciona? (Flujo de Arquitectura)

El sistema funciona separando estrictamente las responsabilidades en dos entornos independientes mediante un modelo de comunicación síncrono:

1. **El Panel de Control (`/control.html`):** Una interfaz web operativa y táctil, protegida por contraseña, donde el usuario edita el lienzo, dibuja, agrupa elementos y gestiona el contenido.
2. **El Overlay de Transmisión (`/overlay.html`):** Una ruta web completamente limpia, líquida y transparente. **No contiene botones, menús ni controles**. Está optimizada para ser incrustada directamente en **OBS Studio** como una fuente de navegador a 60 FPS fijos.

Cada que el usuario hace un trazo o mueve un objeto en el panel, los **WebSockets** envían las coordenadas deltas al servidor, y este las replica milisegundo a milisegundo al OBS.

---

## 📂 Estructura Modular del Proyecto

La arquitectura del sistema aísla la lógica del disco, enrutamiento, flujos de tiempo real y seguridad para máxima mantenibilidad:

```text
.
├── config/
│   └── multer.js           # Motor y límites estrictos de subidas de imágenes
├── middlewares/
│   └── authenticate.js     # Guardián de seguridad perimetral (Control de sesiones)
├── public/
│   ├── img/                # Recursos gráficos fijos (Canva Guides base)
│   ├── style/
│   │   └── main.css        # Estilos globales unificados del ecosistema
│   ├── control.html        # Panel de operaciones del streamer con canvas avanzado
│   ├── login.html          # Interfaz de acceso seguro al panel
│   └── overlay.html        # Lienzo líquido transparente de salida para OBS
├── routes/
│   └── routes.js           # Enrutador centralizado de recursos estáticos y APIs
├── sockets/
│   └── sockets.js          # Core de WebSockets (Flujo síncrono y FS cleaner automático)
├── uploads/                # Directorio volátil y autolimpiable de imágenes en vivo
├── package.json            # Manifiesto de dependencias core
└── server.js               # Inicializador y punto de entrada principal