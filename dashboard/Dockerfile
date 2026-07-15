# ============================================================
# Jaguar Carwash — Dashboard estático servido con nginx
# Sin build: HTML + CSS + JS vanilla se copian tal cual.
# ============================================================

# Versión pineada (no `nginx:alpine` flotante): builds reproducibles y CVEs
# escaneables contra una versión conocida.
FROM nginx:1.27-alpine

# Configuración con cabeceras de seguridad y gzip
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Archivos estáticos del dashboard
COPY index.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/
COPY img/ /usr/share/nginx/html/img/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/salud || exit 1
