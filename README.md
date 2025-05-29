# Browser FPS Game

This repository contains a small browser-based FPS demo that uses Three.js.

The game features simple movement, jumping and a basic gun. Firing the gun
plays a short shot sound and spawns a small yellow bullet. Bullets stop when
they hit walls, the ceiling or the floor. A green sphere enemy roams the level
chasing the player. If it touches you, the game restarts.

## Running the game

Modern browsers block module imports when opening HTML files via the `file://` protocol.
To avoid CORS errors, serve the project through a local web server.

You can use the included Node server:

```bash
node server.js
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

Alternatively, any static HTTP server works, for example:

```bash
python3 -m http.server
```
