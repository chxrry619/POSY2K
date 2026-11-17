# ChrrysDump – app Android

Punto de venta que funciona **sin internet**. Todo (artículos, imágenes, ventas y ajustes)
se guarda **en el teléfono**.

## Estructura

```
app/src/main/assets/www/     ← LA APP (aquí editas diseño y funciones)
   index.html
   css/estilos.css           ← todo lo visual
   js/config.js              ← ajustes rápidos
   js/app.js                 ← lógica
   js/almacenamiento.js      ← dónde se guardan los datos
   js/utilidades.js
   fonts/                    ← letras pixeladas
app/src/main/java/.../MainActivity.java   ← la "ventana" Android que muestra la app
app/src/main/res/            ← icono (tu logo) y colores de arranque
app/chrrysdump.keystore      ← firma de la app (NO lo borres)
app/build.gradle             ← versión de la app (versionCode / versionName)
.github/workflows/compilar-apk.yml        ← compila el APK en GitHub
```

## Cómo obtener el APK (opción A: GitHub, sin instalar nada)

1. Crea una cuenta en https://github.com si no tienes.
2. Crea un repositorio nuevo (botón **New**), por ejemplo `chrrysdump`. Puede ser **privado**.
3. En la página del repositorio: **Add file → Upload files** y arrastra **todo el contenido**
   de esta carpeta (incluida la carpeta `.github`). Pulsa **Commit changes**.
   - Si tu computadora oculta la carpeta `.github`, créala a mano:
     **Add file → Create new file**, escribe como nombre
     `.github/workflows/compilar-apk.yml` y pega el contenido de ese archivo.
4. Ve a la pestaña **Actions**. Verás "Compilar APK" trabajando (tarda ~3–5 minutos).
   Si no arranca solo, entra a "Compilar APK" → **Run workflow**.
5. Cuando termine (palomita verde), ve a **Releases** (columna derecha de la página
   principal del repositorio) → **ChrrysDump.apk**. Ábrelo desde tu teléfono
   (con tu sesión de GitHub iniciada) para descargarlo.

Cada vez que subas cambios, se genera un APK nuevo automáticamente.

## Cómo obtener el APK (opción B: Android Studio en tu computadora)

1. Instala Android Studio: https://developer.android.com/studio
2. **File → Open** y elige esta carpeta. Espera a que termine de sincronizar.
3. **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
4. El APK queda en `app/build/outputs/apk/`.

## Instalar en el teléfono

1. Abre el archivo `ChrrysDump.apk` en el teléfono.
2. Si Android lo pide, permite **"Instalar apps desconocidas"** para tu navegador
   o gestor de archivos.
3. Play Protect puede advertir que es una app no conocida: elige **Instalar de todas formas**
   (es normal en apps que no vienen de la Play Store).

## Actualizar la app sin perder datos

1. Haz tus cambios en `app/src/main/assets/www/`.
2. En `app/build.gradle` sube `versionCode` (1 → 2 → 3…) y, si quieres, `versionName`.
3. Genera el APK nuevo e instálalo **encima** (sin desinstalar).
   Como siempre se firma con `chrrysdump.keystore`, tus datos se conservan.

> **Importante: desinstalar la app borra todos los datos** guardados en el teléfono.
> Conserva `chrrysdump.keystore`: si se pierde, las versiones nuevas
> no podrán instalarse encima de la anterior.

## Probar cambios en la computadora (sin compilar)

Abre `app/src/main/assets/www/index.html` en Chrome. Se comporta igual que la app
y guarda los datos en ese navegador.
