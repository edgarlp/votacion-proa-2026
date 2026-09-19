# Votación Día del Estudiante 2026

La votación cierra automáticamente el lunes 21/09/2026 a las 15:00 (Argentina). El proyecto incluye cuenta regresiva, ganadores finales, logo institucional e informe PDF para autoridades.

Al publicar esta versión, además de subir el proyecto a Netlify, copiá el contenido de `firestore.rules` en Firebase > Firestore > Reglas y presioná **Publicar**. Esta regla impide votos posteriores al cierre desde el servidor.

Sistema de votación para la Escuela PROA La Para. Está creado con HTML, CSS y JavaScript y se abre con Visual Studio Code.

## Qué incluye

- Cursos: 1.º, 2.º A, 2.º B, 3.º A, 3.º B, 4.º, 5.º y 6.º.
- Tres categorías obligatorias.
- Registro e inicio de sesión docente con correo y contraseña.
- Un voto por cuenta docente.
- Resultados visibles para el docente después de votar.
- Resultados y ganadores en vivo.
- Panel de autoridades protegido con correo y contraseña.
- Diseño para celular y computadora.
- Modo demostración local si Firebase todavía no está configurado.

## 1. Probarlo en Visual Studio Code

1. Descomprimir la carpeta.
2. Abrir la carpeta `votacion-dia-estudiante` en Visual Studio Code.
3. Instalar la extensión **Live Server**.
4. Hacer clic derecho sobre `index.html` y elegir **Open with Live Server**.
5. Mientras Firebase no esté configurado aparecerá “Modo demostración”. Los votos de prueba se guardan solamente en ese navegador.

## 2. Crear la base de datos gratuita

1. Entrar en https://console.firebase.google.com/ con una cuenta de Google.
2. Seleccionar **Crear un proyecto** y ponerle `votacion-proa-la-para`.
3. Se puede desactivar Google Analytics para simplificar.
4. Dentro del proyecto, ingresar a **Compilación > Firestore Database**.
5. Pulsar **Crear base de datos**, elegir una ubicación cercana y comenzar en modo producción.
6. Abrir la pestaña **Reglas** de Firestore.
7. Borrar las reglas existentes, copiar todo el contenido de `firestore.rules` y pulsar **Publicar**.

## 3. Conectar la página con Firebase

1. En Firebase abrir **Configuración del proyecto** (rueda dentada).
2. Bajar hasta **Tus apps** y elegir el icono Web `</>`.
3. Escribir `Votacion PROA` y registrar la aplicación. No es necesario activar Firebase Hosting.
4. Firebase mostrará un bloque llamado `firebaseConfig`.
5. Abrir `config.js` en Visual Studio Code y reemplazar los valores `PEGAR_...` por los valores entregados por Firebase. Conservar las comillas.
6. Guardar y volver a probar con Live Server. Ya no debe aparecer “Modo demostración”.

## 4. Publicarlo gratuitamente en Netlify

1. Entrar en https://app.netlify.com/drop e iniciar sesión.
2. Arrastrar la carpeta completa `votacion-dia-estudiante` al recuadro de publicación.
3. Esperar a que Netlify muestre el enlace terminado en `.netlify.app`.
4. Abrir el enlace desde otro celular y realizar un voto de prueba.
5. Compartir ese enlace con los profesores.

## Prueba recomendada antes del evento

- Votar desde dos celulares con nombres distintos.
- Intentar votar nuevamente con el mismo nombre: debe rechazarlo.
- Confirmar que las tres categorías sean obligatorias.
- Verificar que los resultados coincidan.

## Ver los resultados en cualquier momento

Abrí este enlace en cualquier navegador:

https://votacion-proa-la-para-2026.netlify.app/?resultados=proa2026

Guardalo en tus favoritos. El enlace abre el acceso privado para autoridades. Después de ingresar con correo y contraseña muestra los resultados finales y la lista alfabética de docentes que ya votaron.

## Configurar el acceso de autoridades

1. En Firebase abrir **Compilación > Authentication**.
2. Pulsar **Comenzar**.
3. En **Método de acceso**, habilitar **Correo electrónico/contraseña**.
4. Entrar en **Usuarios** y pulsar **Agregar usuario**.
5. Escribir el correo y la contraseña que utilizarán las autoridades.
6. Ir a **Firestore Database > Reglas**.
7. Reemplazar las reglas por el contenido actualizado de `firestore.rules` y pulsar **Publicar**.

La página pública permite registrar votos, pero solamente una cuenta creada en Firebase Authentication puede consultar resultados y nombres.

## Importante

La repetición se controla usando el nombre y apellido normalizados. Por ejemplo, `Débora Cavallo` y `debora cavallo` se consideran la misma persona. Si dos profesores tienen exactamente el mismo nombre, será necesario agregarles una identificación distinta, como la inicial del segundo nombre.
