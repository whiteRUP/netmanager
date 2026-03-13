# React is built by GitHub Actions on the runner.
# This Dockerfile only copies the pre-built dist/ into nginx.
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
