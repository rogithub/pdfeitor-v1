# Dockerfile

# 1. ETAPA BASE: Usar una imagen oficial de Node.js para ARM64.
# La etiqueta 'alpine' es ligera, y la etiqueta 'arm64' asegura la arquitectura correcta.
FROM node:23-alpine3.19 AS base

# 2. Argumento para la arquitectura (utilizado por Sharp)
# Aunque ya usamos la base ARM64, esto ayuda a la consistencia.
ARG TARGETPLATFORM=linux/arm64

# 3. Directorio de trabajo
WORKDIR /app

# 4. Copiar los archivos de configuración de dependencias
# Se copian primero para aprovechar el caché de Docker si solo cambia el código.
COPY package*.json ./

# 5. Instalar dependencias
# - Se instala 'build-base' (herramientas de compilación en Alpine) temporalmente.
# - Se añade 'vips-dev' que es requerido por la librería 'sharp'.
# - Se usa --omit=dev para no instalar dependencias de desarrollo.
RUN apk add --no-cache python3 g++ make vips-dev \
    && npm install --omit=dev \
    && apk del python3 g++ make

# 6. Copiar el código fuente de la aplicación
# Copiamos todo el proyecto, incluyendo server.js y la carpeta public.
COPY . .

# 7. Exponer el puerto
# El servidor Express usa el puerto 3000 (definido en server.js).
EXPOSE 3000

# 8. Comando de ejecución
# Especifica el comando que arranca la aplicación.
CMD ["node", "server.js"]