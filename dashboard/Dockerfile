# ============================================================
# Jaguar Carwash — Dashboard estático servido con nginx
# Sin build: HTML + CSS + JS vanilla se copian tal cual.
# ============================================================

FROM nginx:alpine

# Configuración con cabeceras de seguridad y gzip
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Archivos estáticos del dashboard
COPY index.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/salud || exit 1
