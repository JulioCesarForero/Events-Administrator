# Guía de Inicialización: Proyecto React con Vite

A continuación se detallan los pasos exactos para inicializar por primera vez un proyecto de React (versión TypeScript) utilizando Vite, especialmente configurado considerando tu entorno de desarrollo (**Node.js v22.17.0** y **npm v11.6.1**).

---

## 1. Crear el proyecto base

Abre tu terminal y ubícate en la raíz del espacio de trabajo (por ejemplo `c:\ProyectosIA\Events-Administrator`).

Puesto que estás utilizando **npm v11** (o cualquier versión a partir de la v7), es un requerimiento estricto pasar el operador `--` antes de especificar qué plantilla (`template`) deseas usar.

Para crear o sobrescribir el proyecto en la carpeta `frontend`, ejecuta:

```bash
npm create vite@latest frontend -- --template react-ts
```

*Nota: Al correr este comando, Vite estructurará o reemplazará los archivos de la carpeta `frontend` (como el `README.md` o el `package.json`) con la plantilla oficial.*

## 2. Instalar las dependencias

Una vez que el comando anterior finalice y genere tu esqueleto de proyecto, debes navegar dentro de la carpeta y correr la instalación de paquetes. Vite no lo hace por ti de manera automática.

```bash
cd frontend
npm install
```

## 3. Iniciar el servidor local

Para confirmar que todo fue exitoso, inicializa el servidor en modo desarrollo:

```bash
npm run dev
```

Esto desplegará en la consola una dirección (típicamente `http://localhost:5173/`) a la cual puedes entrar desde tu navegador para ver la página inicial por defecto de Vite y React.

---

## 4. (Opcional) Añadir Tailwind CSS

Si deseas agregar Tailwind CSS a tu nuevo proyecto, este es el momento oportuno. Siguiendo en la carpeta `frontend`, ejecuta:

```bash
npm install -D tailwindcss @tailwindcss/vite
```
*(Consulta la documentación oficial de Tailwind para configurarlo en tu archivo `vite.config.ts` y en la hoja de estilos principal).*

---

### Recordatorio sobre el `README.md`
Cuando corres `npm create vite...`, Vite sobrescribirá tu `README.md` del `frontend` con su archivo descriptivo por defecto. Por eso es importante tener esta guía en su propio archivo (`ReadMeIniReactProject.md`) ajeno al sobreescrito.
